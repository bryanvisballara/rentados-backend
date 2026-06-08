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

async function notifyResidentsAboutPackage(pkg, resident, organization) {
  const userId = resident.userId?._id || resident.userId;
  if (!userId) return;

  const body = pkg.comment?.trim()
    ? `Tienes un paquete en portería: ${pkg.comment.trim()}`
    : 'Tienes un paquete esperando en portería. Pasa a recogerlo.';

  await ResidentNotification.create({
    organizationId: organization._id,
    userId,
    residentId: resident._id,
    unitId: resident.unitId?._id || resident.unitId,
    type: 'locker_package',
    title: 'Paquete en casillero',
    body,
    imageUrl: pkg.photoUrl,
    lockerPackageId: pkg._id,
    read: false,
    pushSent: false,
  });

  pkg.notificationSent = true;
  pkg.notificationSentAt = new Date();
  if (pkg.status === 'held') pkg.status = 'pending_pickup';
  await pkg.save();
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

  const resident = await Resident.findOne({
    _id: input.residentId,
    organizationId: organization._id,
  })
    .populate('userId', 'firstName lastName email')
    .populate('unitId', 'number adminStatus buildingId');

  if (!resident) throw new Error('Residente no encontrado');
  if (resident.unitId?.buildingId?.toString() !== building._id.toString()) {
    throw new Error('El residente no pertenece a este conjunto');
  }

  const isOverdue = resident.unitId?.adminStatus === 'overdue';

  if (isOverdue && !settings.receiveWhenOverdue) {
    throw new Error('Este conjunto no recibe paquetes para unidades en mora');
  }

  const shouldNotify = !isOverdue || settings.notifyWhenOverdue;
  const status = shouldNotify ? 'pending_pickup' : 'held';

  const pkg = await LockerPackage.create({
    organizationId: organization._id,
    buildingId: building._id,
    unitId: resident.unitId._id,
    residentId: resident._id,
    registeredBy: userId,
    photoUrl,
    cloudinaryPublicId: input.cloudinaryPublicId,
    comment: input.comment?.trim() || undefined,
    status,
    notificationSent: false,
  });

  if (shouldNotify) {
    await notifyResidentsAboutPackage(pkg, resident, organization);
  }

  const populated = await LockerPackage.findById(pkg._id)
    .populate('registeredBy', 'firstName lastName')
    .populate({ path: 'residentId', populate: { path: 'userId', select: 'firstName lastName email' } })
    .populate('unitId', 'number adminStatus');

  return {
    package: formatPackage(populated),
    notified: shouldNotify,
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
  }).populate({ path: 'residentId', populate: { path: 'userId', select: 'firstName lastName email' } });

  let released = 0;
  for (const pkg of held) {
    if (!pkg.residentId) continue;
    await notifyResidentsAboutPackage(pkg, pkg.residentId, organization);
    released += 1;
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
  }).populate({ path: 'residentId', populate: { path: 'userId', select: 'firstName lastName email' } });

  if (!pkg) throw new Error('Paquete no encontrado o ya notificado');

  const unit = await Unit.findById(pkg.unitId);
  if (unit?.adminStatus === 'overdue') {
    throw new Error('La unidad sigue en mora; no se puede notificar al residente');
  }

  await notifyResidentsAboutPackage(pkg, pkg.residentId, organization);

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
  }).populate('unitId', 'number tower');

  const byUnit = new Map();

  for (const pkg of packages) {
    const unitId = pkg.unitId?._id?.toString() || pkg.unitId?.toString();
    if (!unitId) continue;

    if (!byUnit.has(unitId)) {
      byUnit.set(unitId, {
        unitId,
        unitNumber: pkg.unitId?.number,
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
  let residentId = input.residentId;

  if (residentId && !unitId) {
    const resident = await Resident.findOne({
      _id: residentId,
      organizationId: organization._id,
    }).populate('unitId', 'buildingId');

    if (!resident) throw new Error('Residente no encontrado');
    if (resident.unitId?.buildingId?.toString() !== building._id.toString()) {
      throw new Error('El residente no pertenece a este conjunto');
    }
    unitId = resident.unitId._id;
  }

  if (!unitId) throw new Error('Selecciona una unidad o residente');

  const unit = await Unit.findOne({ _id: unitId, buildingId: building._id });
  if (!unit) throw new Error('Unidad no encontrada');

  const notifications = await notifyUnitResidents({
    organization,
    unitId,
    residentId,
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
