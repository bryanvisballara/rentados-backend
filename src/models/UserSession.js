const mongoose = require('mongoose');

const userSessionSchema = new mongoose.Schema(
  {
    jti: { type: String, required: true, unique: true, index: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      index: true,
    },
    buildingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Building',
      default: null,
      index: true,
    },
    role: { type: String, required: true, index: true },
    staffType: { type: String, default: null },
    portal: { type: String, trim: true },
    userAgent: { type: String, trim: true },
    ipAddress: { type: String, trim: true },
    lastSeenAt: { type: Date, required: true, index: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

userSessionSchema.index({ buildingId: 1, lastSeenAt: -1 });
userSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('UserSession', userSessionSchema);
