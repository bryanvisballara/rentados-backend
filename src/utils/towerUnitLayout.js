const { buildUnitCode } = require('./unitCode');

/**
 * Paraíso Caribe por torre:
 * piso 1 → 101 (código 1101 / 4101 …)
 * pisos 2–12 → 4 aptos (201–204 … 1201–1204) → códigos 1201–1204 … 11201–11204
 */
const PARAISO_TOWER_FLOORS = [
  { floor: 1, aptCount: 1 },
  ...Array.from({ length: 11 }, (_, index) => ({
    floor: index + 2,
    aptCount: 4,
  })),
];

const PARAISO_TOWER_COUNT = 10;

const PARAISO_TOWER_DEFS = Array.from({ length: PARAISO_TOWER_COUNT }, (_, index) => ({
  name: `Torre ${index + 1}`,
  code: String(index + 1),
  floors: 12,
  sortOrder: index + 1,
}));

function unitsPerTowerFromFloorConfigs(floorConfigs) {
  return floorConfigs.reduce((sum, { aptCount }) => sum + aptCount, 0);
}

const PARAISO_UNITS_PER_TOWER = unitsPerTowerFromFloorConfigs(PARAISO_TOWER_FLOORS);

function buildTowerUnitRows(organizationId, buildingId, tower, floorConfigs = PARAISO_TOWER_FLOORS) {
  const rows = [];
  for (const { floor, aptCount } of floorConfigs) {
    for (let apt = 1; apt <= aptCount; apt += 1) {
      const aptSuffix = String(apt).padStart(2, '0');
      const number = `${floor}${aptSuffix}`;
      rows.push({
        organizationId,
        buildingId,
        towerId: tower._id,
        number,
        code: buildUnitCode({ towerCode: tower.code, floor, number }),
        tower: tower.name,
        floor,
        type: 'apartment',
        administrationFee: 420000,
        adminStatus: 'current',
      });
    }
  }
  return rows;
}

module.exports = {
  PARAISO_TOWER_COUNT,
  PARAISO_TOWER_FLOORS,
  PARAISO_TOWER_DEFS,
  PARAISO_UNITS_PER_TOWER,
  buildTowerUnitRows,
  unitsPerTowerFromFloorConfigs,
};
