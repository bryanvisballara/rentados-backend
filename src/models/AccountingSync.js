const mongoose = require('mongoose');

const accountingSyncSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      index: true,
    },
    provider: { type: String, required: true },
    action: { type: String, enum: ['invoice', 'payment'], required: true },
    status: { type: String, enum: ['sent', 'error', 'skipped'], required: true },
    externalId: { type: String, trim: true },
    message: { type: String, trim: true },
  },
  { timestamps: true }
);

accountingSyncSchema.index({ paymentId: 1, action: 1, status: 1 });

module.exports = mongoose.model('AccountingSync', accountingSyncSchema);
