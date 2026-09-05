const express = require("express");
const router = express.Router();

const adminController = require("../controllers/admin.controller");
const { requireAuth, requireActiveUser } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");
const { validateRejection } = require("../validators/auth.validator");

// Apply authentication, active status, and ADMIN role to all routes in this router
router.use(requireAuth);
router.use(requireActiveUser);
router.use(requireRole("ADMIN"));

router.get("/employee-approvals", adminController.getEmployeeApprovals);
router.post("/employee-approvals/:id/approve", adminController.approveEmployee);
router.post(
  "/employee-approvals/:id/reject",
  validateRejection,
  adminController.rejectEmployee
);
router.get("/stats", adminController.getAdminStats);

module.exports = router;
