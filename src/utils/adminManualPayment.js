const { Payment, Resident, FacilityBooking, Unit, PushDevice } = require('../models');
const { enrichPayment } = require('./billing');
const { refreshUnitBillingStatus } = require('./registerPayment');
const { refreshUnitAdminStatus } = require('./administrationCharges');
const { sendPushToUsers } = require('./pushNotifications');
const { settleSingleAdministrationPayment } = require('./administrationBalance');
const { registerManualBookingPayment } = require('./facilityBookingPayment');

function formatCop(amount) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));
}

function stampManualAdmin(payment, adminUserId, paymentMethod) {
  if (!payment) return payment;
  payment.manualAdmin = {
    registeredAt: payment.manualAdmin?.registeredAt || new Date(),
    registeredBy: adminUserId,
    paymentMethod: paymentMethod === 'transfer' ? 'transfer' : 'cash',
    voidedAt: null,
    voidedBy: null,
  };
  return payment;
}

async function stampManualAdminById(paymentIds, adminUserId, paymentMethod) {
  const ids = [...new Set((paymentIds || []).map(String).filter(Boolean))];
  if (!ids.length) return;
  const meta = {
    registeredAt: new Date(),
    registeredBy: adminUserId,
    paymentMethod: paymentMethod === 'transfer' ? 'transfer' : 'cash',
    voidedAt: null,
    voidedBy: null,
  };
  await Payment.updateMany({ _id: { $in: ids } }, { $set: { manualAdmin: meta } });
}

async function resolveNotifyUserIds({ residentId, unitId, organizationId }) {
  if (residentId) {
    const resident = await Resident.findById(residentId).select('userId unitId');
    if (resident?.userId) return [resident.userId];
  }
  if (unitId) {
    const filter = { unitId };
    if (organizationId) filter.organizationId = organizationId;
    const residents = await Resident.find(filter).select('userId');
    return residents.map((r) => r.userId).filter(Boolean);
  }
  return [];
}

async function notifyManualPaymentRecorded({
  residentId,
  unitId,
  organizationId,
  amount,
  conceptLabel,
}) {
  const fromResident = await resolveNotifyUserIds({ residentId, unitId: null, organizationId });
  const fromUnit = unitId
    ? await resolveNotifyUserIds({ unitId, organizationId })
    : [];
  const userIds = [...new Set([...fromResident, ...fromUnit].map(String))];
  if (!userIds.length) return;

  const label = conceptLabel || 'administración';
  const money = formatCop(amount);
  const devices = await PushDevice.countDocuments({
    userId: { $in: userIds },
  });
  if (!devices) {
    console.warn(
      'Push pago manual: sin dispositivos registrados para userIds',
      userIds.join(', ')
    );
  }
  await sendPushToUsers(userIds, {
    title: 'Pago registrado',
    body: `Tu conjunto registró un pago de ${label} por ${money}.`,
    url: '/app/administracion',
  });
}

function assertEditableManual(payment) {
  if (!payment?.manualAdmin?.registeredAt) {
    const err = new Error('Solo se pueden editar pagos registrados manualmente en administración');
    err.status = 403;
    throw err;
  }
  if (payment.manualAdmin.voidedAt) {
    const err = new Error('Este pago manual ya fue anulado');
    err.status = 400;
    throw err;
  }
  if (payment.status !== 'paid') {
    const err = new Error('Solo se pueden editar pagos en estado pagado');
    err.status = 400;
    throw err;
  }
}

async function reopenPaidPayment(payment) {
  if (payment.facilityBookingId) {
    const booking = await FacilityBooking.findById(payment.facilityBookingId);
    if (booking && booking.status !== 'cancelled') {
      booking.status = 'awaiting_payment';
      booking.paidAt = null;
      await booking.save();
    }
  }

  payment.paidAmount = 0;
  payment.paidAt = null;
  payment.interestAmount = 0;
  payment.status = payment.dueDate && payment.dueDate < new Date() ? 'overdue' : 'pending';
  await payment.save();

  await refreshUnitBillingStatus(payment.unitId, payment.organizationId);
  await refreshUnitAdminStatus(payment.unitId, payment.organizationId);
}

async function voidManualAdminPayment({ paymentId, organizationId, adminUserId, billingSettings }) {
  const payment = await Payment.findOne({ _id: paymentId, organizationId });
  if (!payment) {
    const err = new Error('Pago no encontrado');
    err.status = 404;
    throw err;
  }
  assertEditableManual(payment);

  const voidedAmount =
    Number(payment.paidAmount || payment.amount || 0) + Number(payment.interestAmount || 0);

  await reopenPaidPayment(payment);

  payment.manualAdmin.voidedAt = new Date();
  payment.manualAdmin.voidedBy = adminUserId;
  if (!String(payment.notes || '').includes('Anulado')) {
    payment.notes = payment.notes ? `${payment.notes} · Anulado en administración` : 'Anulado en administración';
  }
  await payment.save();

  const enriched = enrichPayment(payment, billingSettings);
  const { pushManualPaymentAdjusted } = require('./residentPush');
  pushManualPaymentAdjusted({ payment, event: 'void', amount: voidedAmount }).catch(() => {});

  return enriched;
}

async function updateManualAdminPayment({
  paymentId,
  organizationId,
  adminUserId,
  billingSettings,
  paymentMethod,
  notes,
  amount,
}) {
  const payment = await Payment.findOne({ _id: paymentId, organizationId });
  if (!payment) {
    const err = new Error('Pago no encontrado');
    err.status = 404;
    throw err;
  }
  assertEditableManual(payment);

  const methodLabel =
    paymentMethod === 'transfer'
      ? 'Transferencia'
      : paymentMethod === 'cash'
        ? 'Efectivo'
        : payment.manualAdmin.paymentMethod === 'transfer'
          ? 'Transferencia'
          : 'Efectivo';
  const noteParts = [methodLabel, notes?.trim()].filter(Boolean);
  const mergedNotes = noteParts.join(' · ');

  const currentTotal =
    Number(payment.paidAmount || payment.amount || 0) + Number(payment.interestAmount || 0);
  const targetAmount = amount != null ? Math.round(Number(amount)) : currentTotal;

  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    const err = new Error('Indica un monto válido');
    err.status = 400;
    throw err;
  }

  if (targetAmount !== currentTotal) {
    await reopenPaidPayment(payment);
    const reopened = await Payment.findById(paymentId);
    if (!reopened || reopened.status === 'paid') {
      const err = new Error('No se pudo reabrir el pago para corregir el monto');
      err.status = 400;
      throw err;
    }

    if (reopened.facilityBookingId) {
      await registerManualBookingPayment({
        paymentId: reopened._id,
        organizationId,
        notes: mergedNotes,
      });
    } else if (reopened.concept === 'administration') {
      await settleSingleAdministrationPayment({
        paymentId: reopened._id,
        organizationId,
        unitId: reopened.unitId,
        amount: targetAmount,
        billingSettings,
        notes: mergedNotes,
      });
    } else {
      const err = new Error('Corregir monto solo está soportado para administración y reservas');
      err.status = 400;
      throw err;
    }

    await stampManualAdminById([paymentId], adminUserId, paymentMethod);
    const updated = await Payment.findById(paymentId);
    const enriched = enrichPayment(updated, billingSettings);
    const { pushManualPaymentAdjusted } = require('./residentPush');
    pushManualPaymentAdjusted({ payment: updated, event: 'updated', amount: targetAmount }).catch(
      () => {}
    );
    return enriched;
  }

  payment.manualAdmin.paymentMethod = paymentMethod === 'transfer' ? 'transfer' : 'cash';
  payment.notes = mergedNotes || payment.notes;
  await payment.save();
  const enriched = enrichPayment(payment, billingSettings);
  const { pushManualPaymentAdjusted } = require('./residentPush');
  pushManualPaymentAdjusted({
    payment,
    event: 'updated',
    amount: currentTotal,
  }).catch(() => {});
  return enriched;
}

module.exports = {
  stampManualAdmin,
  stampManualAdminById,
  notifyManualPaymentRecorded,
  voidManualAdminPayment,
  updateManualAdminPayment,
};
