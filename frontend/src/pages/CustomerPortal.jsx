import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle,
  Lock,
  MessageSquare,
  Send,
  AlertCircle,
  XCircle,
  Plus,
  Trash2,
  FileText,
  Clock,
  Building2,
  Calendar,
  DollarSign,
  Package,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const API_BASE = "http://localhost:5000/api";
const currency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const statusBadgeClass = (status) => {
  switch (status) {
    case "APPROVED":
    case "CONFIRMED":
      return "badge-approved";
    case "NEGOTIATION":
    case "PENDING":
      return "badge-pending";
    case "REJECTED":
      return "badge-rejected";
    default:
      return "badge-draft";
  }
};

const statusLabel = {
  DRAFT: "Draft - Awaiting Review",
  APPROVED: "Approved by Sales",
  NEGOTIATION: "Under Negotiation",
  CONFIRMED: "Confirmed Order",
  REJECTED: "Declined / Rejected",
};

export default function CustomerPortal() {
  const { user, token } = useAuth();
  const [quotations, setQuotations] = useState([]);
  const [selectedQuotationId, setSelectedQuotationId] = useState(null);
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [requestedDiscountPercent, setRequestedDiscountPercent] = useState("");
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState("");
  const [customerComment, setCustomerComment] = useState("");
  const [products, setProducts] = useState([]);
  const [requestItems, setRequestItems] = useState([]);
  const [requestProductId, setRequestProductId] = useState("");
  const [requestQuantity, setRequestQuantity] = useState(1);
  const [requestDeliveryDate, setRequestDeliveryDate] = useState("");
  const [requestComment, setRequestComment] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [customerRequests, setCustomerRequests] = useState([]);

  async function loadQuotations() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/customer/quotations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load your quotations.");
      setQuotations(data.data || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function openQuotation(id) {
    setSelectedQuotationId(id);
    setDetailLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`${API_BASE}/customer/quotations/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          response.status === 403
            ? "You do not have permission to access this quotation."
            : data.message || "Quotation not found.",
        );
      setQuotation(data.data);
      const pending = data.data.negotiations?.find((request) => request.status === "PENDING");
      if (pending) {
        setRequestedDiscountPercent(pending.requestedDiscountPercent ?? "");
        setRequestedDeliveryDate(pending.requestedDeliveryDate || "");
        setCustomerComment(pending.customerComment || "");
      } else {
        setRequestedDiscountPercent("");
        setRequestedDeliveryDate("");
        setCustomerComment("");
      }
    } catch (requestError) {
      setError(requestError.message);
      setQuotation(null);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    loadQuotations();
    async function loadRequestData() {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [productsResponse, requestsResponse] = await Promise.all([
          fetch(`${API_BASE}/customer/quotations/products`, { headers }),
          fetch(`${API_BASE}/customer/quotations/requests`, { headers }),
        ]);
        const productsData = await productsResponse.json();
        const requestsData = await requestsResponse.json();
        if (!productsResponse.ok) throw new Error(productsData.message || "Unable to load products.");
        if (!requestsResponse.ok) throw new Error(requestsData.message || "Unable to load quotation requests.");
        setProducts(productsData.data || []);
        setCustomerRequests(requestsData.data || []);
      } catch (requestError) {
        setError(requestError.message);
      }
    }
    loadRequestData();
  }, [token]);

  function addRequestItem(productToAdd = null) {
    const product = productToAdd || products.find((entry) => entry.id === requestProductId);
    const safeQuantity = Number(requestQuantity);
    if (!product) return setError("Select a product from the catalog for your request.");
    if (!Number.isInteger(safeQuantity) || safeQuantity <= 0)
      return setError("Quantity must be a positive whole number.");
    if (requestItems.some((item) => item.productId === product.id))
      return setError(`${product.name} is already added to your request.`);
    setRequestItems((current) => [
      ...current,
      {
        productId: product.id,
        name: product.name,
        category: product.category,
        sku: product.sku,
        unitPrice: Number(product.unitPrice || product.unit_price || 0),
        quantity: safeQuantity,
      },
    ]);
    if (!productToAdd) setRequestProductId("");
    setRequestQuantity(1);
    setError("");
  }

  async function submitQuoteRequest(event) {
    event.preventDefault();
    if (!requestItems.length) return setError("Add at least one product to your request.");
    setRequestLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`${API_BASE}/customer/quotations/requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: requestItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          requestedDeliveryDate: requestDeliveryDate,
          customerComment: requestComment,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to send quotation request.");
      setSuccess(data.message);
      setRequestItems([]);
      setRequestDeliveryDate("");
      setRequestComment("");
      const requestsResponse = await fetch(`${API_BASE}/customer/quotations/requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const requestsData = await requestsResponse.json();
      if (requestsResponse.ok) setCustomerRequests(requestsData.data || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRequestLoading(false);
    }
  }

  async function submitNegotiation(event) {
    event.preventDefault();
    if (!quotation) return;
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`${API_BASE}/customer/quotations/${quotation.id}/negotiate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requestedDiscountPercent,
          requestedDeliveryDate,
          customerComment,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to submit negotiation request.");
      setSuccess(data.message);
      await openQuotation(quotation.id);
      await loadQuotations();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function confirmQuotation() {
    if (!quotation || !window.confirm("Confirm this quotation with its current terms?")) return;
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`${API_BASE}/customer/quotations/${quotation.id}/confirm`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to confirm quotation.");
      setSuccess(data.message);
      await openQuotation(quotation.id);
      await loadQuotations();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function rejectQuotation() {
    if (!quotation || !window.confirm("Reject this quotation?")) return;
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`${API_BASE}/customer/quotations/${quotation.id}/reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to reject quotation.");
      setSuccess(data.message);
      await openQuotation(quotation.id);
      await loadQuotations();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setActionLoading(false);
    }
  }

  const isDetail = Boolean(selectedQuotationId);
  const canRespond = quotation && ["DRAFT", "APPROVED", "NEGOTIATION"].includes(quotation.status);
  const pendingRequest = quotation?.negotiations?.find((request) => request.status === "PENDING");

  const glassStyle = {
    background: "rgba(255, 255, 255, 0.88)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid rgba(226, 232, 240, 0.8)",
    borderRadius: "16px",
    padding: "1.5rem",
    marginBottom: "1.25rem",
    boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.04), 0 8px 10px -6px rgba(15, 23, 42, 0.04)",
  };

  return (
    <main className="main-content sales-dashboard-container">
      {/* Top Banner Header */}
      <div className="page-heading-row" style={{ marginBottom: "1.5rem" }}>
        <div>
          <div className="badge badge-approved" style={{ marginBottom: "0.5rem", display: "inline-flex", gap: "0.35rem", alignItems: "center" }}>
            <CheckCircle size={13} /> Verified Customer Account
          </div>
          <h1>{isDetail ? `Negotiation — ${quotation?.quotationNumber || "Quotation"}` : "Customer Portal"}</h1>
          <p className="page-subtitle">
            {isDetail
              ? `Review line items, negotiate terms, or confirm quotation for ${user?.company_name || "your company"}.`
              : `Manage quotations, request custom pricing, and confirm orders for ${user?.company_name || "your account"}.`}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div className="badge badge-neutral" style={{ padding: "0.5rem 0.85rem", fontSize: "0.825rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Building2 size={15} color="#2563eb" />
            <span><strong>{user?.company_name || "Client Account"}</strong></span>
          </div>
          <div className="badge badge-neutral" style={{ padding: "0.5rem 0.85rem", fontSize: "0.825rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Lock size={14} color="#10b981" />
            <span>Single-Tenant Secure Portal</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ borderRadius: "12px", marginBottom: "1.25rem" }}>
          <AlertCircle size={17} /> {error}
        </div>
      )}
      {success && (
        <div className="alert alert-success" style={{ borderRadius: "12px", marginBottom: "1.25rem" }}>
          <CheckCircle size={17} /> {success}
        </div>
      )}

      {!isDetail ? (
        <>
          {/* Section 1: Request a New Quotation */}
          <section style={glassStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(37, 99, 235, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Plus size={18} color="#2563eb" />
              </div>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a" }}>Request a New Quotation</h2>
            </div>
            <p style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: "1.25rem" }}>
              Select products from our catalog and specify quantities. Our sales team will immediately prepare a custom quotation for you.
            </p>

            <form onSubmit={submitQuoteRequest}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 2fr) 120px auto", gap: "0.75rem", alignItems: "end" }}>
                <label className="form-group" style={{ margin: 0 }}>
                  <span className="form-label" style={{ fontWeight: 600, color: "#334155" }}>Select Product</span>
                  <select
                    className="form-input no-icon"
                    value={requestProductId}
                    onChange={(event) => setRequestProductId(event.target.value)}
                  >
                    <option value="">{products.length ? "Choose from admin product catalog..." : "Loading catalog..."}</option>
                    {products
                      .filter((product) => !requestItems.some((item) => item.productId === product.id))
                      .map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} — {currency(product.unitPrice || product.unit_price)} ({product.category} · SKU: {product.sku})
                        </option>
                      ))}
                  </select>
                </label>

                <label className="form-group" style={{ margin: 0 }}>
                  <span className="form-label" style={{ fontWeight: 600, color: "#334155" }}>Quantity</span>
                  <input
                    className="form-input no-icon"
                    type="number"
                    min="1"
                    step="1"
                    value={requestQuantity}
                    onChange={(event) => setRequestQuantity(event.target.value)}
                  />
                </label>

                <button type="button" className="btn-secondary" onClick={() => addRequestItem()} style={{ height: "42px", padding: "0 1.15rem" }}>
                  <Plus size={16} /> Add Product
                </button>
              </div>

              {requestItems.length > 0 && (
                <div style={{ marginTop: "1rem", display: "grid", gap: "0.5rem" }}>
                  {requestItems.map((item) => (
                    <div
                      key={item.productId}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.75rem 1rem",
                        background: "rgba(241, 245, 249, 0.8)",
                        border: "1px solid #cbd5e1",
                        borderRadius: "10px",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        <Package size={16} color="#2563eb" />
                        <strong>{item.name}</strong>
                        <code>{item.sku}</code>
                        <span className="badge badge-neutral" style={{ fontSize: "0.75rem" }}>{item.category}</span>
                        <span style={{ color: "#475569", fontWeight: 700 }}>Qty: {item.quantity}</span>
                        <span style={{ color: "#2563eb", fontWeight: 700 }}>Est. Total: {currency(item.quantity * (item.unitPrice || 0))}</span>
                      </span>
                      <button
                        type="button"
                        className="icon-button danger-icon"
                        title="Remove product"
                        onClick={() => setRequestItems((current) => current.filter((entry) => entry.productId !== item.productId))}
                      >
                        <Trash2 size={16} color="#ef4444" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginTop: "1.25rem" }}>
                <label className="form-group" style={{ margin: 0 }}>
                  <span className="form-label" style={{ fontWeight: 600, color: "#334155" }}>Target Delivery Date</span>
                  <input
                    className="form-input no-icon"
                    type="date"
                    min={new Date().toISOString().slice(0, 10)}
                    value={requestDeliveryDate}
                    onChange={(event) => setRequestDeliveryDate(event.target.value)}
                  />
                </label>

                <label className="form-group" style={{ margin: 0 }}>
                  <span className="form-label" style={{ fontWeight: 600, color: "#334155" }}>Special Requirements / Notes</span>
                  <textarea
                    className="form-input no-icon"
                    rows="1"
                    value={requestComment}
                    onChange={(event) => setRequestComment(event.target.value)}
                    placeholder="Provide any custom order specifications..."
                  />
                </label>
              </div>

              <button className="btn-primary" type="submit" style={{ width: "auto", marginTop: "1.25rem" }} disabled={requestLoading}>
                <Send size={16} /> {requestLoading ? "Sending request..." : "Submit Quotation Request"}
              </button>
            </form>
          </section>

          {/* Section 2: Recent Pending Requests */}
          {customerRequests.length > 0 && (
            <section style={glassStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <Clock size={18} color="#0284c7" />
                <h2 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0f172a" }}>Submitted Quotation Requests</h2>
              </div>
              <div style={{ display: "grid", gap: "0.75rem" }}>
                {customerRequests.map((request) => (
                  <div
                    key={request.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "1rem",
                      flexWrap: "wrap",
                      padding: "0.85rem 1.15rem",
                      background: "rgba(248, 250, 252, 0.8)",
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: "#1e293b", marginBottom: "0.2rem" }}>
                        {request.items.map((item) => `${item.name} (${item.quantity} units)`).join(", ")}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b", display: "flex", gap: "1rem" }}>
                        <span>Submitted: {new Date(request.createdAt || Date.now()).toLocaleDateString("en-IN")}</span>
                        {request.requestedDeliveryDate && <span>Target Delivery: {request.requestedDeliveryDate}</span>}
                      </div>
                    </div>
                    <span className="badge badge-pending" style={{ textTransform: "uppercase", fontSize: "0.75rem" }}>
                      {request.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Section 3: Quotations Directory Table */}
          <div className="admin-panel" style={{ ...glassStyle, padding: 0, overflow: "hidden" }}>
            <div className="panel-heading panel-heading-spread" style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #e2e8f0" }}>
              <div>
                <p className="eyebrow">Assigned Quotations</p>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 800 }}>My Active & Past Quotations</h2>
              </div>
              <span className="staff-count">{quotations.length} Quotations</span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Quotation Ref</th>
                    <th>Date Issued</th>
                    <th>Total Value</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan="5" className="empty-state" style={{ padding: "3rem" }}>
                        Loading your quotations...
                      </td>
                    </tr>
                  )}
                  {!loading && quotations.length === 0 && (
                    <tr>
                      <td colSpan="5" className="empty-state" style={{ padding: "3rem" }}>
                        <strong>No quotations found.</strong>
                        <br />
                        Quotations prepared by your sales manager will appear here for review.
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    quotations.map((entry) => (
                      <tr key={entry.id} style={{ cursor: "pointer" }} onClick={() => openQuotation(entry.id)}>
                        <td>
                          <span style={{ fontWeight: 800, color: "#2563eb", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                            <FileText size={15} />
                            {entry.quotationNumber}
                          </span>
                        </td>
                        <td style={{ color: "#475569" }}>
                          {new Date(entry.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </td>
                        <td>
                          <strong style={{ fontSize: "1.025rem", color: "#0f172a" }}>{currency(entry.finalAmount)}</strong>
                        </td>
                        <td>
                          <span className={`badge ${statusBadgeClass(entry.status)}`}>
                            {statusLabel[entry.status] || entry.status}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            className="btn-secondary"
                            style={{ padding: "0.4rem 0.85rem", fontSize: "0.825rem" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openQuotation(entry.id);
                            }}
                          >
                            View & Negotiate
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : detailLoading ? (
        <div style={{ ...glassStyle, textAlign: "center", padding: "4rem", color: "#64748b" }}>
          <div className="spin" style={{ display: "inline-block", marginBottom: "1rem" }}>
            <FileText size={32} color="#2563eb" />
          </div>
          <p style={{ fontWeight: 600 }}>Retrieving quotation specifications...</p>
        </div>
      ) : quotation ? (
        <>
          {/* Detail View Navigation Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <button
              className="btn-secondary"
              onClick={() => {
                setSelectedQuotationId(null);
                setQuotation(null);
              }}
              style={{ padding: "0.5rem 1rem", borderRadius: "10px" }}
            >
              <ArrowLeft size={16} /> Back to My Quotations
            </button>
            <span className={`badge ${statusBadgeClass(quotation.status)}`} style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
              {statusLabel[quotation.status] || quotation.status}
            </span>
          </div>

          {/* Quotation Specification Card */}
          <section style={glassStyle}>
            <div className="panel-heading-spread" style={{ marginBottom: "1.25rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "1rem" }}>
              <div>
                <p className="eyebrow">Official Quotation</p>
                <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a" }}>{quotation.quotationNumber}</h2>
                <p style={{ color: "#64748b", fontSize: "0.875rem", marginTop: "0.2rem" }}>
                  Prepared for <strong>{user?.company_name || "Your Company"}</strong> · Issued on {new Date(quotation.createdAt).toLocaleDateString("en-IN")}
                </p>
              </div>

              {/* Single-Row Pricing Totals Summary Bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1.25rem",
                  background: "rgba(241, 245, 249, 0.9)",
                  border: "1px solid #cbd5e1",
                  borderRadius: "12px",
                  padding: "0.75rem 1.25rem",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
                }}
              >
                <div>
                  <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700, display: "block" }}>Subtotal</span>
                  <span style={{ fontSize: "1rem", fontWeight: 700, color: "#334155" }}>{currency(quotation.subtotal)}</span>
                </div>
                <div style={{ height: "24px", width: "1px", background: "#cbd5e1" }} />
                <div>
                  <span style={{ fontSize: "0.75rem", color: "#ef4444", textTransform: "uppercase", fontWeight: 700, display: "block" }}>Discount</span>
                  <span style={{ fontSize: "1rem", fontWeight: 700, color: "#ef4444" }}>-{currency(quotation.discountAmount)}</span>
                </div>
                <div style={{ height: "24px", width: "1px", background: "#cbd5e1" }} />
                <div>
                  <span style={{ fontSize: "0.75rem", color: "#2563eb", textTransform: "uppercase", fontWeight: 800, display: "block" }}>Final Price</span>
                  <span style={{ fontSize: "1.2rem", fontWeight: 800, color: "#1e40af" }}>{currency(quotation.finalAmount)}</span>
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div style={{ borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden", marginBottom: "1.25rem" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product / Item</th>
                    <th>Category</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Item Discount</th>
                    <th style={{ textAlign: "right" }}>Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.items.map((item) => (
                    <tr key={item.id}>
                      <td><strong style={{ color: "#0f172a" }}>{item.name}</strong></td>
                      <td style={{ color: "#64748b" }}>{item.category}</td>
                      <td><span style={{ fontWeight: 700 }}>{item.quantity}</span></td>
                      <td>{currency(item.unitPrice)}</td>
                      <td><span style={{ color: item.discountPercent > 0 ? "#ef4444" : "#64748b", fontWeight: 600 }}>{item.discountPercent}%</span></td>
                      <td style={{ textAlign: "right", fontWeight: 800, color: "#0f172a" }}>{currency(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pendingRequest && (
              <div className="alert alert-success" style={{ marginBottom: "1rem", borderRadius: "10px" }}>
                <MessageSquare size={17} /> <strong>Active Negotiation Pending:</strong> Requested Discount:{" "}
                {pendingRequest.requestedDiscountPercent ?? "-"}% · Target Date: {pendingRequest.requestedDeliveryDate || "Default"} · Status: Pending Sales Approval
              </div>
            )}

            {/* Response & Negotiation Controls */}
            <div style={{ background: "rgba(248, 250, 252, 0.9)", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "1.25rem" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0f172a", marginBottom: "0.35rem" }}>
                Respond or Counter-Offer
              </h3>
              <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "1rem" }}>
                Submit a counter discount or delivery date request to open negotiations, or click Approve to confirm the quote immediately.
              </p>

              <form onSubmit={submitNegotiation}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "1rem" }}>
                  <label className="form-group" style={{ margin: 0 }}>
                    <span className="form-label" style={{ fontWeight: 600 }}>Requested Discount %</span>
                    <input
                      className="form-input no-icon"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={requestedDiscountPercent}
                      onChange={(event) => setRequestedDiscountPercent(event.target.value)}
                      disabled={!canRespond || Boolean(pendingRequest)}
                      placeholder="e.g. 15"
                    />
                  </label>

                  <label className="form-group" style={{ margin: 0 }}>
                    <span className="form-label" style={{ fontWeight: 600 }}>Target Delivery Date</span>
                    <input
                      className="form-input no-icon"
                      type="date"
                      min={new Date().toISOString().slice(0, 10)}
                      value={requestedDeliveryDate}
                      onChange={(event) => setRequestedDeliveryDate(event.target.value)}
                      disabled={!canRespond || Boolean(pendingRequest)}
                    />
                  </label>
                </div>

                <label className="form-group" style={{ marginTop: "1rem", marginBottom: "1.25rem" }}>
                  <span className="form-label" style={{ fontWeight: 600 }}>Comments / Special Instructions for Sales Team</span>
                  <textarea
                    className="form-input no-icon"
                    rows="3"
                    value={customerComment}
                    onChange={(event) => setCustomerComment(event.target.value)}
                    disabled={!canRespond || Boolean(pendingRequest)}
                    placeholder="Add comments or request specific payment/delivery adjustments..."
                  />
                </label>

                <div style={{ display: "flex", gap: "0.85rem", flexWrap: "wrap" }}>
                  <button
                    className="btn-primary"
                    type="submit"
                    disabled={!canRespond || Boolean(pendingRequest) || actionLoading}
                    style={{ padding: "0.65rem 1.25rem" }}
                  >
                    <Send size={16} /> {actionLoading ? "Submitting counter-offer..." : "Submit Counter-Offer"}
                  </button>

                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={confirmQuotation}
                    disabled={!canRespond || actionLoading}
                    style={{ padding: "0.65rem 1.25rem", background: "#f0fdf4", color: "#166534", borderColor: "#bbf7d0" }}
                  >
                    <CheckCircle size={16} color="#166534" /> {actionLoading ? "Confirming..." : "Approve & Confirm Quote"}
                  </button>

                  <button
                    className="btn-danger"
                    type="button"
                    onClick={rejectQuotation}
                    disabled={!canRespond || actionLoading}
                    style={{ padding: "0.65rem 1.25rem" }}
                  >
                    <XCircle size={16} /> Decline Quotation
                  </button>
                </div>
              </form>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
