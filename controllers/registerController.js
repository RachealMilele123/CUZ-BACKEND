const bcrypt = require("bcrypt");
const User = require("../models/User");
const Account = require("../models/Account");

// Helper: Generate account number with prefix
function generateAccountNumber(type) {
  const prefixMap = {
    business: "BUS",
    student: "STU",
    savings: "SAV",
    person: "PER",
    school: "SCH",
    admin: "ADM",
  };
  const prefix = prefixMap[type] || "GEN";
  const uniquePart =
    Date.now().toString().slice(-6) +
    Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
  return `${prefix}-${uniquePart}`;
}

exports.register = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      address,
      dob,
      type,
      studentId,
      course,
      schoolName,
      yearOfStudy,
      expectedCompletion,
      businessName,
      registrationNumber,
      nationalId,
      tpinNumber,
      termsOfService,
    } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Auto-approve admin users
    const isAutoApproved = type === "admin";
    
    const user = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      address,
      dob,
      type,
      studentId,
      course,
      schoolName,
      yearOfStudy,
      expectedCompletion,
      businessName,
      registrationNumber,
      nationalId,
      tpinNumber,
      termsOfService,
      approved: isAutoApproved, // Auto-approve admin users
    });
    await user.save();
    // Create account with generated account number
    const accountNumber = generateAccountNumber(type);
    const account = new Account({ user: user._id, accountNumber, type });
    await account.save();
    // Prepare user data to return (exclude password)
    const userObj = user.toObject();
    delete userObj.password;
    res.status(201).json({
      message: isAutoApproved 
        ? "Admin registration successful. Account automatically approved." 
        : "Registration successful. Await admin approval.",
      user: userObj,
      account: {
        accountNumber: account.accountNumber,
        type: account.type,
        balance: account.balance,
        createdAt: account.createdAt,
      },
    });
  } catch (err) {
    if (err.code === 11000 && err.keyPattern && err.keyPattern.email) {
      return res.status(409).json({
        error: "Email already exists. Please use a different email address.",
      });
    }
    res.status(400).json({ error: err.message });
  }
};
