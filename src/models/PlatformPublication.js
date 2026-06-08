const mongoose = require('mongoose');

const platformPublicationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    media: [
      {
        type: { type: String, enum: ['image', 'video'], default: 'image' },
        url: String,
        cloudinaryPublicId: String,
      },
    ],
    targetCountries: [{ type: String, trim: true }],
    targetCities: [{ type: String, trim: true }],
    isPinned: { type: Boolean, default: false },
    publishedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
    isActive: { type: Boolean, default: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlatformPublication', platformPublicationSchema);
