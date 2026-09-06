const express = require("express");
const router = express.Router();
const aiController = require("../controllers/ai.controller");
const { requireAuth, requireActiveUser } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

router.use(requireAuth);
router.use(requireActiveUser);

router.post("/negotiation-copilot", requireRole("ADMIN", "SALES_MANAGER", "SALES_REP"), aiController.analyzeNegotiation);
router.post("/deal-health-explanation", requireRole("ADMIN", "FINANCE", "OPERATIONS", "SALES_MANAGER"), aiController.explainDealHealth);
router.post("/pricing-recommendation", requireRole("ADMIN", "SALES_MANAGER", "SALES_REP"), aiController.recommendPricing);
router.post("/sales-insights", requireRole("ADMIN", "FINANCE", "OPERATIONS", "SALES_MANAGER"), aiController.getSalesInsights);
router.get("/smart-alerts", requireRole("ADMIN", "SALES_MANAGER"), aiController.getSmartAlerts);
router.get("/test", requireRole("ADMIN", "SALES_MANAGER", "SALES_REP"), aiController.testConnection);

module.exports = router;
