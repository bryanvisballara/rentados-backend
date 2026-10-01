const { Payment, Unit } = require('../models');
const { getUnitAdministrationFee } = require('./billing');

const LOOKBACK_MONTHS = 18;

function bogotaMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === 'year').value);
  const month = Number(parts.find((part) => part.type === 'month').value);
  return { year, month };
}

function periodKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function shiftMonth(year, month, delta) {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function comparePeriod(a, b) {
  return a.year === b.year ? a.month - b.month : a.year - b.year;
}

function dueDateForPeriod(period) {
  const [year, month] = period.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1, 5, 0, 0));
}

/** Inicio inclusive y fin exclusive del mes calendario en America/Bogota (para recaudo por paidAt). */
function bogotaMonthBounds(asOf = new Date()) {
  const { year, month } = bogotaMonth(asOf);
  const start = dueDateForPeriod(periodKey(year, month));
  const next = shiftMonth(year, month, 1);
  const endExclusive = dueDateForPeriod(periodKey(next.year, next.month));
  return { start, endExclusive, periodKey: periodKey(year, month) };
}

function bogotaMonthBoundsFromPeriod(period) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(period || ''));
  if (!match) return bogotaMonthBounds();
  const year = Number(match[1]);
  const month = Number(match[2]);
  const start = dueDateForPeriod(periodKey(year, month));
  const next = shiftMonth(year, month, 1);
  const endExclusive = dueDateForPeriod(periodKey(next.year, next.month));
  return { start, endExclusive, periodKey: periodKey(year, month) };
}

function paymentCollectedTotal(payment) {
  return Number(payment.paidAmount || payment.amount || 0) + Number(payment.interestAmount || 0);
}

function monthsBetween(start, end) {
  const periods = [];
  let cursor = { ...start };
  while (comparePeriod(cursor, end) <= 0) {
    periods.push(periodKey(cursor.year, cursor.month));
    cursor = shiftMonth(cursor.year, cursor.month, 1);
  }
  return periods;
}

function openStatus(payment, _billingSettings, asOf) {
  const plain = payment.toObject ? payment.toObject() : payment;
  if (plain.status === 'paid') return 'paid';
  const current = bogotaMonth(asOf);
  const currentPeriod = periodKey(current.year, current.month);
  if (plain.period && plain.period < currentPeriod) return 'overdue';
  if (plain.status === 'partial' || (plain.paidAmount > 0 && plain.paidAmount < plain.amount)) {
    return 'partial';
  }
  return 'pending';
}

async function refreshUnitAdminStatus(unitId, organizationId) {
  const overdueCount = await Payment.countDocuments({
    unitId,
    organizationId,
    status: 'overdue',
  });
  const pendingCount = await Payment.countDocuments({
    unitId,
    organizationId,
    status: { $in: ['pending', 'partial'] },
  });

  let adminStatus = 'current';
  if (overdueCount > 0) adminStatus = 'overdue';
  else if (pendingCount > 0) adminStatus = 'pending';

  await Unit.findByIdAndUpdate(unitId, { adminStatus });
  return adminStatus;
}

/**
 * Crea la administración de cada mes que ya venció o está en curso
 * y aún no tiene un pago. Los meses sin pagar se conservan.
 */
async function syncAdministrationCharges({
  unit,
  organizationId,
  residentId,
  billingSettings,
  asOf = new Date(),
}) {
  const fee = getUnitAdministrationFee(unit, billingSettings);
  if (fee == null || fee <= 0) return { created: 0 };

  const existing = await Payment.find({
    unitId: unit._id,
    organizationId,
  }).select('period concept status amount paidAmount dueDate');

  const takenPeriods = new Set(existing.map((payment) => payment.period));
  const adminPeriods = existing
    .filter((payment) => payment.concept === 'administration' && /^\d{4}-\d{2}$/.test(payment.period || ''))
    .map((payment) => payment.period)
    .sort();

  const end = bogotaMonth(asOf);
  const earliest = adminPeriods[0];
  let start = end;
  if (earliest) {
    const [year, month] = earliest.split('-').map(Number);
    start = { year, month };
  }

  const oldestAllowed = shiftMonth(end.year, end.month, -(LOOKBACK_MONTHS - 1));
  if (comparePeriod(start, oldestAllowed) < 0) start = oldestAllowed;

  const missing = monthsBetween(start, end).filter((period) => !takenPeriods.has(period));
  const docs = missing.map((period) => {
    const dueDate = dueDateForPeriod(period);
    const status = openStatus(
      { status: 'pending', amount: fee, paidAmount: 0, dueDate, period },
      billingSettings,
      asOf
    );
    return {
      organizationId,
      unitId: unit._id,
      residentId,
      concept: 'administration',
      period,
      amount: fee,
      paidAmount: 0,
      currency: 'COP',
      dueDate,
      status,
    };
  });

  if (docs.length) {
    try {
      await Payment.insertMany(docs, { ordered: false });
    } catch (err) {
      const codes = [err.code, ...(err.writeErrors || []).map((item) => item.code)].filter(Boolean);
      if (!codes.length || codes.some((code) => code !== 11000)) throw err;
    }
  }

  const openAdmin = await Payment.find({
    unitId: unit._id,
    organizationId,
    concept: 'administration',
    status: { $ne: 'paid' },
  });

  await Promise.all(
    openAdmin.map(async (payment) => {
      const nextStatus = openStatus(payment, billingSettings, asOf);
      if (nextStatus === payment.status) return;
      payment.status = nextStatus;
      await payment.save();
    })
  );

  await refreshUnitAdminStatus(unit._id, organizationId);
  return { created: docs.length };
}

module.exports = {
  syncAdministrationCharges,
  refreshUnitAdminStatus,
  dueDateForPeriod,
  bogotaMonth,
  bogotaMonthBounds,
  bogotaMonthBoundsFromPeriod,
  paymentCollectedTotal,
  periodKey,
};
