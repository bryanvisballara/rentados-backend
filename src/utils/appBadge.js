const mongoose = require('mongoose');
const { LockerPackage, Resident, ResidentNotification } = require('../models');

const PENDING_LOCKER = ['pending_pickup', 'held'];

function asId(value) {
  if (!value) return null;
  const raw = value._id || value;
  const text = String(raw);
  return mongoose.Types.ObjectId.isValid(text) ? new mongoose.Types.ObjectId(text) : null;
}

function isLockedLockerNotice(notification, pendingPackageIds) {
  if (notification.type !== 'locker_package') return false;
  if (notification.meta?.event === 'picked_up') return false;
  if (!notification.lockerPackageId) return true;
  return pendingPackageIds.has(String(notification.lockerPackageId));
}

async function pendingLockerCount(unitId) {
  const id = asId(unitId);
  if (!id) return 0;
  return LockerPackage.countDocuments({
    unitId: id,
    status: { $in: PENDING_LOCKER },
  });
}

async function alertCount(userId) {
  const id = asId(userId);
  if (!id) return 0;
  return ResidentNotification.countDocuments({
    userId: id,
    dismissed: { $ne: true },
    type: { $ne: 'locker_package' },
  });
}

async function badgeCountsForUsers(userIds) {
  const ids = [...new Set((userIds || []).map((id) => String(asId(id) || '')).filter(Boolean))];
  const counts = Object.fromEntries(ids.map((id) => [id, 0]));
  if (!ids.length) return counts;

  const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));
  const residents = await Resident.find({ userId: { $in: objectIds } }).select('userId unitId');
  const unitByUser = new Map(residents.map((resident) => [String(resident.userId), resident.unitId]));
  const unitIds = [...unitByUser.values()].filter(Boolean);

  const [packageGroups, alertGroups] = await Promise.all([
    unitIds.length
      ? LockerPackage.aggregate([
          { $match: { unitId: { $in: unitIds }, status: { $in: PENDING_LOCKER } } },
          { $group: { _id: '$unitId', count: { $sum: 1 } } },
        ])
      : [],
    ResidentNotification.aggregate([
      {
        $match: {
          userId: { $in: objectIds },
          dismissed: { $ne: true },
          type: { $ne: 'locker_package' },
        },
      },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]),
  ]);

  const packagesByUnit = new Map(packageGroups.map((row) => [String(row._id), row.count]));
  const alertsByUser = new Map(alertGroups.map((row) => [String(row._id), row.count]));

  for (const id of ids) {
    const unitId = unitByUser.get(id);
    const locker = unitId ? packagesByUnit.get(String(unitId)) || 0 : 0;
    counts[id] = locker + (alertsByUser.get(id) || 0);
  }

  return counts;
}

async function loadInbox(userId, organizationId, unitId) {
  const notifications = await ResidentNotification.find({
    userId,
    organizationId,
    dismissed: { $ne: true },
  })
    .sort({ createdAt: -1 })
    .limit(40);

  const packageIds = notifications.map((item) => item.lockerPackageId).filter(Boolean);
  const pending = packageIds.length
    ? await LockerPackage.find({
        _id: { $in: packageIds },
        status: { $in: PENDING_LOCKER },
      }).select('_id')
    : [];
  const pendingIds = new Set(pending.map((item) => String(item._id)));
  const [lockerPackages, alerts] = await Promise.all([
    pendingLockerCount(unitId),
    alertCount(userId),
  ]);

  return {
    notifications: notifications.map((item) => ({
      id: item._id,
      type: item.type,
      title: item.title,
      body: item.body || '',
      createdAt: item.createdAt,
      locked: isLockedLockerNotice(item, pendingIds),
    })),
    lockerPackages,
    alerts,
    badge: lockerPackages + alerts,
  };
}

async function clearDismissibleNotifications(userId, organizationId, unitId) {
  const inbox = await loadInbox(userId, organizationId, unitId);
  const lockedIds = inbox.notifications.filter((item) => item.locked).map((item) => item.id);
  await ResidentNotification.updateMany(
    {
      userId,
      organizationId,
      dismissed: { $ne: true },
      _id: { $nin: lockedIds },
    },
    { $set: { dismissed: true, dismissedAt: new Date(), read: true, readAt: new Date() } }
  );
  return loadInbox(userId, organizationId, unitId);
}

async function dismissLockerArrivalNotices(packageId) {
  if (!packageId) return;
  await ResidentNotification.updateMany(
    {
      lockerPackageId: packageId,
      type: 'locker_package',
      'meta.event': { $ne: 'picked_up' },
    },
    { $set: { dismissed: true, dismissedAt: new Date(), read: true, readAt: new Date() } }
  );
}

module.exports = {
  badgeCountsForUsers,
  loadInbox,
  clearDismissibleNotifications,
  dismissLockerArrivalNotices,
};
