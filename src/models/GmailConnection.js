const mongoose = require('mongoose');

const gmailConnectionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    residentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resident',
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      index: true,
    },
    googleEmail: { type: String, trim: true, lowercase: true },
    refreshTokenEnc: { type: String, required: true },
    accessTokenEnc: { type: String },
    accessTokenExpiresAt: { type: Date },
    scope: { type: String },
    isActive: { type: Boolean, default: true },
    lastSyncAt: { type: Date },
    lastSyncStatus: {
      type: String,
      enum: ['ok', 'error', 'partial', 'never'],
      default: 'never',
    },
    lastSyncError: { type: String },
    lastSyncSummary: {
      scanned: { type: Number, default: 0 },
      created: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
    },
    processedMessageIds: [{ type: String }],
    historyId: { type: String },
    watchExpiration: { type: Date },
    watchTopic: { type: String },
    pushEnabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('GmailConnection', gmailConnectionSchema);
