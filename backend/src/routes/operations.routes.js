const express = require("express");
const router = express.Router();

const controller = require("../controllers/operations.controller");
const { requireAuth, requireActiveUser } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

router.use(requireAuth, requireActiveUser);

// Accessible by Operations, Admin, Sales Managers, and Sales Reps
router.get(
  "/warehouses",
  requireRole("OPERATIONS", "ADMIN", "SALES_MANAGER", "SALES_REP"),
  controller.listWarehouses
);

router.get(
  "/orders/:orderId/fulfillment-options",
  requireRole("OPERATIONS", "ADMIN", "SALES_MANAGER", "SALES_REP"),
  controller.getFulfillmentOptions
);

router.get(
  "/orders/:orderId/optimal-route",
  requireRole("OPERATIONS", "ADMIN", "SALES_MANAGER", "SALES_REP"),
  controller.getOptimalRoute
);

router.post(
  "/orders/:orderId/fulfillment/approve",
  requireRole("OPERATIONS", "ADMIN", "SALES_MANAGER", "SALES_REP"),
  controller.approveFulfillment
);

module.exports = router;
