const express = require("express");
const router = express.Router();

const adminController = require("../controllers/admin.controller");
const { requireAuth, requireActiveUser } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");
const {
  validateRejection,
  validateStaff,
  validateStaffUpdate,
  validateProduct,
  validateWarehouse,
  validateWarehouseInventory
} = require("../validators/auth.validator");

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
router.get("/staff", adminController.getStaff);
router.post("/staff", validateStaff, adminController.createStaff);
router.put("/staff/:id", validateStaffUpdate, adminController.updateStaff);
router.get("/products", adminController.getProducts);
router.post("/products", validateProduct, adminController.createProduct);
router.put("/products/:id", validateProduct, adminController.updateProduct);
router.get("/warehouses", adminController.getWarehouses);
router.post("/warehouses", validateWarehouse, adminController.createWarehouse);
router.put("/warehouses/:id", validateWarehouse, adminController.updateWarehouse);
router.get("/warehouses/analytics", adminController.getWarehouseAnalytics);
router.get("/warehouses/:id/inventory", adminController.getWarehouseInventory);
router.put("/warehouses/:id/inventory", validateWarehouseInventory, adminController.upsertWarehouseInventory);
router.delete("/warehouses/:id/inventory/:inventoryId", adminController.removeWarehouseInventory);

module.exports = router;
