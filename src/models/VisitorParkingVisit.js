const mongoose = require('mongoose');

const visitorParkingVisitSchema = new mongoose.Schema(
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
    spotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VisitorParking',
      required: true,
    },
    residentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resident',
      required: true,
    },
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
      required: true,
      index: true,
    },
    tower: { type: String, trim: true },
    licensePlate: { type: String, required: true, trim: true, uppercase: true },
    visitorName: { type: String, trim: true },
    registeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    exitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['active', 'exited'],
      default: 'active',
      index: true,
    },
    entryAt: { type: Date, default: Date.now },
    exitAt: { type: Date },
  },
  { timestamps: true }
);

visitorParkingVisitSchema.index({ buildingId: 1, licensePlate: 1, status: 1 });
visitorParkingVisitSchema.index({ buildingId: 1, status: 1, entryAt: -1 });

module.exports = mongoose.model('VisitorParkingVisit', visitorParkingVisitSchema);
