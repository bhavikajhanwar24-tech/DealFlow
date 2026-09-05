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
const fulfillmentRoutes = require("./src/routes/fulfillment.routes");
const messageRoutes = require("./src/routes/message.routes");
const invoiceRoutes = require("./src/routes/invoice.routes");
const analyticsRoutes = require("./src/routes/analytics.routes");
const aiRoutes = require("./src/routes/ai.routes");

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
app.use("/api/fulfillment", fulfillmentRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api", catalogRoutes);
app.use("/api", dashboardRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/ai", aiRoutes);

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
// ERROR & 404 HANDLERS
// ===============================

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: `API route ${req.method} ${req.originalUrl} not found.`,
  });
});

app.use((err, req, res, next) => {
  console.error("DealFlow360 API Error:", err);
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || "An unexpected server error occurred.",
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
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
