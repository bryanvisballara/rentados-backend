const mongoose = require('mongoose');

const QUICK_ACTION_TYPES = ['wifi', 'location', 'order', 'whatsapp', 'custom'];

const quickActionSchema = new mongoose.Schema(
  {
    buildingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Building',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: QUICK_ACTION_TYPES,
      required: true,
    },
    label: { type: String, required: true, trim: true },
    icon: { type: String },
    payload: {
      ssid: String,
      password: String,
      url: String,
      phone: String,
      message: String,
    },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

quickActionSchema.index({ buildingId: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('QuickAction', quickActionSchema);
module.exports.QUICK_ACTION_TYPES = QUICK_ACTION_TYPES;
