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
      billing: {
        monthlyInterestRatePercent: { type: Number, default: 1.5, min: 0 },
        gracePeriodDays: { type: Number, default: 5, min: 0 },
        maxInterestMonths: { type: Number, default: 12, min: 1 },
        autoSuggestSuspensionOnOverdue: { type: Boolean, default: true },
        autoSuspension: {
          enabled: { type: Boolean, default: false },
          facilityIds: [{ type: String }],
          durationDays: { type: Number, default: 30, min: 1 },
          autoLiftWhenPaid: { type: Boolean, default: true },
        },
        defaultAdministrationFee: { type: Number, min: 0 },
      },
      locker: {
        enabled: { type: Boolean, default: false },
        receiveWhenOverdue: { type: Boolean, default: true },
        notifyWhenOverdue: { type: Boolean, default: true },
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Organization', organizationSchema);
