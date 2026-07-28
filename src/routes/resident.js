const express = require('express');
const mongoose = require('mongoose');
const { Resident, Unit, Facility, FacilityBooking, Payment, Organization, Building, LockerPackage, ResidentNotification, ShopCategory, ShopProduct, ShopOrder, Publication, Service, ServiceProvider, Restaurant, ResidentVisitorRequest, ResidentUtilityAccount, UtilityBill, UtilityPayment, GmailConnection } = require('../models');
const { getLockerSettings } = require('../utils/lockerSettings');
const { getContactSettings } = require('../utils/contactSettings');
const { formatPackage } = require('../utils/lockerPackage');
const { authenticate, requireRoles } = require('../middleware/auth');
const { getBillingSettings, enrichPayment, getUnitAdministrationFee } = require('../utils/billing');
const { getActiveSuspensions, getSuspendedFacilityIds } = require('../utils/suspensions');
const {
  resolveBookingWindow,
  assertBookingAvailable,
  formatBookingEvent,
  getBookingPricing,
  ACTIVE_STATUSES,
} = require('../utils/facilityBooking');

const { matchesShopLocation } = require('../utils/shopFilter');
const { buildOrderNumber, formatShopOrder } = require('../utils/shopOrder');
const { SERVICE_TYPES } = require('../utils/utilityServices');
const {
  formatProvider,
  formatAccount,
  formatBill,
  formatPayment,
  listProvidersForCity,
  linkResidentUtilityAccount,
  markUtilityBillPaid,
  syncOverdueBills,
  getAccountDetail,
} = require('../utils/utilityBilling');
const {
  formatGmailStatus,
  startGmailConnect,
  disconnectGmail,
  syncAirEBillsFromGmail,
  isGmailOAuthConfigured,
} = require('../utils/gmailUtilitySync');

function normalizePlate(plate) {
  return String(plate || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function formatPublication(pub) {
  const imageUrl =
    pub.media?.find((item) => item.type === 'image')?.url ||
    pub.media?.[0]?.thumbnailUrl ||
    pub.media?.[0]?.url ||
    null;

  return {
    id: pub._id,
    title: pub.title,
    body: pub.body,
    imageUrl,
    publishedAt: pub.publishedAt,
    isPinned: pub.isPinned,
  };
}

const router = express.Router();

router.use(authenticate, requireRoles('RESIDENT'));

async function getResidentContext(user) {
  const resident = await Resident.findOne({ userId: user._id }).populate(
    'unitId',
    'number type tower adminStatus buildingId administrationFee'
  );
  if (!resident) throw new Error('Perfil de residente no encontrado');
  return resident;
}

async function assertCanBookFacility(facility, unit, suspendedIds) {
  if (!facility.bookable) throw new Error('Este servicio no acepta reservas en línea');
  if (facility.status !== 'open') throw new Error('El servicio no está disponible');
  if (suspendedIds.has(facility._id.toString())) {
    throw new Error('No puedes reservar: servicio suspendido por morosidad');
  }
  if (unit.adminStatus === 'overdue' && facility.blockWhenOverdue && suspendedIds.has(facility._id.toString())) {
    throw new Error('No puedes reservar mientras haya mora pendiente');
  }
}

router.get('/home', async (req, res) => {
  try {
    const resident = await getResidentContext(req.user);
    const [org, building] = await Promise.all([
      Organization.findById(resident.organizationId).select('name email phone settings.contacts'),
      Building.findById(resident.unitId.buildingId).select(
        'name slug address heroImageUrl description'
      ),
    ]);

    const [lockerPackages, unreadNotifications, pendingVisitors] = await Promise.all([
      LockerPackage.countDocuments({
        unitId: resident.unitId._id,
        status: { $in: ['pending_pickup', 'held'] },
      }),
      ResidentNotification.countDocuments({
        userId: req.user._id,
        organizationId: resident.organizationId,
        read: false,
      }),
      ResidentVisitorRequest.countDocuments({
        residentId: resident._id,
        status: 'pending',
      }),
    ]);

    res.json({
      user: {
        firstName: req.user.firstName,
        lastName: req.user.lastName,
      },
      unit: {
        number: resident.unitId.number,
        tower: resident.unitId.tower,
        adminStatus: resident.unitId.adminStatus,
      },
      building: building
        ? {
            id: building._id,
            name: building.name,
            slug: building.slug,
            address: building.address,
            heroImageUrl: building.heroImageUrl,
            description: building.description,
          }
        : null,
      organization: org
        ? {
            name: org.name,
            email: org.email,
            phone: org.phone,
            contacts: getContactSettings(org),
          }
        : null,
      counts: {
        lockerPackages,
        unreadNotifications,
        pendingVisitors,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/publications', async (req, res) => {
  try {
    const resident = await getResidentContext(req.user);
    const now = new Date();

    const publications = await Publication.find({
      organizationId: resident.organizationId,
      isActive: { $ne: false },
      $and: [
        { $or: [{ buildingId: resident.unitId.buildingId }, { buildingId: null }] },
        { $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }] },
      ],
    })
      .sort({ isPinned: -1, publishedAt: -1 })
      .limit(20);

    res.json({ publications: publications.map(formatPublication) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/providers', async (req, res) => {
  try {
    const resident = await getResidentContext(req.user);
    const unit = resident.unitId;

    const services = await Service.find({
      organizationId: resident.organizationId,
      isActive: true,
      $or: [{ buildingId: unit.buildingId }, { buildingId: null }],
    })
      .populate({
        path: 'providerId',
        match: { approvalStatus: 'approved', isActive: true },
        select: 'businessName description rating reviewCount categoryIds offerings',
        populate: { path: 'categoryIds', select: 'name slug icon' },
      })
      .populate('categoryId', 'name slug icon description')
      .sort({ sortOrder: 1, title: 1 });

    const visible = services.filter((service) => service.providerId);

    res.json({
      providers: visible.map((service) => ({
        id: service._id,
        title: service.title,
        description: service.description,
        icon: service.icon || service.categoryId?.icon,
        priceFrom: service.priceFrom,
        currency: service.currency,
        category: service.categoryId,
        provider: {
          id: service.providerId._id,
          businessName: service.providerId.businessName,
          description: service.providerId.description,
          rating: service.providerId.rating,
          reviewCount: service.providerId.reviewCount,
          categories: service.providerId.categoryIds,
          offerings: service.providerId.offerings,
        },
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/restaurants', async (req, res) => {
  try {
    const resident = await getResidentContext(req.user);
    const building = await Building.findById(resident.unitId.buildingId).select(
      'address.city address.country'
    );
    const location = {
      city: building?.address?.city,
      country: building?.address?.country || 'Colombia',
    };

    const restaurants = await Restaurant.find({ isActive: true }).sort({
      isFeatured: -1,
      sortOrder: 1,
      name: 1,
    });

    const visible = restaurants.filter((restaurant) => {
      const cities = restaurant.targetCities || [];
      const countries = restaurant.targetCountries || [];
      if (!cities.length && !countries.length) return true;
      const cityOk = !cities.length || cities.includes(location.city);
      const countryOk = !countries.length || countries.includes(location.country);
      return cityOk && countryOk;
    });

    res.json({
      location,
      restaurants: visible.map((restaurant) => ({
        id: restaurant._id,
        name: restaurant.name,
        slug: restaurant.slug,
        shortDescription: restaurant.shortDescription,
        cuisineType: restaurant.cuisineType,
        coverImageUrl: restaurant.coverImage?.url,
        logoImageUrl: restaurant.logoImage?.url,
        openingHours: restaurant.openingHours,
        deliveryFee: restaurant.deliveryFee,
        minOrderAmount: restaurant.minOrderAmount,
        avgPrepMinutes: restaurant.avgPrepMinutes,
        isFeatured: restaurant.isFeatured,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/visitor-requests', async (req, res) => {
  try {
    const resident = await getResidentContext(req.user);
    const { visitorName, licensePlate, expectedAt, notes } = req.body;
    const plate = normalizePlate(licensePlate);

    if (!plate) return res.status(400).json({ error: 'Indica la placa del visitante' });

    const request = await ResidentVisitorRequest.create({
      organizationId: resident.organizationId,
      buildingId: resident.unitId.buildingId,
      unitId: resident.unitId._id,
      residentId: resident._id,
      visitorName: visitorName?.trim(),
      licensePlate: plate,
      expectedAt: expectedAt ? new Date(expectedAt) : undefined,
      notes: notes?.trim(),
    });

    res.status(201).json({ request });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/billing', async (req, res) => {
  try {
    const resident = await getResidentContext(req.user);
    const org = await Organization.findById(resident.organizationId);
    const billingSettings = getBillingSettings(org);

    const payments = await Payment.find({ unitId: resident.unitId })
      .populate('facilityId', 'name')
      .sort({ dueDate: -1 })
      .limit(24);

    const enriched = payments.map((p) => enrichPayment(p, billingSettings));
    const totalDue = enriched.reduce((sum, p) => sum + (p.totalDue || 0), 0);
    const totalInterest = enriched.reduce((sum, p) => sum + (p.interestAmount || 0), 0);

    res.json({
      unit: resident.unitId,
      billingSettings,
      monthlyAdministrationFee: getUnitAdministrationFee(resident.unitId, billingSettings),
      summary: {
        totalDue,
        totalInterest,
        isOverdue: resident.unitId?.adminStatus === 'overdue',
      },
      payments: enriched,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/services', async (req, res) => {
  try {
    const resident = await getResidentContext(req.user);
    const unit = resident.unitId;

    const facilities = await Facility.find({
      buildingId: unit.buildingId,
      isActive: true,
    }).sort({ name: 1 });

    const suspendedIds = await getSuspendedFacilityIds(unit._id);
    const suspensions = await getActiveSuspensions(unit._id);

    const services = facilities.map((f) => {
      const isSuspended = suspendedIds.has(f._id.toString());
      const blockedByOverdue = unit.adminStatus === 'overdue' && f.blockWhenOverdue && isSuspended;
      const pricing = getBookingPricing(f);

      return {
        id: f._id,
        name: f.name,
        slug: f.slug,
        description: f.description,
        price: f.price,
        currency: f.currency,
        pricingType: f.pricingType,
        bookable: f.bookable,
        bookingPricing: pricing,
        bookingRules: f.bookingRules,
        openHours: f.openHours,
        requiresApproval: f.requiresApproval,
        status: f.status,
        available: !isSuspended && f.status === 'open',
        blocked: isSuspended,
        blockReason: isSuspended ? 'suspension' : f.status !== 'open' ? f.status : null,
        blockedByOverdue,
      };
    });

    res.json({
      unit: { number: unit.number, adminStatus: unit.adminStatus },
      suspensions,
      services,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/facility-bookings', async (req, res) => {
  try {
    const resident = await getResidentContext(req.user);
    const unit = resident.unitId;
    const { from, to, facilityId } = req.query;

    if (!from || !to || !facilityId || !mongoose.Types.ObjectId.isValid(facilityId)) {
      return res.status(400).json({ error: 'Indica from, to y un facilityId válido' });
    }

    const facility = await Facility.findOne({
      _id: facilityId,
      buildingId: unit.buildingId,
      bookable: true,
      isActive: true,
    });
    if (!facility) return res.status(404).json({ error: 'Servicio no encontrado' });

    const fromDate = new Date(from);
    const toDate = new Date(to);

    const bookings = await FacilityBooking.find({
      facilityId: facility._id,
      status: { $in: ACTIVE_STATUSES },
      startAt: { $lt: toDate },
      endAt: { $gt: fromDate },
    })
      .populate({ path: 'residentId', populate: { path: 'userId', select: 'firstName lastName' } })
      .populate('unitId', 'number type')
      .sort({ startAt: 1 });

    res.json({
      facility: {
        id: facility._id,
        name: facility.name,
        openHours: facility.openHours,
        bookingPricing: getBookingPricing(facility),
        bookingRules: facility.bookingRules,
        requiresApproval: facility.requiresApproval,
      },
      bookings: bookings.map((b) => {
        const isOwn = b.residentId?._id?.toString() === resident._id.toString();
        return {
          ...formatBookingEvent(b, { showResidentDetails: isOwn }),
          isOwn,
        };
      }),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/my-bookings', async (req, res) => {
  try {
    const resident = await getResidentContext(req.user);
    const bookings = await FacilityBooking.find({
      residentId: resident._id,
      status: { $in: ACTIVE_STATUSES },
      endAt: { $gte: new Date() },
    })
      .populate('facilityId', 'name slug')
      .sort({ startAt: 1 })
      .limit(20);

    res.json({
      bookings: bookings.map((b) => ({
        id: b._id,
        startAt: b.startAt,
        endAt: b.endAt,
        status: b.status,
        totalPrice: b.totalPrice,
        title: b.facilityId?.name || 'Reserva',
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/facility-bookings', async (req, res) => {
  try {
    const resident = await getResidentContext(req.user);
    const unit = resident.unitId;
    const { facilityId, startAt, endAt, blockIndex, notes } = req.body;

    const facility = await Facility.findOne({
      _id: facilityId,
      buildingId: unit.buildingId,
      bookable: true,
      isActive: true,
    });
    if (!facility) return res.status(404).json({ error: 'Servicio no encontrado' });

    const suspendedIds = await getSuspendedFacilityIds(unit._id);
    await assertCanBookFacility(facility, unit, suspendedIds);

    const { start, end, durationMinutes, priceInfo } = resolveBookingWindow(
      facility,
      startAt,
      endAt,
      blockIndex
    );
    await assertBookingAvailable(facility._id, start, end);

    const booking = await FacilityBooking.create({
      organizationId: resident.organizationId,
      buildingId: unit.buildingId,
      facilityId: facility._id,
      residentId: resident._id,
      unitId: unit._id,
      createdByUserId: req.user._id,
      startAt: start,
      endAt: end,
      durationMinutes,
      totalPrice: priceInfo.totalPrice,
      currency: facility.currency || 'COP',
      pricingMode: priceInfo.pricingMode,
      pricingLabel: priceInfo.blockLabel,
      notes,
      status: facility.requiresApproval ? 'pending' : 'confirmed',
    });

    await booking.populate([
      { path: 'facilityId', select: 'name slug' },
      { path: 'unitId', select: 'number' },
      { path: 'residentId', populate: { path: 'userId', select: 'firstName lastName' } },
    ]);

    res.status(201).json({ booking: formatBookingEvent(booking, { showResidentDetails: true }) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/facility-bookings/:id', async (req, res) => {
  try {
    const resident = await getResidentContext(req.user);
    const booking = await FacilityBooking.findOne({
      _id: req.params.id,
      residentId: resident._id,
      status: { $in: ACTIVE_STATUSES },
    });
    if (!booking) return res.status(404).json({ error: 'Reserva no encontrada' });

    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.cancelReason = 'Cancelada por el residente';
    await booking.save();

    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/notifications', async (req, res) => {
  try {
    const resident = await getResidentContext(req.user);
    const notifications = await ResidentNotification.find({
      userId: req.user._id,
      organizationId: resident.organizationId,
    })
      .sort({ createdAt: -1 })
      .limit(40);

    const unreadCount = notifications.filter((n) => !n.read).length;

    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/notifications/:id/read', async (req, res) => {
  try {
    const resident = await getResidentContext(req.user);
    const notification = await ResidentNotification.findOne({
      _id: req.params.id,
      userId: req.user._id,
      organizationId: resident.organizationId,
    });
    if (!notification) return res.status(404).json({ error: 'Notificación no encontrada' });

    notification.read = true;
    notification.readAt = new Date();
    await notification.save();

    res.json({ notification });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/locker-packages', async (req, res) => {
  try {
    const resident = await getResidentContext(req.user);
    const org = await Organization.findById(resident.organizationId);
    const settings = getLockerSettings(org);

    if (!settings.enabled) {
      return res.json({ enabled: false, packages: [] });
    }

    const packages = await LockerPackage.find({
      unitId: resident.unitId._id,
      organizationId: resident.organizationId,
      status: { $in: ['pending_pickup', 'held'] },
    })
      .populate('registeredBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({
      enabled: true,
      packages: packages.map(formatPackage),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/shop', async (req, res) => {
  try {
    const resident = await getResidentContext(req.user);
    const building = await Building.findById(resident.unitId.buildingId).select(
      'address.city address.country name'
    );

    const location = {
      city: building?.address?.city,
      country: building?.address?.country,
    };

    const [categories, products] = await Promise.all([
      ShopCategory.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }),
      ShopProduct.find({ isActive: true })
        .populate('categoryId', 'name slug icon')
        .sort({ isFeatured: -1, sortOrder: 1, name: 1 }),
    ]);

    const visibleProducts = products.filter((product) => matchesShopLocation(product, location));

    res.json({
      location,
      categories: categories.filter((category) =>
        visibleProducts.some(
          (product) => String(product.categoryId?._id || product.categoryId) === String(category._id)
        )
      ),
      products: visibleProducts,
      featured: visibleProducts.filter((product) => product.isFeatured),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/shop/orders', async (req, res) => {
  try {
    const resident = await getResidentContext(req.user);
    const orders = await ShopOrder.find({ residentId: resident._id })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ orders: orders.map(formatShopOrder) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/shop/orders', async (req, res) => {
  try {
    const resident = await getResidentContext(req.user);
    const { items, notes } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Agrega al menos un producto al pedido' });
    }

    const [building, unit] = await Promise.all([
      Building.findById(resident.unitId.buildingId).select('name address.city address.country'),
      Unit.findById(resident.unitId._id || resident.unitId).select('number tower'),
    ]);

    const location = {
      city: building?.address?.city,
      country: building?.address?.country,
    };

    const productIds = items.map((item) => item.productId);
    const products = await ShopProduct.find({
      _id: { $in: productIds },
      isActive: true,
    });

    const productMap = new Map(products.map((product) => [String(product._id), product]));
    const orderItems = [];
    let subtotal = 0;
    let currency = null;

    for (const item of items) {
      const quantity = Number(item.quantity);
      if (!item.productId || !Number.isFinite(quantity) || quantity < 1) {
        return res.status(400).json({ error: 'Cantidad inválida en uno de los productos' });
      }

      const product = productMap.get(String(item.productId));
      if (!product) {
        return res.status(400).json({ error: 'Uno de los productos ya no está disponible' });
      }
      if (!matchesShopLocation(product, location)) {
        return res.status(400).json({ error: `${product.name} no está disponible en tu ciudad` });
      }
      if (product.stock === 0) {
        return res.status(400).json({ error: `${product.name} está agotado` });
      }
      if (product.stock != null && quantity > product.stock) {
        return res.status(400).json({ error: `Stock insuficiente para ${product.name}` });
      }

      const itemCurrency = product.currency || 'COP';
      if (!currency) currency = itemCurrency;
      if (currency !== itemCurrency) {
        return res.status(400).json({ error: 'No puedes mezclar productos con distinta moneda en un pedido' });
      }

      const lineTotal = product.price * quantity;
      subtotal += lineTotal;
      orderItems.push({
        productId: product._id,
        name: product.name,
        sku: product.sku,
        imageUrl: product.images?.[0]?.url,
        quantity,
        unitPrice: product.price,
        lineTotal,
        currency: itemCurrency,
      });
    }

    for (const item of orderItems) {
      const product = productMap.get(String(item.productId));
      if (product.stock != null) {
        await ShopProduct.findByIdAndUpdate(product._id, { $inc: { stock: -item.quantity } });
      }
    }

    const order = await ShopOrder.create({
      orderNumber: buildOrderNumber(),
      residentId: resident._id,
      userId: req.user._id,
      organizationId: resident.organizationId,
      buildingId: resident.unitId.buildingId,
      unitId: resident.unitId._id || resident.unitId,
      customerName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
      customerEmail: req.user.email,
      customerPhone: req.user.phone,
      buildingName: building?.name,
      unitNumber: unit?.number,
      unitTower: unit?.tower,
      city: location.city,
      country: location.country,
      items: orderItems,
      subtotal,
      currency,
      notes: notes?.trim() || undefined,
      status: 'pending',
    });

    res.status(201).json({ order: formatShopOrder(order) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// —— Servicios públicos (utilities) ——
router.get('/utilities/overview', async (req, res) => {
  try {
    const resident = await getResidentContext(req.user);
    await syncOverdueBills({ residentId: resident._id });

    const building = await Building.findById(resident.unitId.buildingId).select('name address');
    const city = building?.address?.city || '';

    const [accounts, bills, payments] = await Promise.all([
      ResidentUtilityAccount.find({
        residentId: resident._id,
        isActive: true,
      }).populate('providerId'),
      UtilityBill.find({ residentId: resident._id })
        .populate('providerId')
        .sort({ dueDate: 1, createdAt: -1 }),
      UtilityPayment.find({ residentId: resident._id })
        .populate('providerId')
        .sort({ paidAt: -1 })
        .limit(30),
    ]);

    const pendingBills = bills.filter((b) => ['pending', 'overdue'].includes(b.status));

    res.json({
      city,
      serviceTypes: SERVICE_TYPES,
      accounts: accounts.map((account) => formatAccount(account, { bills })),
      pendingBills: pendingBills.map(formatBill),
      payments: payments.map(formatPayment),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/utilities/providers', async (req, res) => {
  try {
    const resident = await getResidentContext(req.user);
    const building = await Building.findById(resident.unitId.buildingId).select('address.city');
    const city = building?.address?.city;
    if (!city) {
      return res.status(400).json({ error: 'Tu conjunto no tiene ciudad configurada' });
    }

    const providers = await listProvidersForCity(city, {
      serviceType: req.query.serviceType,
    });

    res.json({
      city,
      serviceType: req.query.serviceType || null,
      providers: providers.map(formatProvider),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/utilities/accounts', async (req, res) => {
  try {
    const resident = await getResidentContext(req.user);
    const [organization, building] = await Promise.all([
      Organization.findById(resident.organizationId),
      Building.findById(resident.unitId.buildingId),
    ]);
    if (!organization || !building) {
      return res.status(404).json({ error: 'Conjunto no encontrado' });
    }

    const account = await linkResidentUtilityAccount(req.body, {
      resident,
      user: req.user,
      organization,
      building,
    });

    res.status(201).json({ account });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/utilities/accounts/:id', async (req, res) => {
  try {
    const resident = await getResidentContext(req.user);
    const account = await ResidentUtilityAccount.findOne({
      _id: req.params.id,
      residentId: resident._id,
    });
    if (!account) return res.status(404).json({ error: 'Cuenta no encontrada' });
    account.isActive = false;
    await account.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/utilities/accounts/:id', async (req, res) => {
  try {
    const resident = await getResidentContext(req.user);
    const detail = await getAccountDetail(req.params.id, resident);
    res.json(detail);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.post('/utilities/accounts/:id/open-portal', async (req, res) => {
  try {
    const resident = await getResidentContext(req.user);
    const detail = await getAccountDetail(req.params.id, resident);
    const paymentUrl = detail.lookup.paymentUrl;
    if (!paymentUrl) {
      return res.status(400).json({ error: 'Este proveedor no tiene portal de pagos configurado' });
    }
    res.json({
      paymentUrl,
      accountCode: detail.account.accountCode,
      accountCodeLabel: detail.account.accountCodeType || detail.lookup.accountCodeLabel,
      message: detail.lookup.message,
      canAutoFetch: detail.lookup.canAutoFetch,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/utilities/bills', async (req, res) => {
  try {
    const resident = await getResidentContext(req.user);
    const filter = { residentId: resident._id };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.serviceType) filter.serviceType = req.query.serviceType;

    const bills = await UtilityBill.find(filter)
      .populate('providerId')
      .sort({ dueDate: -1, createdAt: -1 })
      .limit(50);

    res.json({ bills: bills.map(formatBill) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/utilities/bills/:id/open-payment', async (req, res) => {
  try {
    const resident = await getResidentContext(req.user);
    const bill = await UtilityBill.findOne({
      _id: req.params.id,
      residentId: resident._id,
    }).populate('providerId');
    if (!bill) return res.status(404).json({ error: 'Factura no encontrada' });

    const paymentUrl =
      bill.providerId?.paymentUrl || bill.paymentUrl || bill.providerId?.websiteUrl;
    if (!paymentUrl) {
      return res.status(400).json({ error: 'Este proveedor aún no tiene página de pago configurada' });
    }

    if (bill.paymentUrl !== paymentUrl) {
      bill.paymentUrl = paymentUrl;
      await bill.save();
    }

    res.json({
      bill: formatBill(bill),
      paymentUrl,
      note:
        'Serás redirigido al portal del proveedor. Cuando pagues, marca la factura como pagada o espera confirmación automática si el proveedor tiene webhook.',
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/utilities/bills/:id/mark-paid', async (req, res) => {
  try {
    const resident = await getResidentContext(req.user);
    const bill = await markUtilityBillPaid(req.params.id, { resident, user: req.user }, {
      source: 'manual',
      notes: req.body.notes,
    });
    res.json({ bill });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/utilities/payments', async (req, res) => {
  try {
    const resident = await getResidentContext(req.user);
    const filter = { residentId: resident._id };
    if (req.query.serviceType) filter.serviceType = req.query.serviceType;

    const payments = await UtilityPayment.find(filter)
      .populate('providerId')
      .sort({ paidAt: -1 })
      .limit(100);

    res.json({ payments: payments.map(formatPayment) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/utilities/gmail', async (req, res) => {
  try {
    await getResidentContext(req.user);
    const connection = await GmailConnection.findOne({
      userId: req.user._id,
      isActive: true,
    });
    res.json({
      gmail: formatGmailStatus(connection),
      configured: isGmailOAuthConfigured(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/utilities/gmail/connect', async (req, res) => {
  try {
    const resident = await getResidentContext(req.user);
    const result = await startGmailConnect({ user: req.user, resident });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/utilities/gmail/sync', async (req, res) => {
  try {
    const resident = await getResidentContext(req.user);
    const force = Boolean(req.body?.force);
    const result = await syncAirEBillsFromGmail({ user: req.user, resident, force });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/utilities/gmail', async (req, res) => {
  try {
    await getResidentContext(req.user);
    await disconnectGmail(req.user._id);
    res.json({ ok: true, gmail: formatGmailStatus(null) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
