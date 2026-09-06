const express = require("express");
const router = express.Router();

const quotationController = require("../controllers/quotation.controller");
const { requireAuth, requireActiveUser } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

const internalSales = requireRole("SALES_REP", "SALES_MANAGER", "ADMIN");
const salesCreators = requireRole("SALES_REP", "SALES_MANAGER", "ADMIN");

router.use(requireAuth, requireActiveUser);

router.get("/customers", internalSales, quotationController.getCustomers);
router.get("/products", internalSales, quotationController.getProducts);
router.get("/dashboard-summary", internalSales, quotationController.getDashboardSummary);
router.get("/customer-requests", internalSales, quotationController.listCustomerRequests);
router.post("/customer-requests/:requestId/convert", internalSales, quotationController.convertCustomerRequest);
router.get("/", internalSales, quotationController.listQuotations);
router.get("/:id", internalSales, quotationController.getQuotation);
router.post("/", salesCreators, quotationController.createQuotation);
router.put("/:id", salesCreators, quotationController.updateQuotation);
router.post("/risk-preview", salesCreators, quotationController.previewQuotationRisk);
router.post("/:id/apply-negotiation-suggestion", salesCreators, quotationController.applyNegotiationSuggestion);
router.post("/:id/recreate-from-ai", salesCreators, quotationController.applyAiQuoteUpdate);
router.post("/:id/submit", salesCreators, quotationController.submitQuotation);
router.post("/:id/finalize", internalSales, quotationController.finalizeQuotation);
router.post("/:id/negotiations/:negotiationId/respond", internalSales, quotationController.respondToNegotiation);

module.exports = router;
