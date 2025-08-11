const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    address: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^0x[a-fA-F0-9]{40}$/, // Basic eth address validation
    },
    name: {
      type: String,
      default: '',
      trim: true,
    },
    email: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
    },
    role: {
      type: String,
      enum: ['buyer', 'seller', 'admin'],
      default: 'buyer',
    },
    nonce: {
      type: Number,
      default: () => Math.floor(Math.random() * 1000000), // For login message challenge
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
