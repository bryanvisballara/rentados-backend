const express = require('express');
const bcrypt = require('bcryptjs');
const {
  Building,
  Tower,
  Unit,
  Facility,
  FacilityBooking,
  Publication,
  User,
  Resident,
  Payment,
  VisitorParking,
  Organization,
  ServiceSuspension,
  RentadosHomeService,
} = require('../models');
const { authenticate, requireAdmin, getOrganizationFilter, formatAuthUser } = require('../middleware/auth');
const {
  getBillingSettings,
  enrichPayment,
  parseAdministrationFee,
  getUnitAdministrationFee,
} = require('../utils/billing');
const { syncAdministrationCharges } = require('../utils/administrationCharges');
const {
  buildAdministrationOutstanding,
  settleAdministrationPayments,
  settleSingleAdministrationPayment,
} = require('../utils/administrationBalance');
const { releaseHeldLockerPackages } = require('../utils/lockerPackage');
const {
  voidPendingBookingPayment,
  voidPaymentsForCancelledBookings,
  registerManualBookingPayment,
} = require('../utils/facilityBookingPayment');
const {
  stampManualAdminById,
  notifyManualPaymentRecorded,
  voidManualAdminPayment,
  updateManualAdminPayment,
} = require('../utils/adminManualPayment');

async function completeManualAdminPaymentSideEffects({
  payments,
  residentId,
  unitId,
  organizationId,
  adminUserId,
  paymentMethod,
  notifyAmount,
  conceptLabel,
}) {
  const list = Array.isArray(payments) ? payments : payments ? [payments] : [];
  const ids = list.map((p) => p._id).filter(Boolean);
  if (!ids.length) return;

  await stampManualAdminById(ids, adminUserId, paymentMethod);
  notifyManualPaymentRecorded({
    residentId,
    unitId: unitId || list[0]?.unitId,
    organizationId,
    amount: notifyAmount,
    conceptLabel,
  }).catch((err) => console.error('Push pago manual:', err.message));
}
const { getLockerSettings } = require('../utils/lockerSettings');
const { getContactSettings, normalizeWhatsappNumber } = require('../utils/contactSettings');
const { syncAutoSuspensions } = require('../utils/autoSuspension');
const { registerPayment, settleSingleOpenPayment } = require('../utils/registerPayment');
const { getOrgContext, getScopedOrgFilter } = require('../utils/tenantContext');
const { parseUnitFloor, inferFloorFromUnitNumber } = require('../utils/unitFloor');
const {
  matchResidentQuery,
  matchResidentName,
  matchResidentUsername,
} = require('../utils/residentSearch');

function parseUnitCode(value) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

const { uploadPublicationMedia } = require('../middleware/uploadPublication');
const {
  uploadPublicationFile,
  uploadBuildingHeroImage,
  uploadRentadosHomeServiceImage,
  deletePublicationMedia,
} = require('../utils/publicationMedia');
const {
  listRentadosHomeServicesForAdmin,
  formatRentadosHomeService,
} = require('../utils/rentadosHomeServices');
const mongoose = require('mongoose');
const { normalizeOpenHours } = require('../utils/openHours');
const {
  resolveBookingWindow,
  assertBookingAvailable,
  formatBookingEvent,
  getBookingPricing,
  ACTIVE_STATUSES,
} = require('../utils/facilityBooking');
const { resolvePublicationAudience } = require('../utils/publicationAudience');

const router = express.Router();

router.use(authenticate, requireAdmin);

function formatBuildingChoice(building) {
  return {
    id: building._id,
    name: building.name,
    city: building.address?.city || '',
    organizationId: building.organizationId,
  };
}

function requireCompanyAdmin(user) {
  if (user.role !== 'ORG_ADMIN' || user.buildingId) {
    const error = new Error('Solo el acceso de la empresa puede ver todos los conjuntos');
    error.status = 403;
    throw error;
  }
}

router.get('/context', async (req, res) => {
  try {
    const { organization, building, buildings, canSwitchBuildings, scope } = await getOrgContext(req.user, req);
    res.json({
      organization,
      building,
      buildings: (buildings || []).map(formatBuildingChoice),
      canSwitchBuildings: Boolean(canSwitchBuildings),
      scope: scope || (req.user.buildingId ? 'building' : 'company'),
      needsTenantSelection: req.user.role === 'SUPER_ADMIN' && !organization,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/building-admins', async (req, res) => {
  try {
    requireCompanyAdmin(req.user);
    const [admins, buildings] = await Promise.all([
      User.find({ organizationId: req.user.organizationId, role: 'ORG_ADMIN' })
        .select('-passwordHash')
        .sort({ firstName: 1, lastName: 1 }),
      Building.find({ organizationId: req.user.organizationId }).select('name'),
    ]);
    const names = new Map(buildings.map((item) => [item._id.toString(), item.name]));
    res.json({
      admins: admins.map((admin) => ({
        ...formatAuthUser(admin),
        buildingName: admin.buildingId ? names.get(admin.buildingId.toString()) || '' : '',
        scope: admin.buildingId ? 'building' : 'company',
      })),
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/building-admins', async (req, res) => {
  try {
    requireCompanyAdmin(req.user);
    const { email, password, firstName, lastName, phone, buildingId } = req.body;
    if (!email || !password || !firstName || !lastName || !buildingId) {
      return res.status(400).json({ error: 'Nombre, correo, contraseña y conjunto son requeridos' });
    }

    const building = await Building.findOne({
      _id: buildingId,
      organizationId: req.user.organizationId,
      isActive: { $ne: false },
    });
    if (!building) return res.status(400).json({ error: 'Ese conjunto no pertenece a tu empresa' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: String(email).toLowerCase().trim(),
      passwordHash,
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      phone,
      role: 'ORG_ADMIN',
      organizationId: req.user.organizationId,
      buildingId: building._id,
    });

    res.status(201).json({
      admin: {
        ...formatAuthUser(user),
        buildingName: building.name,
        scope: 'building',
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Ese correo ya está registrado en esta empresa' });
    }
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.patch('/building', async (req, res) => {
  try {
    const { building } = await getOrgContext(req.user, req);
    if (!building) return res.status(400).json({ error: 'No hay conjunto configurado' });

    const updates = {};
    if (req.body.platformCommissionPercent != null) {
      const value = Number(req.body.platformCommissionPercent);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        return res.status(400).json({ error: 'Porcentaje inválido (0-100)' });
      }
      updates.platformCommissionPercent = value;
    }

    if (req.body.heroImageUrl !== undefined) {
      const raw = req.body.heroImageUrl;
      if (raw === null || raw === '') {
        updates.heroImageUrl = null;
      } else {
        const value = String(raw).trim();
        if (!/^https?:\/\//i.test(value)) {
          return res.status(400).json({ error: 'La URL de la imagen debe comenzar con http:// o https://' });
        }
        updates.heroImageUrl = value;
      }
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No hay cambios para guardar' });
    }

    const updated = await Building.findByIdAndUpdate(building._id, updates, { new: true });
    res.json({ building: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/building/upload-hero', (req, res) => {
  uploadPublicationMedia.single('file')(req, res, async (uploadErr) => {
    if (uploadErr) {
      const message =
        uploadErr.code === 'LIMIT_FILE_SIZE'
          ? 'El archivo supera el límite de 50 MB.'
          : uploadErr.message;
      res.status(400).json({ error: message });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'Selecciona una imagen.' });
      return;
    }

    if (!req.file.mimetype.startsWith('image/')) {
      res.status(400).json({ error: 'Solo se permiten imágenes (JPG, PNG, WebP, GIF).' });
      return;
    }

    try {
      const { building, organization } = await getOrgContext(req.user, req);
      if (!building) {
        res.status(400).json({ error: 'No hay conjunto configurado' });
        return;
      }

      const heroImageUrl = await uploadBuildingHeroImage(
        req.file.buffer,
        req.file.mimetype,
        organization?._id?.toString() || building.organizationId?.toString(),
        building._id.toString()
      );

      const updated = await Building.findByIdAndUpdate(
        building._id,
        { heroImageUrl },
        { new: true }
      );

      res.status(201).json({ building: updated, heroImageUrl });
    } catch (err) {
      res.status(err.status || 400).json({ error: err.message });
    }
  });
});

router.get('/dashboard', async (req, res) => {
  try {
    const orgFilter = getOrganizationFilter(req.user);
    const { building } = await getOrgContext(req.user, req);
    if (!building) return res.json({ stats: {}, finance: {} });

    const buildingFilter = { buildingId: building._id, ...orgFilter };
    const unitIds = await Unit.find(buildingFilter).distinct('_id');
    const unitFilter = { unitId: { $in: unitIds } };
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
      Resident.countDocuments({ ...orgFilter, ...unitFilter }),
      Payment.countDocuments({ ...orgFilter, ...unitFilter, status: 'paid' }),
      Payment.countDocuments({ ...orgFilter, ...unitFilter, status: 'overdue' }),
      VisitorParking.countDocuments(buildingFilter),
      Payment.find({ ...orgFilter, ...unitFilter }),
      Payment.find({ ...orgFilter, ...unitFilter, period: currentPeriod }),
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
      .sort({ type: 1, floor: 1, number: 1 });

    res.json({ units });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/units', async (req, res) => {
  try {
    const { building, organization } = await getOrgContext(req.user, req);
    if (!building) return res.status(400).json({ error: 'No hay conjunto configurado' });

    let towerName = req.body.tower;
    let towerDoc = null;
    if (req.body.towerId && !towerName) {
      towerDoc = await Tower.findById(req.body.towerId);
      towerName = towerDoc?.name;
    } else if (req.body.towerId) {
      towerDoc = await Tower.findById(req.body.towerId);
    }

    const administrationFee =
      parseAdministrationFee(req.body.administrationFee) ??
      getBillingSettings(organization).defaultAdministrationFee ??
      undefined;

    const code = parseUnitCode(req.body.code);

    const unit = await Unit.create({
      organizationId: building.organizationId,
      buildingId: building._id,
      towerId: req.body.towerId || null,
      number: req.body.number,
      code: code || undefined,
      tower: towerName,
      floor: req.body.floor,
      type: req.body.type || 'apartment',
      areaSqm: req.body.areaSqm,
      administrationFee,
      adminStatus: req.body.adminStatus || 'current',
    });

    res.status(201).json({ unit });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/units/bulk', async (req, res) => {
  try {
    const { building, organization } = await getOrgContext(req.user, req);
    if (!building) return res.status(400).json({ error: 'No hay conjunto configurado' });

    const defaultFee = getBillingSettings(organization).defaultAdministrationFee;

    const { towerId, units: items } = req.body;
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'Debes enviar al menos una unidad' });
    }

    let towerName = null;
    let towerDoc = null;
    if (towerId) {
      towerDoc = await Tower.findById(towerId);
      if (!towerDoc) return res.status(404).json({ error: 'Torre no encontrada' });
      towerName = towerDoc.name;
    }

    const created = [];
    const errors = [];

    for (const item of items) {
      const number = item.number?.trim();
      if (!number) continue;

      try {
        const floor = parseUnitFloor(item.floor);
        const code = parseUnitCode(item.code);

        const unit = await Unit.create({
          organizationId: building.organizationId,
          buildingId: building._id,
          towerId: towerId || null,
          tower: towerName || item.tower || undefined,
          number,
          code: code || undefined,
          floor,
          type: item.type || 'apartment',
          areaSqm: item.areaSqm,
          administrationFee:
            parseAdministrationFee(item.administrationFee) ?? defaultFee ?? undefined,
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
  const message =
    writeError.errmsg ||
    writeError.err?.errmsg ||
    writeError.err?.message ||
    writeError.message ||
    '';
  if (writeError.code === 11000) {
    if (message.includes('code')) return 'Código de unidad duplicado en este conjunto';
    return 'Número de unidad duplicado en este conjunto';
  }
  return message || `Error de base de datos (${writeError.code || 'desconocido'})`;
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
          administrationFee: sourceUnit.administrationFee,
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

router.post('/units/apply-default-fee', async (req, res) => {
  try {
    const { building, organization } = await getOrgContext(req.user, req);
    if (!building) return res.status(400).json({ error: 'No hay conjunto configurado' });

    const defaultFee = getBillingSettings(organization).defaultAdministrationFee;
    if (defaultFee == null) {
      return res.status(400).json({ error: 'Configura primero el valor de administración por defecto' });
    }

    const { towerId, overwrite = false } = req.body;
    const filter = { buildingId: building._id };
    if (towerId) filter.towerId = towerId;
    if (!overwrite) {
      filter.$or = [{ administrationFee: null }, { administrationFee: { $exists: false } }];
    }

    const result = await Unit.updateMany(filter, { $set: { administrationFee: defaultFee } });

    res.json({
      updated: result.modifiedCount,
      defaultAdministrationFee: defaultFee,
      towerId: towerId || null,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/units/:id', async (req, res) => {
  try {
    const allowed = [
      'number',
      'code',
      'towerId',
      'tower',
      'floor',
      'type',
      'areaSqm',
      'administrationFee',
      'adminStatus',
      'isActive',
    ];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowed.includes(key))
    );
    if (updates.administrationFee !== undefined) {
      updates.administrationFee =
        updates.administrationFee === null || updates.administrationFee === ''
          ? null
          : parseAdministrationFee(updates.administrationFee);
    }
    if (updates.code !== undefined) {
      updates.code = updates.code?.trim() || null;
    }
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

// —— Servicios a domicilio (Rentados) ——
router.get('/home-services', async (req, res) => {
  try {
    const { organization } = await getOrgContext(req.user, req);
    if (!organization) return res.json({ services: [] });
    const services = await listRentadosHomeServicesForAdmin(organization._id);
    res.json({ services });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/home-services/:id', async (req, res) => {
  try {
    const { organization } = await getOrgContext(req.user, req);
    const service = await RentadosHomeService.findOne({
      _id: req.params.id,
      organizationId: organization._id,
    });
    if (!service) return res.status(404).json({ error: 'Servicio no encontrado' });

    if (req.body.name != null) service.name = String(req.body.name).trim();
    if (req.body.description != null) service.description = String(req.body.description).trim();
    if (req.body.imageUrl != null) service.imageUrl = String(req.body.imageUrl).trim();
    if (req.body.sortOrder != null) service.sortOrder = Number(req.body.sortOrder);
    if (req.body.isActive !== undefined) service.isActive = Boolean(req.body.isActive);

    await service.save();
    res.json({ service: formatRentadosHomeService(service) });
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
    if (!req.file || !req.file.mimetype.startsWith('image/')) {
      res.status(400).json({ error: 'Selecciona una imagen válida.' });
      return;
    }

    try {
      const { organization } = await getOrgContext(req.user, req);
      const service = await RentadosHomeService.findOne({
        _id: req.params.id,
        organizationId: organization._id,
      });
      if (!service) {
        res.status(404).json({ error: 'Servicio no encontrado' });
        return;
      }

      const imageUrl = await uploadRentadosHomeServiceImage(
        req.file.buffer,
        req.file.mimetype,
        organization._id.toString(),
        service._id.toString()
      );
      service.imageUrl = imageUrl;
      await service.save();
      res.json({ service: formatRentadosHomeService(service), imageUrl });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
});

// —— Servicios / áreas comunes ——
function formatFacility(facility) {
  const doc = facility?.toObject ? facility.toObject() : facility;
  if (!doc) return doc;
  return { ...doc, openHours: normalizeOpenHours(doc.openHours) };
}

router.get('/facilities', async (req, res) => {
  try {
    const { building } = await getOrgContext(req.user, req);
    if (!building) return res.json({ facilities: [] });

    const facilities = await Facility.find({ buildingId: building._id }).sort({ name: 1 });
    res.json({ facilities: facilities.map(formatFacility) });
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
      open24Hours: req.body.open24Hours ?? false,
      openHours: req.body.open24Hours
        ? { start: '00:00', end: '00:00' }
        : normalizeOpenHours(req.body.openHours),
      seasonOpenDate: req.body.open24Hours ? undefined : req.body.seasonOpenDate,
      seasonCloseDate: req.body.open24Hours ? undefined : req.body.seasonCloseDate,
      status: req.body.status || 'open',
      price: req.body.price ?? 0,
      currency: req.body.currency,
      pricingType: req.body.pricingType || 'free',
      blockWhenOverdue: req.body.blockWhenOverdue ?? true,
      bookable: req.body.bookable ?? false,
      bookingPricing: req.body.bookingPricing,
      bookingRules: req.body.bookingRules,
    });

    res.status(201).json({ facility: formatFacility(facility) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/facilities/:id', async (req, res) => {
  try {
    const { building } = await getOrgContext(req.user, req);
    const facility = await Facility.findOne({
      _id: req.params.id,
      ...(building ? { buildingId: building._id } : getOrganizationFilter(req.user)),
    });
    if (!facility) return res.status(404).json({ error: 'Servicio no encontrado' });

    const allowed = [
      'name',
      'description',
      'icon',
      'capacity',
      'requiresApproval',
      'open24Hours',
      'openHours',
      'seasonOpenDate',
      'seasonCloseDate',
      'status',
      'price',
      'currency',
      'pricingType',
      'blockWhenOverdue',
      'isActive',
      'bookable',
      'bookingPricing',
      'bookingRules',
    ];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowed.includes(key))
    );

    if (updates.name && updates.name !== facility.name) {
      updates.slug = updates.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    if (updates.open24Hours) {
      updates.openHours = { start: '00:00', end: '00:00' };
      updates.seasonOpenDate = undefined;
      updates.seasonCloseDate = undefined;
    } else if (updates.openHours) {
      updates.openHours = normalizeOpenHours(updates.openHours);
    }

    Object.assign(facility, updates);
    await facility.save();
    res.json({ facility: formatFacility(facility) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/facilities/:id', async (req, res) => {
  try {
    const { building } = await getOrgContext(req.user, req);
    const facility = await Facility.findOne({
      _id: req.params.id,
      ...(building ? { buildingId: building._id } : getOrganizationFilter(req.user)),
    });
    if (!facility) return res.status(404).json({ error: 'Servicio no encontrado' });

    const inSuspensions = await ServiceSuspension.countDocuments({
      facilityIds: facility._id,
      isActive: true,
    });
    if (inSuspensions > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar: hay suspensiones activas vinculadas a este servicio',
      });
    }

    await facility.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/facility-bookings', async (req, res) => {
  try {
    const { building } = await getOrgContext(req.user, req);
    if (!building) return res.json({ bookings: [], facilities: [] });

    const { from, to, facilityId } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: 'Indica from y to (ISO date)' });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    const filter = {
      buildingId: building._id,
      status: { $in: ACTIVE_STATUSES },
      startAt: { $lt: toDate },
      endAt: { $gt: fromDate },
    };
    if (facilityId && mongoose.Types.ObjectId.isValid(facilityId)) {
      filter.facilityId = facilityId;
    }

    const [bookings, facilities] = await Promise.all([
      FacilityBooking.find(filter)
        .populate({ path: 'residentId', populate: { path: 'userId', select: 'firstName lastName' } })
        .populate('unitId', 'number type')
        .populate('facilityId', 'name slug openHours bookingRules bookingPricing bookable')
        .sort({ startAt: 1 }),
      Facility.find({ buildingId: building._id, bookable: true, isActive: true }).sort({ name: 1 }),
    ]);

    res.json({
      facilities: facilities.map(formatFacility),
      bookings: bookings.map((b) => formatBookingEvent(b, { showResidentDetails: true })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/facility-bookings', async (req, res) => {
  try {
    const { building } = await getOrgContext(req.user, req);
    if (!building) return res.status(400).json({ error: 'No hay conjunto configurado' });

    const { facilityId, residentId, startAt, endAt, blockIndex, notes } = req.body;
    const facility = await Facility.findOne({ _id: facilityId, buildingId: building._id, bookable: true });
    if (!facility) return res.status(404).json({ error: 'Servicio reservable no encontrado' });
    if (facility.status !== 'open') {
      return res.status(400).json({ error: 'El servicio no está disponible para reservas' });
    }

    const resident = await Resident.findOne({ _id: residentId, organizationId: building.organizationId }).populate(
      'unitId',
      'number buildingId adminStatus'
    );
    if (!resident) return res.status(404).json({ error: 'Residente no encontrado' });

    const { start, end, durationMinutes, priceInfo } = resolveBookingWindow(
      facility,
      startAt,
      endAt,
      blockIndex
    );
    await assertBookingAvailable(facility, start, end);

    const booking = await FacilityBooking.create({
      organizationId: building.organizationId,
      buildingId: building._id,
      facilityId: facility._id,
      residentId: resident._id,
      unitId: resident.unitId._id,
      createdByUserId: req.user._id,
      startAt: start,
      endAt: end,
      durationMinutes,
      totalPrice: priceInfo.totalPrice,
      currency: facility.currency || 'COP',
      pricingMode: priceInfo.pricingMode,
      pricingLabel: priceInfo.blockLabel,
      notes,
      status: priceInfo.totalPrice > 0 ? 'awaiting_payment' : facility.requiresApproval ? 'pending' : 'confirmed',
    });

    if (booking.status === 'awaiting_payment') {
      booking.status = 'confirmed';
      booking.paidAt = new Date();
      await booking.save();
    }

    await booking.populate([
      { path: 'residentId', populate: { path: 'userId', select: 'firstName lastName' } },
      { path: 'unitId', select: 'number type tower' },
      { path: 'facilityId', select: 'name slug' },
    ]);

    const { notifyPorteriaNewFacilityBooking } = require('../utils/porteriaPush');
    notifyPorteriaNewFacilityBooking(booking).catch(() => {});
    const { pushFacilityBookingResidents } = require('../utils/residentPush');
    pushFacilityBookingResidents(booking, 'created').catch(() => {});

    res.status(201).json({ booking: formatBookingEvent(booking, { showResidentDetails: true }) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/facility-bookings/:id', async (req, res) => {
  try {
    const { building } = await getOrgContext(req.user, req);
    const booking = await FacilityBooking.findOne({
      _id: req.params.id,
      ...(building ? { buildingId: building._id } : getOrganizationFilter(req.user)),
    });
    if (!booking) return res.status(404).json({ error: 'Reserva no encontrada' });

    const previousStatus = booking.status;

    if (req.body.status === 'confirmed') booking.status = 'confirmed';
    if (req.body.status === 'cancelled') {
      booking.status = 'cancelled';
      booking.cancelledAt = new Date();
      booking.cancelReason = req.body.cancelReason || 'Cancelada por administración';
    }
    if (req.body.notes != null) booking.notes = req.body.notes;

    await booking.save();
    if (booking.status === 'cancelled') {
      await voidPendingBookingPayment(booking, booking.cancelReason);
    }
    await booking.populate([
      { path: 'residentId', populate: { path: 'userId', select: 'firstName lastName' } },
      { path: 'unitId', select: 'number type tower' },
      { path: 'facilityId', select: 'name slug' },
    ]);

    if (previousStatus !== booking.status) {
      const { pushFacilityBookingResidents } = require('../utils/residentPush');
      if (booking.status === 'confirmed') {
        pushFacilityBookingResidents(booking, 'confirmed').catch(() => {});
      } else if (booking.status === 'cancelled') {
        pushFacilityBookingResidents(booking, 'cancelled').catch(() => {});
      }
    }

    res.json({ booking: formatBookingEvent(booking, { showResidentDetails: true }) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/facility-bookings/:id', async (req, res) => {
  try {
    const { building } = await getOrgContext(req.user, req);
    const booking = await FacilityBooking.findOne({
      _id: req.params.id,
      ...(building ? { buildingId: building._id } : getOrganizationFilter(req.user)),
    });
    if (!booking) return res.status(404).json({ error: 'Reserva no encontrada' });

    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.cancelReason = 'Eliminada por administración';
    await booking.save();
    await voidPendingBookingPayment(booking, booking.cancelReason);

    await booking.populate([
      { path: 'facilityId', select: 'name' },
      { path: 'unitId', select: 'number tower' },
    ]);
    const { pushFacilityBookingResidents } = require('../utils/residentPush');
    pushFacilityBookingResidents(booking, 'cancelled').catch(() => {});

    res.json({ ok: true });
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
    const { building } = await getOrgContext(req.user, req);
    const filter = { ...orgFilter };
    if (building) filter.buildingId = building._id;
    const publications = await Publication.find(filter).sort({ publishedAt: -1 }).limit(50);
    res.json({ publications });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/publications/upload-media', (req, res) => {
  uploadPublicationMedia.single('file')(req, res, async (uploadErr) => {
    if (uploadErr) {
      const message =
        uploadErr.code === 'LIMIT_FILE_SIZE'
          ? 'El archivo supera el límite de 50 MB.'
          : uploadErr.message;
      res.status(400).json({ error: message });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'Selecciona un archivo de imagen o video.' });
      return;
    }

    try {
      const orgId = req.user.organizationId?.toString();
      const media = await uploadPublicationFile(
        req.file.buffer,
        req.file.mimetype,
        orgId
      );
      res.status(201).json({ media });
    } catch (err) {
      res.status(err.status || 400).json({ error: err.message });
    }
  });
});

router.post('/publications', async (req, res) => {
  try {
    const { building } = await getOrgContext(req.user, req);
    const audience = await resolvePublicationAudience(req.body, building);
    const publication = await Publication.create({
      organizationId: building?.organizationId || req.user.organizationId,
      buildingId: building?._id,
      audienceScope: audience.audienceScope,
      audienceTowerIds: audience.audienceTowerIds,
      audienceUnitIds: audience.audienceUnitIds,
      title: req.body.title,
      body: req.body.body,
      media: req.body.media || [],
      isPinned: req.body.isPinned,
      publishedAt: req.body.publishedAt,
      expiresAt: req.body.expiresAt,
      createdBy: req.user._id,
    });

    const { notifyNewPublication } = require('../utils/pushNotifications');
    notifyNewPublication(publication).catch(() => {});

    res.status(201).json({ publication });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.delete('/publications/:id', async (req, res) => {
  try {
    const orgFilter = getOrganizationFilter(req.user);
    const publication = await Publication.findOne({ _id: req.params.id, ...orgFilter });
    if (!publication) {
      res.status(404).json({ error: 'Publicación no encontrada' });
      return;
    }

    try {
      await deletePublicationMedia(publication.media);
    } catch (cloudErr) {
      console.warn('No se pudo eliminar media en Cloudinary:', cloudErr.message);
    }

    await publication.deleteOne();
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

router.get('/porteria-settings', async (req, res) => {
  try {
    const { organization } = await getOrgContext(req.user, req);
    if (!organization) return res.status(404).json({ error: 'Organización no encontrada' });

    res.json({
      locker: getLockerSettings(organization),
      organizationId: organization._id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/porteria-settings', async (req, res) => {
  try {
    const { organization } = await getOrgContext(req.user, req);
    if (!organization) return res.status(404).json({ error: 'Organización no encontrada' });

    const current = getLockerSettings(organization);
    const locker = {
      ...current,
      ...req.body,
    };

    organization.settings = organization.settings || {};
    organization.settings.locker = locker;
    organization.markModified('settings.locker');
    await organization.save();

    res.json({ locker: getLockerSettings(organization) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/contact-settings', async (req, res) => {
  try {
    const { organization } = await getOrgContext(req.user, req);
    if (!organization) return res.status(404).json({ error: 'Organización no encontrada' });
    res.json({ contacts: getContactSettings(organization) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/contact-settings', async (req, res) => {
  try {
    const { organization } = await getOrgContext(req.user, req);
    if (!organization) return res.status(404).json({ error: 'Organización no encontrada' });

    const current = getContactSettings(organization);
    const contacts = { ...current };

    if (req.body.receptionWhatsapp !== undefined) {
      const raw = String(req.body.receptionWhatsapp || '').trim();
      contacts.receptionWhatsapp = raw ? normalizeWhatsappNumber(raw) : '';
    }
    if (req.body.adminWhatsapp !== undefined) {
      const raw = String(req.body.adminWhatsapp || '').trim();
      contacts.adminWhatsapp = raw ? normalizeWhatsappNumber(raw) : '';
    }

    organization.settings = organization.settings || {};
    organization.settings.contacts = contacts;
    organization.markModified('settings.contacts');
    await organization.save();

    res.json({ contacts: getContactSettings(organization) });
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

router.post('/payments', async (req, res) => {
  try {
    const { organization } = await getOrgContext(req.user, req);
    const billingSettings = getBillingSettings(organization);
    const {
      settleAdministration,
      settleAdministrationLine,
      settleBookingPayment,
      settleOpenPayment,
      paymentMethod,
      notes: notesInput,
      ...body
    } = req.body;

    if (settleOpenPayment && body.paymentId && !settleBookingPayment) {
      const resident = await Resident.findOne({
        _id: body.residentId,
        organizationId: organization._id,
      }).populate('unitId');

      if (!resident?.unitId) {
        return res.status(400).json({ error: 'Residente no encontrado' });
      }

      const methodLabel =
        paymentMethod === 'transfer'
          ? 'Transferencia'
          : paymentMethod === 'cash'
            ? 'Efectivo'
            : 'Pago en administración';
      const notes = [methodLabel, notesInput?.trim()].filter(Boolean).join(' · ');

      const openPayment = await Payment.findOne({
        _id: body.paymentId,
        organizationId: organization._id,
        unitId: resident.unitId._id,
      });
      if (!openPayment) {
        return res.status(404).json({ error: 'Pago no encontrado para esta unidad' });
      }

      const result = await settleSingleOpenPayment({
        paymentId: openPayment._id,
        organizationId: organization._id,
        notes,
        billingSettings,
      });

      try {
        const { syncPaidPayments } = require('../utils/accounting');
        await syncPaidPayments(result.payments);
      } catch (err) {
        console.error('No se pudo enviar el pago al software contable:', err.message);
      }

      await completeManualAdminPaymentSideEffects({
        payments: result.payments,
        residentId: body.residentId,
        unitId: resident.unitId._id,
        organizationId: organization._id,
        adminUserId: req.user._id,
        paymentMethod,
        notifyAmount: Math.round(Number(result.payment?.paidAmount || result.payment?.amount || 0)),
        conceptLabel: result.payment?.conceptLabel || result.payment?.concept,
      });

      return res.status(201).json(result);
    }

    if (settleBookingPayment && body.paymentId) {
      const resident = await Resident.findOne({
        _id: body.residentId,
        organizationId: organization._id,
      }).populate('unitId');

      if (!resident?.unitId) {
        return res.status(400).json({ error: 'Residente no encontrado' });
      }

      const openPayment = await Payment.findOne({
        _id: body.paymentId,
        organizationId: organization._id,
        unitId: resident.unitId._id,
        status: { $in: ['pending', 'overdue', 'partial'] },
      });
      if (!openPayment) {
        return res.status(404).json({ error: 'Pago no encontrado para esta unidad' });
      }

      const methodLabel =
        paymentMethod === 'transfer'
          ? 'Transferencia'
          : paymentMethod === 'cash'
            ? 'Efectivo'
            : 'Pago en administración';
      const notes = [methodLabel, notesInput?.trim()].filter(Boolean).join(' · ');

      const result = await registerManualBookingPayment({
        paymentId: openPayment._id,
        organizationId: organization._id,
        notes,
      });

      try {
        const { syncPaidPayments } = require('../utils/accounting');
        if (result.payment) await syncPaidPayments([result.payment]);
      } catch (err) {
        console.error('No se pudo enviar el pago al software contable:', err.message);
      }

      await completeManualAdminPaymentSideEffects({
        payments: result.payment ? [result.payment] : [],
        residentId: body.residentId,
        unitId: resident.unitId._id,
        organizationId: organization._id,
        adminUserId: req.user._id,
        paymentMethod,
        notifyAmount: Math.round(Number(result.payment?.amount || 0)),
        conceptLabel: result.payment?.conceptLabel || 'reserva',
      });

      return res.status(201).json({
        payment: result.payment,
        booking: result.booking,
        payments: result.payment ? [result.payment] : [],
      });
    }

    if (settleAdministration || settleAdministrationLine) {
      const resident = await Resident.findOne({
        _id: body.residentId,
        organizationId: organization._id,
      }).populate('unitId');

      if (!resident?.unitId) {
        return res.status(400).json({ error: 'Residente no encontrado' });
      }

      await syncAdministrationCharges({
        unit: resident.unitId,
        organizationId: organization._id,
        residentId: resident._id,
        billingSettings,
      });

      const amount = Math.round(Number(body.amount));
      const methodLabel =
        paymentMethod === 'transfer'
          ? 'Transferencia'
          : paymentMethod === 'cash'
            ? 'Efectivo'
            : 'Pago en administración';
      const notes = [methodLabel, notesInput?.trim()].filter(Boolean).join(' · ');

      if (settleAdministrationLine && body.paymentId) {
        const payment = await settleSingleAdministrationPayment({
          paymentId: body.paymentId,
          organizationId: organization._id,
          unitId: resident.unitId._id,
          amount,
          billingSettings,
          notes,
        });

        const updatedUnit = await Unit.findById(resident.unitId._id);
        if (updatedUnit?.adminStatus !== 'overdue') {
          await releaseHeldLockerPackages(resident.unitId._id, organization);
        }

        try {
          const { syncPaidPayments } = require('../utils/accounting');
          await syncPaidPayments([payment]);
        } catch (err) {
          console.error('No se pudo enviar el pago al software contable:', err.message);
        }

        await completeManualAdminPaymentSideEffects({
          payments: [payment],
          residentId: resident._id,
          unitId: resident.unitId._id,
          organizationId: organization._id,
          adminUserId: req.user._id,
          paymentMethod,
          notifyAmount: amount,
          conceptLabel: 'administración',
        });

        return res.status(201).json({ payment, payments: [payment] });
      }

      const payments = await settleAdministrationPayments({
        organizationId: organization._id,
        unitId: resident.unitId._id,
        amount,
        billingSettings,
        notes,
      });

      if (resident.unitId.adminStatus !== 'overdue') {
        await releaseHeldLockerPackages(resident.unitId._id, organization);
      }

      try {
        const { syncPaidPayments } = require('../utils/accounting');
        await syncPaidPayments(payments);
      } catch (err) {
        console.error('No se pudo enviar el pago al software contable:', err.message);
      }

      await completeManualAdminPaymentSideEffects({
        payments,
        residentId: resident._id,
        unitId: resident.unitId._id,
        organizationId: organization._id,
        adminUserId: req.user._id,
        paymentMethod,
        notifyAmount: amount,
        conceptLabel: 'administración',
      });

      return res.status(201).json({
        payment: payments[payments.length - 1],
        payments,
      });
    }

    const methodLabel =
      paymentMethod === 'transfer'
        ? 'Transferencia'
        : paymentMethod === 'cash'
          ? 'Efectivo'
          : null;
    const mergedNotes = [methodLabel, notesInput?.trim()].filter(Boolean).join(' · ');

    const result = await registerPayment(
      { ...body, notes: mergedNotes || notesInput },
      {
        organization,
        userId: req.user._id,
      }
    );

    if (body.residentId && result.payments?.length) {
      const resident = await Resident.findById(body.residentId).select('unitId');
      await completeManualAdminPaymentSideEffects({
        payments: result.payments,
        residentId: body.residentId,
        unitId: resident?.unitId,
        organizationId: organization._id,
        adminUserId: req.user._id,
        paymentMethod,
        notifyAmount: Math.round(Number(body.amount || 0)),
        conceptLabel: result.payment?.conceptLabel || result.payment?.concept,
      });
    }

    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.patch('/payments/:id', async (req, res) => {
  try {
    const { organization } = await getOrgContext(req.user, req);
    const billingSettings = getBillingSettings(organization);
    const payment = await updateManualAdminPayment({
      paymentId: req.params.id,
      organizationId: organization._id,
      adminUserId: req.user._id,
      billingSettings,
      paymentMethod: req.body.paymentMethod,
      notes: req.body.notes,
      amount: req.body.amount,
    });
    res.json({ payment });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.post('/payments/:id/void', async (req, res) => {
  try {
    const { organization } = await getOrgContext(req.user, req);
    const billingSettings = getBillingSettings(organization);
    const payment = await voidManualAdminPayment({
      paymentId: req.params.id,
      organizationId: organization._id,
      adminUserId: req.user._id,
      billingSettings,
    });
    res.json({ payment });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.get('/cartera', async (req, res) => {
  try {
    const orgFilter = getOrganizationFilter(req.user);
    const { view, period: periodQuery, from, to } = req.query;
    const { organization, building } = await getOrgContext(req.user, req);
    if (building) {
      const unitIds = await Unit.find({
        buildingId: building._id,
        organizationId: organization?._id || building.organizationId,
      }).distinct('_id');
      orgFilter.unitId = { $in: unitIds };
    }
    const billingSettings = getBillingSettings(organization);

    const now = new Date();
    const currentPeriod =
      periodQuery || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const populateOpts = { path: 'unitId', select: 'number type tower adminStatus code' };

    function applyDueDateRange(filter) {
      if (!from && !to) return filter;
      const dueDate = {};
      if (from) {
        const start = new Date(`${from}T00:00:00`);
        if (!Number.isNaN(start.getTime())) dueDate.$gte = start;
      }
      if (to) {
        const end = new Date(`${to}T23:59:59.999`);
        if (!Number.isNaN(end.getTime())) dueDate.$lte = end;
      }
      if (Object.keys(dueDate).length) filter.dueDate = dueDate;
      return filter;
    }

    const sum = (items, pick) => items.reduce((acc, p) => acc + pick(p), 0);

    if (view) {
      let filter = { ...orgFilter };
      let payments = [];

      switch (view) {
        case 'cartera-actual':
          filter.status = { $in: ['pending', 'overdue'] };
          applyDueDateRange(filter);
          payments = await Payment.find(filter).populate(populateOpts).sort({ dueDate: -1 });
          break;
        case 'recaudo':
          filter = { ...orgFilter, period: currentPeriod, status: 'paid' };
          applyDueDateRange(filter);
          payments = await Payment.find(filter).populate(populateOpts).sort({ paidAt: -1, dueDate: -1 });
          break;
        case 'morosidad':
          filter = { ...orgFilter, status: 'overdue' };
          applyDueDateRange(filter);
          payments = await Payment.find(filter).populate(populateOpts).sort({ dueDate: -1 });
          break;
        case 'pendiente':
          filter = { ...orgFilter, period: currentPeriod, status: 'pending' };
          applyDueDateRange(filter);
          payments = await Payment.find(filter).populate(populateOpts).sort({ dueDate: -1 });
          break;
        case 'facturado':
          filter = { ...orgFilter, period: currentPeriod };
          applyDueDateRange(filter);
          payments = await Payment.find(filter).populate(populateOpts).sort({ dueDate: -1 });
          break;
        case 'tasa-recaudo':
          filter = { ...orgFilter, period: currentPeriod };
          applyDueDateRange(filter);
          payments = await Payment.find(filter).populate(populateOpts).sort({ status: 1, dueDate: -1 });
          break;
        default:
          return res.status(400).json({ error: 'Vista de cartera no válida' });
      }

      const enriched = payments.map((p) => enrichPayment(p, billingSettings));

      let detailTotal = 0;
      if (view === 'cartera-actual' || view === 'morosidad' || view === 'pendiente') {
        detailTotal = sum(enriched, (p) => p.amount - (p.paidAmount || 0));
      } else if (view === 'recaudo') {
        detailTotal = sum(enriched, (p) => p.paidAmount || p.amount);
      } else if (view === 'facturado') {
        detailTotal = sum(enriched, (p) => p.amount);
      } else if (view === 'tasa-recaudo') {
        const facturadoMes = sum(enriched, (p) => p.amount);
        const recaudoMes = sum(
          enriched.filter((p) => p.status === 'paid'),
          (p) => p.paidAmount || p.amount
        );
        const pendienteMes = sum(
          enriched.filter((p) => p.status === 'pending'),
          (p) => p.amount - (p.paidAmount || 0)
        );
        const morosidadMes = sum(
          enriched.filter((p) => p.status === 'overdue'),
          (p) => p.amount - (p.paidAmount || 0)
        );
        const tasaRecaudo = facturadoMes > 0 ? Math.round((recaudoMes / facturadoMes) * 100) : 0;

        return res.json({
          view,
          period: currentPeriod,
          billingSettings,
          breakdown: {
            facturadoMes,
            recaudoMes,
            pendienteMes,
            morosidadMes,
            tasaRecaudo,
          },
          summary: {
            total: enriched.length,
            paid: enriched.filter((p) => p.status === 'paid').length,
            pending: enriched.filter((p) => p.status === 'pending').length,
            overdue: enriched.filter((p) => p.status === 'overdue').length,
          },
          payments: enriched,
        });
      }

      return res.json({
        view,
        period: ['recaudo', 'pendiente', 'facturado'].includes(view) ? currentPeriod : null,
        billingSettings,
        detailTotal,
        summary: {
          total: enriched.length,
          totalInterest: enriched.reduce((acc, p) => acc + (p.interestAmount || 0), 0),
          totalDue: enriched.reduce((acc, p) => acc + (p.totalDue || 0), 0),
        },
        payments: enriched,
      });
    }

    const filter = { ...orgFilter };
    if (periodQuery) filter.period = periodQuery;
    applyDueDateRange(filter);

    const [paid, pending, overdue, rawPayments] = await Promise.all([
      Payment.countDocuments({ ...filter, status: 'paid' }),
      Payment.countDocuments({ ...filter, status: 'pending' }),
      Payment.countDocuments({ ...filter, status: 'overdue' }),
      Payment.find(filter).populate(populateOpts).sort({ dueDate: -1 }).limit(100),
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
    const { building } = await getOrgContext(req.user, req);
    const filter = { ...orgFilter };

    const residents = await Resident.find(filter)
      .populate('userId', 'firstName lastName email phone')
      .populate('unitId', 'number type tower adminStatus towerId code buildingId')
      .sort({ createdAt: -1 });

    let result = residents;
    if (building) {
      result = result.filter((resident) => resident.unitId?.buildingId?.toString() === building._id.toString());
    }

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
      result = result.filter((r) => {
        const unitTower = (r.unitId?.tower || r.unitId?.towerId?.name || '').toLowerCase();
        return unitTower === tower;
      });
    }

    if (req.query.relationship) {
      result = result.filter((r) => r.relationship === req.query.relationship);
    }

    if (req.query.q) {
      result = result.filter((r) => matchResidentQuery(r, req.query.q));
    }

    if (req.query.name) {
      result = result.filter((r) => matchResidentName(r, req.query.name));
    }

    if (req.query.username) {
      result = result.filter((r) => matchResidentUsername(r, req.query.username));
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
      .populate('unitId', 'number type tower adminStatus areaSqm buildingId');

    if (!resident) return res.status(404).json({ error: 'Residente no encontrado' });

    const { organization, building } = await getOrgContext(req.user, req);
    if (building && resident.unitId?.buildingId?.toString() !== building._id.toString()) {
      return res.status(404).json({ error: 'Residente no encontrado' });
    }
    const billingSettings = getBillingSettings(organization);

    await syncAdministrationCharges({
      unit: resident.unitId,
      organizationId: organization._id,
      residentId: resident._id,
      billingSettings,
    });

    await voidPaymentsForCancelledBookings({
      unitId: resident.unitId._id,
      organizationId: organization._id,
    });

    const payments = await Payment.find({ unitId: resident.unitId._id })
      .populate('facilityId', 'name')
      .populate('facilityBookingId', 'startAt endAt status')
      .sort({ paidAt: -1, dueDate: -1 })
      .limit(72);

    const enriched = payments.map((p) => enrichPayment(p, billingSettings));
    const adminOutstanding = buildAdministrationOutstanding(enriched);
    const openPayments = enriched.filter((p) =>
      ['pending', 'overdue', 'partial'].includes(p.status)
    );
    const totalOpenDue = openPayments.reduce(
      (sum, p) => sum + Number(p.totalDue ?? Math.max(0, p.amount - (p.paidAmount || 0))),
      0
    );

    res.json({
      resident,
      payments: enriched,
      adminOutstanding,
      totalOpenDue,
      openPayments,
      monthlyAdministrationFee: getUnitAdministrationFee(resident.unitId, billingSettings),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/residents', async (req, res) => {
  try {
    const { building } = await getOrgContext(req.user, req);
    const { email, password, firstName, lastName, phone, unitId, relationship } = req.body;

    if (!email || !password || !firstName || !lastName || !unitId) {
      return res.status(400).json({ error: 'Usuario, contraseña, nombre y unidad son requeridos' });
    }

    const unit = await Unit.findById(unitId);
    if (!unit) return res.status(404).json({ error: 'Unidad no encontrada' });

    const organizationId = building?.organizationId || unit.organizationId;
    const existing = await User.findOne({
      email: String(email).trim().toLowerCase(),
      organizationId,
    });
    if (existing) {
      return res.status(400).json({ error: 'Este usuario ya está registrado en este conjunto' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: String(email).trim().toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      phone,
      role: 'RESIDENT',
      organizationId,
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
      return res.status(400).json({ error: 'Este usuario ya está registrado en este conjunto' });
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

router.use('/accounting', require('./accountingAdmin'));

module.exports = router;
