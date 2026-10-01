const mongoose = require('mongoose');

const pushDeviceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    platform: { type: String, enum: ['ios', 'android', 'web'], required: true },
    token: { type: String, required: true, trim: true },
    subscription: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

pushDeviceSchema.index({ platform: 1, token: 1 }, { unique: true });

module.exports = mongoose.model('PushDevice', pushDeviceSchema);
