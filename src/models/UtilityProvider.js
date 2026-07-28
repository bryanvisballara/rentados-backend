const mongoose = require('mongoose');
const { SERVICE_TYPE_KEYS } = require('../utils/utilityServices');

const utilityProviderSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true, unique: true },
    serviceType: { type: String, enum: SERVICE_TYPE_KEYS, required: true, index: true },
    cities: [{ type: String, trim: true }],
    cityKeys: [{ type: String, trim: true, lowercase: true, index: true }],
    accountCodeLabel: { type: String, default: 'Código de usuario', trim: true },
    accountCodeHelp: { type: String, trim: true },
    websiteUrl: { type: String, trim: true },
    paymentUrl: { type: String, trim: true },
    integrationStatus: {
      type: String,
      enum: ['manual', 'api', 'webhook'],
      default: 'manual',
    },
    integrationNotes: { type: String, trim: true },
    logoUrl: { type: String, trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

utilityProviderSchema.index({ serviceType: 1, isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('UtilityProvider', utilityProviderSchema);
