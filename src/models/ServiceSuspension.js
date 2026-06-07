const mongoose = require('mongoose');

const serviceSuspensionSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
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
    },
    facilityIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Facility',
      },
    ],
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true, index: true },
    reason: {
      type: String,
      enum: ['morosidad', 'manual', 'other'],
      default: 'morosidad',
    },
    notes: { type: String, trim: true },
    isAutomatic: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

serviceSuspensionSchema.index({ unitId: 1, startAt: 1, endAt: 1 });

module.exports = mongoose.model('ServiceSuspension', serviceSuspensionSchema);
