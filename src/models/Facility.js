const mongoose = require('mongoose');

const facilitySchema = new mongoose.Schema(
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
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String },
    icon: { type: String },
    capacity: { type: Number },
    requiresApproval: { type: Boolean, default: false },
    openHours: {
      start: { type: String, default: '06:00' },
      end: { type: String, default: '22:00' },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

facilitySchema.index({ buildingId: 1, slug: 1 }, { unique: true });

module.exports = mongoose.model('Facility', facilitySchema);
