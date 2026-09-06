const express = require("express");
const router = express.Router();
const invoiceController = require("../controllers/invoice.controller");
const { requireAuth, requireActiveUser } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

// Require authenticated and active session for all invoice endpoints
router.use(requireAuth);
router.use(requireActiveUser);

// 1. Dynamic summary / KPIs for Finance and Admin Dashboards
router.get(
  "/summary",
  requireRole("ADMIN", "FINANCE", "OPERATIONS", "SALES_MANAGER", "SALES_REP"),
  invoiceController.getFinanceSummary
);

// 2. Invoice Generation from Order (supports both POST /generate and POST /generate/:orderId)
router.post(
  "/generate/:orderId",
  requireRole("ADMIN", "FINANCE", "OPERATIONS", "SALES_MANAGER", "SALES_REP", "CUSTOMER"),
  invoiceController.generateInvoice
);

router.post(
  "/generate",
  requireRole("ADMIN", "FINANCE", "OPERATIONS", "SALES_MANAGER", "SALES_REP", "CUSTOMER"),
  invoiceController.generateInvoice
);

// 3. List Invoices with role-based filtering (Customers see own, Sales see assigned, Admin/Finance see all)
router.get(
  "/",
  requireRole("ADMIN", "FINANCE", "OPERATIONS", "SALES_MANAGER", "SALES_REP", "CUSTOMER"),
  invoiceController.getInvoices
);

// 4. Download / Stream PDF invoice
router.get(
  "/:id/pdf",
  requireRole("ADMIN", "FINANCE", "OPERATIONS", "SALES_MANAGER", "SALES_REP", "CUSTOMER"),
  invoiceController.downloadInvoicePDF
);

// 5. Get detailed invoice record with line items, address snapshots, and payment history
router.get(
  "/:id",
  requireRole("ADMIN", "FINANCE", "OPERATIONS", "SALES_MANAGER", "SALES_REP", "CUSTOMER"),
  invoiceController.getInvoiceDetails
);

// 6. Record Payment against invoice
router.post(
  "/:id/payments",
  requireRole("ADMIN", "FINANCE", "OPERATIONS", "SALES_MANAGER"),
  invoiceController.recordPayment
);

module.exports = router;
