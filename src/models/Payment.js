const mongoose = require('mongoose');

const PAYMENT_STATUSES = ['paid', 'pending', 'overdue', 'partial'];

const paymentSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
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
    },
    concept: {
      type: String,
      enum: ['administration', 'utilities', 'parking', 'fine', 'service', 'other'],
      default: 'administration',
    },
    facilityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Facility',
      index: true,
    },
    conceptLabel: { type: String, trim: true },
    period: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    interestAmount: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'COP' },
    dueDate: { type: Date, required: true },
    paidAt: { type: Date },
    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: 'pending',
      index: true,
    },
    notes: { type: String },
  },
  { timestamps: true }
);

paymentSchema.index({ organizationId: 1, period: 1, unitId: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
