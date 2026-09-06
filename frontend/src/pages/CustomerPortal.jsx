import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
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
  ShieldAlert,
  User,
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

export default function CustomerPortal({ onNavigate }) {
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
  const [selectedRemovalItemIds, setSelectedRemovalItemIds] = useState([]);
  const [products, setProducts] = useState([]);
  const [requestItems, setRequestItems] = useState([]);
  const [requestProductId, setRequestProductId] = useState("");
  const [requestQuantity, setRequestQuantity] = useState(1);
  const [requestDeliveryDate, setRequestDeliveryDate] = useState("");
  const [requestComment, setRequestComment] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [customerRequests, setCustomerRequests] = useState([]);

  // Delivery Destination state
  const [destAddress, setDestAddress] = useState("");
  const [destCity, setDestCity] = useState("Delhi");
  const [destState, setDestState] = useState("Delhi");
  const [destZip, setDestZip] = useState("110001");
  const [destCountry, setDestCountry] = useState("India");
  const [destLat, setDestLat] = useState("28.6139");
  const [destLng, setDestLng] = useState("77.2090");

  // Complaints state
  const [activeTab, setActiveTab] = useState("QUOTATIONS"); // 'QUOTATIONS' | 'COMPLAINTS'
  const [complaints, setComplaints] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [complaintStaffId, setComplaintStaffId] = useState("");
  const [complaintQuotationId, setComplaintQuotationId] = useState("");
  const [complaintCategory, setComplaintCategory] = useState("COMMUNICATION");
  const [complaintSubject, setComplaintSubject] = useState("");
  const [complaintDescription, setComplaintDescription] = useState("");
  const [submittingComplaint, setSubmittingComplaint] = useState(false);

  async function loadComplaints() {
    setComplaintsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/complaints/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setComplaints(data.data || []);
      }
    } catch (err) {
      console.error("Failed to load customer complaints:", err);
    } finally {
      setComplaintsLoading(false);
    }
  }

  async function loadStaffMembers() {
    try {
      const response = await fetch(`${API_BASE}/complaints/staff-members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setStaffMembers(data.data || []);
      }
    } catch (err) {
      console.error("Failed to load staff members:", err);
    }
  }

  async function handleLodgeComplaint(e) {
    e.preventDefault();
    if (!complaintStaffId) {
      setError("Please select the staff member you are reporting.");
      return;
    }
    if (!complaintSubject.trim()) {
      setError("Please enter a subject for the complaint.");
      return;
    }
    if (!complaintDescription.trim()) {
      setError("Please describe the grievance in detail.");
      return;
    }

    setSubmittingComplaint(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`${API_BASE}/complaints`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          staff_id: complaintStaffId,
          quotation_id: complaintQuotationId || null,
          category: complaintCategory,
          subject: complaintSubject.trim(),
          description: complaintDescription.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to submit complaint.");
      }

      setSuccess("Complaint lodged successfully and sent directly to System Administrator. You can track progress below.");
      setComplaintStaffId("");
      setComplaintQuotationId("");
      setComplaintCategory("COMMUNICATION");
      setComplaintSubject("");
      setComplaintDescription("");
      await loadComplaints();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingComplaint(false);
    }
  }

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
async function loadRequestData() {
  setRequestLoading(true);
  setError("");
  try {
    const response = await fetch(`${API_BASE}/customer/quotations/requests`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Unable to load quotation requests.");
    setCustomerRequests(data.data || []);
  } catch (requestError) {
    setError(requestError.message);
  } finally {
    setRequestLoading(false);
  }
}

  async function openQuotation(id) {
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
      setSelectedRemovalItemIds([]);
      setSelectedQuotationId(id);
    } catch (requestError) {
      setError(requestError.message);
      setQuotation(null);
    } finally {
      setDetailLoading(false);
    }
  }

  function toggleRemovalItem(itemId) {
    if (selectedRemovalItemIds.includes(itemId)) {
      setSelectedRemovalItemIds((prev) => prev.filter((id) => id !== itemId));
    } else {
      if (quotation?.items && selectedRemovalItemIds.length + 1 >= quotation.items.length) {
        setError("Cannot mark all items for removal. At least one product must remain in the quotation.");
        return;
      }
      setError("");
      setSelectedRemovalItemIds((prev) => [...prev, itemId]);
    }
  }

  async function loadProducts() {
    try {
      const response = await fetch(`${API_BASE}/customer/quotations/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok && data.data) {
        setProducts(data.data);
      }
    } catch (err) {
      console.error("Failed to load catalog in customer portal:", err);
    }
  }

  useEffect(() => {
    if (token) {
      loadQuotations();
      loadRequestData();
      loadProducts();
      loadComplaints();
      loadStaffMembers();
    }
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
      
      if (data.data?.isAutoApproved) {
        setSuccess(`⚡ Instant Auto-Approval! Quotation ${data.data.quotationNumber} has been generated and approved. You can review and confirm it below.`);
      } else {
        setSuccess(data.message || "Your custom quotation request has been submitted to the sales team for review.");
      }

      setRequestItems([]);
      setRequestDeliveryDate("");
      setRequestComment("");
      
      // Reload both requests and quotations
      await Promise.all([
        loadQuotations(),
        loadRequestData()
      ]);
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
          removedItemIds: selectedRemovalItemIds,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to submit negotiation request.");
      setSuccess(data.message);
      setSelectedRemovalItemIds([]);
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

  async function submitDestinationForm(event) {
    event.preventDefault();
    if (!quotation) return;
    if (!destAddress || !destCity || !destState || !destZip) {
      return setError("Please fill out Address, City, State, and PIN/ZIP code.");
    }
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`${API_BASE}/customer/quotations/${quotation.id}/destination`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          address: destAddress,
          city: destCity,
          state: destState,
          zip: destZip,
          country: destCountry || "India",
          latitude: destLat ? Number(destLat) : null,
          longitude: destLng ? Number(destLng) : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to submit delivery destination.");
      setSuccess("Delivery destination submitted successfully! Operations team has been notified for multi-warehouse route optimization.");
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
    ["DRAFT", "APPROVED", "NEGOTIATION", "PENDING_APPROVAL", "SENT"].includes(quotation.status);
  const pendingRequest = quotation?.negotiations?.find((request) => request.status === "PENDING");

  const remainingItems = (quotation?.items || []).filter((item) => !selectedRemovalItemIds.includes(item.id));
  const proposedSubtotal = remainingItems.reduce((sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 0), 0);
  const proposedDiscountAmount = remainingItems.reduce((sum, item) => {
    const lineSubtotal = Number(item.unitPrice || 0) * Number(item.quantity || 0);
    const disc = requestedDiscountPercent !== "" ? Number(requestedDiscountPercent) : Number(item.discountPercent || 0);
    return sum + (lineSubtotal * disc) / 100;
  }, 0);
  const proposedFinalAmount = Math.max(0, proposedSubtotal - proposedDiscountAmount);

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

      {/* WEBSITE NOTIFICATION BANNER FOR FINALIZED / CONFIRMED QUOTATIONS AWAITING DESTINATION */}
      {quotations.some((q) => ["CONFIRMED", "FINALIZED"].includes(q.status)) && (
        <div
          style={{
            background: "linear-gradient(135deg, #eff6ff, #ecfdf5)",
            border: "2px solid #3b82f6",
            borderRadius: "14px",
            padding: "1.15rem 1.5rem",
            marginBottom: "1.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap",
            boxShadow: "0 8px 20px -4px rgba(37, 99, 235, 0.12)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ background: "#2563eb", borderRadius: "10px", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff" }}>
              <Building2 size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#1e3a8a" }}>
                🎉 Quotation Finalized & Ready for Fulfillment!
              </div>
              <div style={{ color: "#334155", fontSize: "0.875rem", marginTop: "0.2rem" }}>
                Please enter your delivery destination address so our Operations Team can optimize your multi-warehouse shipment route.
              </div>
            </div>
          </div>
          <button
            className="btn-primary"
            onClick={() => {
              const confirmedQuote = quotations.find((q) => ["CONFIRMED", "FINALIZED"].includes(q.status));
              if (confirmedQuote) openQuotation(confirmedQuote.id);
            }}
            style={{ padding: "0.6rem 1.15rem", fontSize: "0.9rem", width: "auto" }}
          >
            Enter Delivery Address <ArrowRight size={16} />
          </button>
        </div>
      )}

      {!isDetail ? (
        <>
          {/* Main Portal View Tabs */}
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
            <button
              onClick={() => setActiveTab("QUOTATIONS")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.65rem 1.25rem",
                borderRadius: "10px",
                fontWeight: 700,
                fontSize: "0.9rem",
                cursor: "pointer",
                border: "1px solid",
                borderColor: activeTab === "QUOTATIONS" ? "#2563eb" : "#cbd5e1",
                background: activeTab === "QUOTATIONS" ? "#2563eb" : "#ffffff",
                color: activeTab === "QUOTATIONS" ? "#ffffff" : "#475569",
                boxShadow: activeTab === "QUOTATIONS" ? "0 4px 12px rgba(37, 99, 235, 0.2)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <FileText size={17} /> Quotations & Catalog ({quotations.length})
            </button>

            <button
              onClick={() => setActiveTab("COMPLAINTS")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.65rem 1.25rem",
                borderRadius: "10px",
                fontWeight: 700,
                fontSize: "0.9rem",
                cursor: "pointer",
                border: "1px solid",
                borderColor: activeTab === "COMPLAINTS" ? "#2563eb" : "#cbd5e1",
                background: activeTab === "COMPLAINTS" ? "#2563eb" : "#ffffff",
                color: activeTab === "COMPLAINTS" ? "#ffffff" : "#475569",
                boxShadow: activeTab === "COMPLAINTS" ? "0 4px 12px rgba(37, 99, 235, 0.2)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <ShieldAlert size={17} /> Staff Complaints & Feedback
              {complaints.filter((c) => c.status === "PENDING").length > 0 && (
                <span
                  style={{
                    background: activeTab === "COMPLAINTS" ? "#f59e0b" : "#d97706",
                    color: "#ffffff",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    padding: "0.15rem 0.5rem",
                    borderRadius: "999px",
                  }}
                >
                  {complaints.filter((c) => c.status === "PENDING").length} Pending
                </span>
              )}
              {complaints.filter((c) => c.status === "ACTION_TAKEN").length > 0 && (
                <span
                  style={{
                    background: activeTab === "COMPLAINTS" ? "#10b981" : "#059669",
                    color: "#ffffff",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    padding: "0.15rem 0.5rem",
                    borderRadius: "999px",
                  }}
                >
                  {complaints.filter((c) => c.status === "ACTION_TAKEN").length} Action Taken
                </span>
              )}
            </button>
          </div>

          {activeTab === "QUOTATIONS" && (
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
                {customerRequests.map((request) => {
                  const targetQuoteId =
                    request.quotationId ||
                    request.quotation_id ||
                    (quotations.length > 0 ? quotations[0].id : null);

                  return (
                    <div
                      key={request.id}
                      onClick={() => {
                        if (targetQuoteId) openQuotation(targetQuoteId);
                      }}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "1rem",
                        flexWrap: "wrap",
                        padding: "0.85rem 1.15rem",
                        background: request.status === "CONVERTED" ? "rgba(239, 246, 255, 0.95)" : "rgba(248, 250, 252, 0.8)",
                        border: request.status === "CONVERTED" ? "2px solid #3b82f6" : "1px solid #e2e8f0",
                        borderRadius: "10px",
                        cursor: "pointer",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: "#1e293b", marginBottom: "0.2rem" }}>
                          {(request.items || []).map((item) => `${item.name} (${item.quantity} units)`).join(", ")}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "#64748b", display: "flex", gap: "1rem" }}>
                          <span>Submitted: {new Date(request.createdAt || Date.now()).toLocaleDateString("en-IN")}</span>
                          {request.requestedDeliveryDate && <span>Target Delivery: {request.requestedDeliveryDate}</span>}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        <span className={`badge ${request.status === "CONVERTED" ? "badge-approved" : "badge-pending"}`} style={{ textTransform: "uppercase", fontSize: "0.75rem" }}>
                          {request.status === "CONVERTED" ? "CONVERTED TO QUOTE" : request.status}
                        </span>
                        {(request.status === "CONVERTED" || request.status === "FINALIZED" || Boolean(targetQuoteId)) && (
                          <button
                            className="btn-primary"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (targetQuoteId) openQuotation(targetQuoteId);
                            }}
                            style={{ padding: "0.4rem 0.85rem", fontSize: "0.825rem", width: "auto" }}
                          >
                            View Quote & Enter Address <ArrowRight size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
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
      )}

      {activeTab === "COMPLAINTS" && (
        <>
          {/* Section: Lodge a Staff Complaint */}
          <section style={glassStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(220, 38, 38, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ShieldAlert size={18} color="#dc2626" />
              </div>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a" }}>
                Lodge a Staff Complaint
              </h2>
            </div>
            <p style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: "1.25rem" }}>
              Have an issue with a sales rep, manager, or operations staff? Report unresponsiveness, pricing disagreements, or unprofessional conduct directly to Executive Administration. All complaints are audited and resolved with written explanation.
            </p>

            <form onSubmit={handleLodgeComplaint}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
                <label className="form-group" style={{ margin: 0 }}>
                  <span className="form-label" style={{ fontWeight: 600, color: "#334155" }}>
                    Select Staff Member <span style={{ color: "#ef4444" }}>*</span>
                  </span>
                  <select
                    className="form-input no-icon"
                    value={complaintStaffId}
                    onChange={(e) => setComplaintStaffId(e.target.value)}
                    required
                  >
                    <option value="">Choose staff member to report...</option>
                    {staffMembers.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.full_name} ({staff.role} — {staff.email})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-group" style={{ margin: 0 }}>
                  <span className="form-label" style={{ fontWeight: 600, color: "#334155" }}>
                    Complaint Category
                  </span>
                  <select
                    className="form-input no-icon"
                    value={complaintCategory}
                    onChange={(e) => setComplaintCategory(e.target.value)}
                  >
                    <option value="COMMUNICATION">Unresponsive / Delayed Communication</option>
                    <option value="PRICING">Quotation / Pricing Discrepancy</option>
                    <option value="CONDUCT">Unprofessional Conduct / Behavior</option>
                    <option value="FULFILLMENT">Delivery / Fulfillment Delay</option>
                    <option value="OTHER">General Grievance</option>
                  </select>
                </label>

                <label className="form-group" style={{ margin: 0 }}>
                  <span className="form-label" style={{ fontWeight: 600, color: "#334155" }}>
                    Related Quotation (Optional)
                  </span>
                  <select
                    className="form-input no-icon"
                    value={complaintQuotationId}
                    onChange={(e) => setComplaintQuotationId(e.target.value)}
                  >
                    <option value="">No specific quotation attached</option>
                    {quotations.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.quotationNumber} — {currency(q.finalAmount)} ({q.status})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{ marginTop: "1rem" }}>
                <label className="form-group" style={{ margin: 0 }}>
                  <span className="form-label" style={{ fontWeight: 600, color: "#334155" }}>
                    Complaint Subject <span style={{ color: "#ef4444" }}>*</span>
                  </span>
                  <input
                    className="form-input no-icon"
                    type="text"
                    placeholder="Brief summary of the issue (e.g., Sales rep unresponsive to discount review request)..."
                    value={complaintSubject}
                    onChange={(e) => setComplaintSubject(e.target.value)}
                    required
                  />
                </label>
              </div>

              <div style={{ marginTop: "1rem" }}>
                <label className="form-group" style={{ margin: 0 }}>
                  <span className="form-label" style={{ fontWeight: 600, color: "#334155" }}>
                    Detailed Description <span style={{ color: "#ef4444" }}>*</span>
                  </span>
                  <textarea
                    className="form-input no-icon"
                    rows="3"
                    placeholder="Describe what occurred, dates, and what outcome or resolution you are seeking from Admin..."
                    value={complaintDescription}
                    onChange={(e) => setComplaintDescription(e.target.value)}
                    required
                  />
                </label>
              </div>

              <button
                className="btn-primary"
                type="submit"
                style={{ width: "auto", marginTop: "1.25rem", background: "#dc2626", borderColor: "#dc2626" }}
                disabled={submittingComplaint}
              >
                <Send size={15} /> {submittingComplaint ? "Filing complaint..." : "Submit Complaint to Admin"}
              </button>
            </form>
          </section>

          {/* Section: My Filed Complaints History */}
          <div style={glassStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(37, 99, 235, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Clock size={18} color="#2563eb" />
                </div>
                <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a" }}>
                  My Filed Complaints ({complaints.length})
                </h2>
              </div>
            </div>

            {complaintsLoading ? (
              <div style={{ textAlign: "center", padding: "2.5rem", color: "#64748b" }}>
                <Clock size={22} style={{ animation: "spin 1s linear infinite", margin: "0 auto 0.5rem" }} />
                <div>Loading your complaints...</div>
              </div>
            ) : complaints.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem 1.5rem", color: "#64748b", background: "#f8fafc", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
                <CheckCircle size={36} color="#10b981" style={{ margin: "0 auto 0.75rem" }} />
                <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "1rem" }}>No Complaints Filed</div>
                <div style={{ fontSize: "0.875rem", marginTop: "0.25rem" }}>
                  You have not submitted any complaints against staff. Any complaints you file will appear here along with the Admin's response.
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {complaints.map((comp) => {
                  const isPending = comp.status === "PENDING";
                  const isActionTaken = comp.status === "ACTION_TAKEN";
                  const isRejected = comp.status === "REJECTED";

                  return (
                    <div
                      key={comp.id}
                      style={{
                        background: "#ffffff",
                        border: isPending ? "1px solid #fde68a" : "1px solid #e2e8f0",
                        borderRadius: "12px",
                        padding: "1.25rem",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.85rem",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                      }}
                    >
                      {/* Top row */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                            <span style={{ background: "#f1f5f9", color: "#475569", fontSize: "0.72rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: "6px" }}>
                              {comp.category}
                            </span>
                            {comp.quotation_number && (
                              <span style={{ background: "#eff6ff", color: "#1d4ed8", fontSize: "0.72rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: "6px" }}>
                                Quote: {comp.quotation_number}
                              </span>
                            )}
                            <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                              Filed on {new Date(comp.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          </div>
                          <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>
                            {comp.subject}
                          </h3>
                        </div>

                        <div>
                          {isActionTaken && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", padding: "0.25rem 0.65rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 700 }}>
                              <CheckCircle size={13} color="#059669" /> Action Taken by Admin
                            </span>
                          )}
                          {isRejected && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", padding: "0.25rem 0.65rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 700 }}>
                              <XCircle size={13} color="#dc2626" /> Rejected by Admin
                            </span>
                          )}
                          {isPending && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a", padding: "0.25rem 0.65rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 700 }}>
                              <Clock size={13} color="#d97706" /> Pending Admin Review
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Reported Staff */}
                      <div style={{ background: "#f8fafc", padding: "0.6rem 0.85rem", borderRadius: "8px", fontSize: "0.85rem", color: "#475569", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <User size={15} color="#64748b" />
                        <span>Reported Staff Member: <strong>{comp.staff_name}</strong> ({comp.staff_role} · {comp.staff_email})</span>
                      </div>

                      {/* Customer Description */}
                      <div style={{ fontSize: "0.875rem", color: "#334155", lineHeight: "1.5", background: "#ffffff", border: "1px solid #f1f5f9", padding: "0.75rem 1rem", borderRadius: "8px" }}>
                        {comp.description}
                      </div>

                      {/* Admin Resolution / Rejection Response Display */}
                      {isActionTaken && (
                        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "10px", padding: "0.9rem 1.15rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#166534", fontWeight: 700, fontSize: "0.875rem", marginBottom: "0.35rem" }}>
                            <CheckCircle size={15} color="#16a34a" /> Administrator Resolution & Action Taken:
                          </div>
                          <div style={{ fontSize: "0.875rem", color: "#14532d", lineHeight: "1.45" }}>
                            {comp.admin_notes}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "#15803d", marginTop: "0.4rem" }}>
                            Resolved on {new Date(comp.resolved_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      )}

                      {isRejected && (
                        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "10px", padding: "0.9rem 1.15rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#991b1b", fontWeight: 700, fontSize: "0.875rem", marginBottom: "0.35rem" }}>
                            <XCircle size={15} color="#dc2626" /> Administrator Explanation (Complaint Not Upheld):
                          </div>
                          <div style={{ fontSize: "0.875rem", color: "#7f1d1d", lineHeight: "1.45" }}>
                            {comp.admin_notes}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "#b91c1c", marginTop: "0.4rem" }}>
                            Reviewed on {new Date(comp.resolved_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      )}

                      {isPending && (
                        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", padding: "0.75rem 1rem", fontSize: "0.825rem", color: "#92400e", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <Clock size={15} color="#d97706" />
                          <span>Your complaint is currently in the Administrator's review queue. Corrective action or explanation will be posted here once resolved.</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
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
            {/* Helper Banner for Item Removal Negotiation */}
            {canRespond && !pendingRequest && quotation.items.length > 1 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#fff1f2",
                  border: "1px solid #fecdd3",
                  borderRadius: "10px",
                  padding: "0.65rem 1rem",
                  marginBottom: "1rem",
                  fontSize: "0.825rem",
                  color: "#9f1239",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Trash2 size={16} color="#e11d48" />
                  <span>
                    <strong>Need to remove products?</strong> Click <em>"Request Removal"</em> on any line item below to propose removing it from this quotation.
                  </span>
                </div>
                {selectedRemovalItemIds.length > 0 && (
                  <span style={{ fontWeight: 700, color: "#be123c" }}>
                    {selectedRemovalItemIds.length} item(s) marked
                  </span>
                )}
              </div>
            )}

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
                    {canRespond && <th style={{ textAlign: "center", width: "160px" }}>Item Adjustment</th>}
                  </tr>
                </thead>
                <tbody>
                  {quotation.items.map((item) => {
                    const isPendingRemoval = pendingRequest?.removedItemIds?.includes(item.id);
                    const isMarkedForRemoval = selectedRemovalItemIds.includes(item.id);

                    return (
                      <tr
                        key={item.id}
                        style={{
                          background: isMarkedForRemoval
                            ? "rgba(254, 242, 242, 0.75)"
                            : isPendingRemoval
                            ? "rgba(254, 243, 199, 0.5)"
                            : undefined,
                          color: isMarkedForRemoval ? "#94a3b8" : undefined,
                        }}
                      >
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                            <strong style={{ color: isMarkedForRemoval ? "#94a3b8" : "#0f172a", textDecoration: isMarkedForRemoval ? "line-through" : "none" }}>
                              {item.name}
                            </strong>
                            {isPendingRemoval && (
                              <span className="badge badge-pending" style={{ fontSize: "0.7rem", padding: "0.15rem 0.45rem" }}>
                                ⏳ Removal Pending Sales Approval
                              </span>
                            )}
                            {isMarkedForRemoval && (
                              <span className="badge badge-rejected" style={{ fontSize: "0.7rem", padding: "0.15rem 0.45rem" }}>
                                Marked for Removal
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ color: "#64748b" }}>{item.category}</td>
                        <td><span style={{ fontWeight: 700, textDecoration: isMarkedForRemoval ? "line-through" : "none" }}>{item.quantity}</span></td>
                        <td>{currency(item.unitPrice)}</td>
                        <td><span style={{ color: item.discountPercent > 0 ? "#ef4444" : "#64748b", fontWeight: 600 }}>{item.discountPercent}%</span></td>
                        <td style={{ textAlign: "right", fontWeight: 800, color: isMarkedForRemoval ? "#94a3b8" : "#0f172a", textDecoration: isMarkedForRemoval ? "line-through" : "none" }}>
                          {currency(item.lineTotal)}
                        </td>
                        {canRespond && (
                          <td style={{ textAlign: "center" }}>
                            {isPendingRemoval ? (
                              <span className="badge badge-pending" style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }}>
                                ⏳ Removal Pending
                              </span>
                            ) : pendingRequest ? (
                              <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                                Review in Progress
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => toggleRemovalItem(item.id)}
                                style={{
                                  padding: "0.35rem 0.75rem",
                                  fontSize: "0.775rem",
                                  fontWeight: 700,
                                  borderRadius: "8px",
                                  border: isMarkedForRemoval ? "1px solid #dc2626" : "1px solid #fca5a5",
                                  background: isMarkedForRemoval ? "#dc2626" : "#fff1f2",
                                  color: isMarkedForRemoval ? "#ffffff" : "#be123c",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.35rem",
                                  transition: "all 0.2s ease",
                                }}
                              >
                                {isMarkedForRemoval ? (
                                  <>Undo Removal</>
                                ) : (
                                  <><Trash2 size={13} /> Request Removal</>
                                )}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Proposed Adjusted Quote Summary if items are marked for removal */}
            {selectedRemovalItemIds.length > 0 && (
              <div
                style={{
                  background: "linear-gradient(135deg, #fef2f2 0%, #fff7ed 100%)",
                  border: "1.5px solid #f87171",
                  borderRadius: "12px",
                  padding: "1rem 1.25rem",
                  marginBottom: "1.25rem",
                  boxShadow: "0 4px 12px rgba(239, 68, 68, 0.08)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#991b1b", fontWeight: 800, fontSize: "0.95rem" }}>
                    <Trash2 size={18} color="#dc2626" />
                    <span>{selectedRemovalItemIds.length} item(s) selected for removal from this quotation</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.85rem", color: "#64748b" }}>Proposed New Total:</span>
                    <strong style={{ fontSize: "1.2rem", color: "#b91c1c", fontWeight: 800 }}>{currency(proposedFinalAmount)}</strong>
                    <span style={{ fontSize: "0.8rem", color: "#94a3b8", textDecoration: "line-through" }}>{currency(quotation.finalAmount)}</span>
                  </div>
                </div>
                <div style={{ fontSize: "0.825rem", color: "#7f1d1d", marginTop: "0.4rem", lineHeight: "1.4" }}>
                  When you submit your counter-offer below, a removal request will be dispatched to your sales representative. Once the sales representative reviews and approves, your quotation will be updated automatically.
                </div>
              </div>
            )}

            {pendingRequest && (
              <div className="alert alert-success" style={{ marginBottom: "1.25rem", borderRadius: "12px", padding: "1rem 1.25rem" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", width: "100%" }}>
                  <MessageSquare size={20} color="#059669" style={{ marginTop: "0.15rem", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#065f46", marginBottom: "0.25rem" }}>
                      Active Negotiation Request Pending Sales Review
                    </div>
                    {pendingRequest.removedItemIds?.length > 0 && (
                      <div style={{ fontSize: "0.85rem", color: "#065f46", marginTop: "0.25rem" }}>
                        • <strong>Requested Item Removals:</strong>{" "}
                        {pendingRequest.requestedItems?.length > 0
                          ? pendingRequest.requestedItems.map((i) => `${i.name} (Qty: ${i.quantity})`).join(", ")
                          : `${pendingRequest.removedItemIds.length} item(s)`}
                      </div>
                    )}
                    {pendingRequest.requestedDiscountPercent !== null && (
                      <div style={{ fontSize: "0.85rem", color: "#065f46", marginTop: "0.15rem" }}>
                        • <strong>Requested Discount:</strong> {pendingRequest.requestedDiscountPercent}%
                      </div>
                    )}
                    {pendingRequest.requestedDeliveryDate && (
                      <div style={{ fontSize: "0.85rem", color: "#065f46", marginTop: "0.15rem" }}>
                        • <strong>Requested Delivery Date:</strong> {pendingRequest.requestedDeliveryDate}
                      </div>
                    )}
                    {pendingRequest.customerComment && (
                      <div style={{ fontSize: "0.85rem", color: "#065f46", marginTop: "0.15rem", fontStyle: "italic" }}>
                        • <strong>Customer Note:</strong> "{pendingRequest.customerComment}"
                      </div>
                    )}
                    <div style={{ fontSize: "0.78rem", color: "#047857", marginTop: "0.4rem" }}>
                      Submitted {new Date(pendingRequest.createdAt).toLocaleString("en-IN")}. Your sales representative has been notified and will update the quotation upon agreement.
                    </div>
                  </div>
                </div>
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

                <div style={{ display: "flex", gap: "0.85rem", flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    className="btn-primary"
                    type="submit"
                    disabled={!canRespond || Boolean(pendingRequest) || actionLoading}
                    style={{ padding: "0.65rem 1.25rem" }}
                  >
                    <Send size={16} />{" "}
                    {actionLoading
                      ? "Submitting request..."
                      : selectedRemovalItemIds.length > 0
                      ? `Submit Removal (${selectedRemovalItemIds.length}) & Counter-Offer`
                      : "Submit Counter-Offer"}
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

                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={() => onNavigate && onNavigate(`/customer/messages`)}
                    style={{ padding: "0.65rem 1.25rem", background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" }}
                  >
                    <MessageSquare size={16} color="#1d4ed8" /> Open Live Chat & Negotiation
                  </button>
                </div>
              </form>
            </div>

            {/* PART 1: DELIVERY DESTINATION FORM (Always available when viewing quotation) */}
            {Boolean(quotation) && (
              <div
                style={{
                  background: "linear-gradient(135deg, rgba(239, 246, 255, 0.95), rgba(240, 253, 244, 0.95))",
                  borderRadius: "14px",
                  border: "2px solid #3b82f6",
                  padding: "1.5rem",
                  marginTop: "1.5rem",
                  boxShadow: "0 10px 25px -5px rgba(37, 99, 235, 0.1)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem" }}>
                  <Building2 size={22} color="#2563eb" />
                  <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#1e3a8a", letterSpacing: "0.02em" }}>
                    DELIVERY DESTINATION
                  </h3>
                </div>
                <p style={{ color: "#334155", fontSize: "0.9rem", fontWeight: 600, marginBottom: "1.25rem" }}>
                  Where should we deliver your order? Once confirmed, our Operations Smart Warehouse Route Optimizer will calculate the optimal fulfillment path.
                </p>

                <form onSubmit={submitDestinationForm}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem" }}>
                    <label className="form-group" style={{ margin: 0 }}>
                      <span className="form-label" style={{ fontWeight: 700, color: "#1e293b" }}>Full Delivery Address</span>
                      <input
                        className="form-input no-icon"
                        type="text"
                        required
                        placeholder="e.g. Connaught Place, Block C, Inner Circle"
                        value={destAddress}
                        onChange={(e) => setDestAddress(e.target.value)}
                      />
                    </label>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
                      <label className="form-group" style={{ margin: 0 }}>
                        <span className="form-label" style={{ fontWeight: 700, color: "#1e293b" }}>City</span>
                        <input
                          className="form-input no-icon"
                          type="text"
                          required
                          placeholder="e.g. Delhi"
                          value={destCity}
                          onChange={(e) => setDestCity(e.target.value)}
                        />
                      </label>

                      <label className="form-group" style={{ margin: 0 }}>
                        <span className="form-label" style={{ fontWeight: 700, color: "#1e293b" }}>State</span>
                        <input
                          className="form-input no-icon"
                          type="text"
                          required
                          placeholder="e.g. Delhi"
                          value={destState}
                          onChange={(e) => setDestState(e.target.value)}
                        />
                      </label>

                      <label className="form-group" style={{ margin: 0 }}>
                        <span className="form-label" style={{ fontWeight: 700, color: "#1e293b" }}>PIN / ZIP</span>
                        <input
                          className="form-input no-icon"
                          type="text"
                          required
                          placeholder="e.g. 110001"
                          value={destZip}
                          onChange={(e) => setDestZip(e.target.value)}
                        />
                      </label>

                      <label className="form-group" style={{ margin: 0 }}>
                        <span className="form-label" style={{ fontWeight: 700, color: "#1e293b" }}>Country</span>
                        <input
                          className="form-input no-icon"
                          type="text"
                          required
                          placeholder="e.g. India"
                          value={destCountry}
                          onChange={(e) => setDestCountry(e.target.value)}
                        />
                      </label>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", background: "rgba(255,255,255,0.7)", padding: "0.85rem", borderRadius: "10px", border: "1px solid #cbd5e1" }}>
                      <label className="form-group" style={{ margin: 0 }}>
                        <span className="form-label" style={{ fontSize: "0.8rem", color: "#64748b" }}>Latitude (Auto/Optional)</span>
                        <input
                          className="form-input no-icon"
                          type="number"
                          step="any"
                          placeholder="28.6139"
                          value={destLat}
                          onChange={(e) => setDestLat(e.target.value)}
                        />
                      </label>

                      <label className="form-group" style={{ margin: 0 }}>
                        <span className="form-label" style={{ fontSize: "0.8rem", color: "#64748b" }}>Longitude (Auto/Optional)</span>
                        <input
                          className="form-input no-icon"
                          type="number"
                          step="any"
                          placeholder="77.2090"
                          value={destLng}
                          onChange={(e) => setDestLng(e.target.value)}
                        />
                      </label>
                    </div>
                  </div>

                  <button
                    className="btn-primary"
                    type="submit"
                    disabled={actionLoading}
                    style={{
                      marginTop: "1.25rem",
                      width: "100%",
                      padding: "0.85rem",
                      fontSize: "1.05rem",
                      fontWeight: 800,
                      background: "#2563eb",
                      boxShadow: "0 4px 14px rgba(37, 99, 235, 0.3)",
                    }}
                  >
                    <CheckCircle size={18} /> {actionLoading ? "Saving Delivery Destination..." : "Confirm Delivery Destination"}
                  </button>
                </form>
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
