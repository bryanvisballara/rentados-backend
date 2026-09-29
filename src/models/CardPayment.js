const mongoose = require('mongoose');

const cardPaymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    residentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resident',
      required: true,
    },
    methodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SavedPaymentMethod',
      required: true,
    },
    purpose: {
      type: String,
      enum: ['restaurant', 'administration'],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'COP' },
    status: {
      type: String,
      enum: ['awaiting_payment', 'paid', 'failed'],
      default: 'awaiting_payment',
      index: true,
    },
    externalRef: { type: String, trim: true },
    restaurantOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RestaurantOrder',
    },
    administrationPaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
    },
    payload: { type: mongoose.Schema.Types.Mixed },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CardPayment', cardPaymentSchema);
