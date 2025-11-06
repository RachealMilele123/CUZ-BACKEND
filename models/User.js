const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  address: { type: String },
  dob: { type: Date },
  type: {
    type: String,
    enum: ["student", "business", "savings", "person", "school"],
    required: true,
  },
  // Student-specific fields
  studentId: { type: String },
  course: { type: String },
  schoolName: { type: String },
  yearOfStudy: { type: String },
  expectedCompletion: { type: String },
  // Business-specific fields
  businessName: { type: String },
  registrationNumber: { type: String },
  // Identity and compliance fields
  nationalId: { type: String },
  tpinNumber: { type: String },
  termsOfService: { type: Boolean, default: false },
  // Approval and timestamps
  approved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  // Password reset fields
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
});

module.exports = mongoose.model("User", userSchema);
