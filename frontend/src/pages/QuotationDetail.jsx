import { useEffect, useState, useMemo } from "react";
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Mail, Printer,
  Edit3, Save, X, Plus, Trash2, RotateCcw, Send
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { printOrExportPDF } from "../utils/exportUtils";

const API_BASE = "http://localhost:5000/api";
const currency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const EDITABLE_STATUSES = ["DRAFT", "PENDING_APPROVAL", "NEGOTIATION"];

export default function QuotationDetail({ quotationId, onNavigate }) {
  const { token, user } = useAuth();
  const [quotation, setQuotation] = useState(null);
  const [error, setError] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [notification, setNotification] = useState(null);
  const [pricingAiLoading, setPricingAiLoading] = useState(false);
  const [pricingAiResult, setPricingAiResult] = useState(null);

  // ─── Edit Mode State ───────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [editItems, setEditItems] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addProductId, setAddProductId] = useState("");
  const [addQty, setAddQty] = useState(1);
  const [addDiscount, setAddDiscount] = useState(0);
  const [addUnitPrice, setAddUnitPrice] = useState("");

  // ─── Load quotation ────────────────────────────────────────
  useEffect(() => {
    loadQuotation();
  }, [quotationId, token]);

  async function loadQuotation() {
    try {
      const response = await fetch(`${API_BASE}/quotations/${quotationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load quotation.");
      setQuotation(data.data);
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  // ─── Load products (for edit mode) ────────────────────────
  async function loadProducts() {
    if (allProducts.length > 0) return;
    try {
      const res = await fetch(`${API_BASE}/quotations/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setAllProducts(data.data || []);
    } catch {
      // non-fatal
    }
  }

  // ─── Enter edit mode ───────────────────────────────────────
  function handleEnterEdit() {
    loadProducts();
    setEditItems(
      (quotation.items || []).map((item) => ({
        productId: item.productId,
        name: item.name,
        category: item.category,
        sku: item.sku,
        unitPrice: item.unitPrice,
        costPrice: item.costPrice || item.cost || 0,
        quantity: item.quantity,
        discountPercent: item.discountPercent,
      }))
    );
    setEditError("");
    setAddProductId("");
    setAddQty(1);
    setAddDiscount(0);
    setAddUnitPrice("");
    setEditMode(true);
  }

  function handleCancelEdit() {
    setEditMode(false);
    setEditItems([]);
    setEditError("");
  }

  // ─── Update an existing edit-item field ───────────────────
  function updateEditItem(idx, field, value) {
    setEditItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        let val = value;
        if (field === "quantity") {
          val = Math.max(1, Math.floor(Number(value) || 1));
        } else if (field === "discountPercent") {
          val = Math.min(100, Math.max(0, Number(value) || 0));
        } else if (field === "unitPrice") {
          val = Math.max(0, Number(value) || 0);
        }
        return { ...item, [field]: val };
      })
    );
  }

  function removeEditItem(idx) {
    setEditItems((prev) => prev.filter((_, i) => i !== idx));
  }

  // ─── Add a new product row in edit mode ───────────────────
  function handleAddProductRow() {
    const product = allProducts.find((p) => p.id === addProductId);
    if (!product) return setEditError("Select a valid product to add.");
    if (editItems.some((item) => item.productId === product.id)) {
      return setEditError("That product is already in the quotation.");
    }
    const safeQty = Math.max(1, Math.floor(Number(addQty) || 1));
    const safeDiscount = Math.min(100, Math.max(0, Number(addDiscount) || 0));
    const safePrice = addUnitPrice !== "" ? Math.max(0, Number(addUnitPrice)) : Number(product.unitPrice);
    setEditItems((prev) => [
      ...prev,
      {
        productId: product.id,
        name: product.name,
        category: product.category,
        sku: product.sku,
        unitPrice: safePrice,
        costPrice: Number(product.costPrice || 0),
        quantity: safeQty,
        discountPercent: safeDiscount,
      },
    ]);
    setAddProductId("");
    setAddQty(1);
    setAddDiscount(0);
    setAddUnitPrice("");
    setEditError("");
  }

  // ─── Save changes (PUT) ────────────────────────────────────
  async function handleSaveChanges() {
    if (editItems.length === 0) return setEditError("At least one product is required.");
    setSaving(true);
    setEditError("");
    try {
      const res = await fetch(`${API_BASE}/quotations/${quotationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: editItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountPercent: item.discountPercent,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unable to update quotation.");
      setQuotation(data.data);
      setEditMode(false);
      setEditError("");
    } catch (err) {
      setEditError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ─── Save & Re-submit for risk analysis ───────────────────
  async function handleSaveAndSubmit() {
    if (editItems.length === 0) return setEditError("At least one product is required.");
    setSubmitting(true);
    setEditError("");
    try {
      // 1. Save edits first (resets to DRAFT)
      const updateRes = await fetch(`${API_BASE}/quotations/${quotationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: editItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountPercent: item.discountPercent,
          })),
        }),
      });
      const updateData = await updateRes.json();
      if (!updateRes.ok) throw new Error(updateData.message || "Unable to update quotation.");

      // 2. Submit for risk analysis
      const submitRes = await fetch(`${API_BASE}/quotations/${quotationId}/submit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const submitData = await submitRes.json();
      if (!submitRes.ok) throw new Error(submitData.message || "Risk analysis failed.");

      setQuotation(submitData.data);
      setEditMode(false);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ─── AI Pricing Recommendation ────────────────────────────
  const handleRecommendPricing = async () => {
    setPricingAiLoading(true);
    setPricingAiResult(null);
    try {
      const response = await fetch(`${API_BASE}/ai/pricing-recommendation`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          productCosts: quotation.items.map((i) => ({ name: i.name, category: i.category, unitPrice: i.unitPrice })),
          currentMargin: quotation.marginPercentage,
          tierMaxDiscount: quotation.customer?.tierMaxDiscount || 15,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to fetch AI pricing");
      setPricingAiResult(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setPricingAiLoading(false);
    }
  };

  // ─── Finalize ──────────────────────────────────────────────
  async function handleFinalizeQuotation() {
    setFinalizing(true);
    setError("");
    setNotification(null);
    try {
      const response = await fetch(`${API_BASE}/quotations/${quotationId}/finalize`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to finalize quotation.");
      setQuotation(data.data);
      setNotification({
        title: "Quotation Finalized",
        quotationNumber: data.data.quotationNumber,
        emailSent: Boolean(data.notification?.emailSent),
        email: data.notification?.email || data.data.customer?.email || data.data.salesRep?.email,
        error: data.notification?.error,
      });
    } catch (finalizeErr) {
      setError(finalizeErr.message);
    } finally {
      setFinalizing(false);
    }
  }

  // ─── PDF Export ───────────────────────────────────────────
  const handlePrintQuotation = () => {
    if (!quotation) return;
    const itemsData = (quotation.items || []).map((item) => ({
      product: item.product?.name || item.name || "Item",
      category: item.product?.category || "Standard",
      qty: item.quantity,
      unitPrice: currency(item.unitPrice),
      discount: `${item.discountPercent || 0}%`,
      total: currency(item.totalPrice),
    }));
    const headers = [
      { key: "product", label: "Product / Line Item" },
      { key: "category", label: "Category" },
      { key: "qty", label: "Qty" },
      { key: "unitPrice", label: "Unit Price" },
      { key: "discount", label: "Discount" },
      { key: "total", label: "Line Total" },
    ];
    const summaryCards = [
      { label: "Subtotal", value: currency(quotation.subtotal), color: "#0f172a" },
      { label: "Total Discount", value: currency(quotation.discountAmount), color: "#b91c1c" },
      { label: "Final Amount", value: currency(quotation.finalAmount), color: "#1e40af" },
      { label: "Deal Margin", value: `${quotation.marginPercent || 25}%`, color: "#166534" },
    ];
    const metadata = [
      { label: "Quotation Ref", value: quotation.quotationNumber },
      { label: "Customer", value: quotation.customer?.companyName || quotation.customer?.fullName || "Client" },
      { label: "Sales Representative", value: quotation.salesRep?.fullName || "Representative" },
      { label: "Status", value: quotation.status },
    ];
    printOrExportPDF({ title: `Commercial Quotation: ${quotation.quotationNumber}`, subtitle: `Official quotation proposal issued for ${quotation.customer?.companyName || quotation.customer?.fullName}.`, metadata, headers, rows: itemsData, summaryCards });
  };

  // ─── Live edit totals ─────────────────────────────────────
  const editTotals = useMemo(() => {
    return editItems.reduce(
      (acc, item) => {
        const lineSubtotal = item.unitPrice * item.quantity;
        const lineDiscount = (lineSubtotal * item.discountPercent) / 100;
        acc.subtotal += lineSubtotal;
        acc.discount += lineDiscount;
        acc.totalCost += (item.costPrice || 0) * item.quantity;
        return acc;
      },
      { subtotal: 0, discount: 0, totalCost: 0 }
    );
  }, [editItems]);
  const editFinal = editTotals.subtotal - editTotals.discount;
  const editGrossMargin = editFinal - editTotals.totalCost;
  const editMarginPct = editFinal > 0 ? (editGrossMargin / editFinal) * 100 : 0;

  // Available products for adding (not already in editItems)
  const availableProducts = allProducts.filter(
    (p) => !editItems.some((item) => item.productId === p.id)
  );

  // ─── Error / Loading states ────────────────────────────────
  if (error)
    return (
      <main className="main-content">
        <div className="alert alert-danger"><AlertTriangle size={17} /> {error}</div>
        <button className="btn-secondary" onClick={() => onNavigate("/sales/quotations")}>
          <ArrowLeft size={16} /> Back to Quotations
        </button>
      </main>
    );
  if (!quotation)
    return (
      <main className="main-content">
        <div style={{ color: "#64748b" }}>Loading quotation...</div>
      </main>
    );

  const canEdit = EDITABLE_STATUSES.includes(quotation.status) && quotation.status !== "FINALIZED";

  return (
    <main className="main-content">
      <button className="btn-secondary" onClick={() => onNavigate("/sales/quotations")}>
        <ArrowLeft size={16} /> Back to Quotations
      </button>

      {/* ── Page Header ── */}
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          gap: "1rem", flexWrap: "wrap", margin: "1.25rem 0 1.5rem",
        }}
      >
        <div>
          <div style={{ color: "#2563eb", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Quotation Detail
          </div>
          <h1 style={{ fontSize: "1.9rem", fontWeight: 800, color: "#0f172a", marginTop: "0.35rem" }}>
            {quotation.quotationNumber}
          </h1>
          <p style={{ color: "#64748b", marginTop: "0.4rem" }}>
            Created {new Date(quotation.createdAt).toLocaleString("en-IN")}
            {quotation.updatedAt && quotation.updatedAt !== quotation.createdAt && (
              <span style={{ marginLeft: "0.75rem", color: "#94a3b8" }}>
                · Updated {new Date(quotation.updatedAt).toLocaleString("en-IN")}
              </span>
            )}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handlePrintQuotation}
            style={{ padding: "0.5rem 0.95rem", fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
          >
            <Printer size={16} color="#2563eb" /> Print / PDF
          </button>

          <span className={`badge ${quotation.status === "FINALIZED" ? "badge-active" : quotation.status === "REJECTED" ? "badge-rejected" : "badge-pending"}`}>
            {quotation.status}
          </span>

          {/* Edit Mode Toggling */}
          {canEdit && !editMode && (
            <button
              type="button"
              className="btn-secondary"
              onClick={handleEnterEdit}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", borderColor: "#f59e0b", color: "#b45309" }}
            >
              <Edit3 size={16} /> Edit Quotation
            </button>
          )}

          {editMode && (
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCancelEdit}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
            >
              <X size={16} /> Cancel Edit
            </button>
          )}

          {!editMode && quotation.status !== "FINALIZED" && (
            <button
              className="btn-success"
              onClick={handleFinalizeQuotation}
              disabled={finalizing}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
            >
              {finalizing ? "Finalizing..." : <><CheckCircle2 size={16} /> Finalize Quotation</>}
            </button>
          )}
          {!editMode && quotation.status !== "FINALIZED" && (
            <button
              className="btn-secondary"
              onClick={handleRecommendPricing}
              disabled={pricingAiLoading}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
            >
              {pricingAiLoading ? "Analyzing..." : "✨ AI Pricing"}
            </button>
          )}
        </div>
      </div>

      {/* ── AI Pricing Panel ── */}
      {pricingAiResult && (
        <div style={{ margin: "0 0 1.5rem", padding: "1.25rem", borderRadius: "12px", background: "linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%)", border: "1px solid #f5d0fe", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#86198f", margin: 0 }}>AI Pricing Strategy</h3>
            <button onClick={() => setPricingAiResult(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#c026d3" }}>✕</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
            <div style={{ padding: "0.5rem 1rem", background: "#fdf4ff", border: "2px solid #d946ef", borderRadius: "8px", color: "#a21caf", fontWeight: 800, fontSize: "1.25rem" }}>
              Recommend: {pricingAiResult.recommendedDiscount}% Discount
            </div>
          </div>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#701a75", lineHeight: "1.5" }}>
            <strong>Reasoning:</strong> {pricingAiResult.reasoning}
          </p>
        </div>
      )}

      {/* ── Finalized Notification ── */}
      {notification && (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "14px", padding: "1.25rem 1.5rem", marginBottom: "1.5rem", boxShadow: "0 4px 12px rgba(16,185,129,0.1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#15803d", fontWeight: 800, fontSize: "1.05rem" }}>
            <CheckCircle2 size={20} color="#16a34a" /> ✓ Quotation Finalized
          </div>
          <div style={{ color: "#166534", marginTop: "0.35rem", fontWeight: 700, fontSize: "0.95rem" }}>
            {notification.quotationNumber} has been finalized successfully.
          </div>
          {notification.emailSent ? (
            <div style={{ marginTop: "0.75rem", padding: "0.6rem 0.85rem", background: "#ffffff", border: "1px solid #86efac", borderRadius: "8px", display: "inline-flex", alignItems: "center", gap: "0.5rem", color: "#14532d", fontSize: "0.875rem", fontWeight: 600 }}>
              <Mail size={16} color="#16a34a" />
              <span>Confirmation email sent to:</span>
              <strong style={{ color: "#15803d", textDecoration: "underline" }}>{notification.email}</strong>
            </div>
          ) : (
            <div style={{ marginTop: "0.75rem", padding: "0.6rem 0.85rem", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", color: "#92400e", fontSize: "0.85rem" }}>
              ⚠️ Status updated to FINALIZED in database.
            </div>
          )}
          <div style={{ marginTop: "0.85rem", paddingTop: "0.85rem", borderTop: "1px dashed #bbf7d0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.875rem", color: "#166534", fontWeight: 700 }}>🚚 Order created in fulfillment queue.</span>
            <button className="btn-primary" onClick={() => onNavigate("/operations/dashboard")} style={{ fontSize: "0.85rem", padding: "0.45rem 0.95rem", width: "auto" }}>
              Open Operations Route Optimizer →
            </button>
          </div>
        </div>
      )}

      {/* ── Customer Info Card ── */}
      <section style={{ background: "#fff", border: "1px solid var(--border-light)", borderRadius: "16px", padding: "1.5rem", boxShadow: "var(--shadow-sm)", marginBottom: "1.25rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "1rem" }}>
        <div><strong>Customer</strong><br />{quotation.customer?.companyName || quotation.customer?.fullName}</div>
        <div><strong>Customer ID</strong><br />{quotation.customer?.customerCode}</div>
        <div><strong>Email</strong><br />{quotation.customer?.email}</div>
        <div><strong>Sales Rep</strong><br />{quotation.salesRep?.fullName}</div>
      </section>

      {/* ── Customer Request Banner ── */}
      {quotation.customerRequest && (
        <div className="alert alert-warning" style={{ marginBottom: "1.25rem" }}>
          Customer response: {quotation.customerRequest.status}
          {quotation.customerRequest.requestedDiscountPercent !== null && ` · Requested discount: ${quotation.customerRequest.requestedDiscountPercent}%`}
          {quotation.customerRequest.requestedDeliveryDate && ` · Requested delivery: ${quotation.customerRequest.requestedDeliveryDate}`}
          {quotation.customerRequest.customerComment && ` · ${quotation.customerRequest.customerComment}`}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          EDIT MODE
      ════════════════════════════════════════════════════════════ */}
      {editMode && (
        <section
          style={{
            background: "#fff",
            border: "2px solid #f59e0b",
            borderRadius: "16px",
            padding: "1.5rem",
            boxShadow: "0 4px 24px rgba(245,158,11,0.1)",
            marginBottom: "1.25rem",
          }}
        >
          {/* Edit Banner */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#fef3c7", color: "#d97706", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Edit3 size={18} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#92400e" }}>Edit Quotation</h2>
                <span style={{ fontSize: "0.78rem", color: "#b45309" }}>
                  Saving will reset this quotation to DRAFT. Re-submit after editing to run risk analysis again.
                </span>
              </div>
            </div>
          </div>

          {editError && (
            <div className="alert alert-danger" style={{ marginBottom: "1rem" }}>
              <AlertTriangle size={16} /> {editError}
            </div>
          )}

          {/* Editable Line Items Table */}
          <div style={{ overflowX: "auto", marginBottom: "1.25rem" }}>
            <table className="data-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ minWidth: "160px" }}>Product</th>
                  <th style={{ minWidth: "100px" }}>Category</th>
                  <th style={{ minWidth: "120px" }}>Unit Price (₹)</th>
                  <th style={{ minWidth: "90px" }}>Quantity</th>
                  <th style={{ minWidth: "120px" }}>Discount (%)</th>
                  <th style={{ minWidth: "120px" }}>Line Total</th>
                  <th style={{ width: "44px" }}></th>
                </tr>
              </thead>
              <tbody>
                {editItems.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
                      No products. Add one below.
                    </td>
                  </tr>
                ) : (
                  editItems.map((item, idx) => {
                    const lineSubtotal = item.unitPrice * item.quantity;
                    const lineDiscount = (lineSubtotal * item.discountPercent) / 100;
                    const lineTotal = lineSubtotal - lineDiscount;
                    return (
                      <tr key={item.productId}>
                        <td style={{ fontWeight: 700 }}>{item.name}</td>
                        <td><span style={{ fontSize: "0.78rem", color: "#64748b" }}>{item.category}</span></td>
                        <td>
                          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                            <span style={{ position: "absolute", left: "8px", color: "#64748b", fontSize: "0.85rem", fontWeight: 600 }}>₹</span>
                            <input
                              type="number"
                              min="0"
                              value={item.unitPrice}
                              onChange={(e) => updateEditItem(idx, "unitPrice", e.target.value)}
                              onKeyDown={(e) => ["-", "+", "e"].includes(e.key) && e.preventDefault()}
                              style={{ width: "100%", padding: "0.45rem 0.5rem 0.45rem 1.5rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.88rem", fontWeight: 700, background: "#f8fafc" }}
                            />
                          </div>
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateEditItem(idx, "quantity", e.target.value)}
                            onKeyDown={(e) => ["-", "+", "e", "."].includes(e.key) && e.preventDefault()}
                            style={{ width: "70px", padding: "0.45rem 0.5rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.88rem", fontWeight: 700, background: "#f8fafc" }}
                          />
                        </td>
                        <td>
                          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={item.discountPercent}
                              onChange={(e) => updateEditItem(idx, "discountPercent", e.target.value)}
                              onKeyDown={(e) => ["-", "+", "e"].includes(e.key) && e.preventDefault()}
                              style={{ width: "100%", padding: "0.45rem 1.6rem 0.45rem 0.5rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.88rem", background: "#f8fafc" }}
                            />
                            <span style={{ position: "absolute", right: "8px", color: "#64748b", fontSize: "0.85rem", fontWeight: 700, pointerEvents: "none" }}>%</span>
                          </div>
                        </td>
                        <td style={{ fontWeight: 800, color: "#0f172a" }}>{currency(lineTotal)}</td>
                        <td>
                          <button
                            type="button"
                            title="Remove item"
                            onClick={() => removeEditItem(idx)}
                            style={{ background: "transparent", border: "none", cursor: "pointer", color: "#ef4444", padding: "4px", borderRadius: "6px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "#fef2f2"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Add Product Row */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px dashed #cbd5e1",
              borderRadius: "12px",
              padding: "1rem",
              marginBottom: "1.25rem",
            }}
          >
            <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.85rem", fontWeight: 700, color: "#475569", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Plus size={15} /> Add Product
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: "0.65rem", alignItems: "flex-end" }}>
              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: "0.25rem" }}>Product</label>
                <select
                  value={addProductId}
                  onChange={(e) => {
                    const p = allProducts.find((x) => x.id === e.target.value);
                    setAddProductId(e.target.value);
                    if (p) setAddUnitPrice(p.unitPrice);
                  }}
                  className="form-input no-icon"
                  style={{ fontSize: "0.85rem" }}
                >
                  <option value="">— Select product —</option>
                  {availableProducts.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: "0.25rem" }}>Unit Price (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={addUnitPrice}
                  onChange={(e) => setAddUnitPrice(e.target.value)}
                  onKeyDown={(e) => ["-", "+", "e"].includes(e.key) && e.preventDefault()}
                  placeholder="Auto"
                  className="form-input"
                  style={{ fontSize: "0.85rem" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: "0.25rem" }}>Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={addQty}
                  onChange={(e) => setAddQty(e.target.value)}
                  onKeyDown={(e) => ["-", "+", "e", "."].includes(e.key) && e.preventDefault()}
                  className="form-input"
                  style={{ fontSize: "0.85rem" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: "0.25rem" }}>Discount (%)</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={addDiscount}
                    onChange={(e) => setAddDiscount(e.target.value)}
                    onKeyDown={(e) => ["-", "+", "e"].includes(e.key) && e.preventDefault()}
                    className="form-input"
                    style={{ fontSize: "0.85rem", paddingRight: "1.7rem" }}
                  />
                  <span style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", color: "#64748b", fontSize: "0.85rem", fontWeight: 700, pointerEvents: "none" }}>%</span>
                </div>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={handleAddProductRow}
                disabled={!addProductId}
                style={{ alignSelf: "flex-end", padding: "0.6rem 1rem", display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem" }}
              >
                <Plus size={15} /> Add
              </button>
            </div>
          </div>

          {/* Live Totals Preview */}
          <div
            style={{
              background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
              border: "1px solid #bae6fd",
              borderRadius: "12px",
              padding: "1rem 1.25rem",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: "1rem",
              marginBottom: "1.25rem",
            }}
          >
            {[
              { label: "Subtotal", value: currency(editTotals.subtotal), color: "#0f172a" },
              { label: "Total Discount", value: `-${currency(editTotals.discount)}`, color: "#dc2626" },
              { label: "Final Amount", value: currency(editFinal), color: "#1d4ed8", big: true },
              { label: "Gross Margin", value: currency(editGrossMargin), color: editGrossMargin >= 0 ? "#16a34a" : "#dc2626" },
              { label: "Margin %", value: `${editMarginPct.toFixed(1)}%`, color: editMarginPct >= 15 ? "#16a34a" : "#dc2626" },
            ].map(({ label, value, color, big }) => (
              <div key={label}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: "0.15rem" }}>{label}</span>
                <strong style={{ fontSize: big ? "1.05rem" : "0.92rem", color, fontWeight: 800 }}>{value}</strong>
              </div>
            ))}
          </div>

          {/* Save / Submit Buttons */}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleSaveChanges}
              disabled={saving || submitting}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
            >
              {saving ? "Saving..." : <><Save size={16} /> Save Changes (Keep as DRAFT)</>}
            </button>
            <button
              type="button"
              className="btn-success"
              onClick={handleSaveAndSubmit}
              disabled={saving || submitting}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
            >
              {submitting ? "Submitting..." : <><Send size={16} /> Save &amp; Re-Submit for Risk Analysis</>}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCancelEdit}
              disabled={saving || submitting}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
            >
              <RotateCcw size={15} /> Cancel
            </button>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════
          READ-ONLY VIEW (normal/non-edit mode)
      ════════════════════════════════════════════════════════════ */}
      {!editMode && (
        <>
          <div className="data-table-card">
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Quantity</th>
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
                      <td style={{ fontWeight: 800 }}>{currency(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Risk section */}
          {quotation.risk && (
            <section
              style={{
                marginTop: "1.25rem", background: "#fff", border: "1px solid var(--border-light)",
                borderRadius: "16px", padding: "1.5rem", boxShadow: "var(--shadow-sm)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "flex-start" }}>
                <div>
                  <div style={{ color: "#2563eb", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>Risk engine analysis</div>
                  <h2 style={{ fontSize: "1.2rem", marginTop: "0.35rem" }}>Submission governance</h2>
                </div>
                <span className={`badge ${quotation.risk.level === "CRITICAL" || quotation.risk.level === "HIGH" ? "badge-rejected" : quotation.risk.level === "MEDIUM" ? "badge-pending" : "badge-active"}`}>
                  {quotation.risk.level} · {quotation.risk.score.toFixed(1)}/100
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.85rem", marginTop: "1.25rem" }}>
                <div><strong>Approval route</strong><br />{quotation.risk.approvalRoute}</div>
                <div><strong>Analyzed at</strong><br />{new Date(quotation.risk.analyzedAt).toLocaleString("en-IN")}</div>
              </div>
              <div style={{ marginTop: "1.25rem" }}>
                <strong>Risk factors</strong>
                <div style={{ display: "grid", gap: "0.65rem", marginTop: "0.65rem" }}>
                  {quotation.risk.factors.map((factor) => (
                    <div key={factor.name} style={{ display: "grid", gridTemplateColumns: "minmax(150px, 0.7fr) minmax(0, 1.5fr) auto", gap: "0.75rem", alignItems: "center", padding: "0.75rem", borderRadius: "8px", background: "#f8fafc" }}>
                      <strong>{factor.name.replaceAll("_", " ")}</strong>
                      <span style={{ color: "#64748b", fontSize: "0.85rem" }}>{factor.reason}</span>
                      <span style={{ fontWeight: 800, color: "#2563eb" }}>+{Number(factor.contribution).toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Summary bar */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.25rem" }}>
            <div
              className="pricing-margin-card"
              style={{ display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap", background: "#fff", border: "1px solid var(--border-light)", borderRadius: "14px", padding: "0.85rem 1.25rem", boxShadow: "var(--shadow-sm)" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span style={{ color: "#64748b", fontSize: "0.85rem", fontWeight: 500 }}>Subtotal:</span>
                <strong style={{ color: "#0f172a", fontSize: "0.95rem" }}>{currency(quotation.subtotal)}</strong>
              </div>
              <span style={{ color: "#cbd5e1" }}>•</span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span style={{ color: "#64748b", fontSize: "0.85rem", fontWeight: 500 }}>Discount:</span>
                <strong style={{ color: "#ef4444", fontSize: "0.95rem" }}>-{currency(quotation.discountAmount)}</strong>
              </div>
              <span style={{ color: "#cbd5e1" }}>•</span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span style={{ color: "#64748b", fontSize: "0.85rem", fontWeight: 500 }}>Final Price:</span>
                <strong style={{ color: "#2563eb", fontSize: "1.15rem", fontWeight: 800 }}>{currency(quotation.finalAmount)}</strong>
              </div>
              <div className="margin-summary-row"><span>Total Product Cost</span><strong>{currency(quotation.totalCost)}</strong></div>
              <div className="margin-summary-row"><span>Gross Margin</span><strong>{currency(quotation.grossMargin)}</strong></div>
              <div className="margin-summary-row"><span>Margin %</span><strong>{Number(quotation.marginPercentage || 0).toFixed(2)}%</strong></div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
