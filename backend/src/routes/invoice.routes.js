const express = require("express");
const router = express.Router();
const invoiceController = require("../controllers/invoice.controller");
const { requireAuth, requireActiveUser } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

router.use(requireAuth);
router.use(requireActiveUser);
router.use(requireRole("ADMIN", "FINANCE", "OPERATIONS", "SALES_MANAGER"));

router.post("/generate", invoiceController.generateInvoice);
router.get("/", invoiceController.getInvoices);
router.get("/:id", invoiceController.getInvoiceDetails);
router.post("/:id/payments", invoiceController.recordPayment);

module.exports = router;
