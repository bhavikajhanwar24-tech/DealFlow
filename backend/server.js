require("dotenv").config();

const express = require("express");
const cors = require("cors");

// Database initialization & pool connection
const pool = require("./src/config/db");
const db = require("./src/config/db");

// Route imports
const authRoutes = require("./src/routes/auth.routes");
const adminRoutes = require("./src/routes/admin.routes");
const dashboardRoutes = require("./src/routes/dashboard.routes");

const app = express();

// ===============================
// MIDDLEWARE
// ===============================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===============================
// API ROUTES
// ===============================

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/dashboard", dashboardRoutes);

// ===============================
// HEALTH CHECKS & DIAGNOSTICS
// ===============================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "DealFlow360 API is running",
  });
});

app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      success: true,
      message: "PostgreSQL connected successfully!",
      databaseTime: result.rows[0].now,
    });
  } catch (error) {
    console.error("DATABASE ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: error.message,
    });
  }
});

app.get("/api/db-test", async (req, res) => {
  try {
    const result = await pool.query("SELECT version()");

    res.json({
      success: true,
      message: "Database is working",
      version: result.rows[0].version,
    });
  } catch (error) {
    console.error("DATABASE ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Database query failed",
      error: error.message,
    });
  }
});

// ===============================
// SERVER INITIALIZATION
// ===============================

const PORT = process.env.PORT || 5000;

if (db.initDatabase && typeof db.initDatabase === "function") {
  db.initDatabase()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`DealFlow360 API running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error("Failed to initialize database schema:", err);
      app.listen(PORT, () => {
        console.log(`DealFlow360 API running with warnings on port ${PORT}`);
      });
    });
} else {
  app.listen(PORT, () => {
    console.log(`DealFlow360 API running on port ${PORT}`);
  });
}