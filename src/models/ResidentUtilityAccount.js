const mongoose = require('mongoose');

const residentUtilityAccountSchema = new mongoose.Schema(
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
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UtilityProvider',
      required: true,
      index: true,
    },
    serviceType: { type: String, required: true, index: true },
    accountCode: { type: String, required: true, trim: true },
    accountCodeType: { type: String, trim: true },
    nickname: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    linkedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

residentUtilityAccountSchema.index(
  { residentId: 1, providerId: 1, accountCode: 1 },
  { unique: true }
);

module.exports = mongoose.model('ResidentUtilityAccount', residentUtilityAccountSchema);
