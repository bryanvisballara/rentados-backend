const { Resident, ResidentNotification } = require('../models');
const { sendPushToUsers } = require('./pushNotifications');

function residentUserId(resident) {
  if (!resident?.userId) return null;
  if (typeof resident.userId === 'object' && resident.userId._id) {
    return resident.userId._id;
  }
  return resident.userId;
}

async function notifyUnitResidents({
  organization,
  unitId,
  type,
  title,
  body,
  imageUrl,
  lockerPackageId,
  visitorVisitId,
  residentId,
  url,
  meta,
}) {
  const filter = { organizationId: organization._id, unitId };
  const residents = await Resident.find(filter).populate('userId', 'firstName lastName isActive');

  const targets = residentId
    ? residents.filter((r) => r._id.toString() === residentId.toString())
    : residents;

  const created = [];

  const pushUserIds = [];

  for (const resident of targets) {
    const userId = residentUserId(resident);
    if (!userId) continue;
    if (resident.userId?.isActive === false) continue;

    const notification = await ResidentNotification.create({
      organizationId: organization._id,
      userId,
      residentId: resident._id,
      unitId,
      type,
      title,
      body,
      imageUrl,
      lockerPackageId,
      visitorVisitId,
      meta,
      read: false,
      pushSent: false,
    });

    pushUserIds.push(userId);
    created.push(notification);
  }

  if (pushUserIds.length) {
    try {
      await sendPushToUsers(pushUserIds, {
        title,
        body,
        url: url || '/app',
      });
      const now = new Date();
      await Promise.all(
        created.map(async (notification) => {
          notification.pushSent = true;
          notification.pushSentAt = now;
          await notification.save();
        })
      );
    } catch {
      // In-app notification still created; push may retry on next event.
    }
  }

  return created;
}

module.exports = { notifyUnitResidents };
