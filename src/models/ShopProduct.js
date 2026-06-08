const mongoose = require('mongoose');

const shopProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    shortDescription: { type: String, trim: true },
    description: { type: String, trim: true },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShopCategory',
      required: true,
      index: true,
    },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0 },
    currency: { type: String, default: 'COP' },
    sku: { type: String, trim: true },
    stock: { type: Number, min: 0 },
    images: [
      {
        url: { type: String, required: true },
        cloudinaryPublicId: String,
        sortOrder: { type: Number, default: 0 },
      },
    ],
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

module.exports = mongoose.model('ShopProduct', shopProductSchema);
