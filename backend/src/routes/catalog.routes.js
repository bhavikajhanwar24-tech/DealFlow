const express = require("express");
const router = express.Router();

const quotationController = require("../controllers/quotation.controller");
const { requireAuth, requireActiveUser } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

router.get(
	"/customers",
	requireAuth,
	requireActiveUser,
	requireRole("SALES_REP", "SALES_MANAGER", "ADMIN"),
	quotationController.getCustomers
);

router.get(
	"/products",
	requireAuth,
	requireActiveUser,
	requireRole("SALES_REP", "SALES_MANAGER", "ADMIN", "CUSTOMER"),
	quotationController.getProducts
);

module.exports = router;
