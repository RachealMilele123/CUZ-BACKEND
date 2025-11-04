const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const User = require("../models/User");
const { sendEmail } = require("../utils/email");

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required." });
    }
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });
    if (!user.approved && user.type !== "admin") {
      return res.status(403).json({
        error: "Your account needs to be approved first by the admin.",
      });
    }
    if (!process.env.JWT_SECRET) {
      return res
        .status(500)
        .json({ error: "JWT secret not set in environment." });
    }
    const token = jwt.sign(
      { userId: user._id, type: user.type, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );
    const userObj = user.toObject();
    delete userObj.password;
    res.json({
      message: "Login successful",
      token,
      user: userObj,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Forgot Password Function
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found with this email." });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString("hex");

    // Hash token and set to resetPasswordToken field
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Set token and expiration (10 minutes)
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;

    await user.save();

    // Create reset URL
    const resetUrl = `${req.protocol}://${req.get(
      "host"
    )}/cuz/auth/reset-password/${resetToken}`;

    // Email message
    const message = `
      <h2>Password Reset Request</h2>
      <p>You are receiving this email because you (or someone else) has requested a password reset for your account.</p>
      <p>Please click on the following link to reset your password:</p>
      <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
      <p>If you did not request this password reset, please ignore this email and your password will remain unchanged.</p>
      <p>This link will expire in 10 minutes.</p>
      <br>
      <p>Best regards,</p>
      <p>CUZ Banking Team</p>
    `;

    try {
      await sendEmail({
        to: user.email,
        subject: "Password Reset Request - CUZ Banking",
        html: message,
      });

      res.status(200).json({
        message: "Password reset email sent successfully",
        emailSent: true,
        data: {
          email: user.email,
          resetToken: resetToken,
          resetUrl: resetUrl,
          expiresAt: new Date(user.resetPasswordExpires),
        },
      });
    } catch (emailError) {
      console.error("Email sending failed:", emailError);

      // Clear the reset token if email fails
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      res.status(500).json({
        error: "Email could not be sent. Please try again later.",
        emailSent: false,
      });
    }
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Server error. Please try again later." });
  }
};

// Reset Password Function
exports.resetPassword = async (req, res) => {
  try {
    let { token } = req.params;
    const { password, confirmPassword } = req.body;

    // Clean the token - remove any extra quotes or whitespace
    token = token.replace(/['"]/g, "").trim();

    // Debug logging
    console.log("Reset password request:");
    console.log("Raw token from params:", req.params.token);
    console.log("Cleaned token:", token);
    console.log("Request body:", req.body);
    console.log("Password provided:", !!password);
    console.log("Confirm password provided:", !!confirmPassword);

    // First, check if token exists in params
    if (!token) {
      return res.status(400).json({
        error: "Reset token is required in URL.",
      });
    }

    // Then check if password fields are provided
    if (!password || !confirmPassword) {
      return res.status(400).json({
        error: "Password and confirm password are required.",
        debug: {
          receivedFields: Object.keys(req.body),
          passwordProvided: !!password,
          confirmPasswordProvided: !!confirmPassword,
        },
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        error: "Passwords do not match.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters long.",
      });
    }

    // Hash the token from URL to match with database
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    console.log("Token validation:");
    console.log("Original token:", token);
    console.log("Hashed token:", hashedToken);
    console.log("Current time:", Date.now());
    console.log("Current time readable:", new Date(Date.now()));

    // Find user with matching token and check if token has not expired
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    console.log("User found:", !!user);
    if (user) {
      console.log("User reset token:", user.resetPasswordToken);
      console.log("Token expires at:", user.resetPasswordExpires);
      console.log(
        "Token expires readable:",
        new Date(user.resetPasswordExpires)
      );
      console.log("Token still valid:", user.resetPasswordExpires > Date.now());
    }

    if (!user) {
      return res.status(400).json({
        error: "Password reset token is invalid or has expired.",
        debug: {
          providedToken: token,
          hashedToken: hashedToken,
          currentTime: new Date(Date.now()),
        },
      });
    }

    // Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Update user password and clear reset token fields
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.status(200).json({
      message:
        "Password reset successful. You can now login with your new password.",
      success: true,
    });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Server error. Please try again later." });
  }
};
