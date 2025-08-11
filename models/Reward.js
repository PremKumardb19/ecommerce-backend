const mongoose = require('mongoose');

const RewardSchema = new mongoose.Schema(
  {
    address: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    balanceWei: { // store balance in wei string to avoid JS precision loss
      type: String,
      required: true,
      default: '0',
    },
    totalMinted: { // Optional: track total minted to this address
      type: String,
      default: '0',
    },
    totalBurned: { // Optional: track total burned from this address
      type: String,
      default: '0',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Reward', RewardSchema);
