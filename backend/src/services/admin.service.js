const db = require("../config/db");
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

module.exports = {
  getEmployeeRegistrations,
  approveEmployee,
  rejectEmployee,
  getAdminStats
};
