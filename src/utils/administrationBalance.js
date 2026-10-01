const { Payment } = require('../models');
const { enrichPayment } = require('./billing');
const { bogotaMonth, dueDateForPeriod, refreshUnitAdminStatus } = require('./administrationCharges');

function isAdministrationPeriod(period) {
  return /^\d{4}-\d{2}$/.test(String(period || ''));
}

function administrationPayments(enrichedPayments) {
  return (enrichedPayments || [])
    .filter(
      (payment) =>
        payment.concept === 'administration' && isAdministrationPeriod(payment.period)
    )
    .sort((a, b) => String(a.period).localeCompare(String(b.period)));
}

function currentPeriodKey(asOf = new Date()) {
  const { year, month } = bogotaMonth(asOf);
  return `${year}-${String(month).padStart(2, '0')}`;
}

function isOpenAdminLine(payment) {
  if (!payment || payment.status === 'paid') return false;
  const totalDue = Number(payment.totalDue ?? 0);
  const principalDue = Number(payment.principalDue ?? payment.amount - (payment.paidAmount || 0));
  return totalDue > 0 || principalDue > 0;
}

/**
 * Cuotas de administración abiertas hasta el mes calendario actual (inclusive).
 */
function buildAdministrationOutstanding(enrichedPayments, asOf = new Date()) {
  const currentPeriod = currentPeriodKey(asOf);
  const lines = administrationPayments(enrichedPayments)
    .filter((payment) => payment.period <= currentPeriod && isOpenAdminLine(payment))
    .map((payment) => ({
      paymentId: payment._id,
      period: payment.period,
      status: payment.status,
      principalDue: Number(payment.principalDue ?? 0),
      interestAmount: Number(payment.interestAmount ?? 0),
      totalDue: Number(payment.totalDue ?? 0),
      dueDate: payment.dueDate,
      amount: payment.amount,
    }));

  const totalPrincipal = lines.reduce((sum, line) => sum + line.principalDue, 0);
  const totalInterest = lines.reduce((sum, line) => sum + line.interestAmount, 0);
  const totalDue = lines.reduce((sum, line) => sum + line.totalDue, 0);

  return {
    currentPeriod,
    lines,
    totalPrincipal,
    totalInterest,
    totalDue,
  };
}

/**
 * Monto e información para el carrusel de meses en la app residente.
 */
function resolveAdministrationCarouselView({
  enrichedPayments,
  slidePeriod,
  monthlyFee,
  asOf = new Date(),
}) {
  const currentPeriod = currentPeriodKey(asOf);
  const outstanding = buildAdministrationOutstanding(enrichedPayments, asOf);
  const byPeriod = new Map(
    administrationPayments(enrichedPayments).map((payment) => [payment.period, payment])
  );
  const record = byPeriod.get(slidePeriod) || null;

  if (slidePeriod > currentPeriod) {
    const fee = monthlyFee ?? 0;
    return {
      currentPeriod,
      slidePeriod,
      mode: 'upcoming',
      payable: fee,
      breakdown: [],
      aggregate: false,
      view: {
        concept: 'administration',
        period: slidePeriod,
        amount: fee,
        totalDue: fee,
        principalDue: fee,
        interestAmount: 0,
        dueDate: dueDateForPeriod(slidePeriod).toISOString(),
        status: 'upcoming',
      },
    };
  }

  if (slidePeriod === currentPeriod) {
    if (outstanding.totalDue <= 0) {
      const fee = monthlyFee ?? 0;
      return {
        currentPeriod,
        slidePeriod,
        mode: 'clear',
        payable: 0,
        breakdown: [],
        aggregate: false,
        view: {
          concept: 'administration',
          period: slidePeriod,
          amount: fee,
          totalDue: 0,
          principalDue: fee,
          interestAmount: 0,
          dueDate: dueDateForPeriod(slidePeriod).toISOString(),
          status: 'clear',
        },
      };
    }

    return {
      currentPeriod,
      slidePeriod,
      mode: outstanding.lines.some((line) => line.status === 'overdue') ? 'overdue' : 'pending',
      payable: outstanding.totalDue,
      breakdown: outstanding.lines,
      aggregate: true,
      view: {
        concept: 'administration',
        period: slidePeriod,
        amount: outstanding.totalPrincipal,
        totalDue: outstanding.totalDue,
        principalDue: outstanding.totalPrincipal,
        interestAmount: outstanding.totalInterest,
        dueDate: record?.dueDate || dueDateForPeriod(slidePeriod).toISOString(),
        status: outstanding.lines.some((line) => line.status === 'overdue') ? 'overdue' : 'pending',
      },
    };
  }

  if (record?.status === 'paid') {
    return {
      currentPeriod,
      slidePeriod,
      mode: 'paid',
      payable: 0,
      breakdown: [],
      aggregate: false,
      view: record,
    };
  }

  if (!record) {
    return {
      currentPeriod,
      slidePeriod,
      mode: 'clear',
      payable: 0,
      breakdown: [],
      aggregate: false,
      view: {
        concept: 'administration',
        period: slidePeriod,
        amount: monthlyFee ?? 0,
        totalDue: 0,
        principalDue: 0,
        interestAmount: 0,
        dueDate: dueDateForPeriod(slidePeriod).toISOString(),
        status: 'clear',
      },
    };
  }

  if (!isOpenAdminLine(record)) {
    return {
      currentPeriod,
      slidePeriod,
      mode: 'clear',
      payable: 0,
      breakdown: [],
      aggregate: false,
      view: {
        ...record,
        totalDue: 0,
        principalDue: 0,
        interestAmount: 0,
        status: 'clear',
      },
    };
  }

  return {
    currentPeriod,
    slidePeriod,
    mode: record.status === 'overdue' ? 'overdue' : 'pending',
    payable: Number(record.totalDue ?? 0),
    breakdown: [
      {
        paymentId: record._id,
        period: record.period,
        status: record.status,
        principalDue: Number(record.principalDue ?? 0),
        interestAmount: Number(record.interestAmount ?? 0),
        totalDue: Number(record.totalDue ?? 0),
        dueDate: record.dueDate,
        amount: record.amount,
      },
    ],
    aggregate: false,
    view: record,
  };
}

/**
 * Aplica un pago (tarjeta o manual) a cuotas de administración abiertas, mes a mes (FIFO).
 */
async function settleAdministrationPayments({
  organizationId,
  unitId,
  amount,
  billingSettings,
  asOf = new Date(),
  notes = '',
}) {
  const targetAmount = Math.round(Number(amount));
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    const err = new Error('El monto debe ser mayor a cero');
    err.status = 400;
    throw err;
  }

  const openDocs = await Payment.find({
    organizationId,
    unitId,
    concept: 'administration',
    status: { $in: ['pending', 'overdue', 'partial'] },
  }).sort({ period: 1, dueDate: 1 });

  let remaining = targetAmount;
  const settled = [];

  for (const payment of openDocs) {
    if (remaining <= 0) break;
    const enriched = enrichPayment(payment, billingSettings, asOf);
    const owed = Math.round(Number(enriched.totalDue ?? 0));
    if (owed <= 0) continue;
    if (remaining < owed) break;

    remaining -= owed;
    payment.paidAmount = payment.amount;
    payment.interestAmount = enriched.interestAmount || 0;
    payment.status = 'paid';
    payment.paidAt = asOf;
    if (notes) {
      payment.notes = payment.notes ? `${payment.notes} · ${notes}` : notes;
    }
    await payment.save();
    settled.push(payment);
  }

  if (!settled.length) {
    const err = new Error('No hay cuotas de administración pendientes por ese valor');
    err.status = 400;
    throw err;
  }

  if (remaining !== 0) {
    const err = new Error('El monto no coincide con las cuotas pendientes');
    err.status = 400;
    throw err;
  }

  await refreshUnitAdminStatus(unitId, organizationId);
  return settled.map((payment) => enrichPayment(payment, billingSettings, asOf));
}

async function settleSingleAdministrationPayment({
  paymentId,
  organizationId,
  unitId,
  amount,
  billingSettings,
  asOf = new Date(),
  notes = '',
}) {
  const payment = await Payment.findOne({
    _id: paymentId,
    organizationId,
    unitId,
    concept: 'administration',
    status: { $in: ['pending', 'overdue', 'partial'] },
  });
  if (!payment) {
    const err = new Error('Cuota de administración no encontrada');
    err.status = 404;
    throw err;
  }

  const enriched = enrichPayment(payment, billingSettings, asOf);
  const owed = Math.round(Number(enriched.totalDue ?? 0));
  const targetAmount = Math.round(Number(amount));
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    const err = new Error('El monto debe ser mayor a cero');
    err.status = 400;
    throw err;
  }
  if (targetAmount !== owed) {
    const err = new Error(`El monto debe ser ${owed} (total de la cuota)`);
    err.status = 400;
    throw err;
  }

  payment.paidAmount = payment.amount;
  payment.interestAmount = enriched.interestAmount || 0;
  payment.status = 'paid';
  payment.paidAt = asOf;
  if (notes) {
    payment.notes = payment.notes ? `${payment.notes} · ${notes}` : notes;
  }
  await payment.save();
  await refreshUnitAdminStatus(unitId, organizationId);
  return enrichPayment(payment, billingSettings, asOf);
}

module.exports = {
  isAdministrationPeriod,
  administrationPayments,
  currentPeriodKey,
  buildAdministrationOutstanding,
  resolveAdministrationCarouselView,
  settleAdministrationPayments,
  settleSingleAdministrationPayment,
};
