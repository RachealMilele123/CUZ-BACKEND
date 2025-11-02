const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const Account = require("../models/Account");
const Transaction = require("../models/Transaction");
const { sendEmail } = require("../utils/email");
// ...existing code...

// Admin approves user
exports.approveUser = async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    user.approved = true;
    await user.save();

    // Send approval email
    let emailSent = false;
    try {
      await sendEmail({
        to: user.email,
        subject: "Your Account Has Been Approved",
        text: `Hello ${user.name},\n\nYour account has been approved by the admin. You can now log in and use your account.`,
        html: `<p>Hello ${user.name},</p><p>Your account has been <b>approved</b> by the admin. You can now log in and use your account.</p>`,
      });
      emailSent = true;
    } catch (emailErr) {
      // Log but don't block approval if email fails
      console.error("Failed to send approval email:", emailErr);
    }

    res.json({ message: "User approved.", emailSent });
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
    res.json({
      message: "Transfer successful.",
      transfer: {
        amount: amount,
        description: description || "Money transfer",
        timestamp: new Date(),
      },
      fromAccount: {
        accountNumber: fromAccount.accountNumber,
        remainingBalance: fromAccount.balance,
        accountType: fromAccount.type,
      },
      toAccount: {
        accountNumber: toAccount.accountNumber,
        newBalance: toAccount.balance,
        accountType: toAccount.type,
      },
      transaction: {
        transactionId: transaction._id,
        from: fromAccount.accountNumber,
        to: toAccount.accountNumber,
        amount: transaction.amount,
        type: transaction.type,
        description: transaction.description,
        createdAt: transaction.createdAt,
      },
    });
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
