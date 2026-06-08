const mongoose = require('mongoose');

const serviceProviderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      index: true,
    },
    businessName: { type: String, required: true, trim: true },
    categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCategory' }],
    description: { type: String },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    reviewCount: { type: Number, default: 0 },
    /** Tarifas por categoría; las define el prestador una vez aprobado. */
    offerings: [
      {
        categoryId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'ServiceCategory',
          required: true,
        },
        description: { type: String, trim: true },
        pricingNotes: { type: String, trim: true },
        referencePrice: { type: Number, min: 0 },
        isActive: { type: Boolean, default: true },
      },
    ],
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    rejectionReason: { type: String, trim: true },
    reviewedAt: { type: Date },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ServiceProvider', serviceProviderSchema);
