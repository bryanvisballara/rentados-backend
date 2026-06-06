const mongoose = require('mongoose');

const emergencyContactSchema = new mongoose.Schema(
  {
    buildingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Building',
      required: true,
      index: true,
    },
    label: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['security', 'admin', 'emergency', 'maintenance'],
      default: 'admin',
    },
    phone: { type: String, required: true },
    available24h: { type: Boolean, default: false },
    priority: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EmergencyContact', emergencyContactSchema);
