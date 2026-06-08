const { VisitorParking, VisitorParkingVisit, Resident, Unit } = require('../models');
const { notifyUnitResidents } = require('./porteriaNotify');

function normalizePlate(plate) {
  return String(plate || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function formatVisit(visit) {
  const doc = visit?.toObject ? visit.toObject() : visit;
  if (!doc) return doc;

  const resident = doc.residentId;
  const unit = doc.unitId;
  const spot = doc.spotId;
  const registeredBy = doc.registeredBy;
  const exitedBy = doc.exitedBy;

  return {
    ...doc,
    licensePlate: doc.licensePlate,
    residentName: resident?.userId
      ? `${resident.userId.firstName || ''} ${resident.userId.lastName || ''}`.trim()
      : undefined,
    unitNumber: unit?.number,
    spotNumber: spot?.spotNumber || spot?.label,
    registeredByName: registeredBy
      ? `${registeredBy.firstName || ''} ${registeredBy.lastName || ''}`.trim()
      : undefined,
    exitedByName: exitedBy
      ? `${exitedBy.firstName || ''} ${exitedBy.lastName || ''}`.trim()
      : undefined,
  };
}

async function getParkingSummary(buildingId) {
  const spots = await VisitorParking.find({ buildingId, isActive: true }).sort({ spotNumber: 1 });
  const occupied = spots.filter((s) => s.isOccupied).length;

  const activeVisits = await VisitorParkingVisit.find({ buildingId, status: 'active' })
    .populate('spotId', 'spotNumber label zone')
    .populate({ path: 'residentId', populate: { path: 'userId', select: 'firstName lastName' } })
    .populate('unitId', 'number tower')
    .populate('registeredBy', 'firstName lastName')
    .sort({ entryAt: -1 });

  return {
    totalSpots: spots.length,
    availableSpots: spots.length - occupied,
    occupiedSpots: occupied,
    spots,
    activeVisits: activeVisits.map(formatVisit),
  };
}

async function resolveVisitTarget(input, organization, building) {
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
    })
      .sort({ isPrimary: -1, createdAt: 1 })
      .populate('userId', 'firstName lastName');

    return { unit, resident };
  }

  if (input.residentId) {
    const resident = await Resident.findOne({
      _id: input.residentId,
      organizationId: organization._id,
    })
      .populate('userId', 'firstName lastName')
      .populate('unitId', 'number tower buildingId');

    if (!resident) throw new Error('Residente no encontrado');
    if (resident.unitId?.buildingId?.toString() !== building._id.toString()) {
      throw new Error('El residente no pertenece a este conjunto');
    }

    return { unit: resident.unitId, resident };
  }

  throw new Error('Selecciona la unidad destino');
}

async function registerVisitorEntry(input, context) {
  const { organization, building, userId } = context;
  if (!building) throw new Error('No hay conjunto configurado');

  const licensePlate = normalizePlate(input.licensePlate);
  if (!licensePlate) throw new Error('Indica la placa del visitante');

  const existing = await VisitorParkingVisit.findOne({
    buildingId: building._id,
    licensePlate,
    status: 'active',
  });
  if (existing) throw new Error('Ya hay un visitante activo con esa placa');

  const { unit, resident } = await resolveVisitTarget(input, organization, building);

  let spot;
  if (input.spotId) {
    spot = await VisitorParking.findOne({
      _id: input.spotId,
      buildingId: building._id,
      isActive: true,
    });
    if (!spot) throw new Error('Puesto no encontrado');
    if (spot.isOccupied) throw new Error('Ese puesto ya está ocupado');
  } else {
    spot = await VisitorParking.findOne({
      buildingId: building._id,
      isActive: true,
      isOccupied: false,
    }).sort({ spotNumber: 1 });
    if (!spot) throw new Error('No hay puestos de visitantes disponibles');
  }

  const tower = input.tower?.trim() || unit.tower || undefined;

  const visit = await VisitorParkingVisit.create({
    organizationId: organization._id,
    buildingId: building._id,
    spotId: spot._id,
    residentId: resident?._id,
    unitId: unit._id,
    tower,
    licensePlate,
    visitorName: input.visitorName?.trim() || undefined,
    registeredBy: userId,
    status: 'active',
    entryAt: new Date(),
  });

  spot.isOccupied = true;
  await spot.save();

  const unitLabel = unit.number ? `unidad ${unit.number}` : 'tu unidad';
  const body = `Visitante con placa ${licensePlate}${tower ? ` · Torre ${tower}` : ''}. Puesto ${spot.spotNumber}.`;

  const notifications = await notifyUnitResidents({
    organization,
    unitId: unit._id,
    type: 'visitor_parking',
    title: 'Visitante en parqueadero',
    body: resident ? body : `${body} (${unitLabel})`,
    visitorVisitId: visit._id,
  });

  const populated = await VisitorParkingVisit.findById(visit._id)
    .populate('spotId', 'spotNumber label zone')
    .populate({ path: 'residentId', populate: { path: 'userId', select: 'firstName lastName' } })
    .populate('unitId', 'number tower')
    .populate('registeredBy', 'firstName lastName');

  return { ...formatVisit(populated), notified: notifications.length > 0 };
}

async function registerVisitorExit(input, context) {
  const { organization, building, userId } = context;
  if (!building) throw new Error('No hay conjunto configurado');

  const licensePlate = normalizePlate(input.licensePlate);
  if (!licensePlate) throw new Error('Indica la placa del visitante');

  const visit = await VisitorParkingVisit.findOne({
    buildingId: building._id,
    licensePlate,
    status: 'active',
  }).populate('spotId', 'spotNumber');

  if (!visit) throw new Error('No hay ingreso activo con esa placa');

  visit.status = 'exited';
  visit.exitAt = new Date();
  visit.exitedBy = userId;
  await visit.save();

  if (visit.spotId) {
    await VisitorParking.findByIdAndUpdate(visit.spotId._id || visit.spotId, { isOccupied: false });
  }

  const populated = await VisitorParkingVisit.findById(visit._id)
    .populate('spotId', 'spotNumber label')
    .populate({ path: 'residentId', populate: { path: 'userId', select: 'firstName lastName' } })
    .populate('unitId', 'number tower')
    .populate('registeredBy', 'firstName lastName')
    .populate('exitedBy', 'firstName lastName');

  return formatVisit(populated);
}

module.exports = {
  normalizePlate,
  formatVisit,
  getParkingSummary,
  registerVisitorEntry,
  registerVisitorExit,
};
