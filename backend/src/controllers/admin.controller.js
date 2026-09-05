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

module.exports = {
  getEmployeeApprovals,
  approveEmployee,
  rejectEmployee,
  getAdminStats
};
