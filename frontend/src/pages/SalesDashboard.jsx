import React, { useEffect, useState, useMemo } from "react";
import {
  ArrowRight,
  FilePlus2,
  ClipboardList,
  Activity,
  Download,
  Printer,
  FileSpreadsheet,
  FileText,
  Filter,
  Calendar,
  Search,
  TrendingUp,
  Settings2,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import RevenueMarginChart from "../components/RevenueMarginChart";
import CustomerRequestAiRecommendations from "../components/CustomerRequestAiRecommendations";
import { exportToCSV, printOrExportPDF, resetExportPreferences, promptExportDialog } from "../utils/exportUtils";

const API_BASE = "http://localhost:5000/api";
const currency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function SalesDashboard({ onNavigate }) {
  const { token, user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [quotations, setQuotations] = useState([]);
  const [customerRequests, setCustomerRequests] = useState([]);
  const [convertingId, setConvertingId] = useState(null);
  const [expandedRecId, setExpandedRecId] = useState(null);
  const [requestFilter, setRequestFilter] = useState("ALL"); // ALL, PENDING, AUTO_APPROVED
  const [actionSuccess, setActionSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Report filters
  const [periodFilter, setPeriodFilter] = useState("ALL"); // ALL, TODAY, WEEK, MONTH
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [summaryRes, quotesRes, requestsRes] = await Promise.all([
        fetch(`${API_BASE}/quotations/dashboard-summary`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/quotations`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/quotations/customer-requests`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => ({ ok: false })),
      ]);

      const summaryData = await summaryRes.json();
      const quotesData = await quotesRes.json();
      const requestsData = requestsRes.ok ? await requestsRes.json() : { data: [] };

      if (!summaryRes.ok) throw new Error(summaryData.message || "Unable to load dashboard summary.");
      if (!quotesRes.ok) throw new Error(quotesData.message || "Unable to load quotations list.");

      setSummary(summaryData.data);
      setQuotations(quotesData.data || []);
      setCustomerRequests(requestsData.data || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [token]);

  // Filter out customer requests whose deal is already confirmed/finalized by the customer
  const activeCustomerRequests = useMemo(() => {
    return customerRequests.filter((r) => {
      if (r.status === "CONFIRMED" || r.status === "REJECTED") return false;
      if (
        r.quotation_status === "CONFIRMED" ||
        r.quotation_status === "FINALIZED" ||
        r.quotation_status === "REJECTED"
      )
        return false;
      return true;
    });
  }, [customerRequests]);

  async function handleConvertRequest(requestId, recItem = null) {
    setConvertingId(requestId);
    setError("");
    setActionSuccess("");
    try {
      const body = recItem ? { additionalItems: [recItem] } : {};
      const response = await fetch(`${API_BASE}/quotations/customer-requests/${requestId}/convert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to convert customer request into quotation.");

      setCustomerRequests((current) =>
        current.map((req) =>
          req.id === requestId
            ? {
                ...req,
                status: "CONVERTED",
                quotation_id: data.data.id,
                quotation_number: data.data.quotationNumber,
                quotation_status: data.data.status,
              }
            : req
        )
      );
      setQuotations((current) => {
        const filtered = current.filter((q) => q.id !== data.data.id);
        return [data.data, ...filtered];
      });
      setActionSuccess(
        `⚡ Success: Quotation ${data.data.quotationNumber} has been generated${
          recItem ? ` including recommended add-on "${recItem.name}"` : ""
        } and added to Quotation & Deal Export Reports table below!`
      );

      // Refresh summary and data
      loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setConvertingId(null);
    }
  }

  // Filtered quotations for reporting
  const filteredQuotes = useMemo(() => {
    const now = new Date();
    return quotations.filter((q) => {
      // Status filter
      if (statusFilter !== "ALL" && q.status !== statusFilter) return false;

      // Period filter
      if (periodFilter !== "ALL") {
        const qDate = new Date(q.createdAt || q.created_at);
        if (periodFilter === "TODAY") {
          if (qDate.toDateString() !== now.toDateString()) return false;
        } else if (periodFilter === "WEEK") {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (qDate < sevenDaysAgo) return false;
        } else if (periodFilter === "MONTH") {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (qDate < thirtyDaysAgo) return false;
        }
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const qNum = (q.quotationNumber || q.quotation_number || "").toLowerCase();
        const cName = (q.customer?.companyName || q.customer?.fullName || q.customer_name || "").toLowerCase();
        const repName = (q.salesRep?.fullName || q.sales_rep_name || "").toLowerCase();
        return qNum.includes(query) || cName.includes(query) || repName.includes(query);
      }

      return true;
    });
  }, [quotations, statusFilter, periodFilter, searchQuery]);

  // Total sales revenue from filtered
  const totalFilteredRevenue = useMemo(() => {
    return filteredQuotes.reduce((acc, q) => acc + Number(q.finalAmount || q.final_amount || 0), 0);
  }, [filteredQuotes]);

  // Export to CSV
  const handleExportCSV = () => {
    const exportData = filteredQuotes.map((q) => ({
      quotationNumber: q.quotationNumber || q.quotation_number,
      customer: q.customer?.companyName || q.customer?.fullName || q.customer_name || "N/A",
      customerCode: q.customer?.customerCode || "N/A",
      salesRep: q.salesRep?.fullName || q.sales_rep_name || "N/A",
      subtotal: Number(q.subtotal || 0).toFixed(2),
      discount: Number(q.discountAmount || q.discount_amount || 0).toFixed(2),
      finalAmount: Number(q.finalAmount || q.final_amount || 0).toFixed(2),
      status: q.status,
      createdDate: new Date(q.createdAt || q.created_at).toLocaleDateString("en-IN"),
    }));

    const headers = [
      { key: "quotationNumber", label: "Quotation Ref" },
      { key: "customer", label: "Customer Name" },
      { key: "customerCode", label: "Customer Code" },
      { key: "salesRep", label: "Sales Rep" },
      { key: "subtotal", label: "Subtotal (INR)" },
      { key: "discount", label: "Discount (INR)" },
      { key: "finalAmount", label: "Final Amount (INR)" },
      { key: "status", label: "Approval Status" },
      { key: "createdDate", label: "Created Date" },
    ];

    exportToCSV("Sales_Quotations_Report", exportData, headers);
  };

  // Export to PDF / Print Report
  const handleExportPDF = () => {
    const exportData = filteredQuotes.map((q) => ({
      quotationNumber: q.quotationNumber || q.quotation_number,
      customer: q.customer?.companyName || q.customer?.fullName || q.customer_name || "N/A",
      salesRep: q.salesRep?.fullName || q.sales_rep_name || "N/A",
      amount: currency(q.finalAmount || q.final_amount),
      status: q.status,
      createdDate: new Date(q.createdAt || q.created_at).toLocaleDateString("en-IN"),
    }));

    const headers = [
      { key: "quotationNumber", label: "Quotation Ref" },
      { key: "customer", label: "Customer" },
      { key: "salesRep", label: "Sales Rep" },
      { key: "amount", label: "Final Amount" },
      { key: "status", label: "Status" },
      { key: "createdDate", label: "Date" },
    ];

    const summaryCards = [
      { label: "Total Quotations", value: filteredQuotes.length, color: "#2563eb" },
      { label: "Pipeline Value", value: currency(totalFilteredRevenue), color: "#166534" },
      { label: "Pending Approvals", value: summary?.pendingApprovals ?? 0, color: "#f59e0b" },
      { label: "Active Deals", value: summary?.openQuotations ?? 0, color: "#7c3aed" },
    ];

    const metadata = [
      { label: "Generated By", value: user?.full_name || "Sales Operator" },
      { label: "Period Filter", value: periodFilter },
      { label: "Status Filter", value: statusFilter },
    ];

    printOrExportPDF({
      title: "Sales Performance & Quotations Report",
      subtitle: `Official export of ${filteredQuotes.length} quotations representing ${currency(totalFilteredRevenue)} total value.`,
      metadata,
      headers,
      rows: exportData,
      summaryCards,
    });
  };

  const cards = [
    [
      "Inbound Customer RFQs",
      summary?.pendingCustomerRequests ?? customerRequests.length,
      "Awaiting quote generation",
      (customerRequests.length > 0 || (summary?.pendingCustomerRequests ?? 0) > 0) ? "#8b5cf6" : "#64748b",
    ],
    [
      "Pending Approvals",
      summary?.pendingApprovals ?? "...",
      "Quotes awaiting review",
      "#f59e0b",
    ],
    [
      "Open Quotations",
      summary?.openQuotations ?? "...",
      "Drafts and active quotes",
      "#2563eb",
    ],
    [
      "Total Pipeline Value",
      currency(totalFilteredRevenue),
      "Filtered quotation revenue",
      "#10b981",
    ],
    [
      "At-Risk Deals",
      summary?.atRiskDeals ?? 0,
      "Deal margin risk alerts",
      "#ef4444",
    ],
  ];

  return (
    <main className="main-content">
      {/* Heading Row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "1.75rem",
        }}
      >
        <div>
          <div
            style={{
              color: "#2563eb",
              fontSize: "0.75rem",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Sales Workspace & Operations
          </div>
          <h1
            style={{
              fontSize: "1.95rem",
              fontWeight: 800,
              color: "#0f172a",
              marginTop: "0.35rem",
            }}
          >
            Sales Performance Dashboard
          </h1>
          <p style={{ color: "#64748b", marginTop: "0.4rem" }}>
            Real-time quotation governance, customer RFQ conversion, revenue analytics, and deal management.
          </p>
        </div>

        {/* Top Quick Actions */}
        <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
          <button
            className="btn-primary"
            style={{ width: "auto" }}
            onClick={() => onNavigate("/sales/quotations/new")}
          >
            <FilePlus2 size={16} /> New Quotation
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="alert alert-success" style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess("")} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 800, color: "#166534" }}>✕</button>
        </div>
      )}

      {error && <div className="alert alert-danger" style={{ marginBottom: "1.5rem" }}>{error}</div>}

      {/* KPI Metric Cards */}
      <div className="metric-grid" style={{ marginBottom: "2rem", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {cards.map(([label, value, detail, color]) => (
          <div
            className="metric-card"
            key={label}
            style={{ borderTop: `3px solid ${color}` }}
          >
            <div>
              <div className="metric-label">{label}</div>
              <div className="metric-value">{loading ? "..." : value}</div>
              <div
                style={{
                  color: "#94a3b8",
                  fontSize: "0.75rem",
                  marginTop: "0.25rem",
                }}
              >
                {detail}
              </div>
            </div>
            <Activity size={22} color={color} />
          </div>
        ))}
      </div>

      {/* INBOUND CUSTOMER QUOTATION REQUESTS & AI RECOMMENDATIONS HUB */}
      <section
        style={{
          background: "#ffffff",
          border: customerRequests.length > 0 ? "1.5px solid #c4b5fd" : "1px solid var(--border-light)",
          borderRadius: "16px",
          padding: "1.5rem",
          boxShadow: customerRequests.length > 0 ? "0 10px 25px -5px rgba(139, 92, 246, 0.12)" : "var(--shadow-sm)",
          marginBottom: "2rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
            marginBottom: "1.25rem",
            paddingBottom: "0.85rem",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <ClipboardList size={20} color="#7c3aed" />
              <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                Inbound Customer Quotation Requests
              </h2>
              {activeCustomerRequests.length > 0 && (
                <span className="badge badge-pending" style={{ background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe", fontWeight: 800 }}>
                  {activeCustomerRequests.length} Active Request{activeCustomerRequests.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <p style={{ color: "#64748b", fontSize: "0.825rem", margin: "0.25rem 0 0" }}>
              Customer quotation inquiries received from the portal. AI generates real-time recommendations. Once approved and confirmed by the customer, deals automatically graduate to the Quotation & Deal Export Reports ledger below.
            </p>
          </div>

          {/* Request Status Tabs */}
          {activeCustomerRequests.length > 0 && (
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {[
                { key: "ALL", label: `All Active (${activeCustomerRequests.length})` },
                {
                  key: "PENDING",
                  label: `Pending Review (${activeCustomerRequests.filter((r) => r.status === "PENDING").length})`,
                },
                {
                  key: "AUTO_APPROVED",
                  label: `Auto-Approved / Converting (${
                    activeCustomerRequests.filter((r) => r.status === "AUTO_APPROVED" || r.status === "CONVERTED").length
                  })`,
                },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setRequestFilter(tab.key)}
                  style={{
                    padding: "0.35rem 0.75rem",
                    borderRadius: "8px",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    border: "1px solid",
                    borderColor: requestFilter === tab.key ? "#7c3aed" : "#e2e8f0",
                    background: requestFilter === tab.key ? "#f5f3ff" : "#ffffff",
                    color: requestFilter === tab.key ? "#7c3aed" : "#64748b",
                    transition: "all 0.15s ease",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {activeCustomerRequests.length === 0 ? (
          <div
            style={{
              padding: "2rem",
              textAlign: "center",
              background: "#f8fafc",
              borderRadius: "12px",
              border: "1px dashed #cbd5e1",
              color: "#64748b",
            }}
          >
            <div style={{ fontWeight: 700, color: "#334155", marginBottom: "0.25rem" }}>
              ✨ All customer quotation requests are processed!
            </div>
            <div style={{ fontSize: "0.825rem" }}>
              All customer requests have been approved, converted, or confirmed into active deals in the Quotation & Deal Export Reports table below.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date & Customer</th>
                  <th>Status</th>
                  <th>Requested Items</th>
                  <th>Est. Value</th>
                  <th>Target Delivery & Notes</th>
                  <th style={{ textAlign: "right" }}>AI Suggestions & Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeCustomerRequests
                  .filter((req) => {
                    if (requestFilter === "PENDING") return req.status === "PENDING";
                    if (requestFilter === "AUTO_APPROVED")
                      return req.status === "AUTO_APPROVED" || req.status === "CONVERTED";
                    return true;
                  })
                  .map((req) => {
                    const isExpanded = expandedRecId === req.id;
                    const isPending = req.status === "PENDING";
                    const isAutoApproved = req.status === "AUTO_APPROVED";
                    const isConverted = req.status === "CONVERTED";

                    return (
                      <React.Fragment key={req.id}>
                        <tr style={{ background: isExpanded ? "#faf5ff" : "rgba(245, 243, 255, 0.4)" }}>
                          <td>
                            <div style={{ fontWeight: 800, color: "#0f172a" }}>
                              {req.customer_name || req.company_name || "Customer"}
                            </div>
                            <div style={{ color: "#64748b", fontSize: "0.75rem" }}>
                              {req.company_name && req.company_name !== req.customer_name ? `${req.company_name} · ` : ""}
                              {req.email}
                            </div>
                            <div style={{ color: "#94a3b8", fontSize: "0.72rem", marginTop: "0.15rem" }}>
                              Received:{" "}
                              {new Date(req.created_at).toLocaleDateString("en-IN", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </td>
                          <td>
                            {isPending && (
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  background: "#fef3c7",
                                  color: "#b45309",
                                  border: "1px solid #fde68a",
                                  padding: "0.2rem 0.55rem",
                                  borderRadius: "6px",
                                  fontWeight: 700,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                ⏳ Pending Review
                              </span>
                            )}
                            {isAutoApproved && (
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  background: "#ecfdf5",
                                  color: "#047857",
                                  border: "1px solid #a7f3d0",
                                  padding: "0.2rem 0.55rem",
                                  borderRadius: "6px",
                                  fontWeight: 700,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                ✓ Auto-Approved
                              </span>
                            )}
                            {isConverted && (
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  background: "#eff6ff",
                                  color: "#1d4ed8",
                                  border: "1px solid #bfdbfe",
                                  padding: "0.2rem 0.55rem",
                                  borderRadius: "6px",
                                  fontWeight: 700,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                ✓ Converted
                              </span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                              {(req.items || []).map((item, idx) => (
                                <span
                                  key={idx}
                                  style={{
                                    fontSize: "0.78rem",
                                    background: "#ffffff",
                                    padding: "0.2rem 0.5rem",
                                    borderRadius: "6px",
                                    border: "1px solid #e2e8f0",
                                    display: "inline-flex",
                                    gap: "0.4rem",
                                    alignItems: "center",
                                  }}
                                >
                                  <strong>{item.name}</strong>
                                  <span style={{ color: "#7c3aed", fontWeight: 700 }}>×{item.quantity}</span>
                                </span>
                              ))}
                            </div>
                          </td>
                          <td style={{ fontWeight: 800, color: "#166534", fontSize: "0.9rem" }}>
                            {currency(req.estimatedTotal)}
                          </td>
                          <td style={{ fontSize: "0.8rem", color: "#475569" }}>
                            <div>
                              <strong>Delivery: </strong>
                              {req.requested_delivery_date
                                ? new Date(req.requested_delivery_date).toLocaleDateString("en-IN")
                                : "Standard"}
                            </div>
                            {req.customer_comment && (
                              <div style={{ fontSize: "0.76rem", color: "#64748b", marginTop: "0.2rem" }}>
                                “{req.customer_comment}”
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: "0.4rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => setExpandedRecId(isExpanded ? null : req.id)}
                                style={{
                                  padding: "0.35rem 0.65rem",
                                  fontSize: "0.78rem",
                                  background: isExpanded ? "#ede9fe" : "#f5f3ff",
                                  color: "#6d28d9",
                                  borderColor: "#c4b5fd",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.3rem",
                                  fontWeight: 700,
                                }}
                              >
                                <Sparkles size={14} color="#7c3aed" />
                                {isExpanded ? "Hide AI Suggestions" : "✨ AI Recommendations"}
                                {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                              </button>

                              {isPending && (
                                <button
                                  className="btn-primary"
                                  style={{
                                    padding: "0.35rem 0.75rem",
                                    fontSize: "0.78rem",
                                    background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                                    border: "none",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.3rem",
                                  }}
                                  disabled={convertingId === req.id}
                                  onClick={() => handleConvertRequest(req.id)}
                                >
                                  {convertingId === req.id ? "Converting..." : "⚡ Approve & Quote"}
                                </button>
                              )}

                              {(isAutoApproved || isConverted) && req.quotation_number && (
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  onClick={() => onNavigate("/sales/quotations")}
                                  style={{
                                    padding: "0.35rem 0.65rem",
                                    fontSize: "0.78rem",
                                    background: "#ecfdf5",
                                    color: "#065f46",
                                    borderColor: "#a7f3d0",
                                    fontWeight: 700,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.25rem",
                                  }}
                                >
                                  {req.quotation_number} <ArrowRight size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expandable AI Recommendations Panel */}
                        {isExpanded && (
                          <tr>
                            <td colSpan="6" style={{ padding: "0 0.5rem 1rem", background: "#faf5ff", borderTop: "none" }}>
                              <CustomerRequestAiRecommendations
                                request={req}
                                token={token}
                                onApproveWithItem={(id, rec) => handleConvertRequest(id, rec)}
                                onQuotationUpdated={(updatedQuote) => {
                                  setQuotations((current) =>
                                    current.map((q) => (q.id === updatedQuote.id ? updatedQuote : q))
                                  );
                                  loadData();
                                }}
                                onNavigate={onNavigate}
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Analytics Feature: Revenue vs Margin Component */}
      <div style={{ marginBottom: "2rem" }}>
        <RevenueMarginChart analytics={summary?.analytics} onNavigate={onNavigate} />
      </div>

      {/* Section A7: Reporting & Export Dashboard Panel */}
      <section
        style={{
          background: "#ffffff",
          border: "1px solid var(--border-light)",
          borderRadius: "16px",
          padding: "1.5rem",
          boxShadow: "var(--shadow-sm)",
          marginBottom: "2rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
            marginBottom: "1.25rem",
            paddingBottom: "1rem",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <FileSpreadsheet size={20} color="#2563eb" />
              <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                Quotation & Deal Export Reports
              </h2>
            </div>
            
          </div>

          {/* Export Controls Layout: Export CSV & Configure Download in same line, Download PDF below */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.45rem" }}>
            {/* Row 1: Export CSV and Configure Download in same line */}
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleExportCSV}
                style={{
                  padding: "0.35rem 0.75rem",
                  fontSize: "0.8rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  height: "32px",
                  whiteSpace: "nowrap",
                }}
              >
                <Download size={14} color="#166534" /> Export CSV / XLS
              </button>
              <button
                type="button"
                onClick={async () => {
                  const config = await promptExportDialog({
                    defaultName: "Sales_Quotations_Report",
                    defaultFormat: "pdf",
                  });
                  if (config) {
                    setActionSuccess(`Download preferences updated: ${config.filename}.${config.format}`);
                  }
                }}
                title="Configure download name & format preferences"
                style={{
                  padding: "0.35rem 0.75rem",
                  fontSize: "0.8rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  background: "#f8fafc",
                  border: "1px solid #cbd5e1",
                  borderRadius: "7px",
                  color: "#334155",
                  cursor: "pointer",
                  fontWeight: 600,
                  height: "32px",
                  whiteSpace: "nowrap",
                }}
              >
                <Settings2 size={13} color="#2563eb" /> Configure Download
              </button>
            </div>

            {/* Row 2: Download PDF directly below Configure Download */}
            <button
              type="button"
              className="btn-primary"
              onClick={handleExportPDF}
              style={{
                padding: "0.4rem 0.95rem",
                fontSize: "0.825rem",
                background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
                border: "none",
                display: "inline-flex",
                gap: "0.35rem",
                alignItems: "center",
                height: "34px",
                whiteSpace: "nowrap",
              }}
            >
              <Download size={15} /> Download PDF
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: "1.25rem",
            background: "#f8fafc",
            padding: "0.75rem 1rem",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
          }}
        >
          {/* Period Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <Calendar size={15} color="#64748b" />
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#475569" }}>Period:</span>
            <select
              className="form-input no-icon"
              style={{ padding: "0.35rem 0.65rem", fontSize: "0.8rem", width: "auto" }}
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today</option>
              <option value="WEEK">Last 7 Days</option>
              <option value="MONTH">Last 30 Days</option>
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <Filter size={15} color="#64748b" />
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#475569" }}>Status:</span>
            <select
              className="form-input no-icon"
              style={{ padding: "0.35rem 0.65rem", fontSize: "0.8rem", width: "auto" }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">DRAFT</option>
              <option value="PENDING_APPROVAL">PENDING APPROVAL</option>
              <option value="APPROVED">APPROVED</option>
              <option value="NEGOTIATION">NEGOTIATION</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="FINALIZED">FINALIZED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>

          {/* Search Box */}
          <div style={{ flex: 1, minWidth: "220px", position: "relative" }}>
            <Search size={15} color="#94a3b8" style={{ position: "absolute", left: "10px", top: "10px" }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: "32px", fontSize: "0.8rem", height: "35px" }}
              placeholder="Search ref, customer, or rep..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>
            Showing <strong>{filteredQuotes.length}</strong> deals ({currency(totalFilteredRevenue)})
          </div>
        </div>

        {/* Filtered Data Table */}
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Quotation Ref</th>
                <th>Customer</th>
                <th>Sales Rep</th>
                <th>Final Amount</th>
                <th>Status</th>
                <th>Created Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: "center", padding: "2.5rem", color: "#64748b" }}>
                    Loading report data...
                  </td>
                </tr>
              ) : filteredQuotes.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: "center", padding: "2.5rem", color: "#64748b" }}>
                    No quotations match the active filter criteria.
                  </td>
                </tr>
              ) : (
                filteredQuotes.slice(0, 10).map((q) => (
                  <tr key={q.id}>
                    <td style={{ fontWeight: 800, color: "#1d4ed8" }}>
                      {q.quotationNumber || q.quotation_number}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>
                        {q.customer?.companyName || q.customer?.fullName || q.customer_name}
                      </div>
                      <div style={{ color: "#64748b", fontSize: "0.75rem" }}>
                        {q.customer?.customerCode}
                      </div>
                    </td>
                    <td>{q.salesRep?.fullName || q.sales_rep_name || "Assigned Rep"}</td>
                    <td style={{ fontWeight: 800, color: "#0f172a" }}>
                      {currency(q.finalAmount || q.final_amount)}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          q.status === "APPROVED" || q.status === "CONFIRMED"
                            ? "badge-approved"
                            : q.status === "REJECTED"
                            ? "badge-rejected"
                            : "badge-pending"
                        }`}
                      >
                        {q.status}
                      </span>
                    </td>
                    <td style={{ color: "#64748b", fontSize: "0.825rem" }}>
                      {new Date(q.createdAt || q.created_at).toLocaleDateString("en-IN")}
                    </td>
                    <td>
                      <button
                        className="btn-secondary"
                        style={{ padding: "0.3rem 0.65rem", fontSize: "0.78rem" }}
                        onClick={() => onNavigate(`/sales/quotations/${q.id}`)}
                      >
                        View <ArrowRight size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
