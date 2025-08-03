const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const auth = require("../middlewares/auth");
const {
  validateForgotPassword,
  validateOTP,
} = require("../middlewares/validation.cjs");

// Public routes (no authentication required)
router.post("/register", authController.register);
router.post("/login", authController.login);

// Protected routes (authentication required)
router.get("/profile", auth, authController.getProfile);
router.put("/profile", auth, authController.updateProfile);
router.put("/change-password", auth, authController.changePassword);

// Forgot password routes
router.post(
  "/forgot-password",
  validateForgotPassword,
  authController.forgotPassword,
);
router.post("/verify-otp", validateOTP, authController.verifyOTP);
router.post("/reset-password", authController.resetPassword);
router.post("/resend-otp", validateForgotPassword, authController.resendOTP);

module.exports = router;
