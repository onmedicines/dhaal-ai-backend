const mongoose = require("mongoose");

const OTPSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    otpCode: {
      type: String,
      required: true,
      length: 6,
    },
    used: {
      type: Boolean,
      default: false,
    },
    attempts: {
      type: Number,
      default: 0,
      max: 3,
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0, // MongoDB TTL - automatically removes expired documents
    },
  },
  { timestamps: true }, // This gives you createdAt and updatedAt
);

// Compound index for efficient queries
OTPSchema.index({ email: 1, otpCode: 1 });
OTPSchema.index({ expiresAt: 1 }); // For TTL functionality

module.exports = mongoose.model("OTP", OTPSchema);
