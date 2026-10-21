const mongoose = require('mongoose');

const emailVerificationSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    codeHash: { type: String, required: true },
    tokenHash: { type: String, default: '' },
    expiresAt: { type: Date, required: true },
    verifiedAt: { type: Date, default: null },
    lastSentAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

emailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('EmailVerification', emailVerificationSchema);
