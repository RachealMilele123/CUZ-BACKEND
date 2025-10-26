const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const Account = require("../models/Account");
const Transaction = require("../models/Transaction");
// User/Admin login
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
    // Require approval for all users except admin
    if (!user.approved && user.type !== "admin") {
      return res.status(403).json({
        error: "Your account needs to be approved first by the admin.",
      });
    }
    // Generate JWT token
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
// Register user
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
      businessName,
      registrationNumber,
    } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
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
      businessName,
      registrationNumber,
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
      message: "Registration successful. Await admin approval.",
      user: userObj,
      account: {
        accountNumber: account.accountNumber,
        type: account.type,
        balance: account.balance,
        createdAt: account.createdAt,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Admin approves user
exports.approveUser = async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    user.approved = true;
    await user.save();
    res.json({ message: "User approved." });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Helper: Generate account number with prefix
function generateAccountNumber(type) {
  const prefixMap = {
    business: "BUS",
    student: "STU",
    savings: "SAV",
    person: "PER",
    school: "SCH",
  };
  const prefix = prefixMap[type] || "GEN";
  const uniquePart =
    Date.now().toString().slice(-6) +
    Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
  return `${prefix}-${uniquePart}`;
}

// Admin deposit
exports.deposit = async (req, res) => {
  try {
    const { accountNumber, amount, description } = req.body;
    const account = await Account.findOne({ accountNumber });
    if (!account) return res.status(404).json({ error: "Account not found" });
    account.balance += amount;
    await account.save();
    const transaction = new Transaction({
      to: account._id,
      amount,
      type: "deposit",
      description,
    });
    await transaction.save();
    res.json({
      message: "Deposit successful.",
      transaction: {
        to: transaction.to,
        amount: transaction.amount,
        type: transaction.type,
        description: transaction.description,
        createdAt: transaction.createdAt,
      },
      account: {
        accountNumber: account.accountNumber,
        balance: account.balance,
        type: account.type,
        updatedAt: account.updatedAt || account.createdAt,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Transfer money
exports.transfer = async (req, res) => {
  try {
    const {
      fromAccountNumber,
      toAccountNumber,
      amount,
      description,
    } = req.body;
    const fromAccount = await Account.findOne({
      accountNumber: fromAccountNumber,
    });

    const toAccount = await Account.findOne({ accountNumber: toAccountNumber });
    if (!fromAccount || !toAccount)
      return res.status(404).json({ error: "Account not found" });
    if (fromAccount.balance < amount)
      return res.status(400).json({ error: "Insufficient funds" });
    fromAccount.balance -= amount;
    toAccount.balance += amount;
    await fromAccount.save();
    await toAccount.save();
    const transaction = new Transaction({
      from: fromAccount._id,
      to: toAccount._id,
      amount,
      type: "transfer",
      description,
    });
    await transaction.save();
    console.log(
      "fromAccount:",
      fromAccount,
      "toAccount:",
      toAccount,
      "amount:",
      amount
    );
    res.json({ message: "Transfer successful." });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Get transaction history
exports.transactions = async (req, res) => {
  try {
    const { accountNumber } = req.params;
    const account = await Account.findOne({ accountNumber });
    if (!account) return res.status(404).json({ error: "Account not found" });
    const transactions = await Transaction.find({
      $or: [{ from: account._id }, { to: account._id }],
    }).sort({ createdAt: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
