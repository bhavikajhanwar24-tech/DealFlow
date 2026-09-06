const express = require("express");
const router = express.Router();

const complaintController = require("../controllers/complaint.controller");
const { requireAuth, requireActiveUser } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

// Base authentication and active check for all complaint routes
router.use(requireAuth);
router.use(requireActiveUser);

// 1. Customer & General Staff routes
// Get list of internal staff members who can be reported
router.get(
  "/staff-members",
  requireRole("CUSTOMER", "ADMIN", "SALES_REP", "SALES_MANAGER"),
  complaintController.getStaffMembers
);

// Customer lodge new complaint
router.post(
  "/",
  requireRole("CUSTOMER", "ADMIN"),
  complaintController.createComplaint
);

// Customer view their filed complaints
router.get(
  "/my",
  requireRole("CUSTOMER", "ADMIN"),
  complaintController.getCustomerComplaints
);

// 2. Administrator Complaints Management routes
// Admin view all complaints
router.get(
  "/admin",
  requireRole("ADMIN"),
  complaintController.getAdminComplaints
);

// Admin view complaint stats
router.get(
  "/admin/stats",
  requireRole("ADMIN"),
  complaintController.getAdminComplaintStats
);

// Admin take action on complaint
router.put(
  "/admin/:id/action",
  requireRole("ADMIN"),
  complaintController.takeActionOnComplaint
);

// Admin reject complaint
router.put(
  "/admin/:id/reject",
  requireRole("ADMIN"),
  complaintController.rejectComplaint
);

module.exports = router;
