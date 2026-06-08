const { FacilityBooking } = require('../models');

const ACTIVE_STATUSES = ['pending', 'confirmed'];

function parseTimeToMinutes(timeStr) {
  const [hours, minutes] = (timeStr || '06:00').split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function parseTimeOnDate(date, timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function isWithinOpenHours(facility, startAt, endAt) {
  if (facility.open24Hours) return true;

  const openStart = parseTimeToMinutes(facility.openHours?.start || '06:00');
  let openEnd = parseTimeToMinutes(facility.openHours?.end || '22:00');
  const overnight = openEnd <= openStart;
  if (overnight) openEnd += 24 * 60;

  const opDay = new Date(startAt);
  opDay.setHours(0, 0, 0, 0);

  if (overnight && minutesSinceMidnight(startAt) < openStart && minutesSinceMidnight(startAt) < openEnd - 24 * 60) {
    opDay.setDate(opDay.getDate() - 1);
  }

  const windowStart = new Date(opDay);
  windowStart.setHours(Math.floor(openStart / 60), openStart % 60, 0, 0);

  const windowEnd = new Date(opDay);
  if (overnight) {
    windowEnd.setDate(windowEnd.getDate() + 1);
    windowEnd.setHours(Math.floor((openEnd % (24 * 60)) / 60), openEnd % 60, 0, 0);
  } else {
    windowEnd.setHours(Math.floor(openEnd / 60), openEnd % 60, 0, 0);
  }

  return startAt >= windowStart && endAt <= windowEnd;
}

function minutesBetween(start, end) {
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

function snapToSlotMinutes(minutes, slotMinutes) {
  return Math.ceil(minutes / slotMinutes) * slotMinutes;
}

function isWithinSeason(facility, startAt, endAt) {
  if (facility.open24Hours) return true;

  if (facility.seasonOpenDate && startAt < new Date(facility.seasonOpenDate)) return false;
  if (facility.seasonCloseDate && endAt > new Date(facility.seasonCloseDate)) return false;
  return true;
}

function getBookingPricing(facility) {
  const legacy = facility.bookingPricing || {};
  if (legacy.mode) return legacy;

  if (facility.pricingType === 'per_use' && facility.price > 0) {
    return { mode: 'flat', flatPrice: facility.price, hourlyRate: 0, blocks: [] };
  }

  return { mode: 'free', hourlyRate: 0, flatPrice: 0, blocks: [] };
}

function calculateBookingPrice(facility, startAt, endAt, blockIndex) {
  const pricing = getBookingPricing(facility);
  const durationMinutes = minutesBetween(startAt, endAt);

  if (pricing.mode === 'free') return { totalPrice: 0, durationMinutes, pricingMode: 'free' };

  if (pricing.mode === 'hourly') {
    const billedHours = Math.ceil(durationMinutes / 60);
    return {
      totalPrice: billedHours * (pricing.hourlyRate || 0),
      durationMinutes,
      pricingMode: 'hourly',
    };
  }

  if (pricing.mode === 'blocks') {
    const block = pricing.blocks?.[blockIndex];
    if (!block) throw new Error('Selecciona un paquete de horas válido');
    return {
      totalPrice: block.price || 0,
      durationMinutes: block.durationMinutes,
      pricingMode: 'blocks',
      blockLabel: block.label,
    };
  }

  if (pricing.mode === 'flat') {
    return {
      totalPrice: pricing.flatPrice || facility.price || 0,
      durationMinutes,
      pricingMode: 'flat',
    };
  }

  return { totalPrice: 0, durationMinutes, pricingMode: 'free' };
}

function resolveBookingWindow(facility, startAt, endAt, blockIndex) {
  const pricing = getBookingPricing(facility);
  const rules = facility.bookingRules || {};
  const slotMinutes = rules.slotMinutes || 60;

  if (!startAt || Number.isNaN(new Date(startAt).getTime())) {
    throw new Error('Fecha de inicio inválida');
  }

  const start = new Date(startAt);
  let end = endAt ? new Date(endAt) : null;

  if (pricing.mode === 'blocks') {
    const block = pricing.blocks?.[blockIndex];
    if (!block) throw new Error('Selecciona un paquete de horas');
    end = new Date(start.getTime() + block.durationMinutes * 60000);
  }

  if (!end || Number.isNaN(end.getTime())) {
    throw new Error('Fecha de fin inválida');
  }

  if (end <= start) throw new Error('La hora de fin debe ser posterior al inicio');

  let durationMinutes = minutesBetween(start, end);
  const minDuration = rules.minDurationMinutes || slotMinutes;
  const maxDuration = rules.maxDurationMinutes || 24 * 60;

  if (durationMinutes < minDuration) {
    throw new Error(`La reserva mínima es de ${minDuration} minutos`);
  }
  if (durationMinutes > maxDuration) {
    throw new Error(`La reserva máxima es de ${maxDuration} minutos`);
  }

  if (pricing.mode === 'hourly' && durationMinutes % slotMinutes !== 0) {
    throw new Error(`Las reservas deben ser en bloques de ${slotMinutes} minutos`);
  }

  const advanceDays = rules.advanceBookingDays ?? 30;
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + advanceDays);
  if (start > maxDate) {
    throw new Error(`Solo puedes reservar hasta ${advanceDays} días adelante`);
  }

  if (start < new Date()) {
    throw new Error('No puedes reservar en el pasado');
  }

  if (!isWithinSeason(facility, start, end)) {
    throw new Error('La reserva está fuera de la temporada del servicio');
  }

  if (!isWithinOpenHours(facility, start, end)) {
    throw new Error('La reserva está fuera del horario de apertura');
  }

  const priceInfo = calculateBookingPrice(facility, start, end, blockIndex);
  if (pricing.mode === 'blocks') {
    durationMinutes = priceInfo.durationMinutes;
    end = new Date(start.getTime() + durationMinutes * 60000);
  }

  return { start, end, durationMinutes, priceInfo };
}

async function findOverlappingBookings(facilityId, startAt, endAt, excludeId) {
  const filter = {
    facilityId,
    status: { $in: ACTIVE_STATUSES },
    startAt: { $lt: endAt },
    endAt: { $gt: startAt },
  };
  if (excludeId) filter._id = { $ne: excludeId };
  return FacilityBooking.find(filter);
}

async function assertBookingAvailable(facilityId, startAt, endAt, excludeId) {
  const overlaps = await findOverlappingBookings(facilityId, startAt, endAt, excludeId);
  if (overlaps.length > 0) {
    throw new Error('Ese horario ya está reservado');
  }
}

function getResidentName(resident) {
  if (!resident) return 'Residente';
  if (resident.userId?.firstName) {
    return `${resident.userId.firstName} ${resident.userId.lastName || ''}`.trim();
  }
  if (resident.firstName) {
    return `${resident.firstName} ${resident.lastName || ''}`.trim();
  }
  return 'Residente';
}

function formatBookingEvent(booking, { showResidentDetails = false } = {}) {
  const resident = booking.residentId;
  const unit = booking.unitId;
  const residentName = getResidentName(resident);
  const unitLabel = unit?.number ? `Apto ${unit.number}` : 'Unidad';

  return {
    id: booking._id,
    facilityId: booking.facilityId?._id || booking.facilityId,
    startAt: booking.startAt,
    endAt: booking.endAt,
    status: booking.status,
    totalPrice: booking.totalPrice,
    durationMinutes: booking.durationMinutes,
    notes: booking.notes,
    title: showResidentDetails ? `${residentName} · ${unitLabel}` : unitLabel,
    residentName: showResidentDetails ? residentName : undefined,
    unitNumber: unit?.number,
    residentId: resident?._id || booking.residentId,
  };
}

module.exports = {
  ACTIVE_STATUSES,
  parseTimeOnDate,
  minutesBetween,
  snapToSlotMinutes,
  getBookingPricing,
  calculateBookingPrice,
  resolveBookingWindow,
  findOverlappingBookings,
  assertBookingAvailable,
  formatBookingEvent,
  isWithinOpenHours,
  isWithinSeason,
};
