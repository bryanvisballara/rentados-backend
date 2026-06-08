const { LockerPackage, Resident, ResidentNotification, Unit, VisitorParkingVisit } = require('../models');
const { getLockerSettings } = require('./lockerSettings');
const { notifyUnitResidents } = require('./porteriaNotify');

function formatPackage(pkg) {
  const doc = pkg?.toObject ? pkg.toObject() : pkg;
  if (!doc) return doc;

  const resident = doc.residentId;
  const unit = doc.unitId;
  const registeredBy = doc.registeredBy;
  const pickedUpBy = doc.pickedUpBy;

  return {
    ...doc,
    residentName: resident?.userId
      ? `${resident.userId.firstName || ''} ${resident.userId.lastName || ''}`.trim()
      : undefined,
    unitNumber: unit?.number,
    unitTower: unit?.tower,
    unitAdminStatus: unit?.adminStatus,
    registeredByName: registeredBy
      ? `${registeredBy.firstName || ''} ${registeredBy.lastName || ''}`.trim()
      : undefined,
    pickedUpByName: pickedUpBy
      ? `${pickedUpBy.firstName || ''} ${pickedUpBy.lastName || ''}`.trim()
      : undefined,
  };
}

async function notifyUnitAboutPackage(pkg, unitId, organization) {
  const body = pkg.comment?.trim()
    ? `Tienes un paquete en portería: ${pkg.comment.trim()}`
    : 'Tienes un paquete esperando en portería. Pasa a recogerlo.';

  const notifications = await notifyUnitResidents({
    organization,
    unitId,
    type: 'locker_package',
    title: 'Paquete en casillero',
    body,
    imageUrl: pkg.photoUrl,
    lockerPackageId: pkg._id,
  });

  if (notifications.length > 0) {
    pkg.notificationSent = true;
    pkg.notificationSentAt = new Date();
    if (pkg.status === 'held') pkg.status = 'pending_pickup';
    await pkg.save();
  }

  return notifications;
}

async function resolvePackageTarget(input, organization, building) {
  if (input.unitId) {
    const unit = await Unit.findOne({
      _id: input.unitId,
      organizationId: organization._id,
      buildingId: building._id,
      isActive: true,
    });

    if (!unit) throw new Error('Unidad no encontrada');

    const resident = await Resident.findOne({
      unitId: unit._id,
      organizationId: organization._id,
    }).sort({ isPrimary: -1, createdAt: 1 });

    return { unit, resident };
  }

  if (input.residentId) {
    const resident = await Resident.findOne({
      _id: input.residentId,
      organizationId: organization._id,
    }).populate('unitId', 'number adminStatus buildingId tower');

    if (!resident) throw new Error('Residente no encontrado');
    if (resident.unitId?.buildingId?.toString() !== building._id.toString()) {
      throw new Error('El residente no pertenece a este conjunto');
    }

    return { unit: resident.unitId, resident };
  }

  throw new Error('Selecciona la unidad destino');
}

async function registerLockerPackage(input, context) {
  const { organization, building, userId } = context;
  const settings = getLockerSettings(organization);

  if (!settings.enabled) {
    throw new Error('El servicio de casillero no está habilitado');
  }
  if (!building) {
    throw new Error('No hay conjunto configurado');
  }

  const photoUrl = input.photoUrl?.trim();
  if (!photoUrl) {
    throw new Error('La foto del paquete es obligatoria');
  }

  const { unit, resident } = await resolvePackageTarget(input, organization, building);
  const isOverdue = unit.adminStatus === 'overdue';

  if (isOverdue && !settings.receiveWhenOverdue) {
    throw new Error('Este conjunto no recibe paquetes para unidades en mora');
  }

  const shouldNotify = !isOverdue || settings.notifyWhenOverdue;
  const status = shouldNotify ? 'pending_pickup' : 'held';

  const pkg = await LockerPackage.create({
    organizationId: organization._id,
    buildingId: building._id,
    unitId: unit._id,
    residentId: resident?._id,
    registeredBy: userId,
    photoUrl,
    cloudinaryPublicId: input.cloudinaryPublicId,
    comment: input.comment?.trim() || undefined,
    status,
    notificationSent: false,
  });

  let notifiedCount = 0;
  if (shouldNotify) {
    const notifications = await notifyUnitAboutPackage(pkg, unit._id, organization);
    notifiedCount = notifications.length;
  }

  const populated = await LockerPackage.findById(pkg._id)
    .populate('registeredBy', 'firstName lastName')
    .populate({ path: 'residentId', populate: { path: 'userId', select: 'firstName lastName email' } })
    .populate('unitId', 'number tower adminStatus');

  return {
    package: formatPackage(populated),
    notified: notifiedCount > 0,
    heldDueToOverdue: status === 'held',
  };
}

async function releaseHeldLockerPackages(unitId, organization) {
  const settings = getLockerSettings(organization);
  if (!settings.enabled || !settings.notifyWhenOverdue) {
    return { released: 0 };
  }

  const unit = await Unit.findById(unitId);
  if (!unit || unit.adminStatus === 'overdue') {
    return { released: 0 };
  }

  const held = await LockerPackage.find({
    unitId,
    organizationId: organization._id,
    status: 'held',
  });

  let released = 0;
  for (const pkg of held) {
    const notifications = await notifyUnitAboutPackage(pkg, unitId, organization);
    if (notifications.length > 0) released += 1;
  }

  return { released };
}

async function markPackagePickedUp(packageId, context, options = {}) {
  const { organization, building, userId } = context;

  const pkg = await LockerPackage.findOne({
    _id: packageId,
    organizationId: organization._id,
    buildingId: building._id,
    status: { $in: ['pending_pickup', 'held'] },
  });

  if (!pkg) throw new Error('Paquete no encontrado o ya entregado');

  pkg.status = 'picked_up';
  pkg.pickedUpAt = new Date();
  pkg.pickedUpBy = userId;
  pkg.signatureRecipientName = options.signatureRecipientName?.trim() || undefined;
  pkg.signatureData = options.signatureData || undefined;
  await pkg.save();

  const populated = await LockerPackage.findById(pkg._id)
    .populate('registeredBy', 'firstName lastName')
    .populate('pickedUpBy', 'firstName lastName')
    .populate({ path: 'residentId', populate: { path: 'userId', select: 'firstName lastName' } })
    .populate('unitId', 'number tower adminStatus');

  return formatPackage(populated);
}

async function notifyHeldPackage(packageId, context) {
  const { organization, building } = context;
  const settings = getLockerSettings(organization);

  if (!settings.enabled) throw new Error('El servicio de casillero no está habilitado');

  const pkg = await LockerPackage.findOne({
    _id: packageId,
    organizationId: organization._id,
    buildingId: building._id,
    status: 'held',
  });

  if (!pkg) throw new Error('Paquete no encontrado o ya notificado');

  const unit = await Unit.findById(pkg.unitId);
  if (unit?.adminStatus === 'overdue') {
    throw new Error('La unidad sigue en mora; no se puede notificar al residente');
  }

  const notifications = await notifyUnitAboutPackage(pkg, pkg.unitId, organization);
  if (notifications.length === 0) {
    throw new Error('La unidad no tiene residentes en la app para notificar');
  }

  const populated = await LockerPackage.findById(pkg._id)
    .populate('registeredBy', 'firstName lastName')
    .populate({ path: 'residentId', populate: { path: 'userId', select: 'firstName lastName' } })
    .populate('unitId', 'number adminStatus');

  return formatPackage(populated);
}

async function getLockerSummaryByUnit(buildingId, organizationId) {
  const packages = await LockerPackage.find({
    buildingId,
    organizationId,
    status: { $in: ['pending_pickup', 'held'] },
  }).populate('unitId', 'number tower code');

  const byUnit = new Map();

  for (const pkg of packages) {
    const unitId = pkg.unitId?._id?.toString() || pkg.unitId?.toString();
    if (!unitId) continue;

    if (!byUnit.has(unitId)) {
      byUnit.set(unitId, {
        unitId,
        unitNumber: pkg.unitId?.number,
        unitCode: pkg.unitId?.code,
        tower: pkg.unitId?.tower,
        count: 0,
        packages: [],
      });
    }

    const entry = byUnit.get(unitId);
    entry.count += 1;
    entry.packages.push(formatPackage(pkg));
  }

  return Array.from(byUnit.values()).sort((a, b) =>
    String(a.unitNumber).localeCompare(String(b.unitNumber), 'es', { numeric: true })
  );
}

async function notifyLockerOverflow(unitId, context) {
  const { organization, building } = context;
  const settings = getLockerSettings(organization);
  if (!settings.enabled) throw new Error('El servicio de casillero no está habilitado');

  const count = await LockerPackage.countDocuments({
    unitId,
    organizationId: organization._id,
    buildingId: building._id,
    status: { $in: ['pending_pickup', 'held'] },
  });

  if (count < 5) {
    throw new Error('La unidad tiene menos de 5 paquetes pendientes');
  }

  const unit = await Unit.findById(unitId);
  if (!unit) throw new Error('Unidad no encontrada');

  await notifyUnitResidents({
    organization,
    unitId,
    type: 'locker_overflow',
    title: 'Muchos paquetes en portería',
    body: `Tienes ${count} paquetes registrados en portería. Por favor pasa a recogerlos o contacta a portería.`,
  });

  return { unitId, count, notified: true };
}

async function getBitacoraEntries(buildingId, organizationId, { unitId, limit = 100 } = {}) {
  const packageFilter = { buildingId, organizationId };
  const visitFilter = { buildingId, organizationId };

  if (unitId) {
    packageFilter.unitId = unitId;
    visitFilter.unitId = unitId;
  }

  const [packages, visits] = await Promise.all([
    LockerPackage.find(packageFilter)
      .populate('registeredBy', 'firstName lastName')
      .populate('pickedUpBy', 'firstName lastName')
      .populate({ path: 'residentId', populate: { path: 'userId', select: 'firstName lastName' } })
      .populate('unitId', 'number tower')
      .sort({ createdAt: -1 })
      .limit(limit),
    VisitorParkingVisit.find(visitFilter)
      .populate('registeredBy', 'firstName lastName')
      .populate('exitedBy', 'firstName lastName')
      .populate('spotId', 'spotNumber')
      .populate({ path: 'residentId', populate: { path: 'userId', select: 'firstName lastName' } })
      .populate('unitId', 'number tower')
      .sort({ entryAt: -1 })
      .limit(limit),
  ]);

  const entries = [];

  for (const pkg of packages) {
    const formatted = formatPackage(pkg);
    entries.push({
      id: pkg._id,
      kind: 'package',
      unitNumber: formatted.unitNumber,
      tower: formatted.unitTower,
      description: formatted.comment || 'Paquete registrado',
      status: formatted.status,
      receivedBy: formatted.registeredByName,
      receivedAt: formatted.createdAt,
      deliveredBy: formatted.pickedUpByName,
      deliveredAt: formatted.pickedUpAt,
      signatureRecipientName: formatted.signatureRecipientName,
      photoUrl: formatted.photoUrl,
    });
  }

  for (const visit of visits) {
    const formatted = formatVisitFromDoc(visit);
    entries.push({
      id: visit._id,
      kind: 'visitor',
      unitNumber: formatted.unitNumber,
      tower: formatted.tower || visit.unitId?.tower,
      description: `Visita placa ${formatted.licensePlate}${formatted.visitorName ? ` · ${formatted.visitorName}` : ''}`,
      status: formatted.status,
      receivedBy: formatted.registeredByName,
      receivedAt: formatted.entryAt,
      deliveredBy: formatted.exitedByName,
      deliveredAt: formatted.exitAt,
      licensePlate: formatted.licensePlate,
      spotNumber: formatted.spotNumber,
    });
  }

  entries.sort((a, b) => {
    const dateA = new Date(a.receivedAt || 0).getTime();
    const dateB = new Date(b.receivedAt || 0).getTime();
    return dateB - dateA;
  });

  return entries.slice(0, limit);
}

function formatVisitFromDoc(visit) {
  const doc = visit?.toObject ? visit.toObject() : visit;
  return {
    licensePlate: doc.licensePlate,
    visitorName: doc.visitorName,
    status: doc.status,
    entryAt: doc.entryAt,
    exitAt: doc.exitAt,
    tower: doc.tower,
    unitNumber: doc.unitId?.number,
    spotNumber: doc.spotId?.spotNumber,
    registeredByName: doc.registeredBy
      ? `${doc.registeredBy.firstName || ''} ${doc.registeredBy.lastName || ''}`.trim()
      : undefined,
    exitedByName: doc.exitedBy
      ? `${doc.exitedBy.firstName || ''} ${doc.exitedBy.lastName || ''}`.trim()
      : undefined,
  };
}

async function sendPorteriaMessage(input, context) {
  const { organization, building } = context;
  if (!building) throw new Error('No hay conjunto configurado');

  const message = input.message?.trim();
  if (!message) throw new Error('Escribe el mensaje para el residente');

  const title = input.title?.trim() || 'Aviso de portería';

  let unitId = input.unitId;

  if (!unitId && input.residentId) {
    const resident = await Resident.findOne({
      _id: input.residentId,
      organizationId: organization._id,
    }).populate('unitId', 'buildingId');

    if (!resident) throw new Error('Residente no encontrado');
    if (resident.unitId?.buildingId?.toString() !== building._id.toString()) {
      throw new Error('El residente no pertenece a este conjunto');
    }
    unitId = resident.unitId._id;
  }

  if (!unitId) throw new Error('Selecciona la unidad destino');

  const unit = await Unit.findOne({ _id: unitId, buildingId: building._id });
  if (!unit) throw new Error('Unidad no encontrada');

  const notifications = await notifyUnitResidents({
    organization,
    unitId,
    type: 'porteria_message',
    title,
    body: message,
  });

  return { unitId, count: notifications.length };
}

module.exports = {
  formatPackage,
  registerLockerPackage,
  releaseHeldLockerPackages,
  markPackagePickedUp,
  notifyHeldPackage,
  getLockerSummaryByUnit,
  notifyLockerOverflow,
  getBitacoraEntries,
  sendPorteriaMessage,
};
