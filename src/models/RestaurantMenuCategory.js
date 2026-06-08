const mongoose = require('mongoose');

const restaurantMenuCategorySchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

restaurantMenuCategorySchema.index({ restaurantId: 1, slug: 1 }, { unique: true });

module.exports = mongoose.model('RestaurantMenuCategory', restaurantMenuCategorySchema);
