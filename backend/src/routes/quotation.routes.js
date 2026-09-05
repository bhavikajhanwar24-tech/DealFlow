const express = require("express");
const router = express.Router();

const quotationController = require("../controllers/quotation.controller");
const { requireAuth, requireActiveUser } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

const internalSales = requireRole("SALES_REP", "SALES_MANAGER", "ADMIN");
const salesCreators = requireRole("SALES_REP", "SALES_MANAGER");

router.use(requireAuth, requireActiveUser);

router.get("/customers", internalSales, quotationController.getCustomers);
router.get("/products", internalSales, quotationController.getProducts);
router.get("/dashboard-summary", internalSales, quotationController.getDashboardSummary);
router.get("/", internalSales, quotationController.listQuotations);
router.get("/:id", internalSales, quotationController.getQuotation);
router.post("/", salesCreators, quotationController.createQuotation);

module.exports = router;
