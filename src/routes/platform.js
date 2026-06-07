const express = require('express');
const bcrypt = require('bcryptjs');
const { Organization, Building, User, Tower, Unit } = require('../models');
const { authenticate, requireSuperAdmin, formatAuthUser } = require('../middleware/auth');
const { slugify } = require('../utils/tenantContext');

const router = express.Router();

router.use(authenticate, requireSuperAdmin);

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

    const adminsByOrg = admins.reduce((acc, admin) => {
      const key = admin.organizationId?.toString();
      if (!key) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push(formatAuthUser(admin));
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
    const allowed = ['name', 'slug', 'address', 'description', 'heroImageUrl', 'isActive'];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowed.includes(key))
    );

    const building = await Building.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!building) return res.status(404).json({ error: 'Conjunto no encontrado' });
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

    const { email, password, firstName, lastName, phone } = req.body;
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Nombre, correo y contraseña son requeridos' });
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
    });

    res.status(201).json({ admin: formatAuthUser(user) });
  } catch (err) {
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

module.exports = router;
