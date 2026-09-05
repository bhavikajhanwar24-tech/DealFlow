const express = require("express");
const router = express.Router();

const controller = require("../controllers/recommendation.controller");
const { requireAuth, requireActiveUser } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

router.use(requireAuth, requireActiveUser, requireRole("SALES_REP", "SALES_MANAGER", "ADMIN"));

// Get upsell/cross-sell recommendations
router.post("/", controller.getRecommendations);

module.exports = router;
