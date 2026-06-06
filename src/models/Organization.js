const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    nit: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    plan: {
      type: String,
      enum: ['trial', 'basic', 'pro', 'enterprise'],
      default: 'trial',
    },
    isActive: { type: Boolean, default: true },
    settings: {
      timezone: { type: String, default: 'America/Bogota' },
      currency: { type: String, default: 'COP' },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Organization', organizationSchema);
