/**
 * Calcula intereses y totales de cartera según configuración del conjunto.
 */
function daysBetween(start, end) {
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function parseAdministrationFee(value) {
  if (value === '' || value == null) return undefined;
  const parsed = Number(String(value).replace(/\s/g, ''));
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.round(parsed);
}

function getBillingSettings(org) {
  const billing = org?.settings?.billing || {};
  const autoSuspension = billing.autoSuspension || {};
  return {
    defaultAdministrationFee: billing.defaultAdministrationFee ?? null,
    monthlyInterestRatePercent: billing.monthlyInterestRatePercent ?? 1.5,
    gracePeriodDays: billing.gracePeriodDays ?? 5,
    maxInterestMonths: billing.maxInterestMonths ?? 12,
    autoSuggestSuspensionOnOverdue: billing.autoSuggestSuspensionOnOverdue ?? true,
    autoSuspension: {
      enabled: autoSuspension.enabled ?? false,
      facilityIds: (autoSuspension.facilityIds || []).map(String),
      durationDays: autoSuspension.durationDays ?? 30,
      autoLiftWhenPaid: autoSuspension.autoLiftWhenPaid ?? true,
    },
  };
}

function getUnitAdministrationFee(unit, billingSettings) {
  if (unit?.administrationFee != null && unit.administrationFee >= 0) {
    return unit.administrationFee;
  }
  return billingSettings?.defaultAdministrationFee ?? null;
}

function calculatePaymentTotals(payment, billingSettings, asOf = new Date()) {
  if (payment.status === 'paid') {
    return {
      interestAmount: payment.interestAmount || 0,
      totalDue: 0,
      daysOverdue: 0,
      monthsOverdue: 0,
    };
  }

  const principal = payment.amount - (payment.paidAmount || 0);
  const dueDate = new Date(payment.dueDate);
  const daysOverdue = Math.max(0, daysBetween(dueDate, asOf) - billingSettings.gracePeriodDays);

  if (daysOverdue <= 0 || principal <= 0) {
    return {
      interestAmount: 0,
      totalDue: principal,
      daysOverdue: 0,
      monthsOverdue: 0,
    };
  }

  const monthsOverdue = Math.min(
    billingSettings.maxInterestMonths,
    Math.max(1, Math.ceil(daysOverdue / 30))
  );
  const rate = billingSettings.monthlyInterestRatePercent / 100;
  const interestAmount = Math.round(principal * rate * monthsOverdue);

  return {
    interestAmount,
    totalDue: principal + interestAmount,
    daysOverdue,
    monthsOverdue,
  };
}

function enrichPayment(payment, billingSettings, asOf = new Date()) {
  const totals = calculatePaymentTotals(payment, billingSettings, asOf);
  const doc = payment.toObject ? payment.toObject() : { ...payment };

  return {
    ...doc,
    principalDue: doc.amount - (doc.paidAmount || 0),
    interestAmount: totals.interestAmount,
    totalDue: totals.totalDue,
    daysOverdue: totals.daysOverdue,
    monthsOverdue: totals.monthsOverdue,
  };
}

module.exports = {
  getBillingSettings,
  getUnitAdministrationFee,
  parseAdministrationFee,
  calculatePaymentTotals,
  enrichPayment,
};
