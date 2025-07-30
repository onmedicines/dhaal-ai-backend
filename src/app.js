const express = require("express");
const connectDB = require("./config/database");
const authRoutes = require("./routes/auth");
const cors = require("cors");

const app = express();

// Connect to database
connectDB();

// Basic middleware
app.use(express.json());
app.use(cors());

// Health check
app.get("/health", (req, res) => {
  res.json({ message: "Server is running!", database: "connected" });
});

app.use("/api/auth", authRoutes);

module.exports = app;
