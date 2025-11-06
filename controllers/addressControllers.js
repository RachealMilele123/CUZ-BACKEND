const Address = require("../models/Address");

// Add a new address
const addAddress = async (req, res) => {
  try {
    const address = new Address(req.body);
    const savedAddress = await address.save();
    console.log("✅ Address added:", savedAddress);
    res.status(201).json({
      message: "✅ Address added successfully",
      data: savedAddress,
    });
  } catch (error) {
    console.error("❌ Error adding address:", error);
    res.status(400).json({
      message: "❌ Failed to add address",
      error: error.message,
    });
  }
};

// Get all addresses
const getAllAddresses = async (req, res) => {
  try {
    const addresses = await Address.find();
    res.status(200).json(addresses);
  } catch (error) {
    res.status(500).json({
      message: "❌ Failed to fetch addresses",
      error: error.message,
    });
  }
};

module.exports = { addAddress, getAllAddresses };
