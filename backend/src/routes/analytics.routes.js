const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analytics.controller");
const { requireAuth, requireActiveUser } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

router.use(requireAuth);
router.use(requireActiveUser);
router.use(requireRole("ADMIN", "FINANCE", "OPERATIONS", "SALES_MANAGER"));

router.get("/deal-health", analyticsController.getDealHealth);
router.get("/reports", analyticsController.getReports);
router.get("/activity-feed", analyticsController.getActivityFeed);

module.exports = router;
