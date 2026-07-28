const mongoose = require('mongoose');

const residentVisitorRequestSchema = new mongoose.Schema(
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
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
      required: true,
      index: true,
    },
    residentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resident',
      required: true,
    },
    visitorName: { type: String, trim: true },
    licensePlate: { type: String, required: true, trim: true, uppercase: true },
    expectedAt: { type: Date },
    notes: { type: String, trim: true },
    status: {
      type: String,
      enum: ['pending', 'acknowledged', 'cancelled'],
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ResidentVisitorRequest', residentVisitorRequestSchema);
