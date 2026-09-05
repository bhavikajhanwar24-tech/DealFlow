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
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const API_BASE = "http://localhost:5000/api";
const currency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const statusLabel = {
  DRAFT: "Draft - Awaiting Review",
  APPROVED: "Approved",
  NEGOTIATION: "Under Negotiation",
  CONFIRMED: "Confirmed",
  REJECTED: "Rejected",
};

export default function CustomerPortal() {
  const { user, token, logout } = useAuth();
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
      if (!response.ok)
        throw new Error(data.message || "Unable to load your quotations.");
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
      const pending = data.data.negotiations?.find(
        (request) => request.status === "PENDING",
      );
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
        if (!productsResponse.ok)
          throw new Error(productsData.message || "Unable to load products.");
        if (!requestsResponse.ok)
          throw new Error(
            requestsData.message || "Unable to load quotation requests.",
          );
        setProducts(productsData.data || []);
        setCustomerRequests(requestsData.data || []);
      } catch (requestError) {
        setError(requestError.message);
      }
    }
    loadRequestData();
  }, [token]);

  function addRequestItem() {
    const product = products.find((entry) => entry.id === requestProductId);
    const safeQuantity = Number(requestQuantity);
    if (!product) return setError("Select a product for your request.");
    if (!Number.isInteger(safeQuantity) || safeQuantity <= 0)
      return setError("Quantity must be a positive whole number.");
    if (requestItems.some((item) => item.productId === product.id))
      return setError("That product is already requested.");
    setRequestItems((current) => [
      ...current,
      {
        productId: product.id,
        name: product.name,
        category: product.category,
        quantity: safeQuantity,
      },
    ]);
    setRequestProductId("");
    setRequestQuantity(1);
    setError("");
  }

  async function submitQuoteRequest(event) {
    event.preventDefault();
    if (!requestItems.length)
      return setError("Add at least one product to your request.");
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
      if (!response.ok)
        throw new Error(data.message || "Unable to send quotation request.");
      setSuccess(data.message);
      setRequestItems([]);
      setRequestDeliveryDate("");
      setRequestComment("");
      const requestsResponse = await fetch(
        `${API_BASE}/customer/quotations/requests`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
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
      const response = await fetch(
        `${API_BASE}/customer/quotations/${quotation.id}/negotiate`,
        {
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
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.message || "Unable to submit negotiation request.",
        );
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
    if (
      !quotation ||
      !window.confirm("Confirm this quotation with its current terms?")
    )
      return;
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(
        `${API_BASE}/customer/quotations/${quotation.id}/confirm`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Unable to confirm quotation.");
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
      const response = await fetch(
        `${API_BASE}/customer/quotations/${quotation.id}/reject`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Unable to reject quotation.");
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
  const canRespond =
    quotation &&
    ["DRAFT", "APPROVED", "NEGOTIATION"].includes(quotation.status);
  const pendingRequest = quotation?.negotiations?.find(
    (request) => request.status === "PENDING",
  );

  return (
    <main className="main-content">
      <div className="customer-portal-header">
        <div>
          <div className="customer-verified-badge">
            <CheckCircle size={14} /> Verified Customer Account
          </div>
          <h1>
            {isDetail ? "Customer Portal Negotiation Screen" : "My Quotations"}
          </h1>
          <p>
            {isDetail
              ? `${quotation?.quotationNumber || "Quotation"} for ${user?.company_name || "your company"}`
              : "View and respond to quotations prepared for your company."}
          </p>
        </div>
        <div className="customer-access-summary">
          <div className="customer-access-label">Access Isolation Policy</div>
          <div className="customer-access-value">
            <Lock size={15} /> Strict Single-Tenant Portal
          </div>
          <button className="btn-secondary" onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">
          <AlertCircle size={17} /> {error}
        </div>
      )}
      {success && (
        <div className="alert alert-success">
          <CheckCircle size={17} /> {success}
        </div>
      )}

      {!isDetail ? (
        <>
          <section
            style={{
              background: "#fff",
              border: "1px solid var(--border-light)",
              borderRadius: "16px",
              padding: "1.5rem",
              marginBottom: "1.25rem",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <h2 style={{ fontSize: "1.1rem", fontWeight: 800 }}>
              Request a New Quotation
            </h2>
            <p
              style={{
                color: "#64748b",
                fontSize: "0.875rem",
                margin: "0.35rem 0 1rem",
              }}
            >
              Choose products and quantities. Your sales team will review the
              request and prepare the quotation.
            </p>
            <form onSubmit={submitQuoteRequest}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(220px, 2fr) 120px auto",
                  gap: "0.75rem",
                  alignItems: "end",
                }}
              >
                <label className="form-group">
                  <span className="form-label">Product</span>
                  <select
                    className="form-input no-icon"
                    value={requestProductId}
                    onChange={(event) =>
                      setRequestProductId(event.target.value)
                    }
                  >
                    <option value="">
                      {products.length
                        ? "Select product"
                        : "Loading products..."}
                    </option>
                    {products
                      .filter(
                        (product) =>
                          !requestItems.some(
                            (item) => item.productId === product.id,
                          ),
                      )
                      .map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({product.category})
                        </option>
                      ))}
                  </select>
                </label>
                <label className="form-group">
                  <span className="form-label">Quantity</span>
                  <input
                    className="form-input no-icon"
                    type="number"
                    min="1"
                    step="1"
                    value={requestQuantity}
                    onChange={(event) => setRequestQuantity(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={addRequestItem}
                >
                  <Plus size={16} /> Add
                </button>
              </div>
              {requestItems.length > 0 && (
                <div
                  style={{ marginTop: "1rem", display: "grid", gap: "0.5rem" }}
                >
                  {requestItems.map((item) => (
                    <div
                      key={item.productId}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.75rem 1rem",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                      }}
                    >
                      <span>
                        <strong>{item.name}</strong>{" "}
                        <small style={{ color: "#64748b" }}>
                          {item.category} · Qty {item.quantity}
                        </small>
                      </span>
                      <button
                        type="button"
                        title="Remove product"
                        onClick={() =>
                          setRequestItems((current) =>
                            current.filter(
                              (entry) => entry.productId !== item.productId,
                            ),
                          )
                        }
                      >
                        <Trash2 size={16} color="#ef4444" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                  gap: "1rem",
                  marginTop: "1rem",
                }}
              >
                <label className="form-group">
                  <span className="form-label">Requested Delivery Date</span>
                  <input
                    className="form-input no-icon"
                    type="date"
                    min={new Date().toISOString().slice(0, 10)}
                    value={requestDeliveryDate}
                    onChange={(event) =>
                      setRequestDeliveryDate(event.target.value)
                    }
                  />
                </label>
                <label className="form-group">
                  <span className="form-label">Comments for Sales</span>
                  <textarea
                    className="form-input no-icon"
                    rows="2"
                    value={requestComment}
                    onChange={(event) => setRequestComment(event.target.value)}
                    placeholder="Describe your requirements"
                  />
                </label>
              </div>
              <button
                className="btn-primary"
                type="submit"
                style={{ width: "auto", marginTop: "1rem" }}
                disabled={requestLoading}
              >
                {requestLoading ? "Sending request..." : "Request Quotation"}
              </button>
            </form>
          </section>
          {customerRequests.length > 0 && (
            <section
              style={{
                background: "#fff",
                border: "1px solid var(--border-light)",
                borderRadius: "16px",
                padding: "1.25rem 1.5rem",
                marginBottom: "1.25rem",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <h2 style={{ fontSize: "1.05rem", fontWeight: 800 }}>
                My Quotation Requests
              </h2>
              {customerRequests.map((request) => (
                <div
                  key={request.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "1rem",
                    flexWrap: "wrap",
                    padding: "0.75rem 0",
                    borderBottom: "1px solid #eef2f7",
                  }}
                >
                  <span>
                    {request.items
                      .map((item) => `${item.name} × ${item.quantity}`)
                      .join(", ")}
                  </span>
                  <span className="badge badge-pending">{request.status}</span>
                </div>
              ))}
            </section>
          )}
          <div className="data-table-card">
            <div className="customer-quotes-heading">
              <h2>My Quotations</h2>
              <div>
                Only quotations prepared for your customer account are shown.
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Quotation Number</th>
                    <th>Quotation Date</th>
                    <th>Total Amount</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td
                        colSpan="5"
                        style={{
                          textAlign: "center",
                          padding: "3rem",
                          color: "#64748b",
                        }}
                      >
                        Loading your quotations...
                      </td>
                    </tr>
                  )}
                  {!loading && quotations.length === 0 && (
                    <tr>
                      <td
                        colSpan="5"
                        style={{
                          textAlign: "center",
                          padding: "3rem",
                          color: "#64748b",
                        }}
                      >
                        <strong>No quotations available.</strong>
                        <br />
                        Your sales representative will share quotations with you
                        here.
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    quotations.map((entry) => (
                      <tr key={entry.id}>
                        <td style={{ fontWeight: 800, color: "#1d4ed8" }}>
                          {entry.quotationNumber}
                        </td>
                        <td>
                          {new Date(entry.createdAt).toLocaleDateString(
                            "en-IN",
                          )}
                        </td>
                        <td style={{ fontWeight: 800 }}>
                          {currency(entry.finalAmount)}
                        </td>
                        <td>
                          <span className="badge badge-active">
                            {statusLabel[entry.status] || entry.status}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn-secondary"
                            style={{ padding: "0.4rem 0.75rem" }}
                            onClick={() => openQuotation(entry.id)}
                          >
                            View Quotation
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
        <div style={{ color: "#64748b" }}>Loading quotation...</div>
      ) : quotation ? (
        <>
          <button
            className="btn-secondary"
            onClick={() => {
              setSelectedQuotationId(null);
              setQuotation(null);
            }}
          >
            <ArrowLeft size={16} /> Back to My Quotations
          </button>
          <section
            style={{
              background: "#fff",
              border: "1px solid var(--border-light)",
              borderRadius: "16px",
              padding: "1.5rem",
              marginTop: "1rem",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "1rem",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h2 style={{ fontSize: "1.35rem", fontWeight: 800 }}>
                  {quotation.quotationNumber}
                </h2>
                <p style={{ color: "#64748b", marginTop: "0.35rem" }}>
                  {user?.company_name} ·{" "}
                  {new Date(quotation.createdAt).toLocaleDateString("en-IN")}
                </p>
              </div>
              <span className="badge badge-active">
                Status: {statusLabel[quotation.status] || quotation.status}
              </span>
            </div>
            <div className="data-table-card" style={{ marginTop: "1.25rem" }}>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Line Item</th>
                      <th>Category</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Discount</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotation.items.map((item) => (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 700 }}>{item.name}</td>
                        <td>{item.category}</td>
                        <td>{item.quantity}</td>
                        <td>{currency(item.unitPrice)}</td>
                        <td>{item.discountPercent}%</td>
                        <td style={{ fontWeight: 800 }}>
                          {currency(item.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "1rem",
              }}
            >
              <div style={{ minWidth: "280px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    color: "#64748b",
                  }}
                >
                  <span>Subtotal</span>
                  <strong>{currency(quotation.subtotal)}</strong>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    color: "#ef4444",
                    marginTop: "0.5rem",
                  }}
                >
                  <span>Discount</span>
                  <strong>-{currency(quotation.discountAmount)}</strong>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: 800,
                    fontSize: "1.15rem",
                    marginTop: "0.75rem",
                    paddingTop: "0.75rem",
                    borderTop: "1px solid #e2e8f0",
                  }}
                >
                  <span>Final Price</span>
                  <strong>{currency(quotation.finalAmount)}</strong>
                </div>
              </div>
            </div>
          </section>
          {pendingRequest && (
            <div className="alert alert-success" style={{ marginTop: "1rem" }}>
              <MessageSquare size={17} /> Current terms · Requested discount:{" "}
              {pendingRequest.requestedDiscountPercent ?? "-"}% · Status:
              Pending Review
            </div>
          )}
          <section
            style={{
              background: "#fff",
              border: "1px solid var(--border-light)",
              borderRadius: "16px",
              padding: "1.5rem",
              marginTop: "1rem",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <h2 style={{ fontSize: "1.1rem", fontWeight: 800 }}>
              Respond to quotation
            </h2>
            <p
              style={{
                color: "#64748b",
                fontSize: "0.875rem",
                margin: "0.35rem 0 1rem",
              }}
            >
              If final terms exceed thresholds, the quote will automatically
              re-enter approval.
            </p>
            <form onSubmit={submitNegotiation}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                  gap: "1rem",
                }}
              >
                <label className="form-group">
                  <span className="form-label">Counter Discount %</span>
                  <input
                    className="form-input no-icon"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={requestedDiscountPercent}
                    onChange={(event) =>
                      setRequestedDiscountPercent(event.target.value)
                    }
                    disabled={!canRespond || Boolean(pendingRequest)}
                    placeholder="Optional"
                  />
                </label>
                <label className="form-group">
                  <span className="form-label">Requested Delivery Date</span>
                  <input
                    className="form-input no-icon"
                    type="date"
                    min={new Date().toISOString().slice(0, 10)}
                    value={requestedDeliveryDate}
                    onChange={(event) =>
                      setRequestedDeliveryDate(event.target.value)
                    }
                    disabled={!canRespond || Boolean(pendingRequest)}
                  />
                </label>
              </div>
              <label className="form-group" style={{ marginTop: "1rem" }}>
                <span className="form-label">Customer Comment</span>
                <textarea
                  className="form-input no-icon"
                  rows="3"
                  value={customerComment}
                  onChange={(event) => setCustomerComment(event.target.value)}
                  disabled={!canRespond || Boolean(pendingRequest)}
                  placeholder="Add a request or comment for the sales team"
                />
              </label>
              <div
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  marginTop: "1rem",
                  flexWrap: "wrap",
                }}
              >
                <button
                  className="btn-primary"
                  type="submit"
                  disabled={
                    !canRespond || Boolean(pendingRequest) || actionLoading
                  }
                >
                  {actionLoading ? (
                    "Submitting request..."
                  ) : (
                    <>
                      <Send size={16} /> Submit Request
                    </>
                  )}
                </button>
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={confirmQuotation}
                  disabled={!canRespond || actionLoading}
                >
                  {actionLoading ? (
                    "Confirming quotation..."
                  ) : (
                    <>
                      <CheckCircle size={16} /> Approve Quotation
                    </>
                  )}
                </button>
                <button
                  className="btn-danger"
                  type="button"
                  onClick={rejectQuotation}
                  disabled={!canRespond || actionLoading}
                >
                  <XCircle size={16} /> Reject Quotation
                </button>
              </div>
            </form>
          </section>
        </>
      ) : null}
    </main>
  );
}
