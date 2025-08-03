const OTP = require("../models/OTP");
const crypto = require("crypto");

const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

const storeOTP = async (email, otp) => {
  const expiryTime = new Date(
    Date.now() + process.env.OTP_EXPIRY_MINUTES * 60 * 1000,
  );

  // Remove any existing unused OTPs for this email
  await OTP.deleteMany({ email: email.toLowerCase(), used: false });

  const otpDoc = new OTP({
    email: email.toLowerCase(),
    otpCode: otp,
    expiresAt: expiryTime,
  });

  return await otpDoc.save();
};

const validateOTP = async (email, otp) => {
  const otpDoc = await OTP.findOne({
    email: email.toLowerCase(),
    otpCode: otp,
    used: false,
    expiresAt: { $gt: new Date() },
  });

  if (!otpDoc) {
    return { valid: false, message: "Invalid or expired OTP" };
  }

  if (otpDoc.attempts >= 3) {
    return { valid: false, message: "Maximum attempts exceeded" };
  }

  // Increment attempts
  otpDoc.attempts += 1;
  await otpDoc.save();

  return { valid: true, otpDoc };
};

const markOTPAsUsed = async (otpId) => {
  return await OTP.findByIdAndUpdate(otpId, { used: true });
};

module.exports = {
  generateOTP,
  storeOTP,
  validateOTP,
  markOTPAsUsed,
};
