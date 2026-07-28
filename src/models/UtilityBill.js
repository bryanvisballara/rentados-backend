const mongoose = require('mongoose');

const utilityBillSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    buildingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Building', index: true },
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
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UtilityProvider',
      required: true,
      index: true,
    },
    serviceType: { type: String, required: true, index: true },
    period: { type: String, trim: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'COP' },
    dueDate: { type: Date },
    issuedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['pending', 'paid', 'overdue', 'cancelled'],
      default: 'pending',
      index: true,
    },
    externalBillId: { type: String, trim: true },
    paymentUrl: { type: String, trim: true },
    documentUrl: { type: String, trim: true },
    documentPublicId: { type: String, trim: true },
    documentFileName: { type: String, trim: true },
    documentMimeType: { type: String, trim: true, default: 'application/pdf' },
    notifiedAt: { type: Date },
    paidAt: { type: Date },
    rawPayload: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

utilityBillSchema.index({ accountId: 1, externalBillId: 1 }, { unique: true, sparse: true });
utilityBillSchema.index({ residentId: 1, status: 1, dueDate: -1 });

module.exports = mongoose.model('UtilityBill', utilityBillSchema);
