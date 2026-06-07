const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema(
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
    towerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tower',
      index: true,
      default: null,
    },
    number: { type: String, required: true, trim: true },
    tower: { type: String, trim: true },
    floor: { type: Number },
    type: {
      type: String,
      enum: ['apartment', 'house', 'commercial', 'parking'],
      default: 'apartment',
    },
    adminStatus: {
      type: String,
      enum: ['current', 'pending', 'overdue'],
      default: 'current',
    },
    areaSqm: { type: Number },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

unitSchema.index({ buildingId: 1, number: 1, towerId: 1 }, { unique: true });

module.exports = mongoose.model('Unit', unitSchema);
