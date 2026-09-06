const adminService = require("../services/admin.service");

async function getEmployeeApprovals(req, res) {
  try {
    const statusFilter = req.query.status;
    const approvals = await adminService.getEmployeeRegistrations(statusFilter);

    return res.status(200).json({
      success: true,
      count: approvals.length,
      data: approvals
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to retrieve employee approvals."
    });
  }
}

async function approveEmployee(req, res) {
  try {
    const { id } = req.params;
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const updated = await adminService.approveEmployee(id, req.user.id, ip);

    return res.status(200).json({
      success: true,
      message: `Employee ${updated.full_name} (${updated.employee_id}) has been successfully approved.`,
      data: updated
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to approve employee."
    });
  }
}

async function rejectEmployee(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const updated = await adminService.rejectEmployee(id, req.user.id, reason, ip);

    return res.status(200).json({
      success: true,
      message: `Employee ${updated.full_name} (${updated.employee_id}) registration has been rejected.`,
      data: updated
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to reject employee registration."
    });
  }
}

async function getAdminStats(req, res) {
  try {
    const stats = await adminService.getAdminStats();
    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to retrieve administrative statistics."
    });
  }
}

async function getStaff(req, res) {
  try {
    const staff = await adminService.getStaff(req.query);
    return res.status(200).json({ success: true, count: staff.length, data: staff });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || "Failed to retrieve staff." });
  }
}

async function createStaff(req, res) {
  try {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const staff = await adminService.createStaff(req.body, req.user.id, ip);
    return res.status(201).json({ success: true, message: "Staff account created successfully.", data: staff });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || "Failed to create staff account." });
  }
}

async function updateStaff(req, res) {
  try {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const staff = await adminService.updateStaff(req.params.id, req.body, req.user.id, ip);
    return res.status(200).json({ success: true, message: "Staff account updated successfully.", data: staff });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || "Failed to update staff account." });
  }
}

async function toggleStaffStatus(req, res) {
  try {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const staff = await adminService.toggleStaffStatus(req.params.id, req.body.status, req.user.id, ip);
    const message = staff.status === "ACTIVE"
      ? `Staff member ${staff.full_name} (${staff.employee_id}) activated successfully.`
      : `Staff member ${staff.full_name} (${staff.employee_id}) deactivated successfully.`;
    return res.status(200).json({ success: true, message, data: staff });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || "Failed to update staff status." });
  }
}

async function resetStaffPassword(req, res) {
  try {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const staff = await adminService.resetStaffPassword(req.params.id, req.body.password, req.user.id, ip);
    return res.status(200).json({ success: true, message: `Password reset successfully for ${staff.full_name}.`, data: staff });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || "Failed to reset staff password." });
  }
}

async function getProducts(req, res) {
  try {
    const products = await adminService.getProducts();
    return res.status(200).json({ success: true, count: products.length, data: products });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || "Failed to retrieve products." });
  }
}

async function createProduct(req, res) {
  try {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const product = await adminService.createProduct(req.body, req.user.id, ip);
    return res.status(201).json({ success: true, message: "Product created successfully.", data: product });
  } catch (error) {
    const statusCode = error.code === "23505" ? 409 : error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.code === "23505" ? "Product ID is already in use." : error.message || "Failed to create product." });
  }
}

async function updateProduct(req, res) {
  try {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const product = await adminService.updateProduct(req.params.id, req.body, req.user.id, ip);
    return res.status(200).json({ success: true, message: "Product updated successfully.", data: product });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || "Failed to update product." });
  }
}

async function getWarehouses(req, res) {
  try {
    const warehouses = await adminService.getWarehouses();
    return res.status(200).json({ success: true, count: warehouses.length, data: warehouses });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || "Failed to retrieve warehouses." });
  }
}

async function createWarehouse(req, res) {
  try {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const warehouse = await adminService.createWarehouse(req.body, req.user.id, ip);
    return res.status(201).json({ success: true, message: "Warehouse created successfully.", data: warehouse });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || "Failed to create warehouse." });
  }
}

async function updateWarehouse(req, res) {
  try {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const warehouse = await adminService.updateWarehouse(req.params.id, req.body, req.user.id, ip);
    return res.status(200).json({ success: true, message: "Warehouse updated successfully.", data: warehouse });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || "Failed to update warehouse." });
  }
}

async function getDiscountPolicies(req, res) {
  try {
    const policies = await adminService.getDiscountPolicies();
    return res.status(200).json({ success: true, count: policies.length, data: policies });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || "Failed to retrieve discount policies." });
  }
}

async function createDiscountPolicy(req, res) {
  try {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const policy = await adminService.createDiscountPolicy(req.body, req.user.id, ip);
    return res.status(201).json({ success: true, message: "Discount rule added successfully.", data: policy });
  } catch (error) {
    const duplicate = error.code === "23505";
    return res.status(duplicate ? 409 : error.statusCode || 500).json({ success: false, message: duplicate ? "A rule already exists for this customer tier and product category." : error.message || "Failed to create discount policy." });
  }
}

async function updateDiscountPolicy(req, res) {
  try {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const policy = await adminService.updateDiscountPolicy(req.params.id, req.body, req.user.id, ip);
    const isStatusChange = String(req.body.status || "").toUpperCase() === "INACTIVE" || String(req.body.status || "").toUpperCase() === "ACTIVE";
    const message = isStatusChange
      ? `Discount rule ${policy.status === "ACTIVE" ? "enabled" : "disabled"} successfully.`
      : "Discount ceiling updated successfully.";
    return res.status(200).json({ success: true, message, data: policy });
  } catch (error) {
    const duplicate = error.code === "23505";
    return res.status(duplicate ? 409 : error.statusCode || 500).json({ success: false, message: duplicate ? "A rule already exists for this customer tier and product category." : error.message || "Failed to update discount policy." });
  }
}

async function getWarehouseInventory(req, res) {
  try {
    const inventory = await adminService.getWarehouseInventory(req.params.id);
    return res.status(200).json({ success: true, count: inventory.length, data: inventory });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || "Failed to retrieve warehouse inventory." });
  }
}

async function upsertWarehouseInventory(req, res) {
  try {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const inventory = await adminService.upsertWarehouseInventory(req.params.id, req.body, req.user.id, ip);
    return res.status(200).json({ success: true, message: "Warehouse inventory saved successfully.", data: inventory });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || "Failed to save warehouse inventory." });
  }
}

async function removeWarehouseInventory(req, res) {
  try {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    await adminService.removeWarehouseInventory(req.params.inventoryId, req.user.id, ip);
    return res.status(200).json({ success: true, message: "Product removed from warehouse inventory." });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || "Failed to remove warehouse inventory." });
  }
}

async function getWarehouseAnalytics(req, res) {
  try {
    const analytics = await adminService.getWarehouseAnalytics();
    return res.status(200).json({ success: true, data: analytics });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || "Failed to retrieve warehouse analytics." });
  }
}

async function getAuditLogs(req, res) { try { return res.json({ success: true, data: await adminService.getAuditLogs(req.query) }); } catch (error) { return res.status(error.statusCode || 500).json({ success: false, message: error.message }); } }
async function getBillingConfiguration(req, res) { try { return res.json({ success: true, data: await adminService.getBillingConfiguration() }); } catch (error) { return res.status(error.statusCode || 500).json({ success: false, message: error.message }); } }
async function updateBillingConfiguration(req, res) { try { const ip = req.ip || req.socket.remoteAddress; return res.json({ success: true, message: "Billing configuration updated successfully.", data: await adminService.updateBillingConfiguration(req.body, req.user.id, ip) }); } catch (error) { return res.status(error.statusCode || 500).json({ success: false, message: error.message }); } }
async function getSubscriptionPlans(req, res) { try { return res.json({ success: true, data: await adminService.getSubscriptionPlans() }); } catch (error) { return res.status(error.statusCode || 500).json({ success: false, message: error.message }); } }
async function createSubscriptionPlan(req, res) { try { const plan = await adminService.createSubscriptionPlan(req.body, req.user.id, req.ip); return res.status(201).json({ success: true, message: "Subscription plan created successfully.", data: plan }); } catch (error) { return res.status(error.code === "23505" ? 409 : 500).json({ success: false, message: error.code === "23505" ? "Subscription plan already exists." : error.message }); } }
async function updateSubscriptionPlan(req, res) { try { const plan = await adminService.updateSubscriptionPlan(req.params.id, req.body, req.user.id, req.ip); return res.json({ success: true, message: `Subscription plan ${plan.status === "ACTIVE" ? "enabled" : "disabled"} successfully.`, data: plan }); } catch (error) { return res.status(error.code === "23505" ? 409 : error.statusCode || 500).json({ success: false, message: error.code === "23505" ? "Subscription plan already exists." : error.message }); } }
async function getCustomerTiers(req, res) { try { return res.json({ success: true, data: await adminService.getCustomerTiers() }); } catch (error) { return res.status(500).json({ success: false, message: error.message }); } }
async function updateCustomerTier(req, res) { try { const tier = await adminService.updateCustomerTier(req.params.id, req.body, req.user.id, req.ip); return res.json({ success: true, message: `Customer tier ${tier.status === "ACTIVE" ? "enabled" : "disabled"} successfully.`, data: tier }); } catch (error) { return res.status(error.statusCode || 500).json({ success: false, message: error.message }); } }

module.exports = {
  getEmployeeApprovals,
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
