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
    const staff = await adminService.getStaff();
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

module.exports = {
  getEmployeeApprovals,
  approveEmployee,
  rejectEmployee,
  getAdminStats,
  getStaff,
  createStaff,
  updateStaff,
  getProducts,
  createProduct,
  updateProduct,
  getWarehouses,
  createWarehouse,
  updateWarehouse
};
