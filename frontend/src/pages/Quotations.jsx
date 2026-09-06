import { useEffect, useState, useMemo } from "react";
import {
  FilePlus2,
  ArrowRight,
  Download,
  Printer,
  Search,
  Filter,
  Calendar,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { exportToCSV, printOrExportPDF } from "../utils/exportUtils";

const API_BASE = "http://localhost:5000/api";
const currency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Quotations({ onNavigate }) {
  const { token, user } = useAuth();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [customerRequests, setCustomerRequests] = useState([]);
  const [requestActionLoading, setRequestActionLoading] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [periodFilter, setPeriodFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  async function loadQuotations() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/quotations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Unable to load quotations.");
      setQuotations(data.data || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQuotations();
    if (["SALES_REP", "SALES_MANAGER", "ADMIN"].includes(user?.role)) {
      loadCustomerRequests();
    }
  }, [token]);

  async function loadCustomerRequests() {
    try {
      const response = await fetch(`${API_BASE}/quotations/customer-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) setCustomerRequests(data.data || []);
    } catch {
      // The quotation list remains usable if the optional request queue fails.
    }
  }

  async function convertRequest(requestId) {
    setRequestActionLoading(requestId);
    setError("");
    try {
      const response = await fetch(
        `${API_BASE}/quotations/customer-requests/${requestId}/convert`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.message || "Unable to create quotation from request.",
        );
      setCustomerRequests((current) =>
        current.filter((request) => request.id !== requestId),
      );
      setQuotations((current) => [data.data, ...current]);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRequestActionLoading(null);
    }
  }

  // Filtered quotations
  const filteredQuotations = useMemo(() => {
    const now = new Date();
    return quotations.filter((q) => {
      // Status
      if (statusFilter !== "ALL" && q.status !== statusFilter) return false;

      // Period
      if (periodFilter !== "ALL") {
        const qDate = new Date(q.createdAt || q.created_at);
        if (periodFilter === "TODAY") {
          if (qDate.toDateString() !== now.toDateString()) return false;
        } else if (periodFilter === "WEEK") {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (qDate < sevenDaysAgo) return false;
        }
      }

      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const qNum = (q.quotationNumber || "").toLowerCase();
        const cName = (q.customer?.companyName || q.customer?.fullName || "").toLowerCase();
        const repName = (q.salesRep?.fullName || "").toLowerCase();
        return qNum.includes(query) || cName.includes(query) || repName.includes(query);
      }

      return true;
    });
  }, [quotations, statusFilter, periodFilter, searchQuery]);

  const totalFilteredValue = useMemo(() => {
    return filteredQuotations.reduce((acc, q) => acc + Number(q.finalAmount || 0), 0);
  }, [filteredQuotations]);

  // Export to CSV
  const handleExportCSV = () => {
    const exportData = filteredQuotations.map((q) => ({
      quotationNumber: q.quotationNumber,
      customer: q.customer?.companyName || q.customer?.fullName || "N/A",
      customerCode: q.customer?.customerCode || "N/A",
      salesRep: q.salesRep?.fullName || "N/A",
      subtotal: Number(q.subtotal || 0).toFixed(2),
      discountAmount: Number(q.discountAmount || 0).toFixed(2),
      finalAmount: Number(q.finalAmount || 0).toFixed(2),
      status: q.status,
      createdDate: new Date(q.createdAt).toLocaleDateString("en-IN"),
    }));

    const headers = [
      { key: "quotationNumber", label: "Quotation Ref" },
      { key: "customer", label: "Customer" },
      { key: "customerCode", label: "Customer Code" },
      { key: "salesRep", label: "Sales Rep" },
      { key: "subtotal", label: "Subtotal (INR)" },
      { key: "discountAmount", label: "Discount (INR)" },
      { key: "finalAmount", label: "Final Amount (INR)" },
      { key: "status", label: "Status" },
      { key: "createdDate", label: "Created Date" },
    ];

    exportToCSV("Quotations_Ledger", exportData, headers);
  };

  // Export / Print PDF
  const handleExportPDF = () => {
    const exportData = filteredQuotations.map((q) => ({
      quotationNumber: q.quotationNumber,
      customer: q.customer?.companyName || q.customer?.fullName || "N/A",
      salesRep: q.salesRep?.fullName || "N/A",
      finalAmount: currency(q.finalAmount),
      status: q.status,
      createdDate: new Date(q.createdAt).toLocaleDateString("en-IN"),
    }));

    const headers = [
      { key: "quotationNumber", label: "Quotation Ref" },
      { key: "customer", label: "Customer" },
      { key: "salesRep", label: "Sales Rep" },
      { key: "finalAmount", label: "Final Amount" },
      { key: "status", label: "Status" },
      { key: "createdDate", label: "Created Date" },
    ];

    const summaryCards = [
      { label: "Total Quotations", value: filteredQuotations.length, color: "#2563eb" },
      { label: "Total Value", value: currency(totalFilteredValue), color: "#166534" },
    ];

    const metadata = [
      { label: "Exported By", value: user?.full_name || "Sales User" },
      { label: "Status Filter", value: statusFilter },
    ];

    printOrExportPDF({
      title: "Quotations Registry & Pipeline Report",
      subtitle: `Official export of ${filteredQuotations.length} quotations.`,
      metadata,
      headers,
      rows: exportData,
      summaryCards,
    });
  };

  return (
    <main className="main-content">
      {/* Top Banner */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "1.5rem",
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
            Sales Workspace
          </div>
          <h1
            style={{
              fontSize: "1.95rem",
              fontWeight: 800,
              color: "#0f172a",
              marginTop: "0.35rem",
            }}
          >
            Quotations
          </h1>
          <p style={{ color: "#64748b", marginTop: "0.4rem" }}>
            Create, govern, export, and manage customer quotations.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleExportCSV}
            style={{ padding: "0.45rem 0.85rem", fontSize: "0.825rem", display: "inline-flex", gap: "0.35rem" }}
          >
            <Download size={15} color="#166534" /> Export CSV
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleExportPDF}
            style={{ padding: "0.45rem 0.85rem", fontSize: "0.825rem", display: "inline-flex", gap: "0.35rem", alignItems: "center" }}
          >
            <Download size={15} color="#2563eb" /> Download PDF
          </button>
          <button
            className="btn-primary"
            style={{ width: "auto" }}
            onClick={() => onNavigate("/sales/quotations/new")}
          >
            <FilePlus2 size={16} /> New Quotation
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: "1rem" }}>{error}</div>}

      {/* Customer Inbound Requests (if any) */}
      {customerRequests.length > 0 && (
        <section
          style={{
            background: "#fff",
            border: "1px solid #bfdbfe",
            borderRadius: "16px",
            padding: "1.25rem 1.5rem",
            marginBottom: "1.25rem",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <h2
            style={{
              fontSize: "1.1rem",
              fontWeight: 800,
              marginBottom: "0.75rem",
            }}
          >
            Customer Quotation Requests
          </h2>
          {customerRequests.map((request) => (
            <div
              key={request.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem",
                flexWrap: "wrap",
                padding: "0.85rem 0",
                borderBottom: "1px solid #eef2f7",
              }}
            >
              <div>
                <strong>{request.company_name || request.customer_name}</strong>
                <div
                  style={{
                    color: "#64748b",
                    fontSize: "0.8rem",
                    marginTop: "0.25rem",
                  }}
                >
                  {request.items
                    .map((item) => `${item.name} × ${item.quantity}`)
                    .join(", ")}
                  {request.requested_delivery_date &&
                    ` · Delivery by ${request.requested_delivery_date}`}
                </div>
                {request.customer_comment && (
                  <div
                    style={{
                      color: "#475569",
                      fontSize: "0.8rem",
                      marginTop: "0.25rem",
                    }}
                  >
                    “{request.customer_comment}”
                  </div>
                )}
              </div>
              {user?.role === "SALES_REP" ||
              user?.role === "SALES_MANAGER" ||
              user?.role === "ADMIN" ? (
                <button
                  className="btn-primary"
                  style={{ width: "auto" }}
                  onClick={() => convertRequest(request.id)}
                  disabled={requestActionLoading === request.id}
                >
                  {requestActionLoading === request.id
                    ? "Creating..."
                    : "Create Quotation"}
                </button>
              ) : (
                <span className="badge badge-pending">Ready for review</span>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Filter Controls Bar */}
      <div className="data-table-card">
        <div
          style={{
            padding: "0.85rem 1.25rem",
            borderBottom: "1px solid #e2e8f0",
            background: "#f8fafc",
            display: "flex",
            gap: "0.75rem",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
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
            Showing <strong>{filteredQuotations.length}</strong> quotes ({currency(totalFilteredValue)})
          </div>
        </div>

        {/* Data Table */}
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Quotation Number</th>
                <th>Customer</th>
                <th>Sales Rep</th>
                <th>Total</th>
                <th>Status</th>
                <th>Created Date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="7"
                    style={{
                      textAlign: "center",
                      padding: "3rem",
                      color: "#64748b",
                    }}
                  >
                    Loading quotations...
                  </td>
                </tr>
              ) : null}
              {!loading && filteredQuotations.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    style={{
                      textAlign: "center",
                      padding: "3rem",
                      color: "#64748b",
                    }}
                  >
                    No quotations match the active criteria.
                  </td>
                </tr>
              ) : null}
              {!loading &&
                filteredQuotations.map((quotation) => (
                  <tr
                    key={quotation.id}
                    onClick={() =>
                      onNavigate(`/sales/quotations/${quotation.id}`)
                    }
                    style={{ cursor: "pointer" }}
                  >
                    <td style={{ fontWeight: 800, color: "#1d4ed8" }}>
                      {quotation.quotationNumber}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>
                        {quotation.customer?.companyName ||
                          quotation.customer?.fullName}
                      </div>
                      <div style={{ color: "#64748b", fontSize: "0.75rem" }}>
                        {quotation.customer?.customerCode}
                      </div>
                    </td>
                    <td>{quotation.salesRep?.fullName}</td>
                    <td style={{ fontWeight: 800 }}>
                      {currency(quotation.finalAmount)}
                    </td>
                    <td>
                      <div>
                        <span
                          className={`badge ${
                            quotation.status === "APPROVED" || quotation.status === "CONFIRMED"
                              ? "badge-approved"
                              : quotation.status === "REJECTED"
                              ? "badge-rejected"
                              : "badge-active"
                          }`}
                        >
                          {quotation.status}
                        </span>
                        {quotation.customerRequest && (
                          <div
                            style={{
                              color: "#b45309",
                              fontSize: "0.72rem",
                              marginTop: "0.35rem",
                              maxWidth: "180px",
                            }}
                          >
                            Customer response:{" "}
                            {quotation.customerRequest.status}
                            {quotation.customerRequest
                              .requestedDiscountPercent !== null &&
                              ` · ${quotation.customerRequest.requestedDiscountPercent}% requested`}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ color: "#64748b" }}>
                      {new Date(quotation.createdAt).toLocaleDateString(
                        "en-IN",
                      )}
                    </td>
                    <td>
                      <ArrowRight size={16} color="#94a3b8" />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
