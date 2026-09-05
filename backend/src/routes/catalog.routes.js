const express = require("express");
const router = express.Router();

const quotationController = require("../controllers/quotation.controller");
const { requireAuth, requireActiveUser } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

router.use(requireAuth, requireActiveUser, requireRole("SALES_REP", "SALES_MANAGER", "ADMIN"));
router.get("/customers", quotationController.getCustomers);
router.get("/products", quotationController.getProducts);

module.exports = router;
