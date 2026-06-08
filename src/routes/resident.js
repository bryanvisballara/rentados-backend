const express = require('express');
const mongoose = require('mongoose');
const { Resident, Unit, Facility, FacilityBooking, Payment, Organization, Building, LockerPackage, ResidentNotification, ShopCategory, ShopProduct, ShopOrder } = require('../models');
const { getLockerSettings } = require('../utils/lockerSettings');
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

module.exports = router;
