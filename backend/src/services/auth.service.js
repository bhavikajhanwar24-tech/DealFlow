const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

const JWT_SECRET = process.env.JWT_SECRET || "dealflow360_fallback_secret_key";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function sanitizeUser(user) {
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

async function registerEmployee(data, ipAddress) {
  const {
    fullName,
    employeeId,
    email,
    password,
    department,
    requestedRole
  } = data;

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedEmpId = employeeId.trim().toUpperCase();

  // Check email collision
  const existingEmail = await db.query(
    "SELECT id, status FROM public.users WHERE email = $1",
    [normalizedEmail]
  );
  if (existingEmail.rows.length > 0) {
    const error = new Error("Email is already registered.");
    error.statusCode = 409;
    throw error;
  }

  // Check employee ID collision
  const existingEmpId = await db.query(
    "SELECT id FROM public.users WHERE employee_id = $1",
    [normalizedEmpId]
  );
  if (existingEmpId.rows.length > 0) {
    const error = new Error("Employee ID is already registered.");
    error.statusCode = 409;
    throw error;
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const role = requestedRole.toUpperCase();
  const status = "PENDING_APPROVAL";

  const result = await db.query(
    `INSERT INTO public.users (
      full_name, email, password_hash, employee_id, role, status, department
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, full_name, email, employee_id, role, status, department, created_at`,
    [
      fullName.trim(),
      normalizedEmail,
      passwordHash,
      normalizedEmpId,
      role,
      status,
      department.trim()
    ]
  );

  const createdUser = result.rows[0];

  await db.query(
    `INSERT INTO public.audit_logs (user_id, action, details, ip_address)
     VALUES ($1, $2, $3, $4)`,
    [
      createdUser.id,
      "EMPLOYEE_REGISTRATION_SUBMITTED",
      JSON.stringify({
        employeeId: normalizedEmpId,
        department: createdUser.department,
        requestedRole: role
      }),
      ipAddress || null
    ]
  );

  return sanitizeUser(createdUser);
}

async function registerCustomer(data, ipAddress) {
  const { companyName, fullName, email, password } = data;
  const normalizedEmail = email.trim().toLowerCase();

  const existingEmail = await db.query(
    "SELECT id FROM public.users WHERE email = $1",
    [normalizedEmail]
  );
  if (existingEmail.rows.length > 0) {
    const error = new Error("Email is already registered.");
    error.statusCode = 409;
    throw error;
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const role = "CUSTOMER";
  const status = "ACTIVE";

  const result = await db.query(
    `INSERT INTO public.users (
      full_name, email, password_hash, company_name, role, status
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, full_name, email, company_name, role, status, created_at`,
    [
      fullName.trim(),
      normalizedEmail,
      passwordHash,
      companyName.trim(),
      role,
      status
    ]
  );

  const createdUser = result.rows[0];
  const token = generateToken(createdUser);

  await db.query(
    `INSERT INTO public.audit_logs (user_id, action, details, ip_address)
     VALUES ($1, $2, $3, $4)`,
    [
      createdUser.id,
      "CUSTOMER_REGISTERED",
      JSON.stringify({ companyName: companyName.trim() }),
      ipAddress || null
    ]
  );

  return {
    user: sanitizeUser(createdUser),
    token
  };
}

async function loginUser(email, password, ipAddress) {
  const normalizedEmail = email.trim().toLowerCase();

  const result = await db.query(
    `SELECT id, full_name, email, password_hash, employee_id, company_name,
            role, status, department, created_at
     FROM public.users WHERE email = $1`,
    [normalizedEmail]
  );

  if (result.rows.length === 0) {
    const error = new Error("Invalid email or password.");
    error.statusCode = 401;
    throw error;
  }

  const user = result.rows[0];

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    const error = new Error("Invalid email or password.");
    error.statusCode = 401;
    throw error;
  }

  // Account status check
  if (user.status === "PENDING_APPROVAL") {
    const error = new Error("Your account is still awaiting administrator approval.");
    error.statusCode = 403;
    error.accountStatus = "PENDING_APPROVAL";
    throw error;
  }

  if (user.status === "REJECTED") {
    const error = new Error("Your employee registration was rejected. Please contact your administrator.");
    error.statusCode = 403;
    error.accountStatus = "REJECTED";
    throw error;
  }

  if (user.status === "SUSPENDED") {
    const error = new Error("Your account has been suspended. Please contact your administrator.");
    error.statusCode = 403;
    error.accountStatus = "SUSPENDED";
    throw error;
  }

  if (user.status !== "ACTIVE") {
    const error = new Error("Your account is inactive. Please contact support.");
    error.statusCode = 403;
    error.accountStatus = user.status;
    throw error;
  }

  const token = generateToken(user);

  await db.query(
    `INSERT INTO public.audit_logs (user_id, action, details, ip_address)
     VALUES ($1, $2, $3, $4)`,
    [
      user.id,
      "USER_LOGIN_SUCCESS",
      JSON.stringify({ role: user.role }),
      ipAddress || null
    ]
  );

  return {
    user: sanitizeUser(user),
    token
  };
}

module.exports = {
  registerEmployee,
  registerCustomer,
  loginUser,
  sanitizeUser,
  generateToken
};
