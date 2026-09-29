const mongoose = require('mongoose');

const memberMediaSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['image', 'video'], required: true },
    url: { type: String, required: true, trim: true },
    cloudinaryPublicId: { type: String, trim: true },
    thumbnailUrl: { type: String, trim: true },
  },
  { _id: true }
);

const platformHomeServiceMemberSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PlatformHomeService',
      required: true,
      index: true,
    },
    memberType: {
      type: String,
      enum: ['person', 'company'],
      default: 'person',
    },
    name: { type: String, required: true, trim: true },
    tagline: { type: String, trim: true, default: '' },
    resume: { type: String, trim: true, default: '' },
    media: [memberMediaSchema],
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlatformHomeServiceMember', platformHomeServiceMemberSchema);
