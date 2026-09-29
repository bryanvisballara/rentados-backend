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

  return { booking, payment, alreadyConfirmed: false };
}

module.exports = {
  buildCheckoutUrl,
  createPendingBookingPayment,
  confirmFacilityBookingPayment,
};
