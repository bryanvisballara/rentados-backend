const mongoose = require('mongoose');

const visitorParkingSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    buildingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Building',
      required: true,
      index: true,
    },
    spotNumber: { type: String, required: true, trim: true },
    zone: { type: String, trim: true, default: 'Visitantes' },
    label: { type: String, trim: true },
    isOccupied: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

visitorParkingSchema.index({ buildingId: 1, spotNumber: 1 }, { unique: true });

module.exports = mongoose.model('VisitorParking', visitorParkingSchema);
