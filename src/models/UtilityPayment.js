const mongoose = require('mongoose');

const utilityPaymentSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    residentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resident',
      required: true,
      index: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ResidentUtilityAccount',
      required: true,
      index: true,
    },
    billId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UtilityBill',
      required: true,
      index: true,
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UtilityProvider',
      required: true,
    },
    serviceType: { type: String, required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'COP' },
    paidAt: { type: Date, default: Date.now },
    source: {
      type: String,
      enum: ['manual', 'redirect', 'webhook'],
      default: 'manual',
    },
    externalRef: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

utilityPaymentSchema.index({ residentId: 1, paidAt: -1 });
utilityPaymentSchema.index({ serviceType: 1, paidAt: -1 });

module.exports = mongoose.model('UtilityPayment', utilityPaymentSchema);
