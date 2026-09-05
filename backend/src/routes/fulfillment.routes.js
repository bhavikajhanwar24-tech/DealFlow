const express = require("express");
const router = express.Router();

const controller = require("../controllers/fulfillment.controller");
const { requireAuth, requireActiveUser } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

router.use(requireAuth, requireActiveUser, requireRole("SALES_REP", "SALES_MANAGER", "ADMIN", "OPERATIONS"));
router.get("/orders", controller.listOrders);
router.get("/warehouses", controller.listWarehouses);
router.get("/orders/:id", controller.getOrder);
router.post("/orders/:id/manual-split", controller.manualSplit);
router.post("/orders/:id/consolidate-backorder", controller.consolidate);

module.exports = router;
