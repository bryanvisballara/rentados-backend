const { Payment, FacilityBooking } = require('../models');
const { currentPeriod } = require('./registerPayment');

function buildCheckoutUrl(template, booking, payment) {
  if (!template) return null;
  return String(template)
    .replace(/\{bookingId\}/g, String(booking._id))
    .replace(/\{reference\}/g, booking.paymentReference || String(booking._id))
    .replace(/\{amount\}/g, String(booking.totalPrice || payment?.amount || 0))
    .replace(/\{currency\}/g, booking.currency || 'COP');
}

async function createPendingBookingPayment({ booking, facility, resident, organization }) {
  const payment = await Payment.create({
    organizationId: organization._id,
    unitId: resident.unitId._id || resident.unitId,
    residentId: resident._id,
    concept: 'service',
    facilityId: facility._id,
    facilityBookingId: booking._id,
    conceptLabel: `${facility.name} · reserva`,
    period: currentPeriod(booking.startAt),
    amount: booking.totalPrice,
    paidAmount: 0,
    dueDate: booking.startAt,
    status: 'pending',
    notes: `Pago reserva ${booking._id}`,
  });

  booking.paymentId = payment._id;
  booking.paymentReference = String(booking._id);
  await booking.save();

  return payment;
}

async function voidPendingBookingPayment(booking, reason = 'Reserva cancelada') {
  if (!booking?._id) return { voided: 0 };

  const query = {
    status: { $in: ['pending', 'overdue', 'partial'] },
    $or: [{ facilityBookingId: booking._id }],
  };
  if (booking.paymentId) {
    query.$or.push({ _id: booking.paymentId });
  }

  const payments = await Payment.find(query);
  const suffix = reason.trim();
  for (const payment of payments) {
    payment.status = 'cancelled';
    if (suffix) {
      payment.notes = payment.notes ? `${payment.notes} · ${suffix}` : suffix;
    }
    await payment.save();
  }

  return { voided: payments.length };
}

/** Pagos pendientes ligados a reservas ya canceladas (reparación de datos). */
async function voidPaymentsForCancelledBookings({ unitId, organizationId }) {
  const bookingFilter = { status: 'cancelled' };
  if (unitId) bookingFilter.unitId = unitId;
  if (organizationId) bookingFilter.organizationId = organizationId;

  const cancelledIds = await FacilityBooking.find(bookingFilter).distinct('_id');
  if (!cancelledIds.length) return { voided: 0 };

  const payments = await Payment.find({
    facilityBookingId: { $in: cancelledIds },
    status: { $in: ['pending', 'overdue', 'partial'] },
  });

  for (const payment of payments) {
    payment.status = 'cancelled';
    payment.notes = payment.notes
      ? `${payment.notes} · Reserva cancelada`
      : 'Reserva cancelada';
    await payment.save();
  }

  return { voided: payments.length };
}

async function confirmFacilityBookingPayment({ bookingId, paymentReference, amount, externalRef }) {
  const booking = await FacilityBooking.findById(bookingId || paymentReference);
  if (!booking) throw new Error('Reserva no encontrada');
  if (booking.status === 'cancelled') throw new Error('La reserva fue cancelada');

  const ref = paymentReference || booking.paymentReference;
  if (ref && String(booking.paymentReference) !== String(ref) && String(booking._id) !== String(ref)) {
    throw new Error('Referencia de pago no coincide');
  }

  if (booking.status === 'confirmed') {
    return { booking, alreadyConfirmed: true };
  }

  if (booking.totalPrice <= 0) {
    throw new Error('Esta reserva no requiere pago');
  }

  let payment = null;
  if (booking.paymentId) {
    payment = await Payment.findById(booking.paymentId);
  }
  if (!payment) {
    payment = await Payment.findOne({ facilityBookingId: booking._id, status: 'pending' });
  }
  if (!payment) throw new Error('Pago pendiente no encontrado');

  const expected = Math.round(Number(booking.totalPrice));
  if (amount != null && Math.round(Number(amount)) !== expected) {
    throw new Error('El monto del pago no coincide con la reserva');
  }

  const now = new Date();
  payment.paidAmount = expected;
  payment.status = 'paid';
  payment.paidAt = now;
  if (externalRef) payment.notes = `${payment.notes || ''} · ref ${externalRef}`.trim();
  await payment.save();

  const facility = await require('../models').Facility.findById(booking.facilityId);
  booking.status = facility?.requiresApproval ? 'pending' : 'confirmed';
  booking.paidAt = now;
  await booking.save();

  await booking.populate([
    { path: 'facilityId', select: 'name' },
    { path: 'unitId', select: 'number tower' },
  ]);
  const { pushFacilityBookingResidents } = require('./residentPush');
  pushFacilityBookingResidents(booking, 'payment_received').catch(() => {});

  return { booking, payment, alreadyConfirmed: false };
}

/** Efectivo / transferencia en administración para una reserva con pago pendiente. */
async function registerManualBookingPayment({ paymentId, organizationId, notes }) {
  const payment = await Payment.findOne({
    _id: paymentId,
    organizationId,
    facilityBookingId: { $ne: null },
    status: { $in: ['pending', 'overdue', 'partial'] },
  });
  if (!payment) {
    const err = new Error('Pago de reserva no encontrado o ya fue saldado');
    err.status = 404;
    throw err;
  }

  const owed = Math.round(Number(payment.amount) - Number(payment.paidAmount || 0));
  if (owed <= 0) {
    const err = new Error('Este pago ya no tiene saldo pendiente');
    err.status = 400;
    throw err;
  }

  const result = await confirmFacilityBookingPayment({
    bookingId: payment.facilityBookingId,
    amount: payment.amount,
    externalRef: notes ? `admin · ${notes}` : 'admin manual',
  });

  if (notes && result.payment) {
    const merged = [result.payment.notes, notes].filter(Boolean).join(' · ');
    if (merged !== result.payment.notes) {
      result.payment.notes = merged;
      await result.payment.save();
    }
  }

  return result;
}

module.exports = {
  buildCheckoutUrl,
  createPendingBookingPayment,
  voidPendingBookingPayment,
  voidPaymentsForCancelledBookings,
  confirmFacilityBookingPayment,
  registerManualBookingPayment,
};
