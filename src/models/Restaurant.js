const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    cloudinaryPublicId: String,
  },
  { _id: false }
);

const restaurantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    shortDescription: { type: String, trim: true },
    description: { type: String, trim: true },
    cuisineType: { type: String, trim: true },
    coverImage: imageSchema,
    logoImage: imageSchema,
    city: { type: String, trim: true },
    country: { type: String, trim: true, default: 'Colombia' },
    address: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    openingHours: { type: String, trim: true },
    deliveryFee: { type: Number, min: 0, default: 0 },
    minOrderAmount: { type: Number, min: 0, default: 0 },
    currency: { type: String, default: 'COP' },
    avgPrepMinutes: { type: Number, min: 0 },
    targetCountries: [{ type: String, trim: true }],
    targetCities: [{ type: String, trim: true }],
    isFeatured: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Restaurant', restaurantSchema);
