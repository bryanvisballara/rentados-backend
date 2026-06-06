const mongoose = require('mongoose');

const residentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
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
    relationship: {
      type: String,
      enum: ['owner', 'tenant', 'family'],
      default: 'owner',
    },
    moveInDate: { type: Date },
    isPrimary: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Resident', residentSchema);
