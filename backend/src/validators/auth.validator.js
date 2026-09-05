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

function validateStaff(req, res, next) {
  const { fullName, employeeId, email, password, department, role } = req.body;
  const errors = [];

  if (!fullName || typeof fullName !== "string" || fullName.trim().length < 2) {
    errors.push("Full Name is required and must be at least 2 characters.");
  }
  if (!employeeId || typeof employeeId !== "string" || employeeId.trim().length < 2) {
    errors.push("Staff ID is required.");
  }
  if (!email || !isValidEmail(email)) {
    errors.push("A valid work email address is required.");
  }
  if (!department || typeof department !== "string" || !department.trim()) {
    errors.push("Department is required.");
  }
  if (!role || !ALLOWED_EMPLOYEE_ROLES.includes(String(role).toUpperCase())) {
    errors.push(`Role must be one of: ${ALLOWED_EMPLOYEE_ROLES.join(", ")}.`);
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    errors.push("Password must be at least 6 characters long.");
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors[0], errors });
  }

  next();
}

function validateStaffUpdate(req, res, next) {
  const { fullName, employeeId, email, password, department, role, status } = req.body;
  const errors = [];

  if (!fullName || typeof fullName !== "string" || fullName.trim().length < 2) {
    errors.push("Full Name is required and must be at least 2 characters.");
  }
  if (!employeeId || typeof employeeId !== "string" || employeeId.trim().length < 2) {
    errors.push("Staff ID is required.");
  }
  if (!email || !isValidEmail(email)) {
    errors.push("A valid work email address is required.");
  }
  if (!department || typeof department !== "string" || !department.trim()) {
    errors.push("Department is required.");
  }
  if (!role || !ALLOWED_EMPLOYEE_ROLES.includes(String(role).toUpperCase())) {
    errors.push(`Role must be one of: ${ALLOWED_EMPLOYEE_ROLES.join(", ")}.`);
  }
  if (password !== undefined && password !== "" && (typeof password !== "string" || password.length < 6)) {
    errors.push("Password must be at least 6 characters long.");
  }
  if (status && !["ACTIVE", "SUSPENDED"].includes(String(status).toUpperCase())) {
    errors.push("Status must be ACTIVE or SUSPENDED.");
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors[0], errors });
  }

  next();
}

const PRODUCT_CATEGORIES = [
  "HARDWARE",
  "SERVICE",
  "SUBSCRIPTION",
  "ELECTRONICS",
  "FURNITURE",
  "SOFTWARE",
  "SERVICES",
  "OTHER"
];

function validateProduct(req, res, next) {
  const { name, sku, category, unitPrice, cost, inventoryReference, status } = req.body;
  const errors = [];
  const price = Number(unitPrice);
  const productCost = Number(cost);

  if (!name || typeof name !== "string" || !name.trim()) errors.push("Product name is required.");
  if (!sku || typeof sku !== "string" || !sku.trim()) errors.push("Product ID is required.");
  if (!category || !PRODUCT_CATEGORIES.includes(String(category).toUpperCase())) errors.push("A valid product category is required.");
  if (!Number.isFinite(price) || price < 0) errors.push("Selling price cannot be negative.");
  if (!Number.isFinite(productCost) || productCost < 0) errors.push("Product cost cannot be negative.");
  if (status && !["ACTIVE", "INACTIVE"].includes(String(status).toUpperCase())) errors.push("Status must be ACTIVE or INACTIVE.");
  if (inventoryReference !== undefined && inventoryReference !== null && typeof inventoryReference !== "string") errors.push("Inventory reference must be text.");

  if (errors.length > 0) return res.status(400).json({ success: false, message: errors[0], errors });
  next();
}

function validateWarehouse(req, res, next) {
  const { name, address, latitude, longitude } = req.body;
  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);
  const errors = [];

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    errors.push("Warehouse name is required.");
  }
  if (!address || typeof address !== "string" || address.trim().length < 3) {
    errors.push("Warehouse address is required.");
  }
  if (!Number.isFinite(parsedLatitude) || parsedLatitude < -90 || parsedLatitude > 90) {
    errors.push("Latitude must be between -90 and 90.");
  }
  if (!Number.isFinite(parsedLongitude) || parsedLongitude < -180 || parsedLongitude > 180) {
    errors.push("Longitude must be between -180 and 180.");
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors[0], errors });
  }

  next();
}

const CUSTOMER_TIERS = ["BRONZE", "SILVER", "GOLD"];
const POLICY_CATEGORIES = ["HARDWARE", "SERVICE", "SUBSCRIPTION", "ELECTRONICS", "FURNITURE", "SOFTWARE", "SERVICES", "OTHER"];

function validateDiscountPolicy(req, res, next) {
  const { customerTier, productCategory, maxDiscount, status } = req.body;
  const discount = Number(maxDiscount);
  const errors = [];

  if (!CUSTOMER_TIERS.includes(String(customerTier || "").toUpperCase())) errors.push("Customer tier must be Bronze, Silver, or Gold.");
  if (!productCategory || typeof productCategory !== "string" || !productCategory.trim() || productCategory.trim().length > 30) errors.push("Product category is required and must be 30 characters or fewer.");
  if (!Number.isFinite(discount) || discount < 0 || discount > 100) errors.push("Maximum discount must be a number between 0 and 100.");
  if (status && !["ACTIVE", "INACTIVE"].includes(String(status).toUpperCase())) errors.push("Status must be ACTIVE or INACTIVE.");

  if (errors.length > 0) return res.status(400).json({ success: false, message: errors[0], errors });
  next();
}

module.exports = {
  validateEmployeeRegister,
  validateCustomerRegister,
  validateLogin,
  validateRejection,
  validateStaff,
  validateStaffUpdate,
  validateProduct,
  PRODUCT_CATEGORIES,
  validateWarehouse,
  validateDiscountPolicy,
  CUSTOMER_TIERS,
  POLICY_CATEGORIES,
  ALLOWED_EMPLOYEE_ROLES,
  ALLOWED_DEPARTMENTS
};
