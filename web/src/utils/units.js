export function getUnitTowerName(unit) {
  return unit?.towerId?.name || unit?.tower || '';
}

export function formatUnitLabel(unit, { prefix = 'Apto' } = {}) {
  const number = unit?.number ?? '';
  const tower = getUnitTowerName(unit);
  const code = unit?.code?.trim();
  const base = prefix ? `${prefix} ${number}` : String(number);
  const detail = tower ? `${base} · ${tower}` : base;
  return code ? `${code} · ${detail}` : detail;
}

function normalizeQuery(query) {
  return query.trim().toLowerCase();
}

function unitCode(unit) {
  return String(unit?.code ?? '')
    .trim()
    .toLowerCase();
}

function unitNumberDigits(unit) {
  return String(unit?.number ?? '').replace(/\D/g, '');
}

/** Lower rank = better match when sorting portería results. */
export function unitQueryRank(unit, query) {
  const q = normalizeQuery(query);
  if (!q) return 0;

  const code = unitCode(unit);
  if (code) {
    if (code === q) return 0;
    if (code.startsWith(q)) return 1;
    if (q.startsWith(code)) return 2;
  }

  const number = String(unit?.number ?? '').toLowerCase();
  if (number === q) return 3;
  if (number.startsWith(q)) return 4;

  const tower = getUnitTowerName(unit).toLowerCase();
  if (tower.includes(q)) return 5;

  return 10;
}

export function matchUnitQuery(unit, query) {
  const q = normalizeQuery(query);
  if (!q) return true;

  const code = unitCode(unit);
  const number = String(unit?.number ?? '').toLowerCase();
  const tower = getUnitTowerName(unit).toLowerCase();
  const floor = unit?.floor != null && unit?.floor !== '' ? String(unit.floor) : '';
  const numberDigits = unitNumberDigits(unit);
  const isNumericQuery = /^\d+$/.test(q);

  // Portería busca por código numérico (ej. 41201, 1101).
  if (isNumericQuery) {
    if (code) {
      return code === q || code.startsWith(q);
    }

    if (numberDigits === q || numberDigits.startsWith(q)) return true;

    if (floor) {
      const combined = `${floor}${numberDigits}`;
      return combined === q || combined.startsWith(q);
    }

    return false;
  }

  // Búsqueda por texto: torre, número visible o código que contenga el texto.
  if (code && code.includes(q)) return true;
  if (number.includes(q)) return true;
  if (tower.includes(q)) return true;

  if (floor) {
    const combined = `${floor}${number}`;
    const combinedSpaced = `${floor} ${number}`;
    if (combined.includes(q) || combinedSpaced.includes(q)) return true;
  }

  return formatUnitLabel(unit).toLowerCase().includes(q);
}

export function sortUnitsForPicker(a, b, query = '') {
  const q = normalizeQuery(query);
  if (q) {
    const rankDiff = unitQueryRank(a, q) - unitQueryRank(b, q);
    if (rankDiff !== 0) return rankDiff;
  }

  const keyA = a.code || a.number;
  const keyB = b.code || b.number;
  return String(keyA).localeCompare(String(keyB), 'es', { numeric: true });
}
