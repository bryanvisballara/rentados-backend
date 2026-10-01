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

function parseAreaSqm(value) {
  if (value === '' || value == null) return undefined;
  const parsed = Number(String(value).replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.round(parsed * 1000) / 1000;
}

const parseVolumeM3 = parseAreaSqm;

function parseAdministrationFeePerSqm(value) {
  if (value === '' || value == null) return undefined;
  const parsed = Number(String(value).replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.round(parsed);
}

const parseAdministrationFeePerM3 = parseAdministrationFeePerSqm;

function getBillingSettings(org) {
  const billing = org?.settings?.billing || {};
  const autoSuspension = billing.autoSuspension || {};
  const administrationFeePerSqm =
    billing.administrationFeePerSqm ?? billing.administrationFeePerM3 ?? null;
  return {
    defaultAdministrationFee: billing.defaultAdministrationFee ?? null,
    administrationFeePerSqm,
    /** @deprecated use administrationFeePerSqm */
    administrationFeePerM3: administrationFeePerSqm,
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

function resolveUnitAreaSqm(unit) {
  const raw = unit?.areaSqm ?? unit?.volumeM3;
  const area = Number(raw);
  if (!Number.isFinite(area) || area <= 0) return null;
  return area;
}

function administrationFeeFromArea(areaSqm, billingSettings) {
  const rate =
    billingSettings?.administrationFeePerSqm ?? billingSettings?.administrationFeePerM3;
  const area = Number(areaSqm);
  if (rate == null || rate <= 0 || !Number.isFinite(area) || area <= 0) return null;
  return Math.round(area * rate);
}

const administrationFeeFromVolume = administrationFeeFromArea;

function getUnitAdministrationFee(unit, billingSettings) {
  const fromArea = administrationFeeFromArea(resolveUnitAreaSqm(unit), billingSettings);
  if (fromArea != null) return fromArea;

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
  resolveUnitAreaSqm,
  administrationFeeFromArea,
  administrationFeeFromVolume,
  parseAdministrationFee,
  parseAreaSqm,
  parseVolumeM3,
  parseAdministrationFeePerSqm,
  parseAdministrationFeePerM3,
  calculatePaymentTotals,
  enrichPayment,
};
