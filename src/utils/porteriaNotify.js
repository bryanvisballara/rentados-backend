const { Resident, ResidentNotification } = require('../models');

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
}) {
  const filter = { organizationId: organization._id, unitId };
  const residents = await Resident.find(filter).populate('userId', 'firstName lastName isActive');

  const targets = residentId
    ? residents.filter((r) => r._id.toString() === residentId.toString())
    : residents;

  const created = [];

  for (const resident of targets) {
    if (resident.userId?.isActive === false) continue;

    const notification = await ResidentNotification.create({
      organizationId: organization._id,
      userId: resident.userId._id,
      residentId: resident._id,
      unitId,
      type,
      title,
      body,
      imageUrl,
      lockerPackageId,
      visitorVisitId,
      read: false,
      pushSent: false,
    });

    created.push(notification);
  }

  return created;
}

module.exports = { notifyUnitResidents };
