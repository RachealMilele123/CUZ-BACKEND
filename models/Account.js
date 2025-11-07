const mongoose = require("mongoose");

const accountSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  accountNumber: { type: String, required: true, unique: true },
  type: {
    type: String,
    enum: ["student", "business", "savings", "person", "school", "admin"],
    required: true,
  },
  balance: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Account", accountSchema);
