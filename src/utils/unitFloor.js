function parseUnitFloor(value) {
  if (value === '' || value == null) return undefined;
  const parsed = Number(String(value).trim());
  if (!Number.isFinite(parsed)) return undefined;
  return Math.trunc(parsed);
}

function inferFloorFromUnitNumber(number) {
  const digits = String(number ?? '').replace(/\D/g, '');
  if (!digits) return undefined;
  if (digits.length <= 2) {
    const floor = parseInt(digits, 10);
    return Number.isFinite(floor) && floor > 0 ? floor : undefined;
  }

  const floor = parseInt(digits.slice(0, -2), 10);
  return Number.isFinite(floor) && floor > 0 ? floor : undefined;
}

module.exports = {
  parseUnitFloor,
  inferFloorFromUnitNumber,
};
