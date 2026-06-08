export function getUnitTowerName(unit) {
  return unit?.towerId?.name || unit?.tower || '';
}

export function formatUnitLabel(unit, { prefix = 'Apto' } = {}) {
  const number = unit?.number ?? '';
  const tower = getUnitTowerName(unit);
  const base = prefix ? `${prefix} ${number}` : String(number);
  return tower ? `${base} · ${tower}` : base;
}

export function matchUnitQuery(unit, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const number = String(unit?.number ?? '').toLowerCase();
  const tower = getUnitTowerName(unit).toLowerCase();
  const floor = unit?.floor != null && unit?.floor !== '' ? String(unit.floor) : '';
  const label = formatUnitLabel(unit).toLowerCase();

  if (number.includes(q) || tower.includes(q) || label.includes(q)) return true;
  if (number.length >= 3 && q.includes(number)) return true;

  if (floor) {
    const combined = `${floor}${number}`;
    const combinedSpaced = `${floor} ${number}`;
    const combinedDash = `${floor}-${number}`;
    if (
      combined.includes(q) ||
      q.includes(combined) ||
      combinedSpaced.includes(q) ||
      combinedDash.includes(q)
    ) {
      return true;
    }
  }

  const digits = number.replace(/\D/g, '');
  if (digits.length > 2) {
    const inferredFloor = digits.slice(0, -2);
    const aptSuffix = digits.slice(-2);
    const inferredCombined = `${inferredFloor}${aptSuffix}`;
    if (inferredCombined.includes(q) || q.includes(inferredCombined)) return true;
  }

  return false;
}
