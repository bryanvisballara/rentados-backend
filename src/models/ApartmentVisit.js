const mongoose = require('mongoose');

const apartmentVisitSchema = new mongoose.Schema(
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
    visitorName: { type: String, required: true, trim: true },
    documentId: { type: String, required: true, trim: true },
    notes: { type: String, trim: true },
    status: {
      type: String,
      enum: ['active', 'exited'],
      default: 'active',
      index: true,
    },
    entryAt: { type: Date, default: Date.now },
    exitAt: { type: Date },
    registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    exitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

apartmentVisitSchema.index({ buildingId: 1, status: 1, entryAt: -1 });
apartmentVisitSchema.index({ buildingId: 1, documentId: 1, status: 1 });

module.exports = mongoose.model('ApartmentVisit', apartmentVisitSchema);
