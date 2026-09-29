const mongoose = require('mongoose');

const platformSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    sections: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlatformSetting', platformSettingSchema);
