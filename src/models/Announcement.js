const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
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
      index: true,
    },
    title: { type: String, required: true, trim: true },
    body: { type: String },
    imageUrl: { type: String },
    type: {
      type: String,
      enum: ['announcement', 'event', 'promotion', 'experience'],
      default: 'announcement',
    },
    location: { type: String },
    eventAt: { type: Date },
    price: { type: Number },
    currency: { type: String, default: 'COP' },
    isFeatured: { type: Boolean, default: false, index: true },
    publishedAt: { type: Date, default: Date.now, index: true },
    expiresAt: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Announcement', announcementSchema);
