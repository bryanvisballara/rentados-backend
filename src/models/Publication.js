const mongoose = require('mongoose');

const publicationSchema = new mongoose.Schema(
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
    media: [
      {
        type: { type: String, enum: ['image', 'video'], required: true },
        url: { type: String, required: true },
        cloudinaryPublicId: { type: String },
        thumbnailUrl: { type: String },
      },
    ],
    isPinned: { type: Boolean, default: false },
    publishedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Publication', publicationSchema);
