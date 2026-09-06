import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Trash2, Save, AlertTriangle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import UpsellCrossSellPanel from "../components/UpsellCrossSellPanel";

const API_BASE = "http://localhost:5000/api";
const currency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CreateQuotation({ onNavigate }) {
  const { token } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [items, setItems] = useState([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [riskPreview, setRiskPreview] = useState(null);
  const [riskPreviewLoading, setRiskPreviewLoading] = useState(false);

  useEffect(() => {
    async function loadLookups() {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [customerResponse, productResponse] = await Promise.all([
          fetch(`${API_BASE}/customers`, { headers }),
          fetch(`${API_BASE}/products`, { headers }),
        ]);
        const customerData = await customerResponse.json();
        const productData = await productResponse.json();
        if (!customerResponse.ok)
          throw new Error(
            customerData.message ||
              "Unable to load customers. Please try again.",
          );
        if (!productResponse.ok)
          throw new Error(
            productData.message || "Unable to load products. Please try again.",
          );
        setCustomers(customerData.data || []);
        setProducts(productData.data || []);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }
    loadLookups();
  }, [token]);

  const selectedCustomer = customers.find(
    (customer) => customer.id === customerId,
  );
  const availableProducts = products.filter(
    (product) => !items.some((item) => item.productId === product.id),
  );
  const totals = useMemo(
    () =>
      items.reduce(
        (result, item) => {
          const lineSubtotal = item.unitPrice * item.quantity;
          const lineDiscount = (lineSubtotal * item.discountPercent) / 100;
          result.totalCost += item.costPrice * item.quantity;
          result.subtotal += lineSubtotal;
          result.discount += lineDiscount;
          return result;
        },
        { subtotal: 0, discount: 0, totalCost: 0 },
      ),
    [items],
  );
  const finalPrice = totals.subtotal - totals.discount;
  const grossMargin = finalPrice - totals.totalCost;
  const marginPercentage =
    finalPrice === 0 ? 0 : (grossMargin / finalPrice) * 100;

  useEffect(() => {
    if (!items.length) {
      setRiskPreview(null);
      return undefined;
    }
    const timer = setTimeout(async () => {
      setRiskPreviewLoading(true);
      try {
        const response = await fetch(`${API_BASE}/quotations/risk-preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ items }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to preview risk.");
        setRiskPreview(data.data);
      } catch (previewError) {
        setRiskPreview({ error: previewError.message });
      } finally {
        setRiskPreviewLoading(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [items, token]);

  function addItem() {
    const product = products.find((entry) => entry.id === productId);
    const safeQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
    const safeDiscount = Math.min(100, Math.max(0, Number(discountPercent) || 0));
    if (!product) return setError("Select a product before adding it.");
    if (items.some((item) => item.productId === product.id))
      return setError("That product is already in the quotation.");
    setItems((current) => [
      ...current,
      {
        productId: product.id,
        name: product.name,
        category: product.category,
        unitPrice: Math.max(0, Number(product.unitPrice ?? product.unit_price) || 0),
        costPrice: Math.max(0, Number(product.costPrice ?? product.cost) || 0),
        quantity: safeQuantity,
        discountPercent: safeDiscount,
      },
    ]);
    setProductId("");
    setQuantity(1);
    setDiscountPercent(0);
    setError("");
  }

  function addRecommendedItem(recommendation) {
    if (items.some((item) => item.productId === recommendation.id))
      return setError("That product is already in the quotation.");
    setItems((current) => [
      ...current,
      {
        productId: recommendation.id,
        name: recommendation.name,
        category: recommendation.category,
        unitPrice: Math.max(0, Number(recommendation.unitPrice ?? recommendation.unit_price) || 0),
        costPrice: Math.max(0, Number(recommendation.cost ?? recommendation.costPrice) || 0),
        quantity: 1,
        discountPercent: 0,
      },
    ]);
    setError("");
  }

  function updateItem(productIdToUpdate, field, value) {
    setItems((current) =>
      current.map((item) => {
        if (item.productId !== productIdToUpdate) return item;
        let val = Number(value);
        if (isNaN(val)) val = 0;
        if (field === "quantity") {
          val = Math.max(1, Math.floor(val));
        } else if (field === "discountPercent") {
          val = Math.min(100, Math.max(0, val));
        } else if (field === "unitPrice") {
          val = Math.max(0, val);
        }
        return { ...item, [field]: val };
      })
    );
  }

  async function saveDraft(event) {
    event.preventDefault();
    if (!customerId) return setError("Select a customer before saving.");
    if (items.length === 0)
      return setError("Add at least one product before saving.");
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/quotations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customerId,
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountPercent: item.discountPercent,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Unable to save quotation.");

      const submitResponse = await fetch(
        `${API_BASE}/quotations/${data.data.id}/submit`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const submitData = await submitResponse.json();
      if (!submitResponse.ok)
        throw new Error(submitData.message || "Risk analysis failed.");
      onNavigate(`/sales/quotations/${data.data.id}`);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="main-content">
      <button
        className="btn-secondary"
        onClick={() => onNavigate("/sales/quotations")}
      >
        <ArrowLeft size={16} /> Back to Quotations
      </button>
      <div style={{ margin: "1.25rem 0 1.5rem" }}>
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
            fontSize: "1.9rem",
            fontWeight: 800,
            color: "#0f172a",
            marginTop: "0.35rem",
          }}
        >
          Create New Quotation
        </h1>
        <p style={{ color: "#64748b", marginTop: "0.4rem" }}>
          Build a draft from active customers and products.
        </p>
      </div>
      {error && (
        <div className="alert alert-danger">
          <AlertTriangle size={17} /> {error}
        </div>
      )}

      <form onSubmit={saveDraft}>
        <section
          style={{
            background: "#fff",
            border: "1px solid var(--border-light)",
            borderRadius: "16px",
            padding: "1.5rem",
            boxShadow: "var(--shadow-sm)",
            marginBottom: "1.25rem",
          }}
        >
          <h2
            style={{
              fontSize: "1.1rem",
              fontWeight: 800,
              marginBottom: "1rem",
            }}
          >
            Customer
          </h2>
          <select
            className="form-input no-icon"
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            disabled={loading}
          >
            <option value="">
              {loading
                ? "Loading customers..."
                : customers.length
                  ? "Select Customer"
                  : "No customers available."}
            </option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.companyName || customer.fullName} —{" "}
                {customer.customerCode}
              </option>
            ))}
          </select>
          {selectedCustomer && (
            <div
              style={{
                marginTop: "1.25rem",
                padding: "1rem 1.25rem",
                background: "#f8fafc",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "1rem 1.75rem",
                color: "#475569",
                fontSize: "0.875rem",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    display: "block",
                    marginBottom: "0.25rem",
                  }}
                >
                  Name
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    color: "#0f172a",
                    wordBreak: "break-word",
                    display: "block",
                  }}
                >
                  {selectedCustomer.fullName || "-"}
                </span>
              </div>
              <div style={{ minWidth: 0 }}>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    display: "block",
                    marginBottom: "0.25rem",
                  }}
                >
                  Customer ID
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    color: "#2563eb",
                    wordBreak: "break-word",
                    display: "block",
                  }}
                >
                  {selectedCustomer.customerCode || "-"}
                </span>
              </div>
              <div style={{ minWidth: 0 }}>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    display: "block",
                    marginBottom: "0.25rem",
                  }}
                >
                  Email
                </span>
                <span
                  style={{
                    color: "#334155",
                    wordBreak: "break-all",
                    overflowWrap: "break-word",
                    display: "block",
                  }}
                >
                  {selectedCustomer.email || "-"}
                </span>
              </div>
              <div style={{ minWidth: 0 }}>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    display: "block",
                    marginBottom: "0.25rem",
                  }}
                >
                  Company
                </span>
                <span
                  style={{
                    fontWeight: 600,
                    color: "#0f172a",
                    wordBreak: "break-word",
                    display: "block",
                  }}
                >
                  {selectedCustomer.companyName || "-"}
                </span>
              </div>
            </div>
          )}
        </section>

        <section
          style={{
            background: "#fff",
            border: "1px solid var(--border-light)",
            borderRadius: "16px",
            padding: "1.5rem",
            boxShadow: "var(--shadow-sm)",
            marginBottom: "1.25rem",
          }}
        >
          <div
            className="pricing-margin-card"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <h2 style={{ fontSize: "1.1rem", fontWeight: 800 }}>Products</h2>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(240px, 1fr) 130px 140px auto",
              gap: "0.85rem",
              alignItems: "flex-end",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <label htmlFor="product-select" className="form-label" style={{ marginBottom: "0.35rem", fontWeight: 700 }}>
                Product
              </label>
              <select
                id="product-select"
                className="form-input no-icon"
                style={{ height: "42px" }}
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
                disabled={loading || !availableProducts.length}
              >
                <option value="">
                  {loading
                    ? "Loading products..."
                    : availableProducts.length
                      ? "Select Product"
                      : "No products available."}
                </option>
                {availableProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} - {currency(product.unitPrice)} ({product.category})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <label htmlFor="product-qty" className="form-label" style={{ marginBottom: "0.35rem", fontWeight: 700 }}>
                Quantity
              </label>
              <input
                id="product-qty"
                className="form-input no-icon"
                style={{ height: "42px" }}
                type="number"
                min="1"
                step="1"
                value={quantity}
                onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === ".") e.preventDefault(); }}
                onChange={(event) => {
                  const val = Math.max(1, Math.floor(Number(event.target.value) || 1));
                  setQuantity(val);
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <label htmlFor="product-discount" className="form-label" style={{ marginBottom: "0.35rem", fontWeight: 700 }}>
                Discount
              </label>
              <div style={{ position: "relative", width: "100%" }}>
                <input
                  id="product-discount"
                  className="form-input no-icon"
                  style={{ height: "42px", paddingRight: "1.75rem" }}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={discountPercent}
                  onKeyDown={(e) => { if (e.key === "-" || e.key === "e") e.preventDefault(); }}
                  onChange={(event) => {
                    const val = Math.min(100, Math.max(0, Number(event.target.value) || 0));
                    setDiscountPercent(val);
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#64748b",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    pointerEvents: "none",
                  }}
                >
                  %
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <button
                type="button"
                className="btn-primary"
                onClick={addItem}
                style={{
                  height: "42px",
                  padding: "0 1.25rem",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.4rem",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                <Plus size={16} /> Add Product
              </button>
            </div>
          </div>
        </section>

        <div className="split-panel-layout" style={{ marginBottom: "1.25rem" }}>
          <section className="data-table-card split-panel-main">
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: "150px" }}>Product</th>
                    <th style={{ minWidth: "105px" }}>Category</th>
                    <th style={{ minWidth: "115px" }}>Unit Price</th>
                    <th style={{ minWidth: "90px" }}>Quantity</th>
                    <th style={{ minWidth: "110px" }}>Discount</th>
                    <th style={{ minWidth: "105px" }}>Total</th>
                    <th style={{ width: "40px" }} />
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td
                        colSpan="7"
                        style={{
                          textAlign: "center",
                          padding: "2.5rem",
                          color: "#64748b",
                        }}
                      >
                        Add products to build this quotation.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => {
                      const subtotal = item.unitPrice * item.quantity;
                      const total =
                        subtotal - (subtotal * item.discountPercent) / 100;
                      return (
                        <tr key={item.productId}>
                          <td style={{ fontWeight: 700, wordBreak: "break-word", minWidth: "150px" }}>
                            {item.name}
                          </td>
                          <td style={{ color: "#64748b", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                            {item.category}
                          </td>
                          <td>
                            <input
                              className="form-input no-icon"
                              style={{ width: "110px", height: "36px", fontSize: "0.875rem" }}
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onKeyDown={(e) => { if (e.key === "-" || e.key === "e") e.preventDefault(); }}
                              onChange={(event) =>
                                updateItem(
                                  item.productId,
                                  "unitPrice",
                                  event.target.value,
                                )
                              }
                            />
                          </td>
                          <td>
                            <input
                              className="form-input no-icon"
                              style={{ width: "85px", height: "36px", fontSize: "0.875rem" }}
                              type="number"
                              min="1"
                              step="1"
                              value={item.quantity}
                              onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === ".") e.preventDefault(); }}
                              onChange={(event) =>
                                updateItem(
                                  item.productId,
                                  "quantity",
                                  event.target.value,
                                )
                              }
                            />
                          </td>
                          <td>
                            <div style={{ position: "relative", width: "95px" }}>
                              <input
                                className="form-input no-icon"
                                style={{
                                  width: "100%",
                                  paddingRight: "1.65rem",
                                  height: "36px",
                                  fontSize: "0.875rem",
                                }}
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={item.discountPercent}
                                onKeyDown={(e) => { if (e.key === "-" || e.key === "e") e.preventDefault(); }}
                                onChange={(event) =>
                                  updateItem(
                                    item.productId,
                                    "discountPercent",
                                    event.target.value,
                                  )
                                }
                              />
                              <span
                                style={{
                                  position: "absolute",
                                  right: "8px",
                                  top: "50%",
                                  transform: "translateY(-50%)",
                                  color: "#64748b",
                                  fontSize: "0.8rem",
                                  fontWeight: 700,
                                  pointerEvents: "none",
                                }}
                              >
                                %
                              </span>
                            </div>
                          </td>
                          <td style={{ fontWeight: 800, color: "#0f172a", whiteSpace: "nowrap" }}>
                            {currency(total)}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              type="button"
                              title="Remove product"
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: "4px 6px",
                                borderRadius: "6px",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                              onClick={() =>
                                setItems((current) =>
                                  current.filter(
                                    (entry) =>
                                      entry.productId !== item.productId,
                                  ),
                                )
                              }
                            >
                              <Trash2 size={16} color="#ef4444" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <UpsellCrossSellPanel
            items={items}
            customerId={customerId}
            onAddItem={addRecommendedItem}
            token={token}
          />
        </div>

        <section style={{ marginTop: "1.25rem", background: "#fff", border: "1px solid var(--border-light)", borderRadius: "16px", padding: "1.25rem", boxShadow: "var(--shadow-sm)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <div><div className="eyebrow">Pre-submit intelligence</div><h2 style={{ fontSize: "1.1rem", marginTop: "0.25rem" }}>Pricing suggestion & risk preview</h2></div>
            {riskPreviewLoading && <span style={{ color: "#64748b", fontSize: "0.8rem" }}>Analyzing current quote...</span>}
          </div>
          {riskPreview?.error ? <div className="alert alert-warning" style={{ marginTop: "0.85rem", marginBottom: 0 }}>{riskPreview.error}</div> : riskPreview && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0.75rem", marginTop: "1rem" }}>
            <div className="metric-card"><span className="metric-label">Risk score</span><strong className="metric-value">{Number(riskPreview.risk.riskScore).toFixed(1)}/100</strong></div>
            <div className="metric-card"><span className="metric-label">Risk level</span><strong className="metric-value" style={{ fontSize: "1.05rem" }}>{riskPreview.risk.riskLevel}</strong></div>
            <div className="metric-card"><span className="metric-label">Approval route</span><strong style={{ fontSize: "0.82rem", color: "#0f172a" }}>{riskPreview.risk.governanceRoute}</strong></div>
            <div className="metric-card"><span className="metric-label">Suggested discount</span><strong className="metric-value">{riskPreview.pricing.suggestedDiscountPercent}%</strong></div>
            <div className="metric-card"><span className="metric-label">Suggested final price</span><strong className="metric-value" style={{ fontSize: "1.05rem" }}>{currency(riskPreview.pricing.suggestedFinalPrice)}</strong></div>
          </div>}
          {riskPreview && !riskPreview.error && (
            <div style={{ marginTop: "0.9rem", paddingTop: "0.85rem", borderTop: "1px solid #e2e8f0" }}>
              <strong style={{ fontSize: "0.8rem", color: "#475569" }}>Why this score?</strong>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.55rem" }}>
                {(riskPreview.risk.factors || []).map((factor) => (
                  <span key={factor.name} style={{ padding: "0.35rem 0.55rem", borderRadius: "6px", background: Number(factor.contribution) > 0 ? "#fff7ed" : "#f8fafc", color: Number(factor.contribution) > 0 ? "#9a3412" : "#64748b", fontSize: "0.72rem" }}>
                    {factor.name.replaceAll("_", " ")}: +{Number(factor.contribution).toFixed(1)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1.25rem",
            flexWrap: "wrap",
            marginTop: "1.5rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1.25rem",
              flexWrap: "wrap",
              background: "#fff",
              border: "1px solid var(--border-light)",
              borderRadius: "14px",
              padding: "0.85rem 1.25rem",
              boxShadow: "var(--shadow-sm)",
              flex: "1",
              minWidth: "300px",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
            >
              <span
                style={{
                  color: "#64748b",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                }}
              >
                Subtotal:
              </span>
              <strong style={{ color: "#0f172a", fontSize: "0.95rem" }}>
                {currency(totals.subtotal)}
              </strong>
            </div>

            <span style={{ color: "#cbd5e1" }}>•</span>

            <div
              style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
            >
              <span
                style={{
                  color: "#64748b",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                }}
              >
                Discount:
              </span>
              <strong style={{ color: "#ef4444", fontSize: "0.95rem" }}>
                -{currency(totals.discount)}
              </strong>
            </div>

            <span style={{ color: "#cbd5e1" }}>•</span>

            <div
              style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
            >
              <span
                style={{
                  color: "#64748b",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                }}
              >
                Final Price:
              </span>
              <strong
                style={{
                  color: "#2563eb",
                  fontSize: "1.15rem",
                  fontWeight: 800,
                }}
              >
                {currency(totals.subtotal - totals.discount)}
              </strong>
            </div>
            <div className="margin-summary-row">
              <span>Total Product Cost</span>
              <strong>{currency(totals.totalCost)}</strong>
            </div>
            <div className="margin-summary-row">
              <span>Gross Margin</span>
              <strong>{currency(grossMargin)}</strong>
            </div>
            <div className="margin-summary-row">
              <span>Margin %</span>
              <strong>{marginPercentage.toFixed(2)}%</strong>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onNavigate("/sales/quotations")}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              style={{ width: "auto" }}
              disabled={saving}
            >
              {saving ? (
                "Saving..."
              ) : (
                <>
                  <Save size={16} /> Submit for Risk Analysis
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}
