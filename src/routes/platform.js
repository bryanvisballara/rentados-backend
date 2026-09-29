const express = require('express');
const bcrypt = require('bcryptjs');
const {
  Organization,
  Building,
  User,
  Tower,
  Unit,
  ServiceCategory,
  PlatformHomeService,
  PlatformHomeServiceMember,
  PlatformPublication,
  ShopCategory,
  ShopProduct,
  ShopOrder,
  Restaurant,
  RestaurantMenuCategory,
  RestaurantMenuItem,
  RestaurantOrder,
  UtilityProvider,
  ResidentUtilityAccount,
} = require('../models');
const { authenticate, requireSuperAdmin, formatAuthUser } = require('../middleware/auth');
const { slugify } = require('../utils/tenantContext');
const { SERVICE_TYPES, SERVICE_TYPE_KEYS, normalizeCity } = require('../utils/utilityServices');
const {
  formatProvider,
  createUtilityBill,
} = require('../utils/utilityBilling');
const { getPlatformDashboardStats } = require('../utils/platformDashboard');
const { uploadPublicationMedia } = require('../middleware/uploadPublication');
const {
  uploadPlatformHomeServiceImage,
  uploadPlatformHomeServiceMemberMedia,
} = require('../utils/publicationMedia');
const {
  formatPlatformService,
  formatPlatformMember,
  listPlatformHomeServicesForAdmin,
  nextPlatformHomeServiceSortOrder,
  resolveUniquePlatformServiceSlug,
  reorderPlatformHomeServices,
} = require('../utils/platformHomeServices');
const { uploadShopImage } = require('../utils/shopMedia');
const { uploadRestaurantImage } = require('../utils/restaurantMedia');
const {
  normalizeWeeklyHours,
  syncOpeningHoursString,
} = require('../utils/restaurantHours');
const { getBuildingEngagementReport } = require('../utils/buildingEngagement');
const {
  getUnitsAppAdoptionDetail,
  createUnitAppFollowUp,
} = require('../utils/buildingAppAdoption');
const { formatShopOrder, STATUS_LABELS } = require('../utils/shopOrder');
const {
  loadResidentAppSections,
  saveResidentAppSections,
  toCatalog,
} = require('../utils/residentAppSections');
const {
  formatRestaurantOrder,
  STATUS_LABELS: RESTAURANT_STATUS_LABELS,
} = require('../utils/restaurantOrder');

const router = express.Router();

router.use(authenticate, requireSuperAdmin);

router.get('/resident-app', async (_req, res) => {
  try {
    const sections = await loadResidentAppSections();
    res.json({ sections: toCatalog(sections) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/resident-app', async (req, res) => {
  try {
    const sections = await saveResidentAppSections(req.body?.sections);
    res.json({ sections: toCatalog(sections) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/dashboard', async (_req, res) => {
  try {
    const stats = await getPlatformDashboardStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/service-categories', async (_req, res) => {
  try {
    const categories = await ServiceCategory.find().sort({ sortOrder: 1, name: 1 });
    res.json({ categories });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/service-categories', async (req, res) => {
  try {
    const { name, slug, description, icon, sortOrder } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Nombre requerido' });

    const category = await ServiceCategory.create({
      name: name.trim(),
      slug: slug?.trim() || slugify(name),
      description,
      icon,
      sortOrder: sortOrder ?? 0,
      isActive: true,
    });

    res.status(201).json({ category });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        error: 'Ya existe un servicio con ese slug. Usa otro nombre o slug.',
      });
    }
    res.status(400).json({ error: err.message });
  }
});

router.patch('/service-categories/:id', async (req, res) => {
  try {
    const allowed = ['name', 'slug', 'description', 'icon', 'sortOrder', 'isActive'];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowed.includes(key))
    );
    if (updates.name) updates.name = updates.name.trim();
    if (updates.slug) updates.slug = updates.slug.trim().toLowerCase();

    const category = await ServiceCategory.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    });
    if (!category) return res.status(404).json({ error: 'Servicio no encontrado' });
    res.json({ category });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/service-categories/:id', async (req, res) => {
  try {
    const category = await ServiceCategory.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!category) return res.status(404).json({ error: 'Servicio no encontrado' });
    res.json({ category });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// —— Servicios a domicilio Rentados ——
router.get('/home-services', async (_req, res) => {
  try {
    const services = await listPlatformHomeServicesForAdmin();
    res.json({ services });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/home-services', async (req, res) => {
  try {
    const { name, description, slug, sortOrder, isActive, imageUrl } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Nombre requerido' });

    const resolvedSlug = await resolveUniquePlatformServiceSlug(slug?.trim() || name);
    const order =
      sortOrder != null && sortOrder !== ''
        ? Number(sortOrder)
        : await nextPlatformHomeServiceSortOrder();

    const service = await PlatformHomeService.create({
      slug: resolvedSlug,
      name: String(name).trim(),
      description: description?.trim() || '',
      imageUrl: imageUrl?.trim() || '',
      sortOrder: Number.isFinite(order) ? order : 0,
      isActive: isActive !== false,
    });

    res.status(201).json({ service: formatPlatformService(service) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/home-services/reorder', async (req, res) => {
  try {
    const { orderedIds } = req.body;
    const services = await reorderPlatformHomeServices(orderedIds);
    res.json({ services });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.get('/home-services/:id', async (req, res) => {
  try {
    const service = await PlatformHomeService.findById(req.params.id);
    if (!service) return res.status(404).json({ error: 'Servicio no encontrado' });

    const members = await PlatformHomeServiceMember.find({ serviceId: service._id }).sort({
      sortOrder: 1,
      name: 1,
    });

    res.json({
      service: formatPlatformService(service),
      members: members.map(formatPlatformMember),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/home-services/:id', async (req, res) => {
  try {
    const service = await PlatformHomeService.findById(req.params.id);
    if (!service) return res.status(404).json({ error: 'Servicio no encontrado' });

    if (req.body.name != null) service.name = String(req.body.name).trim();
    if (req.body.description != null) service.description = String(req.body.description).trim();
    if (req.body.imageUrl != null) service.imageUrl = String(req.body.imageUrl).trim();
    if (req.body.sortOrder != null) service.sortOrder = Number(req.body.sortOrder);
    if (req.body.isActive !== undefined) service.isActive = Boolean(req.body.isActive);

    await service.save();
    res.json({ service: formatPlatformService(service) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/home-services/:id/upload-image', (req, res) => {
  uploadPublicationMedia.single('file')(req, res, async (uploadErr) => {
    if (uploadErr) {
      res.status(400).json({ error: uploadErr.message });
      return;
    }
    if (!req.file?.mimetype?.startsWith('image/')) {
      res.status(400).json({ error: 'Selecciona una imagen válida.' });
      return;
    }

    try {
      const service = await PlatformHomeService.findById(req.params.id);
      if (!service) {
        res.status(404).json({ error: 'Servicio no encontrado' });
        return;
      }

      const imageUrl = await uploadPlatformHomeServiceImage(
        req.file.buffer,
        req.file.mimetype,
        service._id.toString()
      );
      service.imageUrl = imageUrl;
      await service.save();
      res.json({ service: formatPlatformService(service), imageUrl });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
});

router.post('/home-services/:serviceId/members', async (req, res) => {
  try {
    const service = await PlatformHomeService.findById(req.params.serviceId);
    if (!service) return res.status(404).json({ error: 'Servicio no encontrado' });

    const { name, memberType, tagline, resume, sortOrder, isActive } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Nombre requerido' });

    const member = await PlatformHomeServiceMember.create({
      serviceId: service._id,
      name: String(name).trim(),
      memberType: memberType === 'company' ? 'company' : 'person',
      tagline: tagline?.trim() || '',
      resume: resume?.trim() || '',
      sortOrder: Number(sortOrder) || 0,
      isActive: isActive !== false,
      media: [],
    });

    res.status(201).json({ member: formatPlatformMember(member) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/home-services/:serviceId/members/:memberId', async (req, res) => {
  try {
    const member = await PlatformHomeServiceMember.findOne({
      _id: req.params.memberId,
      serviceId: req.params.serviceId,
    });
    if (!member) return res.status(404).json({ error: 'Perfil no encontrado' });

    if (req.body.name != null) member.name = String(req.body.name).trim();
    if (req.body.memberType != null) {
      member.memberType = req.body.memberType === 'company' ? 'company' : 'person';
    }
    if (req.body.tagline != null) member.tagline = String(req.body.tagline).trim();
    if (req.body.resume != null) member.resume = String(req.body.resume).trim();
    if (req.body.sortOrder != null) member.sortOrder = Number(req.body.sortOrder);
    if (req.body.isActive !== undefined) member.isActive = Boolean(req.body.isActive);

    await member.save();
    res.json({ member: formatPlatformMember(member) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/home-services/:serviceId/members/:memberId', async (req, res) => {
  try {
    const member = await PlatformHomeServiceMember.findOneAndDelete({
      _id: req.params.memberId,
      serviceId: req.params.serviceId,
    });
    if (!member) return res.status(404).json({ error: 'Perfil no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/home-services/:serviceId/members/:memberId/media', (req, res) => {
  uploadPublicationMedia.single('file')(req, res, async (uploadErr) => {
    if (uploadErr) {
      res.status(400).json({ error: uploadErr.message });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'Selecciona un archivo.' });
      return;
    }
    const isImage = req.file.mimetype.startsWith('image/');
    const isVideo = req.file.mimetype.startsWith('video/');
    if (!isImage && !isVideo) {
      res.status(400).json({ error: 'Solo imágenes o videos.' });
      return;
    }

    try {
      const member = await PlatformHomeServiceMember.findOne({
        _id: req.params.memberId,
        serviceId: req.params.serviceId,
      });
      if (!member) {
        res.status(404).json({ error: 'Perfil no encontrado' });
        return;
      }

      const uploaded = await uploadPlatformHomeServiceMemberMedia(
        req.file.buffer,
        req.file.mimetype,
        req.params.serviceId,
        member._id.toString()
      );

      member.media.push({
        type: uploaded.type,
        url: uploaded.url,
        cloudinaryPublicId: uploaded.cloudinaryPublicId,
        thumbnailUrl: uploaded.thumbnailUrl,
      });
      await member.save();

      res.status(201).json({ member: formatPlatformMember(member) });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
});

router.delete('/home-services/:serviceId/members/:memberId/media/:mediaId', async (req, res) => {
  try {
    const member = await PlatformHomeServiceMember.findOne({
      _id: req.params.memberId,
      serviceId: req.params.serviceId,
    });
    if (!member) return res.status(404).json({ error: 'Perfil no encontrado' });

    member.media = member.media.filter((m) => String(m._id) !== String(req.params.mediaId));
    await member.save();
    res.json({ member: formatPlatformMember(member) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/publications', async (_req, res) => {
  try {
    const publications = await PlatformPublication.find().sort({ publishedAt: -1 });
    res.json({ publications });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/publications', async (req, res) => {
  try {
    const { title, body, targetCountries, targetCities, isPinned, expiresAt } = req.body;
    if (!title || !body) {
      return res.status(400).json({ error: 'Título y contenido son requeridos' });
    }

    const publication = await PlatformPublication.create({
      title,
      body,
      targetCountries: targetCountries || [],
      targetCities: targetCities || [],
      isPinned: Boolean(isPinned),
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      createdBy: req.user._id,
    });

    res.status(201).json({ publication });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/publications/:id', async (req, res) => {
  try {
    const allowed = [
      'title',
      'body',
      'targetCountries',
      'targetCities',
      'isPinned',
      'expiresAt',
      'isActive',
    ];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowed.includes(key))
    );
    if (updates.expiresAt) updates.expiresAt = new Date(updates.expiresAt);

    const publication = await PlatformPublication.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    });
    if (!publication) return res.status(404).json({ error: 'Publicación no encontrada' });
    res.json({ publication });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/publications/:id', async (req, res) => {
  try {
    const publication = await PlatformPublication.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!publication) return res.status(404).json({ error: 'Publicación no encontrada' });
    res.json({ publication });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/conjuntos/engagement', async (_req, res) => {
  try {
    const report = await getBuildingEngagementReport();
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/buildings/:id/app-adoption', async (req, res) => {
  try {
    const building = await Building.findById(req.params.id).select('_id name organizationId');
    if (!building) return res.status(404).json({ error: 'Conjunto no encontrado' });

    const onlyWithoutApp = req.query.onlyWithoutApp !== 'false';
    const detail = await getUnitsAppAdoptionDetail(building._id, { onlyWithoutApp });
    res.json({
      building: {
        id: building._id,
        name: building.name,
        organizationId: building.organizationId,
      },
      ...detail,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/units/:unitId/app-follow-up', async (req, res) => {
  try {
    const { reason, notes, visitorName } = req.body;
    const result = await createUnitAppFollowUp({
      unitId: req.params.unitId,
      reason,
      notes,
      visitorName,
      createdBy: req.user._id,
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.get('/overview', async (_req, res) => {
  try {
    const organizations = await Organization.find().sort({ name: 1 });
    const buildings = await Building.find().sort({ name: 1 });
    const admins = await User.find({ role: 'ORG_ADMIN', isActive: true }).select(
      '-passwordHash'
    );

    const buildingsByOrg = buildings.reduce((acc, building) => {
      const key = building.organizationId.toString();
      if (!acc[key]) acc[key] = [];
      acc[key].push(building);
      return acc;
    }, {});

    const buildingNameById = new Map(buildings.map((building) => [building._id.toString(), building.name]));
    const adminsByOrg = admins.reduce((acc, admin) => {
      const key = admin.organizationId?.toString();
      if (!key) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push({
        ...formatAuthUser(admin),
        buildingName: admin.buildingId ? buildingNameById.get(admin.buildingId.toString()) || '' : '',
        scope: admin.buildingId ? 'building' : 'company',
      });
      return acc;
    }, {});

    res.json({
      organizations: organizations.map((org) => ({
        ...org.toObject(),
        buildings: buildingsByOrg[org._id.toString()] || [],
        admins: adminsByOrg[org._id.toString()] || [],
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/conjuntos', async (req, res) => {
  try {
    const {
      organizationName,
      organizationSlug,
      nit,
      email,
      phone,
      plan,
      buildingName,
      buildingSlug,
      address,
      description,
      heroImageUrl,
      admins = [],
    } = req.body;

    if (!organizationName || !buildingName) {
      return res.status(400).json({ error: 'Nombre de administración y conjunto son requeridos' });
    }

    const orgSlug = organizationSlug || slugify(organizationName);
    const bSlug = buildingSlug || slugify(buildingName);

    const organization = await Organization.create({
      name: organizationName,
      slug: orgSlug,
      nit,
      email,
      phone,
      plan: plan || 'trial',
    });

    const building = await Building.create({
      organizationId: organization._id,
      name: buildingName,
      slug: bSlug,
      address: address || {},
      description,
      heroImageUrl,
    });

    const createdAdmins = [];
    for (const admin of admins) {
      if (!admin.email || !admin.password || !admin.firstName || !admin.lastName) continue;

      const passwordHash = await bcrypt.hash(admin.password, 10);
      const user = await User.create({
        email: admin.email.toLowerCase().trim(),
        passwordHash,
        firstName: admin.firstName,
        lastName: admin.lastName,
        phone: admin.phone,
        role: 'ORG_ADMIN',
        organizationId: organization._id,
      });
      createdAdmins.push(formatAuthUser(user));
    }

    res.status(201).json({
      organization,
      building,
      admins: createdAdmins,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/organizations/:orgId/buildings', async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.orgId);
    if (!organization) return res.status(404).json({ error: 'Organización no encontrada' });

    const building = await Building.create({
      organizationId: organization._id,
      name: req.body.name,
      slug: req.body.slug || slugify(req.body.name),
      address: req.body.address || {},
      description: req.body.description,
      heroImageUrl: req.body.heroImageUrl,
    });

    res.status(201).json({ building });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/buildings/:id', async (req, res) => {
  try {
    const building = await Building.findById(req.params.id);
    if (!building) return res.status(404).json({ error: 'Conjunto no encontrado' });

    const {
      name,
      slug,
      description,
      heroImageUrl,
      isActive,
      platformCommissionPercent,
      address,
    } = req.body;

    if (name !== undefined) building.name = name;
    if (slug !== undefined) building.slug = slug;
    if (description !== undefined) building.description = description;
    if (heroImageUrl !== undefined) building.heroImageUrl = heroImageUrl;
    if (isActive !== undefined) building.isActive = isActive;
    if (platformCommissionPercent !== undefined) {
      building.platformCommissionPercent = platformCommissionPercent;
    }

    if (address && typeof address === 'object') {
      building.address = {
        ...(building.address?.toObject?.() || building.address || {}),
        ...address,
      };
      building.markModified('address');
    }

    await building.save();
    res.json({ building });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/organizations/:orgId/admins', async (req, res) => {
  try {
    const admins = await User.find({
      organizationId: req.params.orgId,
      role: 'ORG_ADMIN',
    }).select('-passwordHash');
    res.json({ admins: admins.map(formatAuthUser) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/organizations/:orgId/admins', async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.orgId);
    if (!organization) return res.status(404).json({ error: 'Organización no encontrada' });

    const { email, password, firstName, lastName, phone, buildingId } = req.body;
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Nombre, correo y contraseña son requeridos' });
    }

    let assignedBuildingId = null;
    if (buildingId) {
      const building = await Building.findOne({ _id: buildingId, organizationId: organization._id });
      if (!building) return res.status(400).json({ error: 'El conjunto no pertenece a esta empresa' });
      assignedBuildingId = building._id;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: email.toLowerCase().trim(),
      passwordHash,
      firstName,
      lastName,
      phone,
      role: 'ORG_ADMIN',
      organizationId: organization._id,
      buildingId: assignedBuildingId,
    });

    res.status(201).json({ admin: formatAuthUser(user) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Ese correo ya está registrado en esta empresa' });
    }
    res.status(400).json({ error: err.message });
  }
});

router.patch('/admins/:id', async (req, res) => {
  try {
    const admin = await User.findOne({ _id: req.params.id, role: 'ORG_ADMIN' });
    if (!admin) return res.status(404).json({ error: 'Administrador no encontrado' });

    const allowed = ['firstName', 'lastName', 'phone', 'isActive'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) admin[key] = req.body[key];
    }

    if (req.body.email) admin.email = req.body.email.toLowerCase().trim();
    if (req.body.password) admin.passwordHash = await bcrypt.hash(req.body.password, 10);

    if (req.body.scope === 'company') {
      admin.buildingId = null;
    } else if (req.body.scope === 'building') {
      if (!req.body.buildingId) {
        return res.status(400).json({ error: 'Elige el conjunto de este administrador' });
      }
      const building = await Building.findOne({
        _id: req.body.buildingId,
        organizationId: admin.organizationId,
      });
      if (!building) {
        return res.status(400).json({ error: 'El conjunto no pertenece a esta empresa' });
      }
      admin.buildingId = building._id;
    }

    await admin.save();
    res.json({ admin: formatAuthUser(admin) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/buildings/:id/summary', async (req, res) => {
  try {
    const building = await Building.findById(req.params.id).populate('organizationId');
    if (!building) return res.status(404).json({ error: 'Conjunto no encontrado' });

    const [towers, units, admins] = await Promise.all([
      Tower.countDocuments({ buildingId: building._id }),
      Unit.countDocuments({ buildingId: building._id }),
      User.countDocuments({ organizationId: building.organizationId, role: 'ORG_ADMIN', isActive: true }),
    ]);

    res.json({
      building,
      organization: building.organizationId,
      stats: { towers, units, admins },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/shop/categories', async (_req, res) => {
  try {
    const categories = await ShopCategory.find().sort({ sortOrder: 1, name: 1 });
    res.json({ categories });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/shop/categories', async (req, res) => {
  try {
    const { name, slug, description, icon, sortOrder } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Nombre requerido' });

    const category = await ShopCategory.create({
      name: name.trim(),
      slug: slug?.trim() || slugify(name),
      description,
      icon,
      sortOrder: sortOrder ?? 0,
      isActive: true,
    });
    res.status(201).json({ category });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/shop/categories/:id', async (req, res) => {
  try {
    const allowed = ['name', 'slug', 'description', 'icon', 'sortOrder', 'isActive'];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowed.includes(key))
    );
    if (updates.slug) updates.slug = updates.slug.trim().toLowerCase();

    const category = await ShopCategory.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!category) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json({ category });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/shop/categories/:id', async (req, res) => {
  try {
    const category = await ShopCategory.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!category) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json({ category });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/shop/products', async (req, res) => {
  try {
    const filter = {};
    if (req.query.categoryId) filter.categoryId = req.query.categoryId;

    const products = await ShopProduct.find(filter)
      .populate('categoryId', 'name slug icon')
      .sort({ isFeatured: -1, sortOrder: 1, name: 1 });
    res.json({ products });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/shop/products/upload-image', (req, res) => {
  uploadPublicationMedia.single('file')(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ error: uploadErr.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Selecciona una imagen' });
    }
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Solo se permiten imágenes' });
    }

    try {
      const image = await uploadShopImage(req.file.buffer, req.file.mimetype);
      res.status(201).json({ image });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
});

router.post('/shop/products', async (req, res) => {
  try {
    const {
      name,
      slug,
      shortDescription,
      description,
      categoryId,
      price,
      compareAtPrice,
      sku,
      stock,
      images,
      targetCountries,
      targetCities,
      isFeatured,
      sortOrder,
      currency,
    } = req.body;

    if (!name?.trim() || !categoryId || price == null) {
      return res.status(400).json({ error: 'Nombre, categoría y precio son requeridos' });
    }

    const product = await ShopProduct.create({
      name: name.trim(),
      slug: slug?.trim() || slugify(name),
      shortDescription,
      description,
      categoryId,
      price: Number(price),
      compareAtPrice: compareAtPrice != null ? Number(compareAtPrice) : undefined,
      currency: currency === 'MXN' ? 'MXN' : 'COP',
      sku,
      stock: stock != null && stock !== '' ? Number(stock) : undefined,
      images: images || [],
      targetCountries: targetCountries || [],
      targetCities: targetCities || [],
      isFeatured: Boolean(isFeatured),
      sortOrder: sortOrder ?? 0,
      isActive: true,
      createdBy: req.user._id,
    });

    const populated = await ShopProduct.findById(product._id).populate(
      'categoryId',
      'name slug icon'
    );
    res.status(201).json({ product: populated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/shop/products/:id', async (req, res) => {
  try {
    const allowed = [
      'name',
      'slug',
      'shortDescription',
      'description',
      'categoryId',
      'price',
      'compareAtPrice',
      'sku',
      'stock',
      'images',
      'targetCountries',
      'targetCities',
      'isFeatured',
      'sortOrder',
      'isActive',
      'currency',
    ];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowed.includes(key))
    );
    if (updates.slug) updates.slug = updates.slug.trim().toLowerCase();
    if (updates.price != null) updates.price = Number(updates.price);
    if (updates.compareAtPrice != null) updates.compareAtPrice = Number(updates.compareAtPrice);
    if (updates.stock != null && updates.stock !== '') updates.stock = Number(updates.stock);
    if (updates.currency != null) updates.currency = updates.currency === 'MXN' ? 'MXN' : 'COP';

    const product = await ShopProduct.findByIdAndUpdate(req.params.id, updates, { new: true }).populate(
      'categoryId',
      'name slug icon'
    );
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ product });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/shop/products/:id', async (req, res) => {
  try {
    const product = await ShopProduct.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ product });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/shop/orders', async (req, res) => {
  try {
    const filter = {};
    if (req.query.status && req.query.status !== 'all') {
      filter.status = req.query.status;
    }

    const orders = await ShopOrder.find(filter).sort({ createdAt: -1 }).limit(200);
    res.json({ orders: orders.map(formatShopOrder), statusLabels: STATUS_LABELS });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/shop/orders/:id', async (req, res) => {
  try {
    const order = await ShopOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json({ order: formatShopOrder(order) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/shop/orders/:id', async (req, res) => {
  try {
    const { status, statusNote } = req.body;
    const allowed = ['pending', 'confirmed', 'preparing', 'delivered', 'cancelled'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const order = await ShopOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    const previousStatus = order.status;
    order.status = status;
    if (statusNote !== undefined) order.statusNote = statusNote?.trim() || undefined;
    await order.save();
    if (previousStatus !== status) {
      const { notifyOrderStatus } = require('../utils/pushNotifications');
      notifyOrderStatus(order, 'shop').catch(() => {});
    }
    res.json({ order: formatShopOrder(order) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// —— Restaurantes (propios Rentados) ——

router.get('/restaurants', async (_req, res) => {
  try {
    const restaurants = await Restaurant.find().sort({ isFeatured: -1, sortOrder: 1, name: 1 });
    res.json({ restaurants });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/restaurants/orders/list', async (req, res) => {
  try {
    const filter = {};
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
    if (req.query.restaurantId) filter.restaurantId = req.query.restaurantId;

    const orders = await RestaurantOrder.find(filter).sort({ createdAt: -1 }).limit(200);
    res.json({
      orders: orders.map(formatRestaurantOrder),
      statusLabels: RESTAURANT_STATUS_LABELS,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/restaurants/orders/:id', async (req, res) => {
  try {
    const { status, statusNote } = req.body;
    const allowed = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const order = await RestaurantOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    const previousStatus = order.status;
    order.status = status;
    if (statusNote !== undefined) order.statusNote = statusNote?.trim() || undefined;
    await order.save();
    if (previousStatus !== status) {
      const { notifyOrderStatus } = require('../utils/pushNotifications');
      notifyOrderStatus(order, 'restaurant').catch(() => {});
    }
    res.json({ order: formatRestaurantOrder(order) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/restaurants/:id', async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ error: 'Restaurante no encontrado' });
    res.json({ restaurant });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/restaurants/upload-image', (req, res) => {
  uploadPublicationMedia.single('file')(req, res, async (uploadErr) => {
    if (uploadErr) return res.status(400).json({ error: uploadErr.message });
    if (!req.file) return res.status(400).json({ error: 'Selecciona una imagen' });
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Solo se permiten imágenes' });
    }

    try {
      const type = req.body?.type === 'logo' ? 'logo' : 'cover';
      const image = await uploadRestaurantImage(req.file.buffer, req.file.mimetype, type);
      res.status(201).json({ image });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
});

router.post('/restaurants', async (req, res) => {
  try {
    const {
      name,
      slug,
      shortDescription,
      description,
      cuisineType,
      coverImage,
      logoImage,
      city,
      country,
      address,
      phone,
      email,
      openingHours,
      weeklyHours,
      deliveryFee,
      minOrderAmount,
      currency,
      avgPrepMinutes,
      targetCountries,
      targetCities,
      isFeatured,
      sortOrder,
    } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
    if (!coverImage?.url) {
      return res.status(400).json({ error: 'La foto del restaurante es requerida' });
    }

    const normalizedWeekly = normalizeWeeklyHours(weeklyHours);
    if (!normalizedWeekly.some((row) => row.enabled)) {
      return res.status(400).json({ error: 'Selecciona al menos un día con horario' });
    }

    const restaurant = await Restaurant.create({
      name: name.trim(),
      slug: slug?.trim() || slugify(name),
      shortDescription,
      description,
      cuisineType,
      coverImage,
      logoImage,
      city,
      country: country || 'Colombia',
      address,
      phone,
      email,
      weeklyHours: normalizedWeekly,
      openingHours: syncOpeningHoursString(normalizedWeekly) || openingHours,
      deliveryFee: deliveryFee != null ? Number(deliveryFee) : 0,
      minOrderAmount: minOrderAmount != null ? Number(minOrderAmount) : 0,
      currency: currency === 'MXN' ? 'MXN' : 'COP',
      avgPrepMinutes: avgPrepMinutes != null ? Number(avgPrepMinutes) : undefined,
      targetCountries: targetCountries?.length
        ? targetCountries
        : [country?.trim() || 'Colombia'],
      targetCities: targetCities?.length
        ? targetCities
        : city?.trim()
          ? [city.trim()]
          : [],
      isFeatured: Boolean(isFeatured),
      sortOrder: sortOrder ?? 0,
      isActive: true,
      createdBy: req.user._id,
    });

    res.status(201).json({ restaurant });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/restaurants/:id', async (req, res) => {
  try {
    const allowed = [
      'name',
      'slug',
      'shortDescription',
      'description',
      'cuisineType',
      'coverImage',
      'logoImage',
      'city',
      'country',
      'address',
      'phone',
      'email',
      'openingHours',
      'weeklyHours',
      'deliveryFee',
      'minOrderAmount',
      'currency',
      'avgPrepMinutes',
      'targetCountries',
      'targetCities',
      'isFeatured',
      'sortOrder',
      'isActive',
    ];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowed.includes(key))
    );
    if (updates.slug) updates.slug = updates.slug.trim().toLowerCase();
    if (updates.deliveryFee != null) updates.deliveryFee = Number(updates.deliveryFee);
    if (updates.minOrderAmount != null) updates.minOrderAmount = Number(updates.minOrderAmount);
    if (updates.avgPrepMinutes != null) updates.avgPrepMinutes = Number(updates.avgPrepMinutes);
    if (updates.currency != null) updates.currency = updates.currency === 'MXN' ? 'MXN' : 'COP';
    if (updates.weeklyHours != null) {
      updates.weeklyHours = normalizeWeeklyHours(updates.weeklyHours);
      updates.openingHours = syncOpeningHoursString(updates.weeklyHours);
    }

    const restaurant = await Restaurant.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!restaurant) return res.status(404).json({ error: 'Restaurante no encontrado' });
    res.json({ restaurant });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/restaurants/:id', async (req, res) => {
  try {
    const restaurant = await Restaurant.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!restaurant) return res.status(404).json({ error: 'Restaurante no encontrado' });
    res.json({ restaurant });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/restaurants/:restaurantId/menu/categories', async (req, res) => {
  try {
    const categories = await RestaurantMenuCategory.find({
      restaurantId: req.params.restaurantId,
    }).sort({ sortOrder: 1, name: 1 });
    res.json({ categories });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/restaurants/:restaurantId/menu/categories', async (req, res) => {
  try {
    const { name, slug, description, sortOrder } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Nombre requerido' });

    const category = await RestaurantMenuCategory.create({
      restaurantId: req.params.restaurantId,
      name: name.trim(),
      slug: slug?.trim() || slugify(name),
      description,
      sortOrder: sortOrder ?? 0,
      isActive: true,
    });
    res.status(201).json({ category });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/restaurants/menu/categories/:id', async (req, res) => {
  try {
    const allowed = ['name', 'slug', 'description', 'sortOrder', 'isActive'];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowed.includes(key))
    );
    if (updates.slug) updates.slug = updates.slug.trim().toLowerCase();

    const category = await RestaurantMenuCategory.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    });
    if (!category) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json({ category });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/restaurants/menu/categories/:id', async (req, res) => {
  try {
    const category = await RestaurantMenuCategory.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!category) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json({ category });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/restaurants/:restaurantId/menu/items', async (req, res) => {
  try {
    const filter = { restaurantId: req.params.restaurantId };
    if (req.query.categoryId) filter.categoryId = req.query.categoryId;

    const items = await RestaurantMenuItem.find(filter)
      .populate('categoryId', 'name slug')
      .sort({ isFeatured: -1, sortOrder: 1, name: 1 });
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/restaurants/:restaurantId/menu/items/upload-image', (req, res) => {
  uploadPublicationMedia.single('file')(req, res, async (uploadErr) => {
    if (uploadErr) return res.status(400).json({ error: uploadErr.message });
    if (!req.file) return res.status(400).json({ error: 'Selecciona una imagen' });
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Solo se permiten imágenes' });
    }

    try {
      const image = await uploadShopImage(req.file.buffer, req.file.mimetype);
      res.status(201).json({ image });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
});

router.post('/restaurants/:restaurantId/menu/items', async (req, res) => {
  try {
    const {
      name,
      slug,
      description,
      categoryId,
      price,
      compareAtPrice,
      currency,
      images,
      tags,
      isAvailable,
      isFeatured,
      sortOrder,
    } = req.body;

    if (!name?.trim() || !categoryId || price == null) {
      return res.status(400).json({ error: 'Nombre, categoría y precio son requeridos' });
    }

    const item = await RestaurantMenuItem.create({
      restaurantId: req.params.restaurantId,
      categoryId,
      name: name.trim(),
      slug: slug?.trim() || slugify(name),
      description,
      price: Number(price),
      compareAtPrice: compareAtPrice != null ? Number(compareAtPrice) : undefined,
      currency: currency === 'MXN' ? 'MXN' : 'COP',
      images: images || [],
      tags: tags || [],
      isAvailable: isAvailable !== false,
      isFeatured: Boolean(isFeatured),
      sortOrder: sortOrder ?? 0,
      isActive: true,
    });

    const populated = await RestaurantMenuItem.findById(item._id).populate(
      'categoryId',
      'name slug'
    );
    res.status(201).json({ item: populated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/restaurants/menu/items/:id', async (req, res) => {
  try {
    const allowed = [
      'name',
      'slug',
      'description',
      'categoryId',
      'price',
      'compareAtPrice',
      'currency',
      'images',
      'tags',
      'isAvailable',
      'isFeatured',
      'sortOrder',
      'isActive',
    ];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowed.includes(key))
    );
    if (updates.slug) updates.slug = updates.slug.trim().toLowerCase();
    if (updates.price != null) updates.price = Number(updates.price);
    if (updates.compareAtPrice != null) updates.compareAtPrice = Number(updates.compareAtPrice);
    if (updates.currency != null) updates.currency = updates.currency === 'MXN' ? 'MXN' : 'COP';

    const item = await RestaurantMenuItem.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    }).populate('categoryId', 'name slug');
    if (!item) return res.status(404).json({ error: 'Plato no encontrado' });
    res.json({ item });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/restaurants/menu/items/:id', async (req, res) => {
  try {
    const item = await RestaurantMenuItem.findByIdAndUpdate(
      req.params.id,
      { isActive: false, isAvailable: false },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Plato no encontrado' });
    res.json({ item });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// —— Servicios públicos (utility providers) ——

router.get('/utility-providers', async (req, res) => {
  try {
    const filter = {};
    if (req.query.serviceType) filter.serviceType = req.query.serviceType;
    if (req.query.city) filter.cityKeys = normalizeCity(req.query.city);
    if (req.query.active === 'true') filter.isActive = { $ne: false };
    if (req.query.active === 'false') filter.isActive = false;

    const providers = await UtilityProvider.find(filter).sort({
      serviceType: 1,
      sortOrder: 1,
      name: 1,
    });

    res.json({
      serviceTypes: SERVICE_TYPES,
      providers: providers.map(formatProvider),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/utility-providers', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });
    if (!SERVICE_TYPE_KEYS.includes(req.body.serviceType)) {
      return res.status(400).json({ error: 'Tipo de servicio inválido' });
    }

    const cities = Array.isArray(req.body.cities)
      ? req.body.cities.map((c) => String(c).trim()).filter(Boolean)
      : String(req.body.cities || '')
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean);

    const provider = await UtilityProvider.create({
      name,
      slug: (req.body.slug || slugify(name)).toLowerCase(),
      serviceType: req.body.serviceType,
      cities,
      cityKeys: cities.map(normalizeCity),
      accountCodeLabel: req.body.accountCodeLabel || 'Código de usuario',
      accountCodeHelp: req.body.accountCodeHelp,
      websiteUrl: req.body.websiteUrl,
      paymentUrl: req.body.paymentUrl,
      integrationStatus: req.body.integrationStatus || 'manual',
      integrationNotes: req.body.integrationNotes,
      logoUrl: req.body.logoUrl,
      sortOrder: Number(req.body.sortOrder) || 0,
      isActive: req.body.isActive !== false,
    });

    res.status(201).json({ provider: formatProvider(provider) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/utility-providers/:id', async (req, res) => {
  try {
    const allowed = [
      'name',
      'slug',
      'serviceType',
      'cities',
      'accountCodeLabel',
      'accountCodeHelp',
      'websiteUrl',
      'paymentUrl',
      'integrationStatus',
      'integrationNotes',
      'logoUrl',
      'sortOrder',
      'isActive',
    ];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowed.includes(key))
    );

    if (updates.serviceType && !SERVICE_TYPE_KEYS.includes(updates.serviceType)) {
      return res.status(400).json({ error: 'Tipo de servicio inválido' });
    }
    if (updates.cities != null) {
      const cities = Array.isArray(updates.cities)
        ? updates.cities.map((c) => String(c).trim()).filter(Boolean)
        : String(updates.cities)
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean);
      updates.cities = cities;
      updates.cityKeys = cities.map(normalizeCity);
    }
    if (updates.slug) updates.slug = String(updates.slug).trim().toLowerCase();
    if (updates.sortOrder != null) updates.sortOrder = Number(updates.sortOrder) || 0;

    const provider = await UtilityProvider.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    });
    if (!provider) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json({ provider: formatProvider(provider) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/utility-providers/:id', async (req, res) => {
  try {
    const provider = await UtilityProvider.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!provider) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json({ provider: formatProvider(provider) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/utility-bills', async (req, res) => {
  try {
    let account = null;
    if (req.body.accountId) {
      account = await ResidentUtilityAccount.findById(req.body.accountId);
    } else if (req.body.providerId && req.body.accountCode) {
      account = await ResidentUtilityAccount.findOne({
        providerId: req.body.providerId,
        accountCode: String(req.body.accountCode).trim(),
        isActive: true,
      });
    }

    if (!account) {
      return res.status(404).json({
        error: 'Cuenta de residente no encontrada. El residente debe vincular su código primero.',
      });
    }

    const bill = await createUtilityBill(
      {
        accountId: account._id,
        period: req.body.period,
        amount: req.body.amount,
        dueDate: req.body.dueDate,
        issuedAt: req.body.issuedAt,
        paymentUrl: req.body.paymentUrl,
        externalBillId: req.body.externalBillId,
        status: req.body.status,
      },
      { notify: req.body.notify !== false }
    );

    res.status(201).json({ bill });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
