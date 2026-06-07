const { ServiceSuspension, Unit } = require('../models');

async function getActiveSuspensions(unitId, asOf = new Date()) {
  return ServiceSuspension.find({
    unitId,
    isActive: true,
    startAt: { $lte: asOf },
    endAt: { $gte: asOf },
  }).populate('facilityIds', 'name slug');
}

async function getSuspendedFacilityIds(unitId, asOf = new Date()) {
  const suspensions = await getActiveSuspensions(unitId, asOf);
  const ids = new Set();
  suspensions.forEach((s) => {
    s.facilityIds.forEach((f) => ids.add(f._id?.toString() || f.toString()));
  });
  return ids;
}

async function isUnitOverdue(unitId) {
  const unit = await Unit.findById(unitId).select('adminStatus');
  return unit?.adminStatus === 'overdue';
}

module.exports = {
  getActiveSuspensions,
  getSuspendedFacilityIds,
  isUnitOverdue,
};
