const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bankRoutes = require("../routes/bankRoutes");

const app = express();

// Enable CORS for all routes
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://cuz-bank-system.vercel.app",
    ];

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    // Allow all localhost origins in development
    if (process.env.NODE_ENV !== "production" && origin.includes("localhost")) {
      return callback(null, true);
    }

    // Check allowed origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      console.error(`CORS blocked origin: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
  optionsSuccessStatus: 200, // Support legacy browsers
};

app.use(cors(corsOptions));

// Debug middleware to log requests
app.use((req, res, next) => {
  console.log(
    `${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${
      req.get("Origin") || "No origin"
    }`
  );
  next();
});

// Middleware to parse JSON
app.use(express.json());

// Basic route for testing
app.get("/", (req, res) => {
  try {
    res.json({
      message: "🚀 CUZ Banking API is live on Vercel! (Fixed)",
      version: "1.0.1",
      environment: process.env.NODE_ENV || "production",
      timestamp: new Date().toISOString(),
      debug: {
        hasMongoCloud: !!process.env.MONGO_URI_CLOUD,
        hasJWTSecret: !!process.env.JWT_SECRET,
        mongoStatus: mongoose.connection.readyState,
        vercelEnv: process.env.VERCEL || "not-vercel",
      },
    });
  } catch (error) {
    console.error("Root route error:", error);
    res.status(500).json({
      error: "Server error in root route",
      message: error.message,
    });
  }
});

// Health check route
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use("/cuz/bank", bankRoutes);

// Database connection configuration
const connectDB = async () => {
  try {
    const isProduction = process.env.NODE_ENV === "production";
    const isVercel = process.env.VERCEL === "1";

    let mongoURI;

    if (isProduction || isVercel) {
      // Use cloud MongoDB for production/Vercel deployment
      mongoURI = process.env.MONGO_URI_CLOUD || process.env.MONGO_URI;
      console.log("Connecting to Cloud MongoDB...");
    } else {
      // Use local MongoDB for development
      mongoURI =
        process.env.MONGO_URI_LOCAL ||
        process.env.MONGO_URI ||
        "mongodb://localhost:27017/zambiabank";
      console.log("Connecting to Local MongoDB...");
    }

    console.log("MongoDB URI exists:", !!mongoURI);
    console.log(
      "Attempting connection to:",
      mongoURI.includes("mongodb+srv") ? "MongoDB Atlas" : "Local MongoDB"
    );

    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 30000, // 30 second timeout (increased)
      socketTimeoutMS: 45000, // 45 second socket timeout
      connectTimeoutMS: 30000, // 30 second connection timeout
      bufferCommands: true, // Enable mongoose buffering (default)
      maxPoolSize: 10, // Maintain up to 10 socket connections
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`Database: ${conn.connection.name}`);
  } catch (error) {
    console.error("Database connection error:", error.message);
    console.error("Full error:", error);

    // Don't crash the app, just continue without database
    console.warn("Continuing without database connection...");

    // Fallback connection attempt only in development
    if (process.env.NODE_ENV !== "production" && process.env.MONGO_URI) {
      try {
        console.log("Attempting fallback connection...");
        const fallbackConn = await mongoose.connect(process.env.MONGO_URI);
        console.log(
          `Fallback connection successful: ${fallbackConn.connection.host}`
        );
      } catch (fallbackError) {
        console.error("Fallback connection failed:", fallbackError.message);
      }
    }
  }
};

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global error handler:", err);
  res.status(500).json({
    error: "Internal server error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.path,
    method: req.method,
  });
});

// Initialize MongoDB connection
connectDB();

// Handle MongoDB connection events
mongoose.connection.on("connected", () => {
  console.log("✅ MongoDB connection established successfully");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("⚠️ MongoDB connection disconnected");
});

// Export the Express app for Vercel
module.exports = app;
