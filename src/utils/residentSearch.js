function normalizeQuery(query) {
  return String(query ?? '').trim().toLowerCase();
}

function matchResidentName(resident, nameQuery) {
  const n = normalizeQuery(nameQuery);
  if (!n) return true;
  const user = resident.userId || {};
  const full = `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase();
  return full.includes(n);
}

function matchResidentUsername(resident, usernameQuery) {
  const u = normalizeQuery(usernameQuery);
  if (!u) return true;
  const user = resident.userId || {};
  const email = String(user.email || '').toLowerCase();
  const phone = String(user.phone || '').toLowerCase();
  return email.includes(u) || phone.includes(u);
}

function matchResidentQuery(resident, query) {
  const q = normalizeQuery(query);
  if (!q) return true;

  const user = resident.userId || {};
  const unit = resident.unitId || {};

  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase();
  const email = String(user.email || '').toLowerCase();
  const phone = String(user.phone || '').toLowerCase();

  if (name.includes(q) || email.includes(q) || phone.includes(q)) return true;

  const unitNumber = String(unit.number || '').toLowerCase();
  const unitCode = String(unit.code || '').trim().toLowerCase();
  const tower = String(unit.tower || '').toLowerCase();
  const isNumericQuery = /^\d+$/.test(q);

  if (isNumericQuery) {
    if (unitCode && (unitCode === q || unitCode.startsWith(q))) return true;
    const numberDigits = unitNumber.replace(/\D/g, '');
    if (numberDigits === q || numberDigits.startsWith(q)) return true;
    return false;
  }

  if (unitCode && unitCode.includes(q)) return true;
  if (unitNumber.includes(q)) return true;
  if (tower.includes(q)) return true;

  return false;
}

module.exports = {
  matchResidentQuery,
  matchResidentName,
  matchResidentUsername,
};
