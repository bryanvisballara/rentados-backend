const mongoose = require('mongoose');

const lockerPackageSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    buildingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Building',
      required: true,
      index: true,
    },
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
      required: true,
      index: true,
    },
    residentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resident',
      required: true,
      index: true,
    },
    registeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    photoUrl: { type: String, required: true },
    cloudinaryPublicId: { type: String },
    comment: { type: String, trim: true },
    status: {
      type: String,
      enum: ['pending_pickup', 'picked_up', 'held'],
      default: 'pending_pickup',
      index: true,
    },
    notificationSent: { type: Boolean, default: false },
    notificationSentAt: { type: Date },
    pickedUpAt: { type: Date },
    pickedUpBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    signatureRecipientName: { type: String, trim: true },
    signatureData: { type: String },
  },
  { timestamps: true }
);

lockerPackageSchema.index({ buildingId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('LockerPackage', lockerPackageSchema);
