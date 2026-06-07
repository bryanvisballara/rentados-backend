const { Unit, Payment, ServiceSuspension } = require('../models');
const { getBillingSettings } = require('./billing');

function getAutoSuspensionSettings(org) {
  const auto = org?.settings?.billing?.autoSuspension || {};
  return {
    enabled: auto.enabled ?? false,
    facilityIds: (auto.facilityIds || []).map(String),
    durationDays: auto.durationDays ?? 30,
    autoLiftWhenPaid: auto.autoLiftWhenPaid ?? true,
  };
}

async function getOverdueUnitIds(organizationId) {
  const ids = new Set();

  const [paymentUnitIds, adminOverdueUnitIds] = await Promise.all([
    Payment.find({ organizationId, status: 'overdue' }).distinct('unitId'),
    Unit.find({ organizationId, adminStatus: 'overdue' }).distinct('_id'),
  ]);

  paymentUnitIds.forEach((id) => ids.add(id.toString()));
  adminOverdueUnitIds.forEach((id) => ids.add(id.toString()));

  return ids;
}

function sameFacilitySet(a, b) {
  const left = [...a].map(String).sort().join(',');
  const right = [...b].map(String).sort().join(',');
  return left === right;
}

async function syncAutoSuspensions(organization, options = {}) {
  const { userId } = options;
  const settings = getAutoSuspensionSettings(organization);
  const organizationId = organization._id;
  const now = new Date();

  if (!settings.enabled || !settings.facilityIds.length) {
    return {
      created: 0,
      updated: 0,
      lifted: 0,
      overdueUnits: 0,
      skipped: true,
      reason: 'Suspensiones automáticas desactivadas o sin servicios configurados',
    };
  }

  const overdueUnitIds = await getOverdueUnitIds(organizationId);
  const endAt = new Date(now);
  endAt.setDate(endAt.getDate() + settings.durationDays);

  let created = 0;
  let updated = 0;
  let lifted = 0;

  for (const unitId of overdueUnitIds) {
    const existing = await ServiceSuspension.findOne({
      organizationId,
      unitId,
      isAutomatic: true,
      isActive: true,
      endAt: { $gte: now },
    });

    if (existing) {
      let changed = false;

      if (!sameFacilitySet(existing.facilityIds, settings.facilityIds)) {
        existing.facilityIds = settings.facilityIds;
        changed = true;
      }

      if (existing.endAt < endAt) {
        existing.endAt = endAt;
        changed = true;
      }

      if (changed) {
        await existing.save();
        updated += 1;
      }
    } else {
      await ServiceSuspension.create({
        organizationId,
        unitId,
        facilityIds: settings.facilityIds,
        startAt: now,
        endAt,
        reason: 'morosidad',
        notes: 'Suspensión automática por morosidad',
        isAutomatic: true,
        isActive: true,
        createdBy: userId,
      });
      created += 1;
    }
  }

  if (settings.autoLiftWhenPaid) {
    const activeAutomatic = await ServiceSuspension.find({
      organizationId,
      isAutomatic: true,
      isActive: true,
    });

    for (const suspension of activeAutomatic) {
      if (!overdueUnitIds.has(suspension.unitId.toString())) {
        suspension.isActive = false;
        await suspension.save();
        lifted += 1;
      }
    }
  }

  return {
    created,
    updated,
    lifted,
    overdueUnits: overdueUnitIds.size,
    skipped: false,
  };
}

module.exports = {
  getAutoSuspensionSettings,
  getOverdueUnitIds,
  syncAutoSuspensions,
};
