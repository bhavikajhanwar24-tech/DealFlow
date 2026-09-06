const complaintService = require("../services/complaint.service");

async function getStaffMembers(req, res) {
  try {
    const staff = await complaintService.getStaffMembers();
    return res.status(200).json({
      success: true,
      count: staff.length,
      data: staff,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to retrieve staff members.",
    });
  }
}

async function createComplaint(req, res) {
  try {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress;
    const complaint = await complaintService.createComplaint(req.user.id, req.body, ip);
    const isAutoRejected = complaint.is_auto_rejected || complaint.status === "REJECTED";
    const message = isAutoRejected
      ? `AI Compliance Screening: Complaint auto-rejected (${complaint.ai_result?.reason || "unrelated/non-business submission"}).`
      : "AI Compliance Screening: Complaint verified as genuine and forwarded to Executive Administrator for manual review.";
    return res.status(201).json({
      success: true,
      message,
      data: complaint,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to submit complaint.",
    });
  }
}

async function getCustomerComplaints(req, res) {
  try {
    const complaints = await complaintService.getCustomerComplaints(req.user.id);
    return res.status(200).json({
      success: true,
      count: complaints.length,
      data: complaints,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to retrieve your complaints.",
    });
  }
}

async function getAdminComplaints(req, res) {
  try {
    const { status, search } = req.query;
    const complaints = await complaintService.getAdminComplaints({ status, search });
    return res.status(200).json({
      success: true,
      count: complaints.length,
      data: complaints,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to retrieve complaints.",
    });
  }
}

async function getAdminComplaintStats(req, res) {
  try {
    const stats = await complaintService.getAdminComplaintStats();
    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to retrieve complaint statistics.",
    });
  }
}

async function takeActionOnComplaint(req, res) {
  try {
    const { id } = req.params;
    const { admin_notes } = req.body;
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress;

    const updated = await complaintService.takeActionOnComplaint(id, req.user.id, admin_notes, ip);
    return res.status(200).json({
      success: true,
      message: "Action taken successfully on complaint. The customer has been notified with your resolution note.",
      data: updated,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to take action on complaint.",
    });
  }
}

async function rejectComplaint(req, res) {
  try {
    const { id } = req.params;
    const { admin_notes } = req.body;
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress;

    const updated = await complaintService.rejectComplaint(id, req.user.id, admin_notes, ip);
    return res.status(200).json({
      success: true,
      message: "Complaint has been rejected with the provided reason for the customer.",
      data: updated,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to reject complaint.",
    });
  }
}

module.exports = {
  getStaffMembers,
  createComplaint,
  getCustomerComplaints,
  getAdminComplaints,
  getAdminComplaintStats,
  takeActionOnComplaint,
  rejectComplaint,
};
