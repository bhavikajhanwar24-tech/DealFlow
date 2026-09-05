const db = require("../config/db");
const bcrypt = require("bcryptjs");
const { sanitizeUser } = require("./auth.service");

async function getEmployeeRegistrations(statusFilter) {
  let queryText = `
    SELECT u.id, u.full_name, u.email, u.employee_id, u.department,
           u.role, u.status, u.created_at, u.approved_at, u.rejected_at,
           u.rejection_reason,
           approver.full_name as approved_by_name,
           rejecter.full_name as rejected_by_name
    FROM public.users u
    LEFT JOIN public.users approver ON u.approved_by = approver.id
    LEFT JOIN public.users rejecter ON u.rejected_by = rejecter.id
    WHERE u.role != 'CUSTOMER'
  `;
  const params = [];

  if (statusFilter && statusFilter.toUpperCase() !== "ALL") {
    params.push(statusFilter.toUpperCase());
    queryText += ` AND u.status = $${params.length}`;
  }

  queryText += ` ORDER BY u.created_at DESC`;

  const result = await db.query(queryText, params);
  return result.rows;
}

async function approveEmployee(userId, adminUserId, ipAddress) {
  const userResult = await db.query(
    "SELECT id, full_name, email, employee_id, role, status FROM public.users WHERE id = $1",
    [userId]
  );

  if (userResult.rows.length === 0) {
    const error = new Error("Employee not found.");
    error.statusCode = 404;
    throw error;
  }

  const employee = userResult.rows[0];

  if (employee.status === "ACTIVE") {
    const error = new Error("Employee is already approved and active.");
    error.statusCode = 400;
    throw error;
  }

  const updateResult = await db.query(
    `UPDATE public.users
     SET status = 'ACTIVE',
         approved_by = $1,
         approved_at = CURRENT_TIMESTAMP,
         rejected_by = NULL,
         rejected_at = NULL,
         rejection_reason = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING id, full_name, email, employee_id, role, status, department, approved_at`,
    [adminUserId, userId]
  );

  const updatedEmployee = updateResult.rows[0];

  await db.query(
    `INSERT INTO public.audit_logs (user_id, action, details, ip_address)
     VALUES ($1, $2, $3, $4)`,
    [
      adminUserId,
      "EMPLOYEE_APPROVED",
      JSON.stringify({
        targetUserId: updatedEmployee.id,
        targetEmployeeId: updatedEmployee.employee_id,
        targetEmail: updatedEmployee.email,
        assignedRole: updatedEmployee.role
      }),
      ipAddress || null
    ]
  );

  return updatedEmployee;
}

async function rejectEmployee(userId, adminUserId, reason, ipAddress) {
  const userResult = await db.query(
    "SELECT id, full_name, email, employee_id, role, status FROM public.users WHERE id = $1",
    [userId]
  );

  if (userResult.rows.length === 0) {
    const error = new Error("Employee not found.");
    error.statusCode = 404;
    throw error;
  }

  const employee = userResult.rows[0];

  const updateResult = await db.query(
    `UPDATE public.users
     SET status = 'REJECTED',
         rejected_by = $1,
         rejected_at = CURRENT_TIMESTAMP,
         rejection_reason = $2,
         approved_by = NULL,
         approved_at = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3
     RETURNING id, full_name, email, employee_id, role, status, department, rejected_at, rejection_reason`,
    [adminUserId, reason.trim(), userId]
  );

  const updatedEmployee = updateResult.rows[0];

  await db.query(
    `INSERT INTO public.audit_logs (user_id, action, details, ip_address)
     VALUES ($1, $2, $3, $4)`,
    [
      adminUserId,
      "EMPLOYEE_REJECTED",
      JSON.stringify({
        targetUserId: updatedEmployee.id,
        targetEmployeeId: updatedEmployee.employee_id,
        targetEmail: updatedEmployee.email,
        reason: reason.trim()
      }),
      ipAddress || null
    ]
  );

  return updatedEmployee;
}

async function getAdminStats() {
  const counts = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'PENDING_APPROVAL' AND role != 'CUSTOMER') as pending_count,
      COUNT(*) FILTER (WHERE status = 'ACTIVE' AND role != 'CUSTOMER') as active_employee_count,
      COUNT(*) FILTER (WHERE role = 'CUSTOMER') as customer_count,
      COUNT(*) FILTER (WHERE status = 'REJECTED' AND role != 'CUSTOMER') as rejected_count
    FROM public.users
  `);

  const auditCount = await db.query(`SELECT COUNT(*) as count FROM public.audit_logs`);

  return {
    pendingApprovals: parseInt(counts.rows[0].pending_count, 10) || 0,
    activeEmployees: parseInt(counts.rows[0].active_employee_count, 10) || 0,
    totalCustomers: parseInt(counts.rows[0].customer_count, 10) || 0,
    rejectedEmployees: parseInt(counts.rows[0].rejected_count, 10) || 0,
    totalAuditLogs: parseInt(auditCount.rows[0].count, 10) || 0
  };
}

async function getStaff() {
  const result = await db.query(`
    SELECT id, full_name, email, employee_id, department, role, status,
           created_at, updated_at
    FROM public.users
    WHERE role != 'ADMIN' AND role != 'CUSTOMER'
    ORDER BY created_at DESC
  `);
  return result.rows;
}

async function createStaff(data, adminUserId, ipAddress) {
  const { fullName, employeeId, email, password, department, role } = data;
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedEmployeeId = employeeId.trim().toUpperCase();
  const normalizedRole = role.toUpperCase();
  const existing = await db.query(
    "SELECT id FROM public.users WHERE email = $1 OR employee_id = $2",
    [normalizedEmail, normalizedEmployeeId]
  );

  if (existing.rows.length > 0) {
    const error = new Error("Email or Staff ID is already assigned.");
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await db.query(`
    INSERT INTO public.users (
      full_name, email, password_hash, employee_id, role, status, department,
      approved_by, approved_at
    ) VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6, $7, CURRENT_TIMESTAMP)
    RETURNING id, full_name, email, employee_id, role, status, department, created_at
  `, [fullName.trim(), normalizedEmail, passwordHash, normalizedEmployeeId, normalizedRole, department.trim(), adminUserId]);

  const staff = result.rows[0];
  await db.query(
    `INSERT INTO public.audit_logs (user_id, action, details, ip_address)
     VALUES ($1, $2, $3, $4)`,
    [adminUserId, "STAFF_CREATED", JSON.stringify({ targetUserId: staff.id, employeeId: staff.employee_id }), ipAddress || null]
  );
  return staff;
}

async function updateStaff(userId, data, adminUserId, ipAddress) {
  const { fullName, employeeId, email, password, department, role, status } = data;
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedEmployeeId = employeeId.trim().toUpperCase();
  const existing = await db.query(
    `SELECT id FROM public.users
     WHERE (email = $1 OR employee_id = $2) AND id != $3`,
    [normalizedEmail, normalizedEmployeeId, userId]
  );

  if (existing.rows.length > 0) {
    const error = new Error("Email or Staff ID is already assigned.");
    error.statusCode = 409;
    throw error;
  }

  const values = [fullName.trim(), normalizedEmail, normalizedEmployeeId, role.toUpperCase(), department.trim(), (status || "ACTIVE").toUpperCase(), userId];
  let query = `UPDATE public.users
               SET full_name = $1, email = $2, employee_id = $3, role = $4,
                   department = $5, status = $6, updated_at = CURRENT_TIMESTAMP`;
  if (password) {
    values.splice(6, 0, await bcrypt.hash(password, 10));
    query += ", password_hash = $7 WHERE id = $8";
  } else {
    query += " WHERE id = $7";
  }
  query += `
    AND role != 'ADMIN' AND role != 'CUSTOMER'
    RETURNING id, full_name, email, employee_id, role, status, department, created_at, updated_at`;

  const result = await db.query(query, values);
  if (result.rows.length === 0) {
    const error = new Error("Staff member not found.");
    error.statusCode = 404;
    throw error;
  }

  const staff = result.rows[0];
  await db.query(
    `INSERT INTO public.audit_logs (user_id, action, details, ip_address)
     VALUES ($1, $2, $3, $4)`,
    [adminUserId, "STAFF_UPDATED", JSON.stringify({ targetUserId: staff.id, employeeId: staff.employee_id }), ipAddress || null]
  );
  return staff;
}

async function getWarehouses() {
  const result = await db.query(`
    SELECT id, name, address, latitude, longitude, is_active, created_at, updated_at
    FROM public.warehouses
    ORDER BY name ASC
  `);
  return result.rows;
}

async function createWarehouse(data, adminUserId, ipAddress) {
  const result = await db.query(`
    INSERT INTO public.warehouses (name, address, latitude, longitude, created_by)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, name, address, latitude, longitude, is_active, created_at, updated_at
  `, [
    data.name.trim(),
    data.address.trim(),
    Number(data.latitude),
    Number(data.longitude),
    adminUserId,
  ]);

  const warehouse = result.rows[0];
  await db.query(
    `INSERT INTO public.audit_logs (user_id, action, details, ip_address)
     VALUES ($1, $2, $3, $4)`,
    [adminUserId, "WAREHOUSE_CREATED", JSON.stringify({ warehouseId: warehouse.id }), ipAddress || null]
  );
  return warehouse;
}

async function updateWarehouse(warehouseId, data, adminUserId, ipAddress) {
  const result = await db.query(`
    UPDATE public.warehouses
    SET name = $1,
        address = $2,
        latitude = $3,
        longitude = $4,
        is_active = $5,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $6
    RETURNING id, name, address, latitude, longitude, is_active, created_at, updated_at
  `, [
    data.name.trim(),
    data.address.trim(),
    Number(data.latitude),
    Number(data.longitude),
    data.isActive !== false,
    warehouseId,
  ]);

  if (result.rows.length === 0) {
    const error = new Error("Warehouse not found.");
    error.statusCode = 404;
    throw error;
  }

  const warehouse = result.rows[0];
  await db.query(
    `INSERT INTO public.audit_logs (user_id, action, details, ip_address)
     VALUES ($1, $2, $3, $4)`,
    [adminUserId, "WAREHOUSE_UPDATED", JSON.stringify({ warehouseId: warehouse.id }), ipAddress || null]
  );
  return warehouse;
}

module.exports = {
  getEmployeeRegistrations,
  approveEmployee,
  rejectEmployee,
  getAdminStats,
  getStaff,
  createStaff,
  updateStaff,
  getWarehouses,
  createWarehouse,
  updateWarehouse
};
