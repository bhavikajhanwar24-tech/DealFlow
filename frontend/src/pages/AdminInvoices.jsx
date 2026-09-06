import { useEffect, useState } from "react";
import {
  FileText,
  X,
  DollarSign,
  CheckCircle,
  Download,
  Eye,
  Building2,
  Calendar,
  CreditCard,
  Search,
  Filter,
  AlertCircle,
  TrendingUp,
  Clock,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const API_BASE = "http://localhost:5000/api";

export default function AdminInvoices() {
  const { token, user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  // Filter & Search states
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Payment Form states
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);

  const loadSummary = async () => {
    try {
      const res = await fetch(`${API_BASE}/invoices/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setSummary(data.data);
      }
    } catch (err) {
      console.error("Failed to load invoice summary:", err);
    }
  };

  const loadInvoices = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "ALL") params.append("status", statusFilter);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());

      const res = await fetch(`${API_BASE}/invoices?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unable to load invoices.");
      setInvoices(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
    loadSummary();
  }, [token, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadInvoices();
  };

  const fetchInvoiceDetails = async (id) => {
    setDetailLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/invoices/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setSelectedInvoice(data.data);
        setPaymentAmount(Math.max(0, Number(data.data.total) - Number(data.data.amount_paid)).toFixed(2));
      } else {
        throw new Error(data.message || "Failed to load invoice details.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDownloadPDF = async (invoiceId, invoiceNumber) => {
    setDownloadingId(invoiceId);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/invoices/${invoiceId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to download PDF invoice.");
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `${invoiceNumber || "Invoice"}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    setPaymentSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_BASE}/invoices/${selectedInvoice.id}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: Number(paymentAmount),
          paymentMethod,
          reference: paymentRef,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to record payment.");

      setSuccess(`Payment of INR ${Number(paymentAmount).toLocaleString("en-IN")} recorded successfully.`);
      setPaymentRef("");

      // Reload everything
      await fetchInvoiceDetails(selectedInvoice.id);
      await loadInvoices();
      await loadSummary();
    } catch (err) {
      setError(err.message);
    } finally {
      setPaymentSaving(false);
    }
  };

  const formatCurrency = (val) =>
    `₹${Number(val || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? String(dateStr) : d.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <main className="main-content admin-page">
      {/* Top Heading Banner */}
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Finance & Billing Hub</p>
          <h1>Invoices & Billing</h1>
          <p className="page-subtitle">
            Manage tax invoices, monitor outstanding balances, download PDFs, and record incoming payments.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              loadInvoices();
              loadSummary();
            }}
            style={{ width: "auto", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
          >
            <RotateCcw size={15} /> Refresh
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ borderRadius: "12px", marginBottom: "1.25rem" }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ borderRadius: "12px", marginBottom: "1.25rem" }}>{success}</div>}

      {/* KPI Metrics Summary Bar */}
      {summary && (
        <div className="metric-grid" style={{ marginBottom: "1.5rem" }}>
          <div className="metric-card">
            <div>
              <div className="metric-label">Total Invoiced</div>
              <div className="metric-value">{formatCurrency(summary.total_invoiced)}</div>
              <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.2rem" }}>
                Across {summary.total_invoices} total invoices
              </div>
            </div>
            <div className="metric-icon-wrap" style={{ background: "#eff6ff", color: "#2563eb" }}>
              <TrendingUp size={22} />
            </div>
          </div>

          <div className="metric-card">
            <div>
              <div className="metric-label">Total Collected</div>
              <div className="metric-value" style={{ color: "#166534" }}>{formatCurrency(summary.total_paid)}</div>
              <div style={{ fontSize: "0.75rem", color: "#16a34a", marginTop: "0.2rem" }}>
                ✓ {summary.paid_count} fully paid
              </div>
            </div>
            <div className="metric-icon-wrap" style={{ background: "#ecfdf5", color: "#16a34a" }}>
              <ShieldCheck size={22} />
            </div>
          </div>

          <div className="metric-card">
            <div>
              <div className="metric-label">Outstanding Balance</div>
              <div className="metric-value" style={{ color: "#d97706" }}>{formatCurrency(summary.total_outstanding)}</div>
              <div style={{ fontSize: "0.75rem", color: "#b45309", marginTop: "0.2rem" }}>
                ⏳ {summary.pending_count} pending settlement
              </div>
            </div>
            <div className="metric-icon-wrap" style={{ background: "#fffbeb", color: "#d97706" }}>
              <Clock size={22} />
            </div>
          </div>

          <div className="metric-card">
            <div>
              <div className="metric-label">Overdue Amount</div>
              <div className="metric-value" style={{ color: "#dc2626" }}>{formatCurrency(summary.overdue_amount)}</div>
              <div style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: "0.2rem" }}>
                {summary.overdue_count} past payment due date
              </div>
            </div>
            <div className="metric-icon-wrap" style={{ background: "#fef2f2", color: "#dc2626" }}>
              <AlertCircle size={22} />
            </div>
          </div>
        </div>
      )}

      {/* Main Invoices Table Card */}
      <div className="data-table-card">
        {/* Controls Bar: Search & Status Filters */}
        <div
          style={{
            padding: "1rem 1.35rem",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
            background: "#ffffff",
          }}
        >
          {/* Status Filter Tabs */}
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {[
              { id: "ALL", label: "All Invoices" },
              { id: "ISSUED", label: "Issued" },
              { id: "PARTIALLY_PAID", label: "Partially Paid" },
              { id: "PAID", label: "Paid" },
              { id: "OVERDUE", label: "Overdue" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                style={{
                  padding: "0.35rem 0.85rem",
                  borderRadius: "8px",
                  fontSize: "0.8125rem",
                  fontWeight: statusFilter === tab.id ? 700 : 500,
                  background: statusFilter === tab.id ? "#2563eb" : "#f8fafc",
                  color: statusFilter === tab.id ? "#ffffff" : "#475569",
                  border: `1px solid ${statusFilter === tab.id ? "#2563eb" : "#e2e8f0"}`,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <div style={{ position: "relative", minWidth: "240px" }}>
              <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: "32px", fontSize: "0.825rem", height: "35px" }}
                placeholder="Search invoice, customer, order..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-secondary" style={{ padding: "0.45rem 0.85rem", fontSize: "0.825rem" }}>
              Filter
            </button>
          </form>
        </div>

        {/* Table Content */}
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice Details</th>
                <th>Customer & Company</th>
                <th>Order Ref</th>
                <th>Total Value</th>
                <th>Paid / Balance Due</th>
                <th>Due Date</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="empty-state" style={{ padding: "3rem" }}>
                    Loading invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty-state" style={{ padding: "3rem" }}>
                    No invoices match the specified criteria.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const total = Number(inv.total || inv.grand_total || 0);
                  const paid = Number(inv.amount_paid || 0);
                  const balanceDue = Math.max(0, total - paid);

                  return (
                    <tr key={inv.id}>
                      <td>
                        <strong style={{ color: "#1d4ed8", fontSize: "0.9rem" }}>{inv.invoice_number}</strong>
                        <div style={{ color: "#64748b", fontSize: "0.75rem", marginTop: "0.15rem" }}>
                          Issued: {formatDate(inv.created_at || inv.invoice_date)}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>{inv.customer_name}</div>
                        <div style={{ color: "#64748b", fontSize: "0.75rem" }}>
                          {inv.company_name && inv.company_name !== inv.customer_name ? `${inv.company_name} · ` : ""}
                          {inv.customer_email}
                        </div>
                      </td>
                      <td>
                        <code style={{ fontSize: "0.8rem", background: "#f1f5f9", padding: "0.2rem 0.45rem", borderRadius: "4px" }}>
                          {inv.order_number}
                        </code>
                        {inv.quotation_number && (
                          <div style={{ fontSize: "0.725rem", color: "#64748b", marginTop: "0.2rem" }}>
                            Quote: {inv.quotation_number}
                          </div>
                        )}
                      </td>
                      <td style={{ fontWeight: 800, color: "#0f172a", fontSize: "0.925rem" }}>
                        {formatCurrency(total)}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: "#166534", fontSize: "0.85rem" }}>
                          Paid: {formatCurrency(paid)}
                        </div>
                        <div style={{ color: balanceDue > 0 ? "#dc2626" : "#166534", fontSize: "0.75rem", fontWeight: 600 }}>
                          Due: {formatCurrency(balanceDue)}
                        </div>
                      </td>
                      <td style={{ color: "#475569", fontSize: "0.825rem", whiteSpace: "nowrap" }}>
                        {formatDate(inv.due_date)}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            inv.status === "PAID"
                              ? "badge-approved"
                              : inv.status === "OVERDUE"
                              ? "badge-rejected"
                              : inv.status === "PARTIALLY_PAID"
                              ? "badge-pending"
                              : "badge-active"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => fetchInvoiceDetails(inv.id)}
                            style={{
                              padding: "0.3rem 0.65rem",
                              fontSize: "0.78rem",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.25rem",
                            }}
                            title="View Invoice Details"
                          >
                            <Eye size={14} /> View
                          </button>
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => handleDownloadPDF(inv.id, inv.invoice_number)}
                            disabled={downloadingId === inv.id}
                            style={{
                              padding: "0.3rem 0.65rem",
                              fontSize: "0.78rem",
                              width: "auto",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.25rem",
                            }}
                            title="Download PDF Invoice"
                          >
                            <Download size={14} /> {downloadingId === inv.id ? "Downloading..." : "PDF"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Details Modal / Drawer */}
      {selectedInvoice && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedInvoice(null)}
          style={{ zIndex: 1100 }}
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "880px",
              width: "95vw",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "2rem",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                paddingBottom: "1.25rem",
                borderBottom: "1px solid #e2e8f0",
                marginBottom: "1.5rem",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800, color: "#0f172a" }}>
                    Invoice {selectedInvoice.invoice_number}
                  </h2>
                  <span
                    className={`badge ${
                      selectedInvoice.status === "PAID"
                        ? "badge-approved"
                        : selectedInvoice.status === "OVERDUE"
                        ? "badge-rejected"
                        : selectedInvoice.status === "PARTIALLY_PAID"
                        ? "badge-pending"
                        : "badge-active"
                    }`}
                  >
                    {selectedInvoice.status}
                  </span>
                </div>
                <div style={{ color: "#64748b", fontSize: "0.825rem", marginTop: "0.35rem" }}>
                  Order: <strong>{selectedInvoice.order_number}</strong>
                  {selectedInvoice.quotation_number && ` · Quotation: ${selectedInvoice.quotation_number}`}
                  {` · Due: ${formatDate(selectedInvoice.due_date)}`}
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => handleDownloadPDF(selectedInvoice.id, selectedInvoice.invoice_number)}
                  disabled={downloadingId === selectedInvoice.id}
                  style={{
                    padding: "0.45rem 0.95rem",
                    fontSize: "0.85rem",
                    width: "auto",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                  }}
                >
                  <Download size={15} /> {downloadingId === selectedInvoice.id ? "Generating PDF..." : "Download Official PDF"}
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setSelectedInvoice(null)}
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Bill To & Ship To Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1rem" }}>
                <div style={{ fontWeight: 800, fontSize: "0.8rem", color: "#1e3a8a", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>
                  Bill To (Customer)
                </div>
                <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.95rem" }}>
                  {selectedInvoice.customer_name}
                </div>
                {selectedInvoice.company_name && (
                  <div style={{ fontSize: "0.825rem", color: "#475569" }}>{selectedInvoice.company_name}</div>
                )}
                <div style={{ fontSize: "0.825rem", color: "#64748b", marginTop: "0.25rem" }}>
                  {selectedInvoice.billing_address?.address || selectedInvoice.delivery_address || "Corporate Billing Address"}
                </div>
                <div style={{ fontSize: "0.825rem", color: "#64748b" }}>
                  {[
                    selectedInvoice.billing_address?.city,
                    selectedInvoice.billing_address?.state,
                    selectedInvoice.billing_address?.zip,
                    selectedInvoice.billing_address?.country,
                  ].filter(Boolean).join(", ")}
                </div>
                <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "0.25rem" }}>
                  {selectedInvoice.customer_email}
                </div>
              </div>

              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1rem" }}>
                <div style={{ fontWeight: 800, fontSize: "0.8rem", color: "#1e3a8a", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>
                  Ship To (Destination)
                </div>
                <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.95rem" }}>
                  {selectedInvoice.shipping_address?.recipientName || selectedInvoice.customer_name}
                </div>
                <div style={{ fontSize: "0.825rem", color: "#64748b", marginTop: "0.25rem" }}>
                  {selectedInvoice.shipping_address?.address || selectedInvoice.delivery_address || "Customer Delivery Address"}
                </div>
                <div style={{ fontSize: "0.825rem", color: "#64748b" }}>
                  {[
                    selectedInvoice.shipping_address?.city,
                    selectedInvoice.shipping_address?.state,
                    selectedInvoice.shipping_address?.zip,
                    selectedInvoice.shipping_address?.country,
                  ].filter(Boolean).join(", ")}
                </div>
                <div style={{ fontSize: "0.78rem", color: "#059669", fontWeight: 700, marginTop: "0.4rem" }}>
                  Payment Terms: {selectedInvoice.payment_terms || "NET_30"}
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "0.95rem", marginBottom: "0.65rem" }}>
                Invoice Line Items
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden" }}>
                <table className="data-table" style={{ margin: 0 }}>
                  <thead style={{ background: "#f8fafc" }}>
                    <tr>
                      <th>Product / Service</th>
                      <th style={{ textAlign: "center" }}>Qty</th>
                      <th style={{ textAlign: "right" }}>Unit Price</th>
                      <th style={{ textAlign: "right" }}>Discount %</th>
                      <th style={{ textAlign: "right" }}>Tax Rate</th>
                      <th style={{ textAlign: "right" }}>Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedInvoice.items || []).map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td>
                          <strong>{item.product_name}</strong>
                          {item.sku && <small style={{ display: "block", color: "#64748b", fontSize: "0.72rem" }}>SKU: {item.sku}</small>}
                        </td>
                        <td style={{ textAlign: "center" }}>{item.quantity}</td>
                        <td style={{ textAlign: "right" }}>{formatCurrency(item.unit_price)}</td>
                        <td style={{ textAlign: "right", color: item.discount_percent > 0 ? "#b91c1c" : "#64748b" }}>
                          {Number(item.discount_percent || 0).toFixed(1)}%
                        </td>
                        <td style={{ textAlign: "right" }}>{Number(item.tax_rate || 0).toFixed(0)}%</td>
                        <td style={{ textAlign: "right", fontWeight: 800 }}>{formatCurrency(item.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals Breakdown and Payment Recording Section */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }}>
              {/* Payment Recording Form & History */}
              <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1.25rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 800, color: "#0f172a", marginBottom: "0.85rem" }}>
                  <CreditCard size={17} color="#2563eb" /> Payment History & Settlement
                </div>

                {selectedInvoice.payments && selectedInvoice.payments.length > 0 ? (
                  <div style={{ marginBottom: "1rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    {selectedInvoice.payments.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                          padding: "0.55rem 0.75rem",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: "0.825rem",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, color: "#166534" }}>{formatCurrency(p.amount)}</div>
                          <div style={{ color: "#64748b", fontSize: "0.72rem" }}>
                            {p.payment_method} · {formatDate(p.payment_date)}
                            {p.reference && ` · Ref: ${p.reference}`}
                          </div>
                        </div>
                        <span className="badge badge-approved" style={{ fontSize: "0.68rem" }}>Recorded</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "#64748b", fontSize: "0.825rem", marginBottom: "1rem" }}>
                    No payments have been recorded for this invoice yet.
                  </div>
                )}

                {/* Record Payment Form (Admin/Finance only) */}
                {["ADMIN", "FINANCE", "OPERATIONS"].includes(user?.role) && selectedInvoice.status !== "PAID" && (
                  <form onSubmit={handleRecordPayment} style={{ borderTop: "1px dashed #e2e8f0", paddingTop: "0.85rem" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.6rem", color: "#1e293b" }}>
                      Record Incoming Payment
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem", marginBottom: "0.65rem" }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: "0.75rem" }}>Amount (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="1"
                          max={Number(selectedInvoice.total) - Number(selectedInvoice.amount_paid) + 0.01}
                          className="form-input"
                          style={{ fontSize: "0.825rem" }}
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: "0.75rem" }}>Method</label>
                        <select
                          className="form-select"
                          style={{ fontSize: "0.825rem" }}
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                        >
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="UPI">UPI</option>
                          <option value="Cheque">Cheque</option>
                          <option value="Card">Card</option>
                          <option value="Cash">Cash</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: "0.65rem" }}>
                      <label className="form-label" style={{ fontSize: "0.75rem" }}>Reference / Transaction ID</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. TXN-984021"
                        style={{ fontSize: "0.825rem" }}
                        value={paymentRef}
                        onChange={(e) => setPaymentRef(e.target.value)}
                      />
                    </div>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={paymentSaving}
                      style={{ width: "100%", padding: "0.45rem", fontSize: "0.85rem" }}
                    >
                      {paymentSaving ? "Recording Payment..." : "Record Payment & Settle"}
                    </button>
                  </form>
                )}
              </div>

              {/* Totals Summary Box */}
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1.25rem" }}>
                <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "0.95rem", marginBottom: "0.85rem" }}>
                  Invoice Summary
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", fontSize: "0.85rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
                    <span>Subtotal:</span>
                    <span>{formatCurrency(selectedInvoice.subtotal)}</span>
                  </div>
                  {Number(selectedInvoice.discount || selectedInvoice.discount_amount || 0) > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#b91c1c" }}>
                      <span>Discount:</span>
                      <span>-{formatCurrency(selectedInvoice.discount || selectedInvoice.discount_amount)}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
                    <span>Taxable Amount:</span>
                    <span>{formatCurrency(selectedInvoice.taxable_amount || Number(selectedInvoice.subtotal) - Number(selectedInvoice.discount || 0))}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
                    <span>GST / Taxes:</span>
                    <span>{formatCurrency(selectedInvoice.tax || selectedInvoice.tax_amount)}</span>
                  </div>
                  {Number(selectedInvoice.shipping_amount || 0) > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
                      <span>Shipping & Freight:</span>
                      <span>{formatCurrency(selectedInvoice.shipping_amount)}</span>
                    </div>
                  )}
                  <div style={{ borderTop: "1px solid #cbd5e1", margin: "0.3rem 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "1.05rem", color: "#0f172a" }}>
                    <span>Grand Total:</span>
                    <span>{formatCurrency(selectedInvoice.total || selectedInvoice.grand_total)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#166534", fontWeight: 700 }}>
                    <span>Amount Paid:</span>
                    <span>{formatCurrency(selectedInvoice.amount_paid)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: Math.max(0, Number(selectedInvoice.total) - Number(selectedInvoice.amount_paid)) > 0 ? "#dc2626" : "#166534", fontWeight: 800, fontSize: "0.95rem" }}>
                    <span>Balance Due:</span>
                    <span>{formatCurrency(Math.max(0, Number(selectedInvoice.total) - Number(selectedInvoice.amount_paid)))}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
