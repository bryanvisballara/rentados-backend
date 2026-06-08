const mongoose = require('mongoose');

const priceBlockSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    durationMinutes: { type: Number, required: true, min: 15 },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const facilitySchema = new mongoose.Schema(
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
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String },
    icon: { type: String },
    capacity: { type: Number },
    price: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'COP' },
    pricingType: {
      type: String,
      enum: ['free', 'per_use', 'monthly', 'per_hour', 'per_block'],
      default: 'free',
    },
    blockWhenOverdue: { type: Boolean, default: true },
    requiresApproval: { type: Boolean, default: false },
    bookable: { type: Boolean, default: false },
    bookingPricing: {
      mode: {
        type: String,
        enum: ['free', 'hourly', 'blocks', 'flat'],
        default: 'free',
      },
      hourlyRate: { type: Number, min: 0, default: 0 },
      flatPrice: { type: Number, min: 0, default: 0 },
      blocks: [priceBlockSchema],
    },
    bookingRules: {
      slotMinutes: { type: Number, default: 60, min: 15 },
      minDurationMinutes: { type: Number, default: 60, min: 15 },
      maxDurationMinutes: { type: Number, default: 480, min: 15 },
      advanceBookingDays: { type: Number, default: 30, min: 1 },
      bufferMinutes: { type: Number, default: 0, min: 0 },
    },
    open24Hours: { type: Boolean, default: false },
    openHours: {
      start: { type: String, default: '06:00' },
      end: { type: String, default: '22:00' },
    },
    seasonOpenDate: { type: Date },
    seasonCloseDate: { type: Date },
    status: {
      type: String,
      enum: ['open', 'closed', 'maintenance'],
      default: 'open',
      index: true,
    },
    maintenanceClosures: [
      {
        startAt: { type: Date, required: true },
        endAt: { type: Date, required: true },
        reason: { type: String, trim: true },
        isActive: { type: Boolean, default: true },
      },
    ],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

facilitySchema.pre('validate', function normalizeStatus(next) {
  if (this.status === 'maintainance') this.status = 'maintenance';
  next();
});

facilitySchema.index({ buildingId: 1, slug: 1 }, { unique: true });

module.exports = mongoose.model('Facility', facilitySchema);
