const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const Account = require("../models/Account");
const Transaction = require("../models/Transaction");
const Beneficiary = require("../models/Beneficiary");
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
    }).populate("user", "name email");

    const toAccount = await Account.findOne({
      accountNumber: toAccountNumber,
    }).populate("user", "name email");
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
        accountHolderName: fromAccount.user?.name || "Unknown",
        accountHolderEmail: fromAccount.user?.email || "Unknown",
      },
      toAccount: {
        accountNumber: toAccount.accountNumber,
        newBalance: toAccount.balance,
        accountType: toAccount.type,
        accountHolderName: toAccount.user?.name || "Unknown",
        accountHolderEmail: toAccount.user?.email || "Unknown",
      },
      transaction: {
        transactionId: transaction._id,
        from: {
          accountNumber: fromAccount.accountNumber,
          accountHolderName: fromAccount.user?.name || "Unknown",
        },
        to: {
          accountNumber: toAccount.accountNumber,
          accountHolderName: toAccount.user?.name || "Unknown",
        },
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
    const account = await Account.findOne({ accountNumber }).populate(
      "user",
      "name email"
    );
    if (!account) return res.status(404).json({ error: "Account not found" });

    const transactions = await Transaction.find({
      $or: [{ from: account._id }, { to: account._id }],
    })
      .populate("from", "accountNumber type user")
      .populate("to", "accountNumber type user")
      .sort({ createdAt: -1 });

    // Populate user details for from and to accounts
    await Transaction.populate(transactions, [
      { path: "from.user", select: "name email" },
      { path: "to.user", select: "name email" },
    ]);

    // Format the transactions for better readability
    const formattedTransactions = transactions.map((transaction) => {
      const isIncoming =
        transaction.to &&
        transaction.to._id.toString() === account._id.toString();
      const isOutgoing =
        transaction.from &&
        transaction.from._id.toString() === account._id.toString();

      // Format date and time for better readability
      const transactionDate = new Date(transaction.createdAt);
      const formattedDate = transactionDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const formattedTime = transactionDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });

      let transferSummary = null;
      if (isOutgoing && transaction.type === "transfer") {
        transferSummary = `Transferred k${transaction.amount} to ${
          transaction.to?.user?.name || "Unknown"
        } (${transaction.to?.accountNumber || "Unknown"})`;
      } else if (isIncoming && transaction.type === "transfer") {
        transferSummary = `Received k${transaction.amount} from ${
          transaction.from?.user?.name || "Unknown"
        } (${transaction.from?.accountNumber || "Unknown"})`;
      } else if (transaction.type === "deposit") {
        transferSummary = `Deposit of k${transaction.amount} to your account`;
      }

      return {
        transactionId: transaction._id,
        type: transaction.type,
        amount: transaction.amount,
        description: transaction.description,
        date: transaction.createdAt,
        formattedDate: formattedDate,
        formattedTime: formattedTime,
        dateTimeString: `${formattedDate} at ${formattedTime}`,
        direction: isIncoming
          ? "incoming"
          : isOutgoing
          ? "outgoing"
          : "unknown",
        transferSummary: transferSummary,
        from: transaction.from
          ? {
              accountNumber: transaction.from.accountNumber,
              accountType: transaction.from.type,
              accountHolderName: transaction.from.user?.name || "Unknown",
              accountHolderEmail: transaction.from.user?.email || "Unknown",
            }
          : null,
        to: transaction.to
          ? {
              accountNumber: transaction.to.accountNumber,
              accountType: transaction.to.type,
              accountHolderName: transaction.to.user?.name || "Unknown",
              accountHolderEmail: transaction.to.user?.email || "Unknown",
            }
          : null,
        status: "completed",
      };
    });

    // Separate outgoing transfers for easier viewing
    const outgoingTransfers = formattedTransactions.filter(
      (t) => t.direction === "outgoing" && t.type === "transfer"
    );

    const incomingTransactions = formattedTransactions.filter(
      (t) => t.direction === "incoming"
    );

    const allOtherTransactions = formattedTransactions.filter(
      (t) =>
        !(t.direction === "outgoing" && t.type === "transfer") &&
        t.direction !== "incoming"
    );

    res.json({
      message: "Transaction history retrieved successfully",
      account: {
        accountNumber: account.accountNumber,
        accountType: account.type,
        accountHolderName: account.user?.name || "Unknown",
        accountHolderEmail: account.user?.email || "Unknown",
        currentBalance: account.balance,
      },
      summary: {
        totalTransactions: formattedTransactions.length,
        outgoingTransfers: outgoingTransfers.length,
        incomingTransactions: incomingTransactions.length,
        totalAmountSent: outgoingTransfers.reduce(
          (sum, t) => sum + t.amount,
          0
        ),
        totalAmountReceived: incomingTransactions.reduce(
          (sum, t) => sum + t.amount,
          0
        ),
      },
      outgoingTransfers: outgoingTransfers,
      incomingTransactions: incomingTransactions,
      allTransactions: formattedTransactions,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Get user balance (requires authentication)
exports.getUserBalance = async (req, res) => {
  try {
    // Extract user info from JWT token
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Access token required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Find user and their account
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.approved && user.type !== "admin") {
      return res.status(403).json({
        error: "Account not approved. Please wait for admin approval.",
      });
    }

    // Find user's account
    const account = await Account.findOne({ user: userId }).populate(
      "user",
      "name email"
    );
    if (!account) {
      return res.status(404).json({
        error: "No account found for this user",
        message: "Please contact admin to create your account",
      });
    }

    // Get recent transactions count for additional info
    const recentTransactionsCount = await Transaction.countDocuments({
      $or: [{ from: account._id }, { to: account._id }],
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
    });

    res.json({
      message: "Balance retrieved successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        type: user.type,
        approved: user.approved,
      },
      account: {
        accountNumber: account.accountNumber,
        accountType: account.type,
        currentBalance: account.balance,
        createdAt: account.createdAt,
        lastUpdated: new Date(),
      },
      summary: {
        recentTransactionsCount: recentTransactionsCount,
        accountStatus: "active",
      },
    });
  } catch (err) {
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid access token" });
    }
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Access token expired" });
    }
    console.error("Get balance error:", err);
    res.status(500).json({ error: "Server error occurred" });
  }
};

// Get all transfers made by the logged-in user
exports.getMyTransfers = async (req, res) => {
  try {
    // Extract user info from JWT token
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Access token required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Find user and their account
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.approved && user.type !== "admin") {
      return res.status(403).json({
        error: "Account not approved. Please wait for admin approval.",
      });
    }

    // Find user's account
    const userAccount = await Account.findOne({ user: userId }).populate(
      "user",
      "name email"
    );
    if (!userAccount) {
      return res.status(404).json({
        error: "No account found for this user",
      });
    }

    // Find all outgoing transfers made by this user
    const outgoingTransfers = await Transaction.find({
      from: userAccount._id,
      type: "transfer",
    })
      .populate({
        path: "to",
        select: "accountNumber type user",
        populate: {
          path: "user",
          select: "name email phone",
        },
      })
      .sort({ createdAt: -1 });

    // Format the transfers with recipient details
    const formattedTransfers = outgoingTransfers.map((transfer) => {
      const transferDate = new Date(transfer.createdAt);
      const formattedDate = transferDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const formattedTime = transferDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      return {
        transferId: transfer._id,
        amount: transfer.amount,
        description: transfer.description || "Transfer",
        date: transfer.createdAt,
        formattedDate: formattedDate,
        formattedTime: formattedTime,
        dateTimeString: `${formattedDate} at ${formattedTime}`,
        recipient: {
          name: transfer.to?.user?.name || "Unknown",
          email: transfer.to?.user?.email || "Unknown",
          phone: transfer.to?.user?.phone || "Unknown",
          accountNumber: transfer.to?.accountNumber || "Unknown",
          accountType: transfer.to?.type || "Unknown",
        },
        transferSummary: `Sent $${transfer.amount} to ${
          transfer.to?.user?.name || "Unknown"
        } (${transfer.to?.accountNumber || "Unknown"})`,
      };
    });

    // Group transfers by recipient for summary
    const transfersByRecipient = {};
    let totalAmountTransferred = 0;

    formattedTransfers.forEach((transfer) => {
      const recipientKey = transfer.recipient.accountNumber;
      totalAmountTransferred += transfer.amount;

      if (!transfersByRecipient[recipientKey]) {
        transfersByRecipient[recipientKey] = {
          recipient: transfer.recipient,
          transfers: [],
          totalAmount: 0,
          transferCount: 0,
        };
      }

      transfersByRecipient[recipientKey].transfers.push(transfer);
      transfersByRecipient[recipientKey].totalAmount += transfer.amount;
      transfersByRecipient[recipientKey].transferCount += 1;
    });

    // Convert to array for easier frontend consumption
    const recipientSummary = Object.values(transfersByRecipient);

    res.json({
      message: "Transfer history retrieved successfully",
      sender: {
        name: user.name,
        email: user.email,
        accountNumber: userAccount.accountNumber,
        accountType: userAccount.type,
      },
      summary: {
        totalTransfers: formattedTransfers.length,
        totalAmountTransferred: totalAmountTransferred,
        uniqueRecipients: recipientSummary.length,
        dateRange:
          formattedTransfers.length > 0
            ? {
                oldest:
                  formattedTransfers[formattedTransfers.length - 1]
                    .formattedDate,
                newest: formattedTransfers[0].formattedDate,
              }
            : null,
      },
      recipientSummary: recipientSummary,
      allTransfers: formattedTransfers,
    });
  } catch (err) {
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid access token" });
    }
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Access token expired" });
    }
    console.error("Get my transfers error:", err);
    res.status(500).json({ error: "Server error occurred" });
  }
};

// Add a new beneficiary
exports.addBeneficiary = async (req, res) => {
  try {
    // Extract user info from JWT token
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Access token required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const { accountNumber, nickname, description } = req.body;

    // Validate input
    if (!accountNumber || !nickname) {
      return res.status(400).json({
        error: "Account number and nickname are required",
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.approved && user.type !== "admin") {
      return res.status(403).json({
        error: "Account not approved. Please wait for admin approval.",
      });
    }

    // Find user's own account
    const userAccount = await Account.findOne({ user: userId });
    if (!userAccount) {
      return res.status(404).json({
        error: "Your account not found",
      });
    }

    // Check if user is trying to add their own account
    if (userAccount.accountNumber === accountNumber) {
      return res.status(400).json({
        error: "You cannot add your own account as a beneficiary",
      });
    }

    // Check if the beneficiary account exists
    const beneficiaryAccount = await Account.findOne({
      accountNumber: accountNumber,
    }).populate("user", "name email type approved");

    if (!beneficiaryAccount) {
      return res.status(404).json({
        error: "Account doesn't exist in the system",
        message: "Please verify the account number and try again",
      });
    }

    // Check if beneficiary account is approved
    if (
      !beneficiaryAccount.user.approved &&
      beneficiaryAccount.user.type !== "admin"
    ) {
      return res.status(400).json({
        error: "Beneficiary account is not approved yet",
        message: "This account is pending admin approval",
      });
    }

    // Check if beneficiary already exists
    const existingBeneficiary = await Beneficiary.findOne({
      userId: userId,
      beneficiaryAccountNumber: accountNumber,
    });

    if (existingBeneficiary) {
      return res.status(400).json({
        error: "Beneficiary already exists",
        message: `You have already added ${beneficiaryAccount.user.name} as a beneficiary`,
        existingBeneficiary: {
          nickname: existingBeneficiary.nickname,
          accountNumber: existingBeneficiary.beneficiaryAccountNumber,
          beneficiaryName: beneficiaryAccount.user.name,
        },
      });
    }

    // Create new beneficiary
    const newBeneficiary = new Beneficiary({
      userId: userId,
      beneficiaryAccountNumber: accountNumber,
      beneficiaryAccountId: beneficiaryAccount._id,
      nickname: nickname,
      description: description || `Transfer to ${beneficiaryAccount.user.name}`,
    });

    await newBeneficiary.save();

    res.status(201).json({
      message: "Beneficiary added successfully",
      beneficiary: {
        id: newBeneficiary._id,
        nickname: newBeneficiary.nickname,
        description: newBeneficiary.description,
        accountNumber: beneficiaryAccount.accountNumber,
        accountType: beneficiaryAccount.type,
        beneficiaryName: beneficiaryAccount.user.name,
        beneficiaryEmail: beneficiaryAccount.user.email,
        createdAt: newBeneficiary.createdAt,
      },
    });
  } catch (err) {
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid access token" });
    }
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Access token expired" });
    }
    if (err.code === 11000) {
      return res.status(400).json({ error: "Beneficiary already exists" });
    }
    console.error("Add beneficiary error:", err);
    res.status(500).json({ error: "Server error occurred" });
  }
};

// Get all beneficiaries for the logged-in user
exports.getBeneficiaries = async (req, res) => {
  try {
    // Extract user info from JWT token
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Access token required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get all beneficiaries for this user
    const beneficiaries = await Beneficiary.find({
      userId: userId,
      isActive: true,
    })
      .populate({
        path: "beneficiaryAccountId",
        select: "accountNumber type user",
        populate: {
          path: "user",
          select: "name email phone type",
        },
      })
      .sort({ createdAt: -1 });

    const formattedBeneficiaries = beneficiaries.map((beneficiary) => ({
      id: beneficiary._id,
      nickname: beneficiary.nickname,
      description: beneficiary.description,
      accountNumber: beneficiary.beneficiaryAccountId.accountNumber,
      accountType: beneficiary.beneficiaryAccountId.type,
      beneficiaryDetails: {
        name: beneficiary.beneficiaryAccountId.user.name,
        email: beneficiary.beneficiaryAccountId.user.email,
        phone: beneficiary.beneficiaryAccountId.user.phone,
        userType: beneficiary.beneficiaryAccountId.user.type,
      },
      createdAt: beneficiary.createdAt,
      isActive: beneficiary.isActive,
    }));

    res.json({
      message: "Beneficiaries retrieved successfully",
      user: {
        name: user.name,
        email: user.email,
      },
      totalBeneficiaries: formattedBeneficiaries.length,
      beneficiaries: formattedBeneficiaries,
    });
  } catch (err) {
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid access token" });
    }
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Access token expired" });
    }
    console.error("Get beneficiaries error:", err);
    res.status(500).json({ error: "Server error occurred" });
  }
};

// Transfer money to a beneficiary
exports.transferToBeneficiary = async (req, res) => {
  try {
    // Extract user info from JWT token
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Access token required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const { beneficiaryId, amount, description } = req.body;

    // Validate input
    if (!beneficiaryId || !amount || amount <= 0) {
      return res.status(400).json({
        error: "Beneficiary ID and valid amount are required",
      });
    }

    // Find user and their account
    const userAccount = await Account.findOne({ user: userId }).populate(
      "user",
      "name email"
    );
    if (!userAccount) {
      return res.status(404).json({ error: "Your account not found" });
    }

    // Find the beneficiary
    const beneficiary = await Beneficiary.findOne({
      _id: beneficiaryId,
      userId: userId,
      isActive: true,
    }).populate("beneficiaryAccountId");

    if (!beneficiary) {
      return res.status(404).json({
        error: "Beneficiary not found",
        message: "The selected beneficiary doesn't exist or has been removed",
      });
    }

    const beneficiaryAccount = beneficiary.beneficiaryAccountId;

    // Check sufficient balance
    if (userAccount.balance < amount) {
      return res.status(400).json({
        error: "Insufficient funds",
        currentBalance: userAccount.balance,
        requestedAmount: amount,
      });
    }

    // Perform the transfer
    userAccount.balance -= amount;
    beneficiaryAccount.balance += amount;

    await userAccount.save();
    await beneficiaryAccount.save();

    // Create transaction record
    const transaction = new Transaction({
      from: userAccount._id,
      to: beneficiaryAccount._id,
      amount,
      type: "transfer",
      description: description || `Transfer to ${beneficiary.nickname}`,
    });

    await transaction.save();

    // Get updated beneficiary details
    const updatedBeneficiary = await Beneficiary.findById(
      beneficiaryId
    ).populate({
      path: "beneficiaryAccountId",
      populate: {
        path: "user",
        select: "name email",
      },
    });

    res.json({
      message: "Transfer to beneficiary successful",
      transfer: {
        amount: amount,
        description: description || `Transfer to ${beneficiary.nickname}`,
        timestamp: new Date(),
        beneficiaryNickname: beneficiary.nickname,
      },
      fromAccount: {
        accountNumber: userAccount.accountNumber,
        remainingBalance: userAccount.balance,
        accountHolderName: userAccount.user.name,
      },
      toAccount: {
        accountNumber: beneficiaryAccount.accountNumber,
        newBalance: beneficiaryAccount.balance,
        beneficiaryName: updatedBeneficiary.beneficiaryAccountId.user.name,
        nickname: beneficiary.nickname,
      },
      transaction: {
        transactionId: transaction._id,
        amount: transaction.amount,
        type: transaction.type,
        description: transaction.description,
        createdAt: transaction.createdAt,
      },
    });
  } catch (err) {
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid access token" });
    }
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Access token expired" });
    }
    console.error("Transfer to beneficiary error:", err);
    res.status(500).json({ error: "Server error occurred" });
  }
};

// Remove a beneficiary
exports.removeBeneficiary = async (req, res) => {
  try {
    // Extract user info from JWT token
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Access token required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const { beneficiaryId } = req.params;

    // Find and remove the beneficiary
    const beneficiary = await Beneficiary.findOne({
      _id: beneficiaryId,
      userId: userId,
    }).populate({
      path: "beneficiaryAccountId",
      populate: {
        path: "user",
        select: "name",
      },
    });

    if (!beneficiary) {
      return res.status(404).json({
        error: "Beneficiary not found",
      });
    }

    // Soft delete by setting isActive to false
    beneficiary.isActive = false;
    await beneficiary.save();

    res.json({
      message: "Beneficiary removed successfully",
      removedBeneficiary: {
        nickname: beneficiary.nickname,
        beneficiaryName: beneficiary.beneficiaryAccountId.user.name,
        accountNumber: beneficiary.beneficiaryAccountNumber,
      },
    });
  } catch (err) {
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid access token" });
    }
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Access token expired" });
    }
    console.error("Remove beneficiary error:", err);
    res.status(500).json({ error: "Server error occurred" });
  }
};
