function resolveUnitAreaSqm(unit) {
  const raw = unit?.areaSqm ?? unit?.volumeM3;
  const area = Number(raw);
  if (!Number.isFinite(area) || area <= 0) return null;
  return area;
}

export function getUnitAdministrationFee(unit, billingSettings = {}) {
  const rate =
    billingSettings.administrationFeePerSqm ?? billingSettings.administrationFeePerM3;
  const area = resolveUnitAreaSqm(unit);
  if (rate != null && rate > 0 && area != null) {
    return Math.round(area * rate);
  }
  if (unit?.administrationFee != null && unit.administrationFee >= 0) {
    return unit.administrationFee;
  }
  return billingSettings.defaultAdministrationFee ?? null;
}

export function administrationFeePerSqmRate(billingSettings = {}) {
  return billingSettings.administrationFeePerSqm ?? billingSettings.administrationFeePerM3 ?? null;
}
