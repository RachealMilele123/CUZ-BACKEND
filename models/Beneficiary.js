const mongoose = require("mongoose");

const beneficiarySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  beneficiaryAccountNumber: { type: String, required: true },
  beneficiaryAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Account",
    required: true,
  },
  nickname: { type: String, required: true }, // User-defined name for easy identification
  description: { type: String }, // Optional description
  createdAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
});

// Ensure a user can't add the same beneficiary twice
beneficiarySchema.index(
  { userId: 1, beneficiaryAccountNumber: 1 },
  { unique: true }
);

module.exports = mongoose.model("Beneficiary", beneficiarySchema);
