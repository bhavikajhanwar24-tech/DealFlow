const express = require("express");
const router = express.Router();

const { requireAuth, requireActiveUser } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

// Sales workspace data
router.get(
  "/sales/dashboard",
  requireAuth,
  requireActiveUser,
  requireRole("SALES_REP", "SALES_MANAGER", "ADMIN"),
  (req, res) => {
    res.status(200).json({
      success: true,
      role: req.user.role,
      user: {
        id: req.user.id,
        fullName: req.user.full_name,
        employeeId: req.user.employee_id,
        department: req.user.department
      },
      summary: {
        activeDeals: 14,
        pipelineValue: "₹45,80,000",
        pendingDiscountApprovals: 3,
        winRate: "68%"
      },
      deals: [
        { id: "DEAL-901", title: "Laptop Pro - 85,000 x 10", customer: "Infosys Labs", value: "₹8,50,000", status: "Negotiation" },
        { id: "DEAL-902", title: "Support Plan - 12,000 x 5", customer: "Wipro Digital", value: "₹60,000", status: "Draft" },
        { id: "DEAL-903", title: "Cloud Migration Enterprise", customer: "Tata Tech", value: "₹24,80,000", status: "Approved" }
      ]
    });
  }
);

// Finance workspace data
router.get(
  "/finance/dashboard",
  requireAuth,
  requireActiveUser,
  requireRole("FINANCE", "ADMIN"),
  (req, res) => {
    res.status(200).json({
      success: true,
      role: req.user.role,
      user: {
        id: req.user.id,
        fullName: req.user.full_name,
        employeeId: req.user.employee_id,
        department: req.user.department
      },
      summary: {
        totalRevenue: "₹1,42,50,000",
        pendingInvoices: 8,
        collectedThisMonth: "₹38,20,000",
        overdueCount: 2
      }
    });
  }
);

// Operations workspace data
router.get(
  "/operations/dashboard",
  requireAuth,
  requireActiveUser,
  requireRole("OPERATIONS", "ADMIN"),
  (req, res) => {
    res.status(200).json({
      success: true,
      role: req.user.role,
      user: {
        id: req.user.id,
        fullName: req.user.full_name,
        employeeId: req.user.employee_id,
        department: req.user.department
      },
      summary: {
        activeFulfillments: 22,
        slaCompliance: "99.2%",
        pendingDeliveries: 5,
        completedDeliveries: 114
      }
    });
  }
);

// Customer portal data (strictly for customer)
router.get(
  "/customer/portal",
  requireAuth,
  requireActiveUser,
  requireRole("CUSTOMER"),
  (req, res) => {
    res.status(200).json({
      success: true,
      role: req.user.role,
      customer: {
        id: req.user.id,
        fullName: req.user.full_name,
        companyName: req.user.company_name,
        email: req.user.email
      },
      quotations: [
        { id: "QTN-2025-001", description: "B2B Hardware Supply Package", amount: "₹24,80,000", status: "Awaiting Confirmation", validUntil: "2026-10-15" },
        { id: "QTN-2024-884", description: "Annual Software SLA & Support", amount: "₹3,20,000", status: "Accepted", validUntil: "2025-12-31" }
      ]
    });
  }
);

module.exports = router;
