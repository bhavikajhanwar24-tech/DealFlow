import { useEffect, useState, useMemo } from "react";
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
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import RevenueMarginChart from "../components/RevenueMarginChart";
import { exportToCSV, printOrExportPDF } from "../utils/exportUtils";

const API_BASE = "http://localhost:5000/api";
const currency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function SalesDashboard({ onNavigate }) {
  const { token, user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [quotations, setQuotations] = useState([]);
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
      const [summaryRes, quotesRes] = await Promise.all([
        fetch(`${API_BASE}/quotations/dashboard-summary`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/quotations`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const summaryData = await summaryRes.json();
      const quotesData = await quotesRes.json();

      if (!summaryRes.ok) throw new Error(summaryData.message || "Unable to load dashboard summary.");
      if (!quotesRes.ok) throw new Error(quotesData.message || "Unable to load quotations list.");

      setSummary(summaryData.data);
      setQuotations(quotesData.data || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [token]);

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
            Real-time quotation governance, revenue analytics, margin tracking, and official export reports.
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

      {error && <div className="alert alert-danger" style={{ marginBottom: "1.5rem" }}>{error}</div>}

      {/* KPI Metric Cards */}
      <div className="metric-grid" style={{ marginBottom: "2rem" }}>
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
            <p style={{ color: "#64748b", fontSize: "0.825rem", margin: "0.25rem 0 0" }}>
              Filter sales deals by period, approval stage, and search query. Download as CSV/XLS or formatted PDF.
            </p>
          </div>

          {/* Export Buttons */}
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleExportCSV}
              style={{ padding: "0.45rem 0.85rem", fontSize: "0.825rem", display: "inline-flex", gap: "0.35rem" }}
            >
              <Download size={15} color="#166534" /> Export CSV / XLS
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleExportPDF}
              style={{
                padding: "0.45rem 0.95rem",
                fontSize: "0.825rem",
                background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
                border: "none",
                display: "inline-flex",
                gap: "0.35rem",
              }}
            >
              <Printer size={15} /> Export / Print PDF
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
