const path = require("path");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");

// Route imports
const authRoutes = require("./src/routes/auth.routes");
const adminRoutes = require("./src/routes/admin.routes");
const dashboardRoutes = require("./src/routes/dashboard.routes");
const quotationRoutes = require("./src/routes/quotation.routes");
const catalogRoutes = require("./src/routes/catalog.routes");
const customerQuotationRoutes = require("./src/routes/customerQuotation.routes");

// PostgreSQL connection
const pool = require("./src/config/db");

const app = express();

// ===============================
// MIDDLEWARE
// ===============================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/quotations", quotationRoutes);
app.use("/api/customer/quotations", customerQuotationRoutes);
app.use("/api", catalogRoutes);
app.use("/api", dashboardRoutes);

// ===============================
// HEALTH CHECK
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

// ===============================
// TEST DATABASE QUERY
// ===============================

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
// SERVER
// ===============================

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await pool.initDatabase();
    console.log("Database schema initialized successfully.");
  } catch (error) {
    console.error("Database initialization failed:", error.message);
    console.error("The API will start in diagnostic mode.");
  }

  app.listen(PORT, () => {
    console.log(`DealFlow360 API running on port ${PORT}`);
  });
}

startServer();
