const { Building, Unit, Resident, Organization } = require('../models');
const { notifyUnitResidents } = require('./porteriaNotify');
const { sendPushToUsers } = require('./pushNotifications');

const FACILITY_BOOKING_URL = '/app/servicios-conjunto';
const ADMIN_URL = '/app/administracion';

function formatCop(amount) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));
}

function formatWhen(date) {
  if (!date) return '';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
}

async function loadOrganization(organizationId) {
  if (!organizationId) return null;
  return Organization.findById(organizationId);
}

function facilityName(booking) {
  const f = booking.facilityId;
  return (f && typeof f === 'object' ? f.name : null) || 'Zona común';
}

async function pushFacilityBookingResidents(booking, event) {
  const org = await loadOrganization(booking.organizationId);
  if (!org || !booking.unitId) return;

  const name = facilityName(booking);
  const when = formatWhen(booking.startAt);
  const whenPart = when ? ` · ${when}` : '';

  let title;
  let body;

  switch (event) {
    case 'created':
      if (booking.status === 'awaiting_payment') {
        title = 'Reserva pendiente de pago';
        body = `${name}${whenPart}. Completa el pago para confirmar.`;
      } else if (booking.status === 'pending') {
        title = 'Reserva en revisión';
        body = `${name}${whenPart}. La administración debe aprobarla.`;
      } else {
        title = 'Reserva confirmada';
        body = `${name}${whenPart}.`;
      }
      break;
    case 'payment_received':
      if (booking.status === 'pending') {
        title = 'Pago de reserva recibido';
        body = `${name}: recibimos tu pago. Pendiente de aprobación.`;
      } else {
        title = 'Reserva confirmada';
        body = `${name}${whenPart} quedó confirmada.`;
      }
      break;
    case 'confirmed':
      title = 'Reserva aprobada';
      body = `${name}${whenPart}.`;
      break;
    case 'cancelled':
      title = 'Reserva cancelada';
      body = `${name}${whenPart} fue cancelada.`;
      break;
    default:
      return;
  }

  notifyUnitResidents({
    organization: org,
    unitId: booking.unitId._id || booking.unitId,
    type: 'facility_booking',
    title,
    body,
    url: FACILITY_BOOKING_URL,
    meta: { bookingId: booking._id, event },
  }).catch((err) => console.error('Push reserva residente:', err.message));
}

async function pushApartmentVisitResidents(visit, event) {
  const org = await loadOrganization(visit.organizationId);
  if (!org || !visit.unitId) return;

  const unit = visit.unitId;
  const unitLabel =
    unit.number != null
      ? `${unit.tower ? `Torre ${unit.tower} · ` : ''}Apto ${unit.number}`
      : 'tu unidad';
  const visitor = visit.visitorName || 'Visitante';

  const title = event === 'exit' ? 'Visitante salió' : 'Visitante en portería';
  const body =
    event === 'exit'
      ? `${visitor} registró salida (${unitLabel}).`
      : `${visitor} ingresó a visitarte (${unitLabel}).`;

  notifyUnitResidents({
    organization: org,
    unitId: unit._id || unit,
    type: 'apartment_visit',
    title,
    body,
    url: '/app',
    meta: { visitId: visit._id, event },
  }).catch((err) => console.error('Push visita apartamento:', err.message));
}

async function pushVisitorParkingExitResidents(visit) {
  const org = await loadOrganization(visit.organizationId);
  if (!org || !visit.unitId) return;

  const plate = visit.licensePlate || '';
  const body = `Visitante con placa ${plate} salió del parqueadero.`;

  notifyUnitResidents({
    organization: org,
    unitId: visit.unitId._id || visit.unitId,
    type: 'visitor_parking',
    title: 'Visitante salió del parqueadero',
    body,
    url: '/app',
    visitorVisitId: visit._id,
    meta: { event: 'exit' },
  }).catch((err) => console.error('Push salida parqueadero:', err.message));
}

async function pushResidentVisitorRequest(request) {
  const org = await loadOrganization(request.organizationId);
  if (!org || !request.unitId) return;

  const plate = request.licensePlate || '';
  const namePart = request.visitorName ? `${request.visitorName} · ` : '';

  notifyUnitResidents({
    organization: org,
    unitId: request.unitId,
    type: 'visitor_request',
    title: 'Visitante registrado',
    body: `${namePart}Placa ${plate}. Aviso para portería.`,
    url: '/app',
    meta: { visitorRequestId: request._id },
  }).catch((err) => console.error('Push solicitud visitante:', err.message));
}

async function pushResidentCardPaymentConfirmed({ userId, organizationId, amount, purpose }) {
  if (!userId) return;

  const label =
    purpose === 'administration'
      ? 'administración'
      : purpose === 'restaurant'
        ? 'restaurante'
        : 'tu pedido';
  const money = formatCop(amount);

  const { ResidentNotification } = require('../models');
  if (organizationId) {
    await ResidentNotification.create({
      organizationId,
      userId,
      type: 'resident_payment',
      title: 'Pago confirmado',
      body: `Recibimos tu pago de ${label} por ${money}.`,
      read: false,
      meta: { purpose, amount },
    }).catch(() => {});
  }

  await sendPushToUsers([userId], {
    title: 'Pago confirmado',
    body: `Recibimos tu pago de ${label} por ${money}.`,
    url: purpose === 'administration' ? ADMIN_URL : '/app',
  });
}

async function pushManualPaymentAdjusted({ payment, event, amount }) {
  const org = await loadOrganization(payment.organizationId);
  if (!org || !payment.unitId) return;

  const money = formatCop(amount);
  const title = event === 'void' ? 'Pago anulado' : 'Pago actualizado';
  const body =
    event === 'void'
      ? `La administración anuló un pago registrado. Revisa tu saldo (${money} revertido).`
      : `La administración corrigió un pago manual a ${money}.`;

  notifyUnitResidents({
    organization: org,
    unitId: payment.unitId,
    type: 'payment_update',
    title,
    body,
    url: ADMIN_URL,
    meta: { paymentId: payment._id, event },
  }).catch((err) => console.error('Push ajuste pago:', err.message));
}

async function pushPlatformPublication(publication) {
  const countries = (publication.targetCountries || []).map((c) => String(c).trim()).filter(Boolean);
  const cities = (publication.targetCities || []).map((c) => String(c).trim()).filter(Boolean);

  const buildingFilter = { isActive: { $ne: false } };
  if (countries.length) {
    buildingFilter['address.country'] = { $in: countries };
  }
  if (cities.length) {
    buildingFilter['address.city'] = { $in: cities };
  }

  const buildings = await Building.find(buildingFilter).select('_id');
  if (!buildings.length) return;

  const unitIds = await Unit.find({
    buildingId: { $in: buildings.map((b) => b._id) },
    isActive: { $ne: false },
  }).distinct('_id');

  if (!unitIds.length) return;

  const residents = await Resident.find({ unitId: { $in: unitIds } })
    .populate('userId', 'isActive')
    .select('userId organizationId');

  const excerpt = String(publication.body || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);

  const title = publication.title || 'Aviso Rentados';
  const body = excerpt || 'Hay un aviso nuevo en la app.';
  const { ResidentNotification } = require('../models');

  const userIds = new Set();

  for (const resident of residents) {
    if (resident.userId?.isActive === false) continue;
    const uid = resident.userId?._id || resident.userId;
    if (!uid) continue;
    userIds.add(String(uid));

    ResidentNotification.create({
      organizationId: resident.organizationId,
      userId: uid,
      type: 'platform_publication',
      title,
      body,
      read: false,
      meta: { publicationId: publication._id },
    }).catch(() => {});
  }

  if (!userIds.size) return;

  await sendPushToUsers([...userIds], {
    title,
    body,
    url: '/app',
  });
}

module.exports = {
  pushFacilityBookingResidents,
  pushApartmentVisitResidents,
  pushVisitorParkingExitResidents,
  pushResidentVisitorRequest,
  pushResidentCardPaymentConfirmed,
  pushManualPaymentAdjusted,
  pushPlatformPublication,
};
