const mongoose = require('mongoose');

const AUDIENCE_SCOPES = ['building', 'towers', 'units'];

function normalizeAudienceScope(publication) {
  const scope = publication?.audienceScope;
  return AUDIENCE_SCOPES.includes(scope) ? scope : 'building';
}

function buildPublicationAudienceFilter(unit, towerObjectIds = []) {
  const unitId = unit._id;

  const or = [
    { audienceScope: { $exists: false } },
    { audienceScope: null },
    { audienceScope: 'building' },
    { audienceScope: 'units', audienceUnitIds: unitId },
  ];

  const towerIds = new Set(
    towerObjectIds.map((id) => String(id)).filter((id) => mongoose.Types.ObjectId.isValid(id))
  );
  if (unit.towerId) towerIds.add(String(unit.towerId));

  towerIds.forEach((towerId) => {
    or.push({ audienceScope: 'towers', audienceTowerIds: new mongoose.Types.ObjectId(towerId) });
  });

  return or;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function resolveUnitTowerIds(unit) {
  const { Tower } = require('../models');
  const ids = new Set();

  if (unit?.towerId) ids.add(String(unit.towerId));
  if (!unit?.buildingId || !unit?.tower) {
    return [...ids]
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
  }

  const label = String(unit.tower).trim();
  const codeGuess = label.replace(/^torre\s*/i, '').trim();
  const or = [{ name: label }, { code: label.toUpperCase() }];
  if (codeGuess) {
    or.push({ code: codeGuess.toUpperCase() });
    or.push({ name: new RegExp(`^Torre\\s*${escapeRegex(codeGuess)}$`, 'i') });
  }

  const towers = await Tower.find({
    buildingId: unit.buildingId,
    $or: or,
  }).select('_id');

  towers.forEach((tower) => ids.add(String(tower._id)));

  return [...ids]
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
}

function parseObjectIdList(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => String(value || '').trim())
    .filter((value) => mongoose.Types.ObjectId.isValid(value))
    .map((value) => new mongoose.Types.ObjectId(value));
}

async function resolvePublicationAudience(body, building) {
  const audienceScope = AUDIENCE_SCOPES.includes(body.audienceScope)
    ? body.audienceScope
    : 'building';

  const audienceTowerIds = parseObjectIdList(body.audienceTowerIds);
  const audienceUnitIds = parseObjectIdList(body.audienceUnitIds);

  if (audienceScope === 'towers' && !audienceTowerIds.length) {
    const err = new Error('Selecciona al menos una torre');
    err.status = 400;
    throw err;
  }

  if (audienceScope === 'units' && !audienceUnitIds.length) {
    const err = new Error('Selecciona al menos un apartamento');
    err.status = 400;
    throw err;
  }

  if (!building) {
    return {
      audienceScope,
      audienceTowerIds: audienceScope === 'towers' ? audienceTowerIds : [],
      audienceUnitIds: audienceScope === 'units' ? audienceUnitIds : [],
    };
  }

  const { Tower, Unit } = require('../models');

  if (audienceScope === 'towers') {
    const count = await Tower.countDocuments({
      _id: { $in: audienceTowerIds },
      buildingId: building._id,
    });
    if (count !== audienceTowerIds.length) {
      const err = new Error('Una o más torres no pertenecen a este conjunto');
      err.status = 400;
      throw err;
    }
  }

  if (audienceScope === 'units') {
    const count = await Unit.countDocuments({
      _id: { $in: audienceUnitIds },
      buildingId: building._id,
    });
    if (count !== audienceUnitIds.length) {
      const err = new Error('Uno o más apartamentos no pertenecen a este conjunto');
      err.status = 400;
      throw err;
    }
  }

  return {
    audienceScope,
    audienceTowerIds: audienceScope === 'towers' ? audienceTowerIds : [],
    audienceUnitIds: audienceScope === 'units' ? audienceUnitIds : [],
  };
}

module.exports = {
  AUDIENCE_SCOPES,
  normalizeAudienceScope,
  buildPublicationAudienceFilter,
  resolveUnitTowerIds,
  resolvePublicationAudience,
};
