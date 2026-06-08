const mongoose = require('mongoose');

const restaurantMenuItemSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RestaurantMenuCategory',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0 },
    currency: { type: String, default: 'COP' },
    images: [
      {
        url: { type: String, required: true },
        cloudinaryPublicId: String,
        sortOrder: { type: Number, default: 0 },
      },
    ],
    tags: [{ type: String, trim: true }],
    isAvailable: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

restaurantMenuItemSchema.index({ restaurantId: 1, slug: 1 }, { unique: true });

module.exports = mongoose.model('RestaurantMenuItem', restaurantMenuItemSchema);
