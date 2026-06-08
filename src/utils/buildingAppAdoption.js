const mongoose = require('mongoose');
const { Unit, Resident, UserSession, UnitAppFollowUp } = require('../models');

/** Apartamento con sesión de residente en los últimos 30 días = app descargada y activa. */
const APP_ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function getAppActiveCutoff() {
  return new Date(Date.now() - APP_ACTIVE_WINDOW_MS);
}

async function aggregateAppAdoptionByBuilding(buildingIds) {
  if (!buildingIds.length) return {};

  const cutoff = getAppActiveCutoff();
  const objectIds = buildingIds.map((id) =>
    id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id)
  );

  const rows = await Unit.aggregate([
    {
      $match: {
        buildingId: { $in: objectIds },
        type: 'apartment',
        isActive: { $ne: false },
      },
    },
    {
      $lookup: {
        from: 'residents',
        localField: '_id',
        foreignField: 'unitId',
        as: 'residents',
      },
    },
    {
      $lookup: {
        from: 'usersessions',
        let: { userIds: '$residents.userId' },
        pipeline: [
          {
            $match: {
              $expr: { $in: ['$userId', '$$userIds'] },
              role: 'RESIDENT',
              lastSeenAt: { $gte: cutoff },
            },
          },
          { $limit: 1 },
        ],
        as: 'activeSessions',
      },
    },
    {
      $group: {
        _id: '$buildingId',
        totalApartments: { $sum: 1 },
        unitsWithActiveApp: {
          $sum: { $cond: [{ $gt: [{ $size: '$activeSessions' }, 0] }, 1, 0] },
        },
      },
    },
    {
      $project: {
        totalApartments: 1,
        unitsWithActiveApp: 1,
        unitsWithoutApp: { $subtract: ['$totalApartments', '$unitsWithActiveApp'] },
      },
    },
  ]);

  return Object.fromEntries(
    rows.map((row) => [
      String(row._id),
      {
        totalApartments: row.totalApartments,
        unitsWithActiveApp: row.unitsWithActiveApp,
        unitsWithoutApp: row.unitsWithoutApp,
        appAdoptionRate:
          row.totalApartments > 0
            ? Math.round((row.unitsWithActiveApp / row.totalApartments) * 100)
            : 0,
      },
    ])
  );
}

async function aggregateFollowUpStatsByBuilding(buildingIds) {
  if (!buildingIds.length) return {};

  const cutoff = getAppActiveCutoff();
  const objectIds = buildingIds.map((id) =>
    id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id)
  );

  const rows = await Unit.aggregate([
    {
      $match: {
        buildingId: { $in: objectIds },
        type: 'apartment',
        isActive: { $ne: false },
      },
    },
    {
      $lookup: {
        from: 'residents',
        localField: '_id',
        foreignField: 'unitId',
        as: 'residents',
      },
    },
    {
      $lookup: {
        from: 'usersessions',
        let: { userIds: '$residents.userId' },
        pipeline: [
          {
            $match: {
              $expr: { $in: ['$userId', '$$userIds'] },
              role: 'RESIDENT',
              lastSeenAt: { $gte: cutoff },
            },
          },
          { $limit: 1 },
        ],
        as: 'activeSessions',
      },
    },
    {
      $addFields: {
        hasActiveApp: { $gt: [{ $size: '$activeSessions' }, 0] },
      },
    },
    { $match: { hasActiveApp: false } },
    {
      $lookup: {
        from: 'unitappfollowups',
        localField: '_id',
        foreignField: 'unitId',
        as: 'followUps',
      },
    },
    {
      $group: {
        _id: '$buildingId',
        unitsWithoutApp: { $sum: 1 },
        unitsWithFollowUp: {
          $sum: { $cond: [{ $gt: [{ $size: '$followUps' }, 0] }, 1, 0] },
        },
      },
    },
    {
      $project: {
        unitsWithoutApp: 1,
        unitsWithFollowUp: 1,
        unitsPendingFollowUp: { $subtract: ['$unitsWithoutApp', '$unitsWithFollowUp'] },
      },
    },
  ]);

  return Object.fromEntries(
    rows.map((row) => [
      String(row._id),
      {
        unitsWithFollowUp: row.unitsWithFollowUp,
        unitsPendingFollowUp: row.unitsPendingFollowUp,
      },
    ])
  );
}

async function getUnitsAppAdoptionDetail(buildingId, { onlyWithoutApp = true } = {}) {
  const cutoff = getAppActiveCutoff();
  const buildingObjectId =
    buildingId instanceof mongoose.Types.ObjectId
      ? buildingId
      : new mongoose.Types.ObjectId(buildingId);

  const units = await Unit.find({
    buildingId: buildingObjectId,
    type: 'apartment',
    isActive: { $ne: false },
  })
    .sort({ tower: 1, floor: 1, number: 1 })
    .lean();

  if (!units.length) {
    return {
      buildingId,
      summary: {
        totalApartments: 0,
        unitsWithActiveApp: 0,
        unitsWithoutApp: 0,
        appAdoptionRate: 0,
        unitsWithFollowUp: 0,
        unitsPendingFollowUp: 0,
      },
      units: [],
    };
  }

  const unitIds = units.map((unit) => unit._id);
  const residents = await Resident.find({ unitId: { $in: unitIds } })
    .populate('userId', 'firstName lastName email phone')
    .lean();

  const residentUserIds = residents
    .map((resident) => resident.userId?._id || resident.userId)
    .filter(Boolean);

  const [sessions, followUps] = await Promise.all([
    residentUserIds.length
      ? UserSession.find({
          role: 'RESIDENT',
          userId: { $in: residentUserIds },
          lastSeenAt: { $gte: cutoff },
        })
          .select('userId lastSeenAt')
          .lean()
      : [],
    UnitAppFollowUp.find({ buildingId: buildingObjectId, unitId: { $in: unitIds } })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'firstName lastName email')
      .lean(),
  ]);

  const residentsByUnit = residents.reduce((acc, resident) => {
    const key = String(resident.unitId);
    if (!acc[key]) acc[key] = [];
    acc[key].push(resident);
    return acc;
  }, {});

  const activeUserIds = new Set(sessions.map((session) => String(session.userId)));

  const followUpsByUnit = followUps.reduce((acc, entry) => {
    const key = String(entry.unitId);
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});

  const enriched = units.map((unit) => {
    const unitResidents = residentsByUnit[String(unit._id)] || [];
    const hasActiveApp = unitResidents.some((resident) =>
      activeUserIds.has(String(resident.userId?._id || resident.userId))
    );
    const unitFollowUps = followUpsByUnit[String(unit._id)] || [];
    const latestFollowUp = unitFollowUps[0] || null;

    return {
      unitId: unit._id,
      code: unit.code || unit.number,
      number: unit.number,
      tower: unit.tower || '—',
      floor: unit.floor,
      hasActiveApp,
      residents: unitResidents.map((resident) => ({
        id: resident._id,
        userId: resident.userId?._id || resident.userId,
        firstName: resident.userId?.firstName,
        lastName: resident.userId?.lastName,
        email: resident.userId?.email,
        phone: resident.userId?.phone,
        relationship: resident.relationship,
        isPrimary: resident.isPrimary,
      })),
      latestFollowUp: latestFollowUp
        ? {
            id: latestFollowUp._id,
            reason: latestFollowUp.reason,
            notes: latestFollowUp.notes,
            visitorName: latestFollowUp.visitorName,
            createdAt: latestFollowUp.createdAt,
            createdBy: latestFollowUp.createdBy
              ? {
                  id: latestFollowUp.createdBy._id,
                  firstName: latestFollowUp.createdBy.firstName,
                  lastName: latestFollowUp.createdBy.lastName,
                  email: latestFollowUp.createdBy.email,
                }
              : null,
          }
        : null,
      followUpHistory: unitFollowUps.map((entry) => ({
        id: entry._id,
        reason: entry.reason,
        notes: entry.notes,
        visitorName: entry.visitorName,
        createdAt: entry.createdAt,
        createdBy: entry.createdBy
          ? {
              id: entry.createdBy._id,
              firstName: entry.createdBy.firstName,
              lastName: entry.createdBy.lastName,
            }
          : null,
      })),
    };
  });

  const filtered = onlyWithoutApp ? enriched.filter((unit) => !unit.hasActiveApp) : enriched;
  const unitsWithActiveApp = enriched.filter((unit) => unit.hasActiveApp).length;
  const unitsWithoutApp = enriched.length - unitsWithActiveApp;
  const unitsWithFollowUp = filtered.filter((unit) => unit.latestFollowUp).length;

  return {
    buildingId,
    summary: {
      totalApartments: enriched.length,
      unitsWithActiveApp,
      unitsWithoutApp,
      appAdoptionRate:
        enriched.length > 0 ? Math.round((unitsWithActiveApp / enriched.length) * 100) : 0,
      unitsWithFollowUp,
      unitsPendingFollowUp: filtered.length - unitsWithFollowUp,
    },
    units: filtered,
  };
}

async function createUnitAppFollowUp({ unitId, reason, notes, visitorName, createdBy }) {
  const unit = await Unit.findById(unitId).select('organizationId buildingId number code');
  if (!unit) {
    const error = new Error('Unidad no encontrada');
    error.status = 404;
    throw error;
  }

  if (!reason?.trim()) {
    const error = new Error('La razón del seguimiento es requerida');
    error.status = 400;
    throw error;
  }

  const followUp = await UnitAppFollowUp.create({
    organizationId: unit.organizationId,
    buildingId: unit.buildingId,
    unitId: unit._id,
    reason: reason.trim(),
    notes: notes?.trim() || '',
    visitorName: visitorName?.trim() || '',
    createdBy,
  });

  await followUp.populate('createdBy', 'firstName lastName email');

  return {
    followUp,
    unit: {
      id: unit._id,
      code: unit.code || unit.number,
      number: unit.number,
    },
  };
}

module.exports = {
  APP_ACTIVE_WINDOW_MS,
  getAppActiveCutoff,
  aggregateAppAdoptionByBuilding,
  aggregateFollowUpStatsByBuilding,
  getUnitsAppAdoptionDetail,
  createUnitAppFollowUp,
};
