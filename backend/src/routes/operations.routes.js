const express = require("express");
const router = express.Router();

const controller = require("../controllers/operations.controller");
const { requireAuth, requireActiveUser } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

router.use(requireAuth, requireActiveUser);

// Accessible by Operations, Admin, and Sales Managers
router.get(
  "/warehouses",
  requireRole("OPERATIONS", "ADMIN", "SALES_MANAGER"),
  controller.listWarehouses
);

router.get(
  "/orders/:orderId/fulfillment-options",
  requireRole("OPERATIONS", "ADMIN", "SALES_MANAGER"),
  controller.getFulfillmentOptions
);

router.get(
  "/orders/:orderId/optimal-route",
  requireRole("OPERATIONS", "ADMIN", "SALES_MANAGER"),
  controller.getOptimalRoute
);

router.post(
  "/orders/:orderId/fulfillment/approve",
  requireRole("OPERATIONS", "ADMIN", "SALES_MANAGER"),
  controller.approveFulfillment
);

module.exports = router;
