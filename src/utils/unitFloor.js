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

function resolveUnitFloor(number, explicitFloor) {
  const inferred = inferFloorFromUnitNumber(number);
  const explicit =
    explicitFloor !== '' && explicitFloor != null ? Number(explicitFloor) : undefined;

  if (explicit == null || Number.isNaN(explicit)) return inferred;
  if (inferred == null) return explicit;

  // Corrige cargas masivas donde dejaron piso 1 en aptos 201, 401, etc.
  if (explicit === 1 && inferred > 1) return inferred;

  return explicit;
}

module.exports = {
  inferFloorFromUnitNumber,
  resolveUnitFloor,
};
