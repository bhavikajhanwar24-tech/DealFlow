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

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

pool.query("SELECT NOW()", (err, result) => {
  if (err) {
    console.error("DATABASE ERROR:", err);
  } else {
    console.log("PostgreSQL connected successfully!");
    console.log("Database time:", result.rows[0].now);
  }
});

app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      success: true,
      message: "PostgreSQL connected!",
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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`DealFlow360 API running on port ${PORT}`);
});
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
