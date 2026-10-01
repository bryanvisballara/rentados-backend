import { APP_TIMEZONE } from '../utils/dateTime';

function bogotaMonthKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return `${year}-${month}`;
}

export function isAdministrationPeriod(period) {
  return /^\d{4}-\d{2}$/.test(String(period || ''));
}

function administrationPayments(payments) {
  return (payments || [])
    .filter(
      (payment) =>
        payment.concept === 'administration' && isAdministrationPeriod(payment.period)
    )
    .sort((a, b) => String(a.period).localeCompare(String(b.period)));
}

function isOpenAdminLine(payment) {
  if (!payment || payment.status === 'paid') return false;
  const totalDue = Number(payment.totalDue ?? 0);
  const principalDue = Number(
    payment.principalDue ?? payment.amount - (payment.paidAmount || 0)
  );
  return totalDue > 0 || principalDue > 0;
}

export function buildAdministrationOutstanding(payments, asOf = new Date()) {
  const currentPeriod = bogotaMonthKey(asOf);
  const lines = administrationPayments(payments)
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

  return {
    currentPeriod,
    lines,
    totalPrincipal: lines.reduce((sum, line) => sum + line.principalDue, 0),
    totalInterest: lines.reduce((sum, line) => sum + line.interestAmount, 0),
    totalDue: lines.reduce((sum, line) => sum + line.totalDue, 0),
  };
}

function dueDateForPeriod(period) {
  const [year, month] = String(period).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1, 5, 0, 0)).toISOString();
}

export function resolveAdministrationCarouselView({
  payments,
  slidePeriod,
  monthlyFee,
  asOf = new Date(),
}) {
  const currentPeriod = bogotaMonthKey(asOf);
  const outstanding = buildAdministrationOutstanding(payments, asOf);
  const byPeriod = new Map(
    administrationPayments(payments).map((payment) => [payment.period, payment])
  );
  const record = byPeriod.get(slidePeriod) || null;

  if (slidePeriod > currentPeriod) {
    const fee = monthlyFee ?? 0;
    return {
      currentPeriod,
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
        dueDate: dueDateForPeriod(slidePeriod),
        status: 'upcoming',
      },
    };
  }

  if (slidePeriod === currentPeriod) {
    if (outstanding.totalDue <= 0) {
      const fee = monthlyFee ?? 0;
      return {
        currentPeriod,
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
          dueDate: dueDateForPeriod(slidePeriod),
          status: 'clear',
        },
      };
    }

    const overdue = outstanding.lines.some((line) => line.status === 'overdue');
    return {
      currentPeriod,
      mode: overdue ? 'overdue' : 'pending',
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
        dueDate: record?.dueDate || dueDateForPeriod(slidePeriod),
        status: overdue ? 'overdue' : 'pending',
      },
    };
  }

  if (record?.status === 'paid') {
    return {
      currentPeriod,
      mode: 'paid',
      payable: 0,
      breakdown: [],
      aggregate: false,
      view: record,
    };
  }

  if (!record || !isOpenAdminLine(record)) {
    return {
      currentPeriod,
      mode: 'clear',
      payable: 0,
      breakdown: [],
      aggregate: false,
      view: {
        concept: 'administration',
        period: slidePeriod,
        amount: monthlyFee ?? record?.amount ?? 0,
        totalDue: 0,
        principalDue: 0,
        interestAmount: 0,
        dueDate: record?.dueDate || dueDateForPeriod(slidePeriod),
        status: 'clear',
      },
    };
  }

  return {
    currentPeriod,
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
