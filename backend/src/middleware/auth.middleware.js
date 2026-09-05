const jwt = require("jsonwebtoken");
const db = require("../config/db");

const JWT_SECRET = process.env.JWT_SECRET || "dealflow360_fallback_secret_key";

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication token missing or invalid. Please log in."
      });
    }

    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Session expired or token invalid. Please log in again."
      });
    }

    const userResult = await db.query(
      `SELECT id, full_name, email, employee_id, company_name, role, status, department, created_at
       FROM public.users WHERE id = $1`,
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "User account no longer exists."
      });
    }

    req.user = userResult.rows[0];
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal authentication error."
    });
  }
}

function requireActiveUser(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required."
    });
  }

  if (req.user.status === "PENDING_APPROVAL") {
    return res.status(403).json({
      success: false,
      status: "PENDING_APPROVAL",
      message: "Your account is still awaiting administrator approval."
    });
  }

  if (req.user.status === "REJECTED") {
    return res.status(403).json({
      success: false,
      status: "REJECTED",
      message: "Your employee registration was rejected. Please contact your administrator."
    });
  }

  if (req.user.status === "SUSPENDED") {
    return res.status(403).json({
      success: false,
      status: "SUSPENDED",
      message: "Your account has been suspended. Please contact your administrator."
    });
  }

  if (req.user.status !== "ACTIVE") {
    return res.status(403).json({
      success: false,
      status: req.user.status,
      message: "Your account is not active. Please contact support."
    });
  }

  next();
}

module.exports = {
  requireAuth,
  requireActiveUser
};
