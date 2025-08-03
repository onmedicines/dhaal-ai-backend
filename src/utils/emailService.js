const nodemailer = require("nodemailer");

// Create reusable transporter object using SMTP transport
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false, // For development only
    },
  });
};

// HTML email template for OTP
const getOTPEmailTemplate = (otp, userName) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset OTP</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .container {
          background-color: #f9f9f9;
          padding: 30px;
          border-radius: 10px;
          border: 1px solid #ddd;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .otp-code {
          font-size: 32px;
          font-weight: bold;
          color: #2563eb;
          background-color: #f0f9ff;
          padding: 20px;
          text-align: center;
          border-radius: 8px;
          border: 2px dashed #2563eb;
          margin: 20px 0;
          letter-spacing: 5px;
        }
        .warning {
          background-color: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 6px;
          padding: 15px;
          margin: 20px 0;
        }
        .footer {
          margin-top: 30px;
          font-size: 14px;
          color: #666;
          text-align: center;
        }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background-color: #2563eb;
          color: white;
          text-decoration: none;
          border-radius: 6px;
          margin: 10px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>

        <p>Hello ${userName},</p>

        <p>We received a request to reset your password. Use the following One-Time Password (OTP) to complete the process:</p>

        <div class="otp-code">${otp}</div>

        <p><strong>This OTP will expire in ${process.env.OTP_EXPIRY_MINUTES || 10} minutes.</strong></p>

        <div class="warning">
          <strong>⚠️ Security Notice:</strong>
          <ul>
            <li>Never share this OTP with anyone</li>
            <li>Our team will never ask for your OTP</li>
            <li>If you didn't request this, please ignore this email</li>
          </ul>
        </div>

        <p>If you're having trouble, please contact our support team.</p>

        <div class="footer">
          <p>This is an automated message, please do not reply to this email.</p>
          <p>&copy; ${new Date().getFullYear()} Your App Name. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Plain text version for email clients that don't support HTML
const getOTPEmailText = (otp, userName) => {
  return `
    Hello ${userName},

    We received a request to reset your password. Use the following One-Time Password (OTP) to complete the process:

    OTP: ${otp}

    This OTP will expire in ${process.env.OTP_EXPIRY_MINUTES || 10} minutes.

    SECURITY NOTICE:
    - Never share this OTP with anyone
    - Our team will never ask for your OTP
    - If you didn't request this, please ignore this email

    If you're having trouble, please contact our support team.

    This is an automated message, please do not reply to this email.

    © ${new Date().getFullYear()} Your App Name. All rights reserved.
  `;
};

// Main function to send OTP email
const sendOTPEmail = async (email, otp, userName = "User") => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"${process.env.APP_NAME || "Your App"}" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: `Your Password Reset OTP - ${otp}`,
      text: getOTPEmailText(otp, userName),
      html: getOTPEmailTemplate(otp, userName),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("OTP email sent successfully:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending OTP email:", error);
    throw new Error("Failed to send OTP email");
  }
};

// Function to send password reset confirmation email
const sendPasswordResetConfirmation = async (email, userName = "User") => {
  try {
    const transporter = createTransporter();

    const confirmationTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Password Reset Successful</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
          .container { background-color: #f0fdf4; padding: 30px; border-radius: 10px; border: 1px solid #16a34a; }
          .success-icon { color: #16a34a; font-size: 48px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">✅</div>
          <h1 style="color: #16a34a; text-align: center;">Password Reset Successful</h1>
          <p>Hello ${userName},</p>
          <p>Your password has been successfully reset on ${new Date().toLocaleString()}.</p>
          <p>If you didn't make this change, please contact our support team immediately.</p>
          <p>For security reasons, you may need to log in again on all your devices.</p>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"${process.env.APP_NAME || "Your App"}" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: "Password Reset Successful",
      html: confirmationTemplate,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Confirmation email sent successfully:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending confirmation email:", error);
    // Don't throw error for confirmation email failure
    return { success: false, error: error.message };
  }
};

// Test email configuration
const testEmailConnection = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log("Email service is ready to send emails");
    return true;
  } catch (error) {
    console.error("Email service configuration error:", error);
    return false;
  }
};

module.exports = {
  sendOTPEmail,
  sendPasswordResetConfirmation,
  testEmailConnection,
};
