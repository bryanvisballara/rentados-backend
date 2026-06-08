const { Building, Tower } = require('../models');
const {
  aggregateAppAdoptionByBuilding,
  aggregateFollowUpStatsByBuilding,
  APP_ACTIVE_WINDOW_MS,
} = require('./buildingAppAdoption');

function getHealthLabel({ appAdoptionRate, totalApartments }) {
  if (totalApartments === 0) {
    return { key: 'setup', label: 'En configuración', priority: 1 };
  }
  if (appAdoptionRate < 20) {
    return { key: 'critical', label: 'Crítico', priority: 0 };
  }
  if (appAdoptionRate < 40) {
    return { key: 'low', label: 'Bajo', priority: 2 };
  }
  if (appAdoptionRate < 65) {
    return { key: 'medium', label: 'Medio', priority: 3 };
  }
  return { key: 'high', label: 'Alto', priority: 4 };
}

async function getBuildingEngagementReport() {
  const buildings = await Building.find({ isActive: { $ne: false } })
    .populate('organizationId', 'name slug')
    .sort({ name: 1 })
    .lean();

  if (!buildings.length) {
    return { buildings: [], summary: { totalBuildings: 0 } };
  }

  const buildingIds = buildings.map((building) => building._id);

  const [towerStats, adoptionByBuilding, followUpByBuilding] = await Promise.all([
    Tower.aggregate([
      {
        $match: {
          buildingId: { $in: buildingIds },
          isActive: { $ne: false },
        },
      },
      { $group: { _id: '$buildingId', totalTowers: { $sum: 1 } } },
    ]),
    aggregateAppAdoptionByBuilding(buildingIds),
    aggregateFollowUpStatsByBuilding(buildingIds),
  ]);

  const towersByBuilding = Object.fromEntries(
    towerStats.map((row) => [String(row._id), row.totalTowers])
  );

  const report = buildings.map((building) => {
    const id = String(building._id);
    const adoption = adoptionByBuilding[id] || {
      totalApartments: 0,
      unitsWithActiveApp: 0,
      unitsWithoutApp: 0,
      appAdoptionRate: 0,
    };
    const totalTowers = towersByBuilding[id] || 0;
    const followUp = followUpByBuilding[id] || {
      unitsWithFollowUp: 0,
      unitsPendingFollowUp: adoption.unitsWithoutApp,
    };
    const unitsWithFollowUp = followUp.unitsWithFollowUp;
    const unitsPendingFollowUp = followUp.unitsPendingFollowUp;
    const health = getHealthLabel({
      appAdoptionRate: adoption.appAdoptionRate,
      totalApartments: adoption.totalApartments,
    });

    return {
      buildingId: building._id,
      buildingName: building.name,
      organizationId: building.organizationId?._id || building.organizationId,
      organizationName: building.organizationId?.name || '—',
      city: building.address?.city || '—',
      country: building.address?.country || '—',
      totalTowers,
      totalApartments: adoption.totalApartments,
      unitsWithActiveApp: adoption.unitsWithActiveApp,
      unitsWithoutApp: adoption.unitsWithoutApp,
      appAdoptionRate: adoption.appAdoptionRate,
      unitsWithFollowUp,
      unitsPendingFollowUp,
      health,
    };
  });

  report.sort((a, b) => {
    if (a.health.priority !== b.health.priority) return a.health.priority - b.health.priority;
    return a.appAdoptionRate - b.appAdoptionRate;
  });

  const summary = {
    totalBuildings: report.length,
    totalTowers: report.reduce((sum, row) => sum + row.totalTowers, 0),
    totalApartments: report.reduce((sum, row) => sum + row.totalApartments, 0),
    unitsWithActiveApp: report.reduce((sum, row) => sum + row.unitsWithActiveApp, 0),
    unitsWithoutApp: report.reduce((sum, row) => sum + row.unitsWithoutApp, 0),
    unitsWithFollowUp: report.reduce((sum, row) => sum + row.unitsWithFollowUp, 0),
    unitsPendingFollowUp: report.reduce((sum, row) => sum + row.unitsPendingFollowUp, 0),
    averageAppAdoption:
      report.length > 0
        ? Math.round(report.reduce((sum, row) => sum + row.appAdoptionRate, 0) / report.length)
        : 0,
    criticalBuildings: report.filter((row) => row.health.key === 'critical').length,
    lowEngagementBuildings: report.filter((row) =>
      ['critical', 'low'].includes(row.health.key)
    ).length,
    appActiveWindowDays: APP_ACTIVE_WINDOW_MS / (24 * 60 * 60 * 1000),
  };

  return { buildings: report, summary };
}

module.exports = { getBuildingEngagementReport, getHealthLabel };
