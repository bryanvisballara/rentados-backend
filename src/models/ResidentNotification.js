const mongoose = require('mongoose');

const residentNotificationSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    residentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resident',
    },
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
    },
    type: {
      type: String,
      enum: ['locker_package', 'visitor_parking', 'porteria_message', 'locker_overflow'],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    body: { type: String, trim: true },
    imageUrl: { type: String },
    lockerPackageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LockerPackage',
    },
    visitorVisitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VisitorParkingVisit',
    },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
    pushSent: { type: Boolean, default: false },
    pushSentAt: { type: Date },
  },
  { timestamps: true }
);

residentNotificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('ResidentNotification', residentNotificationSchema);
