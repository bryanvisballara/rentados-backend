const { parseUnitFloor, inferFloorFromUnitNumber } = require('./unitFloor');

function getTowerDigit(towerCode) {
  if (towerCode == null || towerCode === '') return '';
  const str = String(towerCode).trim();
  const digits = str.replace(/\D/g, '');
  return digits || str;
}

function buildUnitCode({ towerCode, floor, number }) {
  const towerDigit = getTowerDigit(towerCode);
  if (!towerDigit) return null;

  const floorNum = parseUnitFloor(floor) ?? inferFloorFromUnitNumber(number);
  if (floorNum == null) return null;

  const digits = String(number ?? '').replace(/\D/g, '');
  if (!digits) return null;

  const aptSuffix =
    digits.length <= 2 ? digits.padStart(2, '0') : digits.slice(-2).padStart(2, '0');

  return `${towerDigit}${floorNum}${aptSuffix}`;
}

function resolveUnitCode(body, tower) {
  const manual = body.code?.trim();
  if (manual) return manual;

  return buildUnitCode({
    towerCode: tower?.code,
    floor: body.floor,
    number: body.number,
  });
}

module.exports = {
  getTowerDigit,
  buildUnitCode,
  resolveUnitCode,
};
