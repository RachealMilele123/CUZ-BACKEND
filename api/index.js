const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const addressRoutes = require("../routes/addressRoutes");
const bankRoutes = require("../routes/bankRoutes");

const app = express();

// Enable CORS for all routes
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://soschoir.vercel.app",
      "https://soschoir-git-staging-desire-irankundas-projects.vercel.app",
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error("Not allowed by CORS"));
    }
  },
  methods: "GET,POST,PUT,DELETE",
  allowedHeaders: "Content-Type,Authorization",
  credentials: true,
};

app.use(cors(corsOptions));

// Middleware to parse JSON
app.use(express.json());

// Routes
app.use("/cuz/address", addressRoutes);
app.use("/cuz/bank", bankRoutes);

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ Connected to MongoDB");
  })
  .catch((err) => console.error("❌ Database connection error:", err));

// For local development
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

// Export the app for Vercel
module.exports = app;
