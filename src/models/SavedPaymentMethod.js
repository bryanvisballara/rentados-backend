const mongoose = require('mongoose');

const savedPaymentMethodSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    token: { type: String, required: true, unique: true },
    brand: { type: String, trim: true, default: 'card' },
    last4: { type: String, required: true, trim: true },
    expMonth: { type: Number, required: true, min: 1, max: 12 },
    expYear: { type: Number, required: true },
    holderName: { type: String, required: true, trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SavedPaymentMethod', savedPaymentMethodSchema);
