const { Organization, Building } = require('../models');

function getTenantIdsFromRequest(req) {
  return {
    organizationId: req.headers['x-organization-id'] || req.query.organizationId || null,
    buildingId: req.headers['x-building-id'] || req.query.buildingId || null,
  };
}

async function listAccessibleBuildings(user) {
  if (!user?.organizationId || user.role === 'SUPER_ADMIN') return [];
  const filter = { organizationId: user.organizationId, isActive: { $ne: false } };
  if (user.buildingId) filter._id = user.buildingId;
  return Building.find(filter).sort({ createdAt: 1, name: 1 });
}

function pickBuilding(buildings, requestedId, locked) {
  if (!buildings.length) return null;
  if (locked) return buildings[0];
  if (requestedId) {
    const match = buildings.find((building) => building._id.toString() === String(requestedId));
    if (match) return match;
  }
  return buildings[0];
}

async function getOrgContext(user, req = null) {
  if (user.role === 'SUPER_ADMIN') {
    const { organizationId, buildingId } = req ? getTenantIdsFromRequest(req) : {};

    if (!organizationId) {
      return { organization: null, building: null, buildings: [], canSwitchBuildings: false, scope: 'platform' };
    }

    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return { organization: null, building: null, buildings: [], canSwitchBuildings: false, scope: 'platform' };
    }

    const buildings = await Building.find({ organizationId: organization._id, isActive: { $ne: false } }).sort({
      createdAt: 1,
      name: 1,
    });
    const building = pickBuilding(buildings, buildingId, false);

    return { organization, building, buildings, canSwitchBuildings: false, scope: 'platform' };
  }

  const organization = user.organizationId
    ? await Organization.findById(user.organizationId)
    : null;
  const buildings = organization ? await listAccessibleBuildings(user) : [];
  const requestedId = req ? getTenantIdsFromRequest(req).buildingId : null;
  const locked = Boolean(user.buildingId);
  const building = pickBuilding(buildings, requestedId, locked);

  return {
    organization,
    building,
    buildings,
    canSwitchBuildings: !locked && buildings.length > 1,
    scope: locked ? 'building' : 'company',
  };
}

function getScopedOrgFilter(user, req) {
  if (user.role === 'SUPER_ADMIN') {
    const { organizationId } = getTenantIdsFromRequest(req);
    if (organizationId) return { organizationId };
    return { organizationId: null };
  }
  return { organizationId: user.organizationId };
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

module.exports = {
  getOrgContext,
  getTenantIdsFromRequest,
  getScopedOrgFilter,
  listAccessibleBuildings,
  slugify,
};
