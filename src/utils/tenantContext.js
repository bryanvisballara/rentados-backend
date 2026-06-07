const { Organization, Building } = require('../models');

function getTenantIdsFromRequest(req) {
  return {
    organizationId: req.headers['x-organization-id'] || req.query.organizationId || null,
    buildingId: req.headers['x-building-id'] || req.query.buildingId || null,
  };
}

async function getOrgContext(user, req = null) {
  if (user.role === 'SUPER_ADMIN') {
    const { organizationId, buildingId } = req ? getTenantIdsFromRequest(req) : {};

    if (!organizationId) {
      return { organization: null, building: null };
    }

    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return { organization: null, building: null };
    }

    let building = null;
    if (buildingId) {
      building = await Building.findOne({ _id: buildingId, organizationId: organization._id });
    } else {
      building = await Building.findOne({ organizationId: organization._id }).sort({ createdAt: 1 });
    }

    return { organization, building };
  }

  const organization = user.organizationId
    ? await Organization.findById(user.organizationId)
    : null;

  const building = organization
    ? await Building.findOne({ organizationId: organization._id }).sort({ createdAt: 1 })
    : null;

  return { organization, building };
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
  slugify,
};
