const express = require("express");
const router = express.Router();

const quotationController = require("../controllers/quotation.controller");
const { requireAuth, requireActiveUser } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

const catalogAccess = [
	requireAuth,
	requireActiveUser,
	requireRole("SALES_REP", "SALES_MANAGER", "ADMIN"),
];

router.get("/customers", ...catalogAccess, quotationController.getCustomers);
router.get("/products", ...catalogAccess, quotationController.getProducts);

module.exports = router;
