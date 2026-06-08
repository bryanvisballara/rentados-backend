const mongoose = require('mongoose');

const unitAppFollowUpSchema = new mongoose.Schema(
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
    reason: { type: String, required: true, trim: true },
    notes: { type: String, trim: true, default: '' },
    visitorName: { type: String, trim: true, default: '' },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

unitAppFollowUpSchema.index({ unitId: 1, createdAt: -1 });
unitAppFollowUpSchema.index({ buildingId: 1, createdAt: -1 });

module.exports = mongoose.model('UnitAppFollowUp', unitAppFollowUpSchema);
