const mongoose = require('mongoose');

const buildingSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    address: {
      street: String,
      city: String,
      state: String,
      country: { type: String, default: 'Colombia' },
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },
    heroImageUrl: { type: String },
    description: { type: String },
    /** Porcentaje que Rentados cobra sobre pagos de administración (split ePayco). */
    platformCommissionPercent: { type: Number, min: 0, max: 100, default: 3 },
    towers: [{ type: String, trim: true }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

buildingSchema.index({ organizationId: 1, slug: 1 }, { unique: true });

module.exports = mongoose.model('Building', buildingSchema);
