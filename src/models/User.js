const mongoose = require('mongoose');

const ROLES = [
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'ORG_STAFF',
  'RESIDENT',
  'PROVIDER',
];

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    role: { type: String, enum: ROLES, required: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
    isActive: { type: Boolean, default: true },
    avatarUrl: { type: String },
  },
  { timestamps: true }
);

userSchema.index({ role: 1, organizationId: 1 });

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
