const { User, Unit, Resident } = require('../models');
const { sendPushToUsers } = require('./pushNotifications');

async function resolvePorteriaUserIds({ organizationId, buildingId }) {
  if (!organizationId) return [];

  const filter = {
    organizationId,
    role: 'ORG_STAFF',
    staffType: 'porteria',
    isActive: { $ne: false },
  };

  if (buildingId) {
    filter.$or = [{ buildingId }, { buildingId: null }];
  }

  const staff = await User.find(filter).select('_id');
  return staff.map((u) => u._id);
}

async function notifyPorteriaStaff({ organizationId, buildingId, title, body, url }) {
  const userIds = await resolvePorteriaUserIds({ organizationId, buildingId });
  if (!userIds.length) return;

  await sendPushToUsers(userIds, {
    title: title || 'Portería',
    body: body || '',
    url: url || '/porteria',
  });
}

function formatUnitLabel(unit) {
  if (!unit) return 'unidad';
  const parts = [];
  if (unit.tower) parts.push(`Torre ${unit.tower}`);
  if (unit.number) parts.push(`Apto ${unit.number}`);
  return parts.length ? parts.join(' · ') : 'unidad';
}

function formatBookingWhen(startAt) {
  if (!startAt) return '';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(startAt));
}

async function notifyPorteriaNewVisitorRequest(request) {
  const doc = request?.toObject ? request.toObject() : { ...request };
  const [unit, resident] = await Promise.all([
    Unit.findById(doc.unitId).select('number tower'),
    Resident.findById(doc.residentId).populate('userId', 'firstName lastName'),
  ]);

  const unitLabel = formatUnitLabel(unit);
  const residentName = resident?.userId
    ? `${resident.userId.firstName || ''} ${resident.userId.lastName || ''}`.trim()
    : '';
  const plate = doc.licensePlate || '';
  const namePart = doc.visitorName ? `${doc.visitorName} · ` : '';
  const body = `${namePart}Placa ${plate}${residentName ? ` · ${residentName}` : ''} (${unitLabel})`;

  notifyPorteriaStaff({
    organizationId: doc.organizationId,
    buildingId: doc.buildingId,
    title: 'Visitante registrado por residente',
    body,
    url: '/porteria/visitantes',
  }).catch((err) => console.error('Push portería visitante:', err.message));
}

async function notifyPorteriaNewFacilityBooking(booking) {
  const doc = booking?.toObject ? booking.toObject() : { ...booking };
  let facilityName = doc.facilityId?.name;
  let unit = doc.unitId;

  if (!facilityName && doc.facilityId) {
    const { Facility } = require('../models');
    const facility = await Facility.findById(doc.facilityId).select('name');
    facilityName = facility?.name;
  }
  if (unit && !unit.number) {
    unit = await Unit.findById(unit._id || unit).select('number tower');
  }

  const unitLabel = formatUnitLabel(unit);
  const service = facilityName || 'Servicio';
  const when = formatBookingWhen(doc.startAt);
  const statusNote =
    doc.status === 'awaiting_payment'
      ? ' (pendiente de pago)'
      : doc.status === 'pending'
        ? ' (pendiente de aprobación)'
        : '';

  notifyPorteriaStaff({
    organizationId: doc.organizationId,
    buildingId: doc.buildingId,
    title: 'Nueva reserva',
    body: `${service} · ${unitLabel}${when ? ` · ${when}` : ''}${statusNote}`,
    url: '/porteria/reservas',
  }).catch((err) => console.error('Push portería reserva:', err.message));
}

module.exports = {
  resolvePorteriaUserIds,
  notifyPorteriaStaff,
  notifyPorteriaNewVisitorRequest,
  notifyPorteriaNewFacilityBooking,
};
