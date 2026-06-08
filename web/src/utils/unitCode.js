function getTowerDigit(towerCode) {
  if (towerCode == null || towerCode === '') return '';
  const str = String(towerCode).trim();
  const digits = str.replace(/\D/g, '');
  return digits || str;
}

export function inferFloorFromUnitNumber(number) {
  const digits = String(number ?? '').replace(/\D/g, '');
  if (!digits) return undefined;
  if (digits.length <= 2) {
    const floor = parseInt(digits, 10);
    return Number.isFinite(floor) && floor > 0 ? floor : undefined;
  }

  const floor = parseInt(digits.slice(0, -2), 10);
  return Number.isFinite(floor) && floor > 0 ? floor : undefined;
}

export function buildUnitCode({ towerCode, floor, number }) {
  const towerDigit = getTowerDigit(towerCode);
  if (!towerDigit) return '';

  const parsedFloor =
    floor === '' || floor == null
      ? undefined
      : Number.isFinite(Number(floor))
        ? Math.trunc(Number(floor))
        : undefined;
  const floorNum = parsedFloor ?? inferFloorFromUnitNumber(number);
  if (floorNum == null) return '';

  const digits = String(number ?? '').replace(/\D/g, '');
  if (!digits) return '';

  const aptSuffix =
    digits.length <= 2 ? digits.padStart(2, '0') : digits.slice(-2).padStart(2, '0');

  return `${towerDigit}${floorNum}${aptSuffix}`;
}

export function suggestUnitCode({ towerCode, floor, number }) {
  return buildUnitCode({ towerCode, floor, number });
}
