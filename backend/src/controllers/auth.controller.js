const authService = require("../services/auth.service");

async function registerEmployee(req, res) {
  try {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const user = await authService.registerEmployee(req.body, ip);

    return res.status(201).json({
      success: true,
      status: "PENDING_APPROVAL",
      message: "Registration submitted successfully. Your employee account is waiting for administrator approval. You will be able to log in once an administrator approves your account.",
      user
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to register employee."
    });
  }
}

async function registerCustomer(req, res) {
  try {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const result = await authService.registerCustomer(req.body, ip);

    return res.status(201).json({
      success: true,
      status: "ACTIVE",
      message: "Customer account created successfully.",
      user: result.user,
      token: result.token
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to register customer."
    });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const result = await authService.loginUser(email, password, ip);

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      user: result.user,
      token: result.token
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      status: error.accountStatus || undefined,
      message: error.message || "Authentication failed."
    });
  }
}

async function getMe(req, res) {
  return res.status(200).json({
    success: true,
    user: req.user
  });
}

async function logout(req, res) {
  return res.status(200).json({
    success: true,
    message: "Logged out successfully."
  });
}

module.exports = {
  registerEmployee,
  registerCustomer,
  login,
  getMe,
  logout
};
