const express = require('express');
const bcrypt = require('bcryptjs');
const {
  Building,
  Tower,
  Unit,
  Facility,
  Publication,
  User,
  Resident,
  Payment,
  VisitorParking,
  Organization,
  ServiceSuspension,
} = require('../models');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { getBillingSettings, enrichPayment } = require('../utils/billing');
const { syncAutoSuspensions } = require('../utils/autoSuspension');
const { getOrgContext, getScopedOrgFilter } = require('../utils/tenantContext');
const { parseUnitFloor, inferFloorFromUnitNumber } = require('../utils/unitFloor');

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get('/context', async (req, res) => {
  try {
    const { organization, building } = await getOrgContext(req.user, req);
    res.json({
      organization,
      building,
      needsTenantSelection: req.user.role === 'SUPER_ADMIN' && !organization,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/dashboard', async (req, res) => {
  try {
    const orgFilter = getOrganizationFilter(req.user);
    const { building } = await getOrgContext(req.user, req);
    if (!building) return res.json({ stats: {}, finance: {} });

    const buildingFilter = { buildingId: building._id, ...orgFilter };
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [
      towers,
      units,
      facilities,
      residents,
      paidCount,
      overdueCount,
      parking,
      allPayments,
      monthPayments,
    ] = await Promise.all([
      Tower.countDocuments(buildingFilter),
      Unit.countDocuments(buildingFilter),
      Facility.countDocuments(buildingFilter),
      Resident.countDocuments(orgFilter),
      Payment.countDocuments({ ...orgFilter, status: 'paid' }),
      Payment.countDocuments({ ...orgFilter, status: 'overdue' }),
      VisitorParking.countDocuments(buildingFilter),
      Payment.find(orgFilter),
      Payment.find({ ...orgFilter, period: currentPeriod }),
    ]);

    const sum = (items, pick) => items.reduce((acc, p) => acc + pick(p), 0);

    const carteraActual = sum(
      allPayments.filter((p) => p.status === 'pending' || p.status === 'overdue'),
      (p) => p.amount - (p.paidAmount || 0)
    );
    const recaudoMes = sum(
      monthPayments.filter((p) => p.status === 'paid'),
      (p) => p.paidAmount || p.amount
    );
    const morosidadTotal = sum(
      allPayments.filter((p) => p.status === 'overdue'),
      (p) => p.amount - (p.paidAmount || 0)
    );
    const pendienteMes = sum(
      monthPayments.filter((p) => p.status === 'pending'),
      (p) => p.amount - (p.paidAmount || 0)
    );
    const facturadoMes = sum(monthPayments, (p) => p.amount);
    const tasaRecaudo = facturadoMes > 0 ? Math.round((recaudoMes / facturadoMes) * 100) : 0;

    const highlights = [];
    if (overdueCount > 0) {
      highlights.push({
        type: 'warning',
        message: `${overdueCount} unidad(es) con administración en mora`,
      });
    }
    if (pendienteMes > 0) {
      highlights.push({
        type: 'info',
        message: `$${pendienteMes.toLocaleString('es-CO')} pendientes de recaudo este mes`,
      });
    }
    if (tasaRecaudo >= 80) {
      highlights.push({ type: 'success', message: `Recaudo del mes al ${tasaRecaudo}%` });
    }

    res.json({
      stats: { towers, units, facilities, residents, paid: paidCount, overdue: overdueCount, visitorParking: parking },
      finance: {
        currentPeriod,
        carteraActual,
        recaudoMes,
        morosidadTotal,
        pendienteMes,
        facturadoMes,
        tasaRecaudo,
        highlights,
      },
      building,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// —— Torres ——
router.get('/towers', async (req, res) => {
  try {
    const { building } = await getOrgContext(req.user, req);
    if (!building) return res.json({ towers: [] });

    const towers = await Tower.find({ buildingId: building._id }).sort({ sortOrder: 1, name: 1 });
    res.json({ towers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/towers', async (req, res) => {
  try {
    const { building } = await getOrgContext(req.user, req);
    if (!building) return res.status(400).json({ error: 'No hay conjunto configurado' });

    const tower = await Tower.create({
      organizationId: building.organizationId,
      buildingId: building._id,
      name: req.body.name,
      code: req.body.code,
      floors: req.body.floors,
      sortOrder: req.body.sortOrder ?? 0,
    });

    res.status(201).json({ tower });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/towers/:id', async (req, res) => {
  try {
    const tower = await Tower.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!tower) return res.status(404).json({ error: 'Torre no encontrada' });
    res.json({ tower });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/towers/:id', async (req, res) => {
  try {
    const linkedUnits = await Unit.countDocuments({ towerId: req.params.id });
    if (linkedUnits > 0) {
      return res.status(400).json({ error: 'No se puede eliminar: hay unidades asociadas a esta torre' });
    }
    await Tower.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// —— Unidades ——
router.get('/units', async (req, res) => {
  try {
    const { building } = await getOrgContext(req.user, req);
    const filter = building ? { buildingId: building._id } : getOrganizationFilter(req.user);
    if (req.query.type) filter.type = req.query.type;
    if (req.query.towerId) filter.towerId = req.query.towerId;

    const units = await Unit.find(filter)
      .populate('towerId', 'name code')
      .sort({ type: 1, number: 1 });

    res.json({ units });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/units', async (req, res) => {
  try {
    const { building } = await getOrgContext(req.user, req);
    if (!building) return res.status(400).json({ error: 'No hay conjunto configurado' });

    let towerName = req.body.tower;
    if (req.body.towerId && !towerName) {
      const tower = await Tower.findById(req.body.towerId);
      towerName = tower?.name;
    }

    const unit = await Unit.create({
      organizationId: building.organizationId,
      buildingId: building._id,
      towerId: req.body.towerId || null,
      number: req.body.number,
      tower: towerName,
      floor: req.body.floor,
      type: req.body.type || 'apartment',
      areaSqm: req.body.areaSqm,
      adminStatus: req.body.adminStatus || 'current',
    });

    res.status(201).json({ unit });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/units/bulk', async (req, res) => {
  try {
    const { building } = await getOrgContext(req.user, req);
    if (!building) return res.status(400).json({ error: 'No hay conjunto configurado' });

    const { towerId, units: items } = req.body;
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'Debes enviar al menos una unidad' });
    }

    let towerName = null;
    if (towerId) {
      const tower = await Tower.findById(towerId);
      if (!tower) return res.status(404).json({ error: 'Torre no encontrada' });
      towerName = tower.name;
    }

    const created = [];
    const errors = [];

    for (const item of items) {
      const number = item.number?.trim();
      if (!number) continue;

      try {
        const unit = await Unit.create({
          organizationId: building.organizationId,
          buildingId: building._id,
          towerId: towerId || null,
          tower: towerName || item.tower || undefined,
          number,
          floor: parseUnitFloor(item.floor),
          type: item.type || 'apartment',
          areaSqm: item.areaSqm,
          adminStatus: item.adminStatus || 'current',
        });
        created.push(unit);
      } catch (err) {
        errors.push({ number, error: err.message });
      }
    }

    if (!created.length && errors.length) {
      return res.status(400).json({
        error: errors[0].error,
        errors,
      });
    }

    res.status(201).json({
      units: created,
      created: created.length,
      errors,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

function bulkWriteErrorMessage(writeError) {
  return (
    writeError.errmsg ||
    writeError.err?.errmsg ||
    writeError.err?.message ||
    writeError.message ||
    (writeError.code === 11000
      ? 'Número de unidad duplicado en este conjunto'
      : `Error de base de datos (${writeError.code || 'desconocido'})`)
  );
}

router.post('/units/replicate-tower', async (req, res) => {
  try {
    const { building } = await getOrgContext(req.user, req);
    if (!building) return res.status(400).json({ error: 'No hay conjunto configurado' });

    const { sourceTowerId, targetTowerIds, skipExisting = true } = req.body;

    if (!sourceTowerId || !Array.isArray(targetTowerIds) || !targetTowerIds.length) {
      return res.status(400).json({ error: 'Torre origen y al menos una torre destino son requeridas' });
    }

    const sourceTower = await Tower.findOne({ _id: sourceTowerId, buildingId: building._id });
    if (!sourceTower) return res.status(404).json({ error: 'Torre origen no encontrada' });

    const uniqueTargets = [...new Set(targetTowerIds.map(String))].filter(
      (id) => id !== sourceTowerId.toString()
    );
    if (!uniqueTargets.length) {
      return res.status(400).json({ error: 'Selecciona torres destino distintas a la torre origen' });
    }

    const targetTowers = await Tower.find({
      _id: { $in: uniqueTargets },
      buildingId: building._id,
    });

    if (targetTowers.length !== uniqueTargets.length) {
      return res.status(400).json({ error: 'Una o más torres destino no pertenecen a este conjunto' });
    }

    const sourceUnits = await Unit.find({
      buildingId: building._id,
      towerId: sourceTower._id,
    })
      .sort({ floor: 1, number: 1 })
      .lean();

    if (!sourceUnits.length) {
      return res.status(400).json({ error: 'La torre origen no tiene unidades para replicar' });
    }

    const sourceNumbers = sourceUnits.map((u) => u.number);
    const existingKeys = new Set();

    if (skipExisting) {
      const existing = await Unit.find({
        buildingId: building._id,
        towerId: { $in: targetTowers.map((t) => t._id) },
        number: { $in: sourceNumbers },
      })
        .select('towerId number')
        .lean();

      for (const unit of existing) {
        existingKeys.add(`${unit.towerId.toString()}:${unit.number}`);
      }
    }

    const toCreate = [];
    let skipped = 0;

    for (const targetTower of targetTowers) {
      for (const sourceUnit of sourceUnits) {
        const key = `${targetTower._id.toString()}:${sourceUnit.number}`;
        if (skipExisting && existingKeys.has(key)) {
          skipped += 1;
          continue;
        }

        toCreate.push({
          organizationId: building.organizationId,
          buildingId: building._id,
          towerId: targetTower._id,
          tower: targetTower.name,
          number: sourceUnit.number,
          floor: sourceUnit.floor,
          type: sourceUnit.type,
          areaSqm: sourceUnit.areaSqm,
          adminStatus: 'current',
        });
      }
    }

    let created = 0;
    const errors = [];

    if (toCreate.length) {
      try {
        const inserted = await Unit.insertMany(toCreate, { ordered: false });
        created = inserted.length;
      } catch (err) {
        if (err.name === 'MongoBulkWriteError') {
          created = err.insertedDocs?.length ?? err.result?.nInserted ?? 0;
          for (const writeError of err.writeErrors || []) {
            const doc = toCreate[writeError.index];
            errors.push({
              tower: doc?.tower,
              number: doc?.number,
              error: bulkWriteErrorMessage(writeError),
            });
          }
        } else {
          throw err;
        }
      }
    }

    res.status(201).json({
      created,
      skipped,
      sourceTower: sourceTower.name,
      targetTowers: targetTowers.map((t) => t.name),
      sourceUnits: sourceUnits.length,
      errors,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/units/sync-floors', async (req, res) => {
  try {
    const { building } = await getOrgContext(req.user, req);
    if (!building) return res.status(400).json({ error: 'No hay conjunto configurado' });

    const { towerId } = req.body;
    const filter = { buildingId: building._id };
    if (towerId) filter.towerId = towerId;

    const units = await Unit.find(filter).select('number floor');
    let updated = 0;

    for (const unit of units) {
      if (unit.floor != null) continue;
      const inferred = inferFloorFromUnitNumber(unit.number);
      if (inferred == null) continue;
      unit.floor = inferred;
      await unit.save();
      updated += 1;
    }

    res.json({ updated, total: units.length, towerId: towerId || null });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/units/:id', async (req, res) => {
  try {
    const allowed = ['number', 'towerId', 'tower', 'floor', 'type', 'areaSqm', 'adminStatus', 'isActive'];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowed.includes(key))
    );
    const unit = await Unit.findByIdAndUpdate(req.params.id, updates, { new: true }).populate(
      'towerId',
      'name code'
    );
    if (!unit) return res.status(404).json({ error: 'Unidad no encontrada' });

    if (updates.adminStatus !== undefined) {
      const { organization } = await getOrgContext(req.user, req);
      if (organization?.settings?.billing?.autoSuspension?.enabled) {
        await syncAutoSuspensions(organization, { userId: req.user._id });
      }
    }

    res.json({ unit });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/units/:id', async (req, res) => {
  try {
    const linkedResidents = await Resident.countDocuments({ unitId: req.params.id });
    if (linkedResidents > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar: hay residentes asignados. Reasígnalos o elimínalos primero',
      });
    }
    await Unit.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/units/:id/residents', async (req, res) => {
  try {
    const residents = await Resident.find({ unitId: req.params.id })
      .populate('userId', 'firstName lastName email phone isActive')
      .sort({ createdAt: -1 });
    res.json({ residents });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// —— Servicios / áreas comunes ——
router.get('/facilities', async (req, res) => {
  try {
    const { building } = await getOrgContext(req.user, req);
    if (!building) return res.json({ facilities: [] });

    const facilities = await Facility.find({ buildingId: building._id }).sort({ name: 1 });
    res.json({ facilities });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/facilities', async (req, res) => {
  try {
    const { building } = await getOrgContext(req.user, req);
    if (!building) return res.status(400).json({ error: 'No hay conjunto configurado' });

    const slug = (req.body.slug || req.body.name)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const facility = await Facility.create({
      organizationId: building.organizationId,
      buildingId: building._id,
      name: req.body.name,
      slug,
      description: req.body.description,
      icon: req.body.icon,
      capacity: req.body.capacity,
      requiresApproval: req.body.requiresApproval,
      openHours: req.body.openHours,
      seasonOpenDate: req.body.seasonOpenDate,
      seasonCloseDate: req.body.seasonCloseDate,
      status: req.body.status || 'open',
      price: req.body.price ?? 0,
      currency: req.body.currency,
      pricingType: req.body.pricingType || 'free',
      blockWhenOverdue: req.body.blockWhenOverdue ?? true,
    });

    res.status(201).json({ facility });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/facilities/:id', async (req, res) => {
  try {
    const allowed = [
      'name',
      'description',
      'icon',
      'capacity',
      'requiresApproval',
      'openHours',
      'seasonOpenDate',
      'seasonCloseDate',
      'status',
      'price',
      'currency',
      'pricingType',
      'blockWhenOverdue',
      'isActive',
    ];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowed.includes(key))
    );
    const facility = await Facility.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!facility) return res.status(404).json({ error: 'Servicio no encontrado' });
    res.json({ facility });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/facilities/:id/maintenance', async (req, res) => {
  try {
    const { startAt, endAt, reason } = req.body;
    const facility = await Facility.findById(req.params.id);
    if (!facility) return res.status(404).json({ error: 'Servicio no encontrado' });

    facility.maintenanceClosures.push({ startAt, endAt, reason, isActive: true });
    facility.status = 'maintenance';
    await facility.save();

    res.json({ facility });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/facilities/:id/reopen', async (req, res) => {
  try {
    const facility = await Facility.findById(req.params.id);
    if (!facility) return res.status(404).json({ error: 'Servicio no encontrado' });

    facility.status = 'open';
    facility.maintenanceClosures.forEach((c) => {
      c.isActive = false;
    });
    await facility.save();

    res.json({ facility });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// —— Publicaciones ——
router.get('/publications', async (req, res) => {
  try {
    const orgFilter = getOrganizationFilter(req.user);
    const publications = await Publication.find(orgFilter).sort({ publishedAt: -1 }).limit(50);
    res.json({ publications });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/publications', async (req, res) => {
  try {
    const { building } = await getOrgContext(req.user, req);
    const publication = await Publication.create({
      organizationId: building?.organizationId || req.user.organizationId,
      buildingId: building?._id,
      title: req.body.title,
      body: req.body.body,
      media: req.body.media || [],
      isPinned: req.body.isPinned,
      publishedAt: req.body.publishedAt,
      expiresAt: req.body.expiresAt,
      createdBy: req.user._id,
    });

    res.status(201).json({ publication });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/publications/:id', async (req, res) => {
  try {
    await Publication.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// —— Portería ——
router.get('/staff', async (req, res) => {
  try {
    const orgFilter = getOrganizationFilter(req.user);
    const staff = await User.find({
      ...orgFilter,
      role: 'ORG_STAFF',
      staffType: 'porteria',
    }).select('-passwordHash');

    res.json({ staff });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/staff', async (req, res) => {
  try {
    const { building } = await getOrgContext(req.user, req);
    const passwordHash = await bcrypt.hash(req.body.password || 'Rentados2026!', 10);

    const staff = await User.create({
      email: req.body.email,
      passwordHash,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      phone: req.body.phone,
      role: 'ORG_STAFF',
      staffType: 'porteria',
      organizationId: building?.organizationId || req.user.organizationId,
      buildingId: building?._id,
    });

    const safe = staff.toObject();
    delete safe.passwordHash;
    res.status(201).json({ staff: safe });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/staff/:id', async (req, res) => {
  try {
    const updates = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email?.toLowerCase().trim(),
      phone: req.body.phone,
      isActive: req.body.isActive,
    };
    Object.keys(updates).forEach((k) => updates[k] === undefined && delete updates[k]);

    if (req.body.password) {
      updates.passwordHash = await bcrypt.hash(req.body.password, 10);
    }

    const staff = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'ORG_STAFF', staffType: 'porteria' },
      updates,
      { new: true }
    ).select('-passwordHash');

    if (!staff) return res.status(404).json({ error: 'Usuario de portería no encontrado' });
    res.json({ staff });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/staff/:id', async (req, res) => {
  try {
    const staff = await User.findOneAndDelete({
      _id: req.params.id,
      role: 'ORG_STAFF',
      staffType: 'porteria',
    });
    if (!staff) return res.status(404).json({ error: 'Usuario de portería no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// —— Parqueaderos visitantes ——
router.get('/visitor-parking', async (req, res) => {
  try {
    const { building } = await getOrgContext(req.user, req);
    if (!building) return res.json({ spots: [] });

    const spots = await VisitorParking.find({ buildingId: building._id }).sort({ spotNumber: 1 });
    res.json({ spots });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/visitor-parking', async (req, res) => {
  try {
    const { building } = await getOrgContext(req.user, req);
    if (!building) return res.status(400).json({ error: 'No hay conjunto configurado' });

    const spot = await VisitorParking.create({
      organizationId: building.organizationId,
      buildingId: building._id,
      spotNumber: req.body.spotNumber,
      zone: req.body.zone,
      label: req.body.label,
    });

    res.status(201).json({ spot });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/visitor-parking/bulk', async (req, res) => {
  try {
    const { building } = await getOrgContext(req.user, req);
    if (!building) return res.status(400).json({ error: 'No hay conjunto configurado' });

    const count = Number(req.body.count);
    const prefix = req.body.prefix || 'V-';
    const startNumber = Number(req.body.startNumber || 1);
    const zone = req.body.zone || 'Visitantes';

    if (!count || count < 1 || count > 100) {
      return res.status(400).json({ error: 'La cantidad debe estar entre 1 y 100' });
    }

    const spots = [];
    for (let i = 0; i < count; i += 1) {
      const num = startNumber + i;
      const spotNumber = `${prefix}${String(num).padStart(2, '0')}`;
      spots.push({
        organizationId: building.organizationId,
        buildingId: building._id,
        spotNumber,
        zone,
        label: `Visitante ${num}`,
      });
    }

    const created = await VisitorParking.insertMany(spots);
    res.status(201).json({ spots: created, created: created.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/visitor-parking/:id', async (req, res) => {
  try {
    const allowed = ['spotNumber', 'zone', 'label', 'isActive'];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowed.includes(key))
    );
    const spot = await VisitorParking.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!spot) return res.status(404).json({ error: 'Parqueadero no encontrado' });
    res.json({ spot });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/visitor-parking/:id', async (req, res) => {
  try {
    await VisitorParking.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// —— Cartera ——
router.get('/billing-settings', async (req, res) => {
  try {
    const { organization } = await getOrgContext(req.user, req);
    if (!organization) return res.status(404).json({ error: 'Organización no encontrada' });

    res.json({
      billing: getBillingSettings(organization),
      organizationId: organization._id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/billing-settings', async (req, res) => {
  try {
    const { organization } = await getOrgContext(req.user, req);
    if (!organization) return res.status(404).json({ error: 'Organización no encontrada' });

    const current = getBillingSettings(organization);
    const { autoSuspension, ...rest } = req.body;

    const billing = {
      ...current,
      ...rest,
      autoSuspension: autoSuspension
        ? { ...current.autoSuspension, ...autoSuspension }
        : current.autoSuspension,
    };

    organization.settings = organization.settings || {};
    organization.settings.billing = billing;
    organization.markModified('settings.billing');
    await organization.save();

    let syncResult = null;
    if (billing.autoSuspension?.enabled) {
      syncResult = await syncAutoSuspensions(organization, { userId: req.user._id });
    }

    res.json({ billing: getBillingSettings(organization), syncResult });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/service-suspensions', async (req, res) => {
  try {
    const orgFilter = getOrganizationFilter(req.user);
    const suspensions = await ServiceSuspension.find(orgFilter)
      .populate('unitId', 'number tower adminStatus')
      .populate('facilityIds', 'name slug')
      .sort({ startAt: -1 });

    res.json({ suspensions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/service-suspensions', async (req, res) => {
  try {
    const { organization, building } = await getOrgContext(req.user, req);
    const { unitId, facilityIds, startAt, endAt, reason, notes, residentId } = req.body;

    if (!unitId || !facilityIds?.length || !startAt || !endAt) {
      return res.status(400).json({
        error: 'Unidad, servicios, fecha inicio y fecha fin son requeridos',
      });
    }

    const suspension = await ServiceSuspension.create({
      organizationId: organization._id,
      unitId,
      residentId,
      facilityIds,
      startAt,
      endAt,
      reason: reason || 'morosidad',
      notes,
      createdBy: req.user._id,
    });

    await suspension.populate('unitId', 'number tower adminStatus');
    await suspension.populate('facilityIds', 'name slug');

    res.status(201).json({ suspension });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/service-suspensions/:id', async (req, res) => {
  try {
    const allowed = ['facilityIds', 'startAt', 'endAt', 'reason', 'notes', 'isActive'];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowed.includes(key))
    );

    const suspension = await ServiceSuspension.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    })
      .populate('unitId', 'number tower adminStatus')
      .populate('facilityIds', 'name slug');

    if (!suspension) return res.status(404).json({ error: 'Suspensión no encontrada' });
    res.json({ suspension });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/service-suspensions/:id', async (req, res) => {
  try {
    await ServiceSuspension.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/service-suspensions/sync-auto', async (req, res) => {
  try {
    const { organization } = await getOrgContext(req.user, req);
    if (!organization) return res.status(404).json({ error: 'Organización no encontrada' });

    const syncResult = await syncAutoSuspensions(organization, { userId: req.user._id });
    res.json({ syncResult });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/cartera', async (req, res) => {
  try {
    const orgFilter = getOrganizationFilter(req.user);
    const period = req.query.period;
    const { organization } = await getOrgContext(req.user, req);
    const billingSettings = getBillingSettings(organization);

    const filter = { ...orgFilter };
    if (period) filter.period = period;

    const [paid, pending, overdue, rawPayments] = await Promise.all([
      Payment.countDocuments({ ...filter, status: 'paid' }),
      Payment.countDocuments({ ...filter, status: 'pending' }),
      Payment.countDocuments({ ...filter, status: 'overdue' }),
      Payment.find(filter)
        .populate('unitId', 'number type tower adminStatus')
        .sort({ dueDate: -1 })
        .limit(100),
    ]);

    const payments = rawPayments.map((p) => enrichPayment(p, billingSettings));
    const totalInterest = payments.reduce((sum, p) => sum + (p.interestAmount || 0), 0);
    const totalDue = payments.reduce((sum, p) => sum + (p.totalDue || 0), 0);

    res.json({
      billingSettings,
      summary: {
        paid,
        pending,
        overdue,
        total: paid + pending + overdue,
        totalInterest,
        totalDue,
      },
      payments,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// —— Base de datos residentes ——
router.get('/residents', async (req, res) => {
  try {
    const orgFilter = getOrganizationFilter(req.user);
    const filter = { ...orgFilter };

    const residents = await Resident.find(filter)
      .populate('userId', 'firstName lastName email phone')
      .populate('unitId', 'number type tower adminStatus towerId')
      .sort({ createdAt: -1 });

    let result = residents;

    if (req.query.status) {
      result = result.filter((r) => r.unitId?.adminStatus === req.query.status);
    }

    if (req.query.unitId) {
      result = result.filter((r) => (r.unitId?._id || r.unitId)?.toString() === req.query.unitId);
    }

    if (req.query.type) {
      result = result.filter((r) => r.unitId?.type === req.query.type);
    }

    if (req.query.tower) {
      const tower = req.query.tower.toLowerCase();
      result = result.filter((r) => (r.unitId?.tower || '').toLowerCase() === tower);
    }

    if (req.query.relationship) {
      result = result.filter((r) => r.relationship === req.query.relationship);
    }

    if (req.query.q) {
      const q = req.query.q.toLowerCase();
      result = result.filter((r) => {
        const name = `${r.userId?.firstName} ${r.userId?.lastName}`.toLowerCase();
        const email = r.userId?.email?.toLowerCase() || '';
        const unit = r.unitId?.number?.toLowerCase() || '';
        return name.includes(q) || email.includes(q) || unit.includes(q);
      });
    }

    res.json({ residents: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/residents/:id', async (req, res) => {
  try {
    const resident = await Resident.findById(req.params.id)
      .populate('userId', 'firstName lastName email phone')
      .populate('unitId', 'number type tower adminStatus areaSqm');

    if (!resident) return res.status(404).json({ error: 'Residente no encontrado' });

    const payments = await Payment.find({ unitId: resident.unitId })
      .sort({ dueDate: -1 })
      .limit(12);

    res.json({ resident, payments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/residents', async (req, res) => {
  try {
    const { building } = await getOrgContext(req.user, req);
    const { email, password, firstName, lastName, phone, unitId, relationship } = req.body;

    if (!email || !password || !firstName || !lastName || !unitId) {
      return res.status(400).json({ error: 'Email, contraseña, nombre y unidad son requeridos' });
    }

    const unit = await Unit.findById(unitId);
    if (!unit) return res.status(404).json({ error: 'Unidad no encontrada' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      passwordHash,
      firstName,
      lastName,
      phone,
      role: 'RESIDENT',
      organizationId: building?.organizationId || unit.organizationId,
    });

    const resident = await Resident.create({
      userId: user._id,
      organizationId: user.organizationId,
      unitId,
      relationship: relationship || 'owner',
      isPrimary: req.body.isPrimary ?? false,
    });

    await resident.populate('userId', 'firstName lastName email phone');
    await resident.populate('unitId', 'number type tower');

    res.status(201).json({ resident });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'El correo ya está registrado' });
    }
    res.status(400).json({ error: err.message });
  }
});

router.patch('/residents/:id', async (req, res) => {
  try {
    const resident = await Resident.findById(req.params.id);
    if (!resident) return res.status(404).json({ error: 'Residente no encontrado' });

    if (req.body.unitId) resident.unitId = req.body.unitId;
    if (req.body.relationship) resident.relationship = req.body.relationship;
    if (req.body.isPrimary !== undefined) resident.isPrimary = req.body.isPrimary;
    await resident.save();

    const userUpdates = {};
    ['firstName', 'lastName', 'email', 'phone', 'isActive'].forEach((field) => {
      if (req.body[field] !== undefined) userUpdates[field] = req.body[field];
    });
    if (req.body.email) userUpdates.email = req.body.email.toLowerCase().trim();
    if (req.body.password) userUpdates.passwordHash = await bcrypt.hash(req.body.password, 10);

    if (Object.keys(userUpdates).length) {
      await User.findByIdAndUpdate(resident.userId, userUpdates);
    }

    const updated = await Resident.findById(resident._id)
      .populate('userId', 'firstName lastName email phone isActive')
      .populate('unitId', 'number type tower');

    res.json({ resident: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/residents/:id', async (req, res) => {
  try {
    const resident = await Resident.findById(req.params.id);
    if (!resident) return res.status(404).json({ error: 'Residente no encontrado' });

    await User.findByIdAndDelete(resident.userId);
    await Resident.findByIdAndDelete(resident._id);

    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
