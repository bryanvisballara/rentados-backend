const express = require('express');
const { Resident, LockerPackage, Unit, Building } = require('../models');
const { authenticate, requireRoles } = require('../middleware/auth');
const { getOrgContext } = require('../utils/tenantContext');
const { getLockerSettings } = require('../utils/lockerSettings');
const { uploadPackagePhoto } = require('../middleware/uploadPackagePhoto');
const { uploadPackagePhoto: uploadToCloudinary } = require('../utils/packageMedia');
const {
  formatPackage,
  registerLockerPackage,
  markPackagePickedUp,
  notifyHeldPackage,
  getLockerSummaryByUnit,
  notifyLockerOverflow,
  getBitacoraEntries,
  sendPorteriaMessage,
} = require('../utils/lockerPackage');
const {
  getParkingSummary,
  registerVisitorEntry,
  registerVisitorExit,
} = require('../utils/visitorParking');

const router = express.Router();

function requirePorteriaStaff(req, res, next) {
  if (req.user.staffType !== 'porteria') {
    return res.status(403).json({ error: 'Acceso solo para personal de portería' });
  }
  next();
}

router.use(authenticate, requireRoles('ORG_STAFF'), requirePorteriaStaff);

router.get('/settings', async (req, res) => {
  try {
    const { organization } = await getOrgContext(req.user, req);
    if (!organization) return res.status(404).json({ error: 'Organización no encontrada' });

    res.json({ locker: getLockerSettings(organization) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/residents', async (req, res) => {
  try {
    const { organization, building } = await getOrgContext(req.user, req);
    if (!organization || !building) {
      return res.json({ residents: [] });
    }

    const residents = await Resident.find({ organizationId: organization._id })
      .populate('userId', 'firstName lastName email phone isActive')
      .populate('unitId', 'number type tower adminStatus buildingId')
      .sort({ createdAt: -1 });

    const filtered = residents.filter(
      (r) => r.userId?.isActive !== false && r.unitId?.buildingId?.toString() === building._id.toString()
    );

    res.json({ residents: filtered });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/units', async (req, res) => {
  try {
    const { organization, building } = await getOrgContext(req.user, req);
    if (!organization || !building) return res.json({ units: [] });

    const units = await Unit.find({
      buildingId: building._id,
      isActive: true,
      type: { $in: ['apartment', 'house', 'commercial'] },
    })
      .populate('towerId', 'name code')
      .sort({ tower: 1, number: 1 });
    const packageCounts = await LockerPackage.aggregate([
      {
        $match: {
          buildingId: building._id,
          organizationId: organization._id,
          status: { $in: ['pending_pickup', 'held'] },
        },
      },
      { $group: { _id: '$unitId', count: { $sum: 1 } } },
    ]);

    const countMap = Object.fromEntries(packageCounts.map((row) => [row._id.toString(), row.count]));

    res.json({
      units: units.map((u) => ({
        _id: u._id,
        number: u.number,
        code: u.code,
        floor: u.floor,
        tower: u.towerId?.name || u.tower,
        towerId: u.towerId?._id || u.towerId,
        adminStatus: u.adminStatus,
        pendingPackages: countMap[u._id.toString()] || 0,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/towers', async (req, res) => {
  try {
    const { building } = await getOrgContext(req.user, req);
    if (!building) return res.json({ towers: [] });

    const fromBuilding = building.towers || [];
    const unitTowers = await Unit.distinct('tower', {
      buildingId: building._id,
      tower: { $exists: true, $ne: '' },
    });

    const towers = [...new Set([...fromBuilding, ...unitTowers].filter(Boolean))].sort();
    res.json({ towers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/locker-packages', async (req, res) => {
  try {
    const { organization, building } = await getOrgContext(req.user, req);
    if (!organization || !building) return res.json({ packages: [] });

    const settings = getLockerSettings(organization);
    if (!settings.enabled && req.query.requireEnabled !== 'false') {
      return res.status(403).json({ error: 'El servicio de casillero no está habilitado' });
    }

    const status = req.query.status || 'active';
    const filter = {
      organizationId: organization._id,
      buildingId: building._id,
    };

    if (req.query.unitId) filter.unitId = req.query.unitId;

    if (status === 'active') {
      filter.status = { $in: ['pending_pickup', 'held'] };
    } else if (status !== 'all') {
      filter.status = status;
    }

    const packages = await LockerPackage.find(filter)
      .populate('registeredBy', 'firstName lastName')
      .populate('pickedUpBy', 'firstName lastName')
      .populate({ path: 'residentId', populate: { path: 'userId', select: 'firstName lastName email' } })
      .populate('unitId', 'number tower adminStatus')
      .sort({ createdAt: -1 })
      .limit(status === 'all' ? 200 : 100);

    res.json({ packages: packages.map(formatPackage) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/locker-packages/summary-by-unit', async (req, res) => {
  try {
    const { organization, building } = await getOrgContext(req.user, req);
    if (!organization || !building) return res.json({ units: [] });

    const units = await getLockerSummaryByUnit(building._id, organization._id);
    res.json({ units });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/locker-packages/upload-photo', uploadPackagePhoto.single('file'), async (req, res) => {
  try {
    const { organization } = await getOrgContext(req.user, req);
    if (!organization) return res.status(404).json({ error: 'Organización no encontrada' });
    if (!req.file) return res.status(400).json({ error: 'Selecciona una foto del paquete' });

    const media = await uploadToCloudinary(req.file.buffer, req.file.mimetype, organization._id);
    res.json({ photo: { url: media.url, cloudinaryPublicId: media.cloudinaryPublicId } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/locker-packages', async (req, res) => {
  try {
    const context = await getOrgContext(req.user, req);
    if (!context.organization) return res.status(404).json({ error: 'Organización no encontrada' });

    const result = await registerLockerPackage(req.body, {
      ...context,
      userId: req.user._id,
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/locker-packages/:id/pickup', async (req, res) => {
  try {
    const context = await getOrgContext(req.user, req);
    if (!context.organization) return res.status(404).json({ error: 'Organización no encontrada' });

    const pkg = await markPackagePickedUp(
      req.params.id,
      { ...context, userId: req.user._id },
      {
        signatureRecipientName: req.body.signatureRecipientName,
        signatureData: req.body.signatureData,
      }
    );

    res.json({ package: pkg });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/locker-packages/:id/notify', async (req, res) => {
  try {
    const context = await getOrgContext(req.user, req);
    if (!context.organization) return res.status(404).json({ error: 'Organización no encontrada' });

    const pkg = await notifyHeldPackage(req.params.id, context);
    res.json({ package: pkg });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/locker-packages/units/:unitId/notify-overflow', async (req, res) => {
  try {
    const context = await getOrgContext(req.user, req);
    if (!context.organization) return res.status(404).json({ error: 'Organización no encontrada' });

    const result = await notifyLockerOverflow(req.params.unitId, context);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/bitacora', async (req, res) => {
  try {
    const { organization, building } = await getOrgContext(req.user, req);
    if (!organization || !building) return res.json({ entries: [] });

    const entries = await getBitacoraEntries(building._id, organization._id, {
      unitId: req.query.unitId,
      limit: Number(req.query.limit) || 100,
    });

    res.json({ entries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/parking/summary', async (req, res) => {
  try {
    const { building } = await getOrgContext(req.user, req);
    if (!building) {
      return res.json({
        totalSpots: 0,
        availableSpots: 0,
        occupiedSpots: 0,
        spots: [],
        activeVisits: [],
      });
    }

    const summary = await getParkingSummary(building._id);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/parking/entries', async (req, res) => {
  try {
    const context = await getOrgContext(req.user, req);
    if (!context.organization) return res.status(404).json({ error: 'Organización no encontrada' });

    const visit = await registerVisitorEntry(req.body, {
      ...context,
      userId: req.user._id,
    });

    res.status(201).json({ visit });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/parking/exit', async (req, res) => {
  try {
    const context = await getOrgContext(req.user, req);
    if (!context.organization) return res.status(404).json({ error: 'Organización no encontrada' });

    const visit = await registerVisitorExit(req.body, {
      ...context,
      userId: req.user._id,
    });

    res.json({ visit });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/notifications', async (req, res) => {
  try {
    const context = await getOrgContext(req.user, req);
    if (!context.organization) return res.status(404).json({ error: 'Organización no encontrada' });

    const result = await sendPorteriaMessage(req.body, context);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
