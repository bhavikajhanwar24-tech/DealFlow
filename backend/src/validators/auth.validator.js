const ALLOWED_EMPLOYEE_ROLES = [
  "SALES_REP",
  "SALES_MANAGER",
  "FINANCE",
  "OPERATIONS"
];

const ALLOWED_DEPARTMENTS = [
  "Sales",
  "Finance",
  "Operations"
];

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(email).trim().toLowerCase());
}

function validateEmployeeRegister(req, res, next) {
  const {
    fullName,
    employeeId,
    email,
    password,
    confirmPassword,
    department,
    requestedRole
  } = req.body;

  const errors = [];

  if (!fullName || typeof fullName !== "string" || fullName.trim().length < 2) {
    errors.push("Full Name is required and must be at least 2 characters.");
  }

  if (!employeeId || typeof employeeId !== "string" || employeeId.trim().length < 2) {
    errors.push("Employee ID is required (e.g., EMP-1001).");
  }

  if (!email || !isValidEmail(email)) {
    errors.push("A valid work email address is required.");
  }

  if (!department || typeof department !== "string" || !department.trim()) {
    errors.push("Department is required (e.g. Sales, Finance, Operations).");
  }

  if (!requestedRole || typeof requestedRole !== "string") {
    errors.push("Requested role is required.");
  } else if (requestedRole.toUpperCase() === "ADMIN") {
    errors.push("Registration for ADMIN role is not permitted.");
  } else if (!ALLOWED_EMPLOYEE_ROLES.includes(requestedRole.toUpperCase())) {
    errors.push(`Requested role must be one of: ${ALLOWED_EMPLOYEE_ROLES.join(", ")}.`);
  }

  if (!password || typeof password !== "string" || password.length < 6) {
    errors.push("Password must be at least 6 characters long.");
  }

  if (password !== confirmPassword) {
    errors.push("Password and Confirm Password do not match.");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: errors[0],
      errors
    });
  }

  next();
}

function validateCustomerRegister(req, res, next) {
  const {
    companyName,
    fullName,
    email,
    password,
    confirmPassword
  } = req.body;

  const errors = [];

  if (!companyName || typeof companyName !== "string" || companyName.trim().length < 2) {
    errors.push("Company Name is required and must be at least 2 characters.");
  }

  if (!fullName || typeof fullName !== "string" || fullName.trim().length < 2) {
    errors.push("Full Name is required and must be at least 2 characters.");
  }

  if (!email || !isValidEmail(email)) {
    errors.push("A valid email address is required.");
  }

  if (!password || typeof password !== "string" || password.length < 6) {
    errors.push("Password must be at least 6 characters long.");
  }

  if (password !== confirmPassword) {
    errors.push("Password and Confirm Password do not match.");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: errors[0],
      errors
    });
  }

  next();
}

function validateLogin(req, res, next) {
  const { email, password } = req.body;

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      message: "Please enter a valid email address."
    });
  }

  if (!password || typeof password !== "string" || !password.trim()) {
    return res.status(400).json({
      success: false,
      message: "Please enter your password."
    });
  }

  next();
}

function validateRejection(req, res, next) {
  const { reason } = req.body;

  if (!reason || typeof reason !== "string" || reason.trim().length < 3) {
    return res.status(400).json({
      success: false,
      message: "A rejection reason of at least 3 characters is required."
    });
  }

  next();
}

module.exports = {
  validateEmployeeRegister,
  validateCustomerRegister,
  validateLogin,
  validateRejection,
  ALLOWED_EMPLOYEE_ROLES,
  ALLOWED_DEPARTMENTS
};
