require("dotenv").config();

const express = require("express");
const cors = require("cors");
const db = require("./src/config/db");

const authRoutes = require("./src/routes/auth.routes");
const adminRoutes = require("./src/routes/admin.routes");
const dashboardRoutes = require("./src/routes/dashboard.routes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", dashboardRoutes);

// Test Express
app.get("/", (req, res) => {
  res.json({
    name: "DealFlow360 API",
    status: "Operational",
    version: "1.0.0",
    message: "DealFlow360 Quote-to-Cash Platform API is running"
  });
});

// Test PostgreSQL connection
app.get("/api/health", async (req, res) => {
  try {
    const result = await db.query("SELECT NOW()");

    res.json({
      success: true,
      message: "Supabase PostgreSQL connected!",
      databaseTime: result.rows[0].now
    });
  } catch (error) {
    console.error("DATABASE ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: error.message
    });
  }
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.url}`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled Server Error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error."
  });
});

const PORT = process.env.PORT || 5000;

// Initialize Database schema and start server
db.initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`DealFlow360 API running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database tables:", err);
    // Still start server to allow diagnostics
    app.listen(PORT, () => {
      console.log(`DealFlow360 API running with warnings on port ${PORT}`);
    });
  });