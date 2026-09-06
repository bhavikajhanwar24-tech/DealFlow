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
  const complaintCount = await db.query(`
    SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE status = 'PENDING')::int as pending
    FROM public.staff_complaints
  `);

  return {
    pendingApprovals: parseInt(counts.rows[0].pending_count, 10) || 0,
    activeEmployees: parseInt(counts.rows[0].active_employee_count, 10) || 0,
    totalCustomers: parseInt(counts.rows[0].customer_count, 10) || 0,
    rejectedEmployees: parseInt(counts.rows[0].rejected_count, 10) || 0,
    totalAuditLogs: parseInt(auditCount.rows[0].count, 10) || 0,
    pendingComplaints: complaintCount.rows[0]?.pending || 0,
    totalComplaints: complaintCount.rows[0]?.total || 0,
  };
}

async function getStaff(queryFilters = {}) {
  const { search, department, role, status } = queryFilters;
  let queryText = `
    SELECT id, full_name, email, phone, employee_id, department, designation, role, status,
           last_login, created_at, updated_at
    FROM public.users
    WHERE role != 'CUSTOMER'
  `;
  const params = [];

  if (search && String(search).trim()) {
    params.push(`%${String(search).trim().toLowerCase()}%`);
    queryText += ` AND (LOWER(full_name) LIKE $${params.length} OR LOWER(email) LIKE $${params.length} OR LOWER(COALESCE(employee_id, '')) LIKE $${params.length})`;
  }

  if (department && String(department).trim() && String(department).toUpperCase() !== "ALL") {
    params.push(String(department).trim());
    queryText += ` AND LOWER(department) = LOWER($${params.length})`;
  }

  if (role && String(role).trim() && String(role).toUpperCase() !== "ALL") {
    params.push(String(role).trim().toUpperCase());
    queryText += ` AND role = $${params.length}`;
  }

  if (status && String(status).trim() && String(status).toUpperCase() !== "ALL") {
    params.push(String(status).trim().toUpperCase());
    queryText += ` AND status = $${params.length}`;
  }

  queryText += ` ORDER BY created_at DESC`;
  const result = await db.query(queryText, params);
  return result.rows;
}

async function createStaff(data, adminUserId, ipAddress) {
  const { fullName, employeeId, email, phone, designation, password, department, role, status } = data;
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedEmployeeId = employeeId.trim().toUpperCase();
  const normalizedRole = role.toUpperCase();

  if (normalizedRole === "ADMIN") {
    const error = new Error("Creating unrestricted administrator accounts through staff management is not permitted.");
    error.statusCode = 403;
    throw error;
  }

  const existingEmail = await db.query(
    "SELECT id FROM public.users WHERE email = $1",
    [normalizedEmail]
  );
  if (existingEmail.rows.length > 0) {
    const error = new Error("This email is already associated with an account.");
    error.statusCode = 409;
    throw error;
  }

  const existingEmp = await db.query(
    "SELECT id FROM public.users WHERE employee_id = $1",
    [normalizedEmployeeId]
  );
  if (existingEmp.rows.length > 0) {
    const error = new Error("Employee ID is already registered to another staff member.");
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const accountStatus = (status || "ACTIVE").toUpperCase();

  const result = await db.query(`
    INSERT INTO public.users (
      full_name, email, phone, password_hash, employee_id, role, status, department, designation,
      approved_by, approved_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
    RETURNING id, full_name, email, phone, employee_id, role, status, department, designation, created_at
  `, [
    fullName.trim(),
    normalizedEmail,
    phone?.trim() || null,
    passwordHash,
    normalizedEmployeeId,
    normalizedRole,
    accountStatus,
    department.trim(),
    designation?.trim() || null,
    adminUserId
  ]);

  const staff = result.rows[0];
  await db.query(
    `INSERT INTO public.audit_logs (user_id, action, details, ip_address)
     VALUES ($1, $2, $3, $4)`,
    [
      adminUserId,
      "STAFF_CREATED",
      JSON.stringify({
        targetUserId: staff.id,
        employeeId: staff.employee_id,
        email: staff.email,
        name: staff.full_name,
        role: staff.role,
        department: staff.department
      }),
      ipAddress || null
    ]
  );
  return staff;
}

async function updateStaff(userId, data, adminUserId, ipAddress) {
  const existingUser = await db.query(
    "SELECT id, full_name, email, phone, employee_id, role, department, designation, status FROM public.users WHERE id = $1",
    [userId]
  );
  if (existingUser.rows.length === 0) {
    const error = new Error("Staff member not found.");
    error.statusCode = 404;
    throw error;
  }

  const current = existingUser.rows[0];
  const fullName = data.fullName !== undefined ? data.fullName.trim() : current.full_name;
  const normalizedEmail = data.email !== undefined ? data.email.trim().toLowerCase() : current.email;
  const normalizedEmployeeId = data.employeeId !== undefined ? data.employeeId.trim().toUpperCase() : current.employee_id;
  const phone = data.phone !== undefined ? (data.phone ? data.phone.trim() : null) : current.phone;
  const designation = data.designation !== undefined ? (data.designation ? data.designation.trim() : null) : current.designation;
  const department = data.department !== undefined ? data.department.trim() : current.department;
  const normalizedRole = data.role !== undefined ? data.role.toUpperCase() : current.role;
  const accountStatus = data.status !== undefined ? data.status.toUpperCase() : current.status;

  if (normalizedRole === "ADMIN") {
    const error = new Error("Elevating staff accounts to unrestricted administrator is not permitted.");
    error.statusCode = 403;
    throw error;
  }

  if (normalizedEmail !== current.email) {
    const existingEmail = await db.query(
      `SELECT id FROM public.users WHERE email = $1 AND id != $2`,
      [normalizedEmail, userId]
    );
    if (existingEmail.rows.length > 0) {
      const error = new Error("This email is already associated with an account.");
      error.statusCode = 409;
      throw error;
    }
  }

  if (normalizedEmployeeId && normalizedEmployeeId !== current.employee_id) {
    const existingEmp = await db.query(
      `SELECT id FROM public.users WHERE employee_id = $1 AND id != $2`,
      [normalizedEmployeeId, userId]
    );
    if (existingEmp.rows.length > 0) {
      const error = new Error("Employee ID is already registered to another staff member.");
      error.statusCode = 409;
      throw error;
    }
  }

  const oldRole = current.role;

  let query = `
    UPDATE public.users
    SET full_name = $1, email = $2, phone = $3, employee_id = $4, role = $5,
        department = $6, designation = $7, status = $8, updated_at = CURRENT_TIMESTAMP
  `;
  const values = [
    fullName,
    normalizedEmail,
    phone,
    normalizedEmployeeId,
    normalizedRole,
    department,
    designation,
    accountStatus
  ];

  if (data.password) {
    values.push(await bcrypt.hash(data.password, 10));
    query += `, password_hash = $${values.length}`;
  }

  values.push(userId);
  query += ` WHERE id = $${values.length} RETURNING id, full_name, email, phone, employee_id, role, status, department, designation, last_login, created_at, updated_at`;

  const result = await db.query(query, values);
  const staff = result.rows[0];

  await db.query(
    `INSERT INTO public.audit_logs (user_id, action, details, ip_address)
     VALUES ($1, $2, $3, $4)`,
    [
      adminUserId,
      "STAFF_UPDATED",
      JSON.stringify({
        targetUserId: staff.id,
        employeeId: staff.employee_id,
        email: staff.email,
        name: staff.full_name,
        role: staff.role,
        department: staff.department,
        status: staff.status
      }),
      ipAddress || null
    ]
  );

  if (oldRole !== staff.role) {
    await db.query(
      `INSERT INTO public.audit_logs (user_id, action, details, ip_address)
       VALUES ($1, $2, $3, $4)`,
      [
        adminUserId,
        "STAFF_ROLE_CHANGED",
        JSON.stringify({
          targetUserId: staff.id,
          employeeId: staff.employee_id,
          previousRole: oldRole,
          newRole: staff.role
        }),
        ipAddress || null
      ]
    );
  }

  return staff;
}

async function toggleStaffStatus(userId, status, adminUserId, ipAddress) {
  const targetStatus = String(status).toUpperCase();
  if (!["ACTIVE", "INACTIVE", "SUSPENDED"].includes(targetStatus)) {
    const error = new Error("Status must be ACTIVE or INACTIVE.");
    error.statusCode = 400;
    throw error;
  }

  const result = await db.query(
    `UPDATE public.users
     SET status = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING id, full_name, email, employee_id, role, status, department, designation`,
    [targetStatus, userId]
  );

  if (result.rows.length === 0) {
    const error = new Error("Staff member not found.");
    error.statusCode = 404;
    throw error;
  }

  const staff = result.rows[0];
  const actionName = targetStatus === "ACTIVE" ? "STAFF_ACTIVATED" : "STAFF_DEACTIVATED";

  await db.query(
    `INSERT INTO public.audit_logs (user_id, action, details, ip_address)
     VALUES ($1, $2, $3, $4)`,
    [
      adminUserId,
      actionName,
      JSON.stringify({
        targetUserId: staff.id,
        employeeId: staff.employee_id,
        name: staff.full_name,
        status: targetStatus
      }),
      ipAddress || null
    ]
  );

  return staff;
}

async function resetStaffPassword(userId, newPassword, adminUserId, ipAddress) {
  if (!newPassword || newPassword.length < 6) {
    const error = new Error("Password must be at least 6 characters long.");
    error.statusCode = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const result = await db.query(
    `UPDATE public.users
     SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING id, full_name, email, employee_id, role, status`,
    [passwordHash, userId]
  );

  if (result.rows.length === 0) {
    const error = new Error("Staff member not found.");
    error.statusCode = 404;
    throw error;
  }

  const staff = result.rows[0];
  await db.query(
    `INSERT INTO public.audit_logs (user_id, action, details, ip_address)
     VALUES ($1, $2, $3, $4)`,
    [
      adminUserId,
      "STAFF_PASSWORD_RESET",
      JSON.stringify({
        targetUserId: staff.id,
        employeeId: staff.employee_id,
        email: staff.email
      }),
      ipAddress || null
    ]
  );

  return staff;
}

function mapProduct(row) {
  return {
    id: row.id,
    name: row.name,
    productId: row.sku,
    sku: row.sku,
    category: row.category,
    description: row.description || "",
    sellingPrice: Number(row.unit_price),
    cost: Number(row.cost),
    quantity: Number(row.quantity || 0),
    inventoryReference: row.inventory_reference || "",
    status: row.is_active ? "ACTIVE" : "INACTIVE",
    currency: row.currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getProducts() {
  const result = await db.query(`
    SELECT id, name, sku, category, description, unit_price, cost,
           inventory_reference, quantity, is_active, currency, created_at, updated_at
    FROM public.products
    ORDER BY created_at DESC, name
  `);
  return result.rows.map(mapProduct);
}

async function createProduct(data, adminUserId, ipAddress) {
  const result = await db.query(`
    INSERT INTO public.products
      (name, sku, category, description, unit_price, cost, inventory_reference, is_active, quantity)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id, name, sku, category, description, unit_price, cost,
              inventory_reference, is_active, quantity, currency, created_at, updated_at
  `, [
    data.name.trim(), data.sku.trim().toUpperCase(), data.category.toUpperCase(),
    data.description?.trim() || null, Number(data.unitPrice), Number(data.cost),
    data.inventoryReference?.trim() || null,
    String(data.status || "ACTIVE").toUpperCase() === "ACTIVE",
    Number(data.quantity || 0)
  ]);
  const product = mapProduct(result.rows[0]);
  await db.query(
    `INSERT INTO public.audit_logs (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)`,
    [adminUserId, "PRODUCT_CREATED", JSON.stringify({ productId: product.id, sku: product.sku }), ipAddress || null]
  );
  return product;
}

async function updateProduct(productId, data, adminUserId, ipAddress) {
  const result = await db.query(`
    UPDATE public.products
    SET name = $1, category = $2, description = $3, unit_price = $4,
        cost = $5, inventory_reference = $6, is_active = $7, quantity = $8,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $9
    RETURNING id, name, sku, category, description, unit_price, cost,
              inventory_reference, is_active, quantity, currency, created_at, updated_at
  `, [
    data.name.trim(), data.category.toUpperCase(), data.description?.trim() || null,
    Number(data.unitPrice), Number(data.cost), data.inventoryReference?.trim() || null,
    String(data.status || "ACTIVE").toUpperCase() === "ACTIVE", Number(data.quantity || 0), productId
  ]);
  if (result.rows.length === 0) {
    const error = new Error("Product not found.");
    error.statusCode = 404;
    throw error;
  }
  const product = mapProduct(result.rows[0]);
  await db.query(
    `INSERT INTO public.audit_logs (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)`,
    [adminUserId, "PRODUCT_UPDATED", JSON.stringify({ productId: product.id, sku: product.sku }), ipAddress || null]
  );
  return product;
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

function mapDiscountPolicy(row) {
  return {
    id: row.id,
    customerTier: row.customer_tier,
    productCategory: row.product_category,
    maxDiscount: Number(row.max_discount),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getDiscountPolicies() {
  const result = await db.query(`
    SELECT id, customer_tier, product_category, max_discount, status, created_at, updated_at
    FROM public.discount_policies
    ORDER BY CASE customer_tier WHEN 'BRONZE' THEN 1 WHEN 'SILVER' THEN 2 WHEN 'GOLD' THEN 3 END,
             product_category
  `);
  return result.rows.map(mapDiscountPolicy);
}

async function createDiscountPolicy(data, adminUserId, ipAddress) {
  const result = await db.query(`
    INSERT INTO public.discount_policies (customer_tier, product_category, max_discount, status)
    VALUES ($1, $2, $3, $4)
    RETURNING id, customer_tier, product_category, max_discount, status, created_at, updated_at
  `, [
    data.customerTier.toUpperCase(), data.productCategory.trim().toUpperCase(), Number(data.maxDiscount),
    String(data.status || "ACTIVE").toUpperCase()
  ]);
  const policy = mapDiscountPolicy(result.rows[0]);
  await db.query(
    `INSERT INTO public.audit_logs (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)`,
    [adminUserId, "DISCOUNT_POLICY_CREATED", JSON.stringify({ policyId: policy.id, customerTier: policy.customerTier, productCategory: policy.productCategory }), ipAddress || null]
  );
  return policy;
}

async function updateDiscountPolicy(policyId, data, adminUserId, ipAddress) {
  const result = await db.query(`
    UPDATE public.discount_policies
    SET customer_tier = $1, product_category = $2, max_discount = $3, status = $4,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $5
    RETURNING id, customer_tier, product_category, max_discount, status, created_at, updated_at
  `, [
    data.customerTier.toUpperCase(), data.productCategory.trim().toUpperCase(), Number(data.maxDiscount),
    String(data.status || "ACTIVE").toUpperCase(), policyId
  ]);
  if (result.rows.length === 0) {
    const error = new Error("Discount policy not found.");
    error.statusCode = 404;
    throw error;
  }
  const policy = mapDiscountPolicy(result.rows[0]);
  await db.query(
    `INSERT INTO public.audit_logs (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)`,
    [adminUserId, "DISCOUNT_POLICY_UPDATED", JSON.stringify({ policyId: policy.id, customerTier: policy.customerTier, productCategory: policy.productCategory, status: policy.status }), ipAddress || null]
  );
  return policy;
}

async function getWarehouseInventory(warehouseId) {
  const result = await db.query(`
    SELECT wi.id, wi.warehouse_id, wi.product_id, wi.quantity,
           p.name, p.sku, p.category, p.unit_price, p.currency,
           wi.created_at, wi.updated_at
    FROM public.warehouse_inventory wi
    JOIN public.products p ON p.id = wi.product_id
    WHERE wi.warehouse_id = $1
    ORDER BY p.name ASC
  `, [warehouseId]);
  return result.rows;
}

async function upsertWarehouseInventory(warehouseId, data, adminUserId, ipAddress) {
  const warehouse = await db.query("SELECT id FROM public.warehouses WHERE id = $1", [warehouseId]);
  if (warehouse.rows.length === 0) {
    const error = new Error("Warehouse not found.");
    error.statusCode = 404;
    throw error;
  }

  const product = await db.query("SELECT id FROM public.products WHERE id = $1", [data.productId]);
  if (product.rows.length === 0) {
    const error = new Error("Product not found.");
    error.statusCode = 404;
    throw error;
  }

  const result = await db.query(`
    INSERT INTO public.warehouse_inventory (warehouse_id, product_id, quantity, updated_by)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (warehouse_id, product_id)
    DO UPDATE SET quantity = EXCLUDED.quantity,
                  updated_by = EXCLUDED.updated_by,
                  updated_at = CURRENT_TIMESTAMP
    RETURNING id, warehouse_id, product_id, quantity, updated_at
  `, [warehouseId, data.productId, Number(data.quantity), adminUserId]);

  await db.query(
    `INSERT INTO public.audit_logs (user_id, action, details, ip_address)
     VALUES ($1, $2, $3, $4)`,
    [adminUserId, "WAREHOUSE_INVENTORY_UPDATED", JSON.stringify({ warehouseId, productId: data.productId, quantity: Number(data.quantity) }), ipAddress || null]
  );

  const inventory = await getWarehouseInventory(warehouseId);
  return inventory.find((item) => item.id === result.rows[0].id) || result.rows[0];
}

async function removeWarehouseInventory(inventoryId, adminUserId, ipAddress) {
  const result = await db.query(
    "DELETE FROM public.warehouse_inventory WHERE id = $1 RETURNING warehouse_id, product_id",
    [inventoryId]
  );
  if (result.rows.length === 0) {
    const error = new Error("Warehouse inventory item not found.");
    error.statusCode = 404;
    throw error;
  }

  await db.query(
    `INSERT INTO public.audit_logs (user_id, action, details, ip_address)
     VALUES ($1, $2, $3, $4)`,
    [adminUserId, "WAREHOUSE_INVENTORY_REMOVED", JSON.stringify(result.rows[0]), ipAddress || null]
  );
}

async function getWarehouseAnalytics() {
  const warehouses = await db.query(`
    SELECT w.id, w.name,
           COUNT(DISTINCT wi.product_id)::INTEGER AS product_count,
           COALESCE(SUM(wi.quantity), 0)::INTEGER AS total_units,
           COALESCE(SUM(wi.quantity * p.unit_price), 0)::NUMERIC AS inventory_value
    FROM public.warehouses w
    LEFT JOIN public.warehouse_inventory wi ON wi.warehouse_id = w.id
    LEFT JOIN public.products p ON p.id = wi.product_id
    GROUP BY w.id, w.name
    ORDER BY w.name ASC
  `);

  const products = await db.query(`
    SELECT p.id, p.name,
           COALESCE(p.category, 'HARDWARE') AS category,
           COALESCE(SUM(wi.quantity), 0)::INTEGER AS total_units,
           COALESCE(SUM(wi.quantity * p.unit_price), 0)::NUMERIC AS inventory_value
    FROM public.products p
    JOIN public.warehouse_inventory wi ON wi.product_id = p.id
    GROUP BY p.id, p.name, p.category
    HAVING SUM(wi.quantity) > 0
    ORDER BY total_units DESC, p.name ASC
  `);

  const warehouseMix = await db.query(`
    SELECT w.id AS warehouse_id, w.name AS warehouse_name,
           p.id AS product_id, p.name AS product_name,
           COALESCE(p.category, 'HARDWARE') AS category,
           p.sku,
           SUM(wi.quantity)::INTEGER AS total_units,
           COALESCE(SUM(wi.quantity * p.unit_price), 0)::NUMERIC AS inventory_value
    FROM public.warehouse_inventory wi
    JOIN public.warehouses w ON w.id = wi.warehouse_id
    JOIN public.products p ON p.id = wi.product_id
    WHERE wi.quantity > 0
    GROUP BY w.id, w.name, p.id, p.name, p.category, p.sku
    ORDER BY w.name ASC, total_units DESC, p.name ASC
  `);

  return {
    warehouses: warehouses.rows,
    products: products.rows,
    warehouseMix: warehouseMix.rows,
  };
}

async function getAuditLogs(filters = {}) {
  const params = [];
  const conditions = [];
  if (filters.userId && String(filters.userId).trim()) {
    params.push(String(filters.userId).trim());
    conditions.push(`a.user_id = $${params.length}`);
  }
  if (filters.action && String(filters.action).trim()) {
    params.push(`%${String(filters.action).trim()}%`);
    conditions.push(`a.action ILIKE $${params.length}`);
  }
  if (filters.activityType && String(filters.activityType).trim()) {
    params.push(`${String(filters.activityType).trim()}%`);
    conditions.push(`a.action ILIKE $${params.length}`);
  }
  if (filters.dealId && String(filters.dealId).trim()) {
    params.push(`%${String(filters.dealId).trim()}%`);
    conditions.push(`a.details::text ILIKE $${params.length}`);
  }
  if (filters.from && String(filters.from).trim()) {
    params.push(String(filters.from).trim());
    conditions.push(`a.created_at >= $${params.length}::date`);
  }
  if (filters.to && String(filters.to).trim()) {
    params.push(String(filters.to).trim());
    conditions.push(`a.created_at < ($${params.length}::date + INTERVAL '1 day')`);
  }
  if (filters.search && String(filters.search).trim()) {
    params.push(`%${String(filters.search).trim()}%`);
    conditions.push(`(a.action ILIKE $${params.length} OR a.details::text ILIKE $${params.length} OR u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
  }
  const result = await db.query(`
    SELECT a.id, a.action, a.details, a.created_at, a.ip_address,
           u.id AS user_id, u.full_name AS user_name, u.email AS user_email
    FROM public.audit_logs a
    LEFT JOIN public.users u ON u.id = a.user_id
    ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
    ORDER BY a.created_at DESC
    LIMIT 500
  `, params);
  return result.rows.map((row) => ({
    id: row.id, action: row.action, details: row.details || {}, createdAt: row.created_at,
    user: row.user_id ? { id: row.user_id, name: row.user_name, email: row.user_email } : null
  }));
}

async function getBillingConfiguration() {
  const result = await db.query("SELECT * FROM public.billing_configuration WHERE id = TRUE");
  if (!result.rows.length) return null;
  const row = result.rows[0];
  return { currency: row.currency, invoicePrefix: row.invoice_prefix, paymentTerms: row.payment_terms, taxEnabled: row.tax_enabled, defaultTaxRate: Number(row.default_tax_rate), invoiceDuePeriod: row.invoice_due_period, updatedAt: row.updated_at };
}

async function updateBillingConfiguration(data, adminUserId, ipAddress) {
  const result = await db.query(`
    INSERT INTO public.billing_configuration (id, currency, invoice_prefix, payment_terms, tax_enabled, default_tax_rate, invoice_due_period, updated_by, updated_at)
    VALUES (TRUE, $1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO UPDATE SET currency = EXCLUDED.currency, invoice_prefix = EXCLUDED.invoice_prefix,
      payment_terms = EXCLUDED.payment_terms, tax_enabled = EXCLUDED.tax_enabled,
      default_tax_rate = EXCLUDED.default_tax_rate, invoice_due_period = EXCLUDED.invoice_due_period,
      updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `, [data.currency, data.invoicePrefix.trim(), data.paymentTerms, data.taxEnabled, Number(data.defaultTaxRate), Number(data.invoiceDuePeriod), adminUserId]);
  await db.query(`INSERT INTO public.audit_logs (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)`, [adminUserId, "BILLING_CONFIGURATION_UPDATED", JSON.stringify({ currency: data.currency, invoicePrefix: data.invoicePrefix, paymentTerms: data.paymentTerms, taxEnabled: data.taxEnabled, defaultTaxRate: Number(data.defaultTaxRate), invoiceDuePeriod: Number(data.invoiceDuePeriod) }), ipAddress || null]);
  const row = result.rows[0];
  return { currency: row.currency, invoicePrefix: row.invoice_prefix, paymentTerms: row.payment_terms, taxEnabled: row.tax_enabled, defaultTaxRate: Number(row.default_tax_rate), invoiceDuePeriod: row.invoice_due_period };
}

function mapPlan(row) { return { id: row.id, name: row.name, billingFrequency: row.billing_frequency, discountIncentive: Number(row.discount_incentive), status: row.status, createdAt: row.created_at, updatedAt: row.updated_at }; }

async function getSubscriptionPlans() { const result = await db.query("SELECT * FROM public.subscription_plans ORDER BY name"); return result.rows.map(mapPlan); }

async function createSubscriptionPlan(data, adminUserId, ipAddress) {
  const result = await db.query(`INSERT INTO public.subscription_plans (name, billing_frequency, discount_incentive, status) VALUES ($1, $2, $3, $4) RETURNING *`, [data.name.trim(), data.billingFrequency, Number(data.discountIncentive), data.status || "ACTIVE"]);
  const plan = mapPlan(result.rows[0]);
  await db.query(`INSERT INTO public.audit_logs (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)`, [adminUserId, "SUBSCRIPTION_PLAN_CREATED", JSON.stringify({ planId: plan.id, name: plan.name }), ipAddress || null]);
  return plan;
}

async function updateSubscriptionPlan(id, data, adminUserId, ipAddress) {
  const result = await db.query(`UPDATE public.subscription_plans SET name = $1, billing_frequency = $2, discount_incentive = $3, status = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *`, [data.name.trim(), data.billingFrequency, Number(data.discountIncentive), data.status, id]);
  if (!result.rows.length) { const error = new Error("Subscription plan not found."); error.statusCode = 404; throw error; }
  const plan = mapPlan(result.rows[0]);
  await db.query(`INSERT INTO public.audit_logs (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)`, [adminUserId, "SUBSCRIPTION_PLAN_UPDATED", JSON.stringify({ planId: plan.id, name: plan.name, status: plan.status }), ipAddress || null]);
  return plan;
}

async function getCustomerTiers() { const result = await db.query("SELECT id, name, description, status, created_at, updated_at FROM public.customer_tiers ORDER BY CASE name WHEN 'BRONZE' THEN 1 WHEN 'SILVER' THEN 2 WHEN 'GOLD' THEN 3 ELSE 4 END, name"); return result.rows; }

async function updateCustomerTier(id, data, adminUserId, ipAddress) {
  const result = await db.query(`UPDATE public.customer_tiers SET description = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *`, [data.description?.trim() || null, data.status, id]);
  if (!result.rows.length) { const error = new Error("Customer tier not found."); error.statusCode = 404; throw error; }
  const tier = result.rows[0];
  await db.query(`INSERT INTO public.audit_logs (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)`, [adminUserId, "CUSTOMER_TIER_UPDATED", JSON.stringify({ tierId: tier.id, name: tier.name, status: tier.status }), ipAddress || null]);
  return tier;
}

module.exports = {
  getEmployeeRegistrations,
  approveEmployee,
  rejectEmployee,
  getAdminStats,
  getStaff,
  createStaff,
  updateStaff,
  toggleStaffStatus,
  resetStaffPassword,
  getProducts,
  createProduct,
  updateProduct,
  getWarehouses,
  createWarehouse,
  updateWarehouse,
  getDiscountPolicies,
  createDiscountPolicy,
  updateDiscountPolicy,
  getWarehouseInventory,
  upsertWarehouseInventory,
  removeWarehouseInventory,
  getWarehouseAnalytics
  , getAuditLogs,
  getBillingConfiguration,
  updateBillingConfiguration,
  getSubscriptionPlans,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  getCustomerTiers,
  updateCustomerTier
};
