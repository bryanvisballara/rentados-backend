const mongoose = require('mongoose');

const platformHomeServiceSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    imageUrl: { type: String, trim: true, default: '' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlatformHomeService', platformHomeServiceSchema);
