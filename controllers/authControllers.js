const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../models/User");

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
      return res
        .status(403)
        .json({
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
