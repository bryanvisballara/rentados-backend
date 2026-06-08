const mongoose = require('mongoose');

const BOOKING_STATUSES = ['pending', 'confirmed', 'cancelled'];

const facilityBookingSchema = new mongoose.Schema(
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
    facilityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Facility',
      required: true,
      index: true,
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
    },
    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true },
    durationMinutes: { type: Number, min: 1 },
    status: {
      type: String,
      enum: BOOKING_STATUSES,
      default: 'pending',
      index: true,
    },
    totalPrice: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'COP' },
    pricingMode: { type: String },
    pricingLabel: { type: String },
    notes: { type: String },
    cancelledAt: { type: Date },
    cancelReason: { type: String },
  },
  { timestamps: true }
);

facilityBookingSchema.index({ facilityId: 1, startAt: 1, endAt: 1, status: 1 });

module.exports = mongoose.model('FacilityBooking', facilityBookingSchema);
module.exports.BOOKING_STATUSES = BOOKING_STATUSES;
