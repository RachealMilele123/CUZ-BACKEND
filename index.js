const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const addressRoutes = require("./routes/addressRoutes");

dotenv.config();

const app = express();

// Middleware to parse JSON
app.use(express.json());

// Test route
app.use("/cuz/address", addressRoutes);


// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ Connected to MongoDB");
    app.listen(process.env.PORT || 5000, () => {
      console.log(`🚀 Server running on port ${process.env.PORT}`);
    });
  })
  .catch((err) => console.error("❌ Database connection error:", err));
