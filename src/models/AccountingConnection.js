const mongoose = require('mongoose');

const accountingConnectionSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ['siigo', 'alegra', 'quickbooks', 'worldoffice', 'helisa', 'loggro'],
      required: true,
    },
    status: {
      type: String,
      enum: ['disconnected', 'connected', 'error'],
      default: 'disconnected',
    },
    companyName: { type: String, trim: true },
    credentialsEnc: { type: String },
    accountLabel: { type: String, trim: true },
    settings: {
      documentTypeId: { type: String, trim: true },
      documentTypeName: { type: String, trim: true },
      sellerId: { type: String, trim: true },
      paymentTypeId: { type: String, trim: true },
      itemId: { type: String, trim: true },
      itemName: { type: String, trim: true },
      customerIdentification: { type: String, trim: true },
      contactId: { type: String, trim: true },
      contactName: { type: String, trim: true },
      bankAccountId: { type: String, trim: true },
      bankAccountName: { type: String, trim: true },
      sendInvoices: { type: Boolean, default: true },
      sendPayments: { type: Boolean, default: true },
      sendToDian: { type: Boolean, default: false },
    },
    options: { type: mongoose.Schema.Types.Mixed },
    lastTestedAt: { type: Date },
    lastSyncAt: { type: Date },
    lastError: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AccountingConnection', accountingConnectionSchema);
