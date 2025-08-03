const bcrypt = require("bcryptjs");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const OTP = require("../models/OTP");
const {
  generateOTP,
  storeOTP,
  validateOTP,
  markOTPAsUsed,
} = require("../utils/otpService");
const {
  sendOTPEmail,
  sendPasswordResetConfirmation,
} = require("../utils/emailService");

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || "your-secret-key", {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
};

// Register new user
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Basic validation
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email, password, and role",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    if (role !== "individual" && role !== "business") {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    // Create new user
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role,
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        },
        token,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error during registration",
    });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Find user and include password field
    const user = await User.findByEmail(email).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account is deactivated. Please contact support.",
      });
    }

    // Verify password
    const isPasswordCorrect = await user.comparePassword(password);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Update last login
    await user.updateLastLogin();

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          lastLogin: user.lastLogin,
          detectionsCount: user.detectionsCount,
        },
        token,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
};

// Get current user profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          lastLogin: user.lastLogin,
          detectionsCount: user.detectionsCount,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user profile",
    });
  }
};

// Update user profile
exports.updateProfile = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name: name.trim() },
      { new: true, runValidators: true },
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          updatedAt: user.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error("Profile update error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
};

// Change password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide current password and new password",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long",
      });
    }

    // Get user with password
    const user = await User.findById(req.user.id).select("+password");

    // Verify current password
    const isCurrentPasswordCorrect =
      await user.comparePassword(currentPassword);

    if (!isCurrentPasswordCorrect) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Password change error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to change password",
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Check if user exists (replace 'User' with your user model)
    const user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      // Generate and store OTP
      const otp = generateOTP();
      await storeOTP(email, otp);

      // Send email
      await sendOTPEmail(email, otp, user.name);
    }

    // Always return success (security best practice)
    res.json({ message: "If email exists, OTP has been sent" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const validation = await validateOTP(email, otp);

    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }

    // Mark OTP as used
    await markOTPAsUsed(validation.otpDoc._id);

    // Generate password reset token (you can use JWT or any other method)
    const resetToken = jwt.sign(
      { email: email.toLowerCase(), purpose: "password_reset" },
      process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );

    res.json({
      message: "OTP verified successfully",
      resetToken,
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    // Check rate limiting (optional: implement Redis-based rate limiting)
    const recentOTP = await OTP.findOne({
      email: email.toLowerCase(),
      createdAt: { $gt: new Date(Date.now() - 2 * 60 * 1000) }, // 2 minutes
    });

    if (recentOTP) {
      return res.status(429).json({
        error: "Please wait 2 minutes before requesting a new OTP",
      });
    }

    // Check if user exists
    const user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      const otp = generateOTP();
      await storeOTP(email, otp);
      await sendOTPEmail(email, otp, user.name);
    }

    res.json({ message: "New OTP sent if email exists" });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    // Validate input
    if (!resetToken || !newPassword) {
      return res.status(400).json({
        error: "Reset token and new password are required",
      });
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters long",
      });
    }

    // Verify reset token (JWT)
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);

      // Check if token purpose is for password reset
      if (decoded.purpose !== "password_reset") {
        return res.status(400).json({
          error: "Invalid reset token",
        });
      }
    } catch (jwtError) {
      return res.status(400).json({
        error: "Invalid or expired reset token",
      });
    }

    // Find user by email from token
    const user = await User.findOne({
      email: decoded.email.toLowerCase(),
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update user password
    await User.findByIdAndUpdate(user._id, {
      password: hashedPassword,
      // Optional: Add password change timestamp
      passwordChangedAt: new Date(),
    });

    // Invalidate all existing OTPs for this user (cleanup)
    await OTP.deleteMany({
      email: decoded.email.toLowerCase(),
    });

    // Optional: Invalidate all existing user sessions
    // If you're storing session tokens, you'd want to invalidate them here
    // This forces user to login again on all devices for security

    // Send confirmation email
    try {
      await sendPasswordResetConfirmation(decoded.email, user.name);
    } catch (emailError) {
      console.error("Failed to send confirmation email:", emailError);
      // Don't fail the password reset if email fails
    }

    // Log the password reset for security monitoring
    console.log(
      `Password reset successful for user: ${decoded.email} at ${new Date()}`,
    );

    res.json({
      message:
        "Password reset successfully. Please login with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      error: "Server error. Please try again.",
    });
  }
};
