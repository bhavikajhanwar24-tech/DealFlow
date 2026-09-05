import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Trash2, Save, AlertTriangle } from "lucide-react";
import { useAuth } from "../context/AuthContext";

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
  const marginPercentage = finalPrice === 0 ? 0 : (grossMargin / finalPrice) * 100;

  function addItem() {
    const product = products.find((entry) => entry.id === productId);
    const safeQuantity = Number(quantity);
    const safeDiscount = Number(discountPercent);
    if (!product) return setError("Select a product before adding it.");
    if (!Number.isInteger(safeQuantity) || safeQuantity <= 0)
      return setError("Quantity must be a positive whole number.");
    if (
      !Number.isFinite(safeDiscount) ||
      safeDiscount < 0 ||
      safeDiscount > 100
    )
      return setError("Discount must be between 0 and 100 percent.");
    if (items.some((item) => item.productId === product.id))
      return setError("That product is already in the quotation.");
    setItems((current) => [
      ...current,
      {
        productId: product.id,
        name: product.name,
        category: product.category,
        unitPrice: product.unitPrice,
        costPrice: product.costPrice,
        quantity: safeQuantity,
        discountPercent: safeDiscount,
      },
    ]);
    setProductId("");
    setQuantity(1);
    setDiscountPercent(0);
    setError("");
  }

  function updateItem(productIdToUpdate, field, value) {
    setItems((current) =>
      current.map((item) =>
        item.productId === productIdToUpdate
          ? { ...item, [field]: Math.max(0, Number(value)) }
          : item,
      ),
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
      if (!response.ok) throw new Error(data.message || "Unable to save quotation.");

      const submitResponse = await fetch(`${API_BASE}/quotations/${data.data.id}/submit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const submitData = await submitResponse.json();
      if (!submitResponse.ok) throw new Error(submitData.message || "Risk analysis failed.");
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
                marginTop: "1rem",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "0.75rem",
                color: "#475569",
                fontSize: "0.875rem",
              }}
            >
              <div>
                <strong>Name</strong>
                <br />
                {selectedCustomer.fullName}
              </div>
              <div>
                <strong>Customer ID</strong>
                <br />
                {selectedCustomer.customerCode}
              </div>
              <div>
                <strong>Email</strong>
                <br />
                {selectedCustomer.email}
              </div>
              <div>
                <strong>Company</strong>
                <br />
                {selectedCustomer.companyName || "-"}
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
            <span style={{ color: "#64748b", fontSize: "0.8rem" }}>
              {products.length} active products
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(220px, 2fr) 120px 130px auto",
              gap: "0.75rem",
              alignItems: "end",
            }}
          >
            <label className="form-group">
              <span className="form-label">Product</span>
              <select
                className="form-input no-icon"
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
                    {product.name} - {currency(product.unitPrice)} (
                    {product.category})
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
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </label>
            <label className="form-group">
              <span className="form-label">Discount %</span>
              <input
                className="form-input no-icon"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={discountPercent}
                onChange={(event) => setDiscountPercent(event.target.value)}
              />
            </label>
            <button type="button" className="btn-secondary" onClick={addItem}>
              <Plus size={16} /> Add
            </button>
          </div>
        </section>

        <section
          className="data-table-card"
          style={{ marginBottom: "1.25rem" }}
        >
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Unit Price</th>
                  <th>Quantity</th>
                  <th>Discount</th>
                  <th>Total</th>
                  <th />
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
                        <td style={{ fontWeight: 700 }}>{item.name}</td>
                        <td>{item.category}</td>
                          <td><input className="form-input no-icon" style={{ width: "120px" }} type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(item.productId, "unitPrice", event.target.value)} /></td>
                        <td>
                          <input
                            className="form-input no-icon"
                            style={{ width: "90px" }}
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantity}
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
                          <input
                            className="form-input no-icon"
                            style={{ width: "90px" }}
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={item.discountPercent}
                            onChange={(event) =>
                              updateItem(
                                item.productId,
                                "discountPercent",
                                event.target.value,
                              )
                            }
                          />
                          %
                        </td>
                        <td style={{ fontWeight: 800 }}>{currency(total)}</td>
                        <td>
                          <button
                            type="button"
                            title="Remove product"
                            onClick={() =>
                              setItems((current) =>
                                current.filter(
                                  (entry) => entry.productId !== item.productId,
                                ),
                              )
                            }
                          >
                            <Trash2 size={17} color="#ef4444" />
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
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ color: "#64748b", fontSize: "0.85rem", fontWeight: 500 }}>Subtotal:</span>
              <strong style={{ color: "#0f172a", fontSize: "0.95rem" }}>{currency(totals.subtotal)}</strong>
            </div>

            <span style={{ color: "#cbd5e1" }}>•</span>

            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ color: "#64748b", fontSize: "0.85rem", fontWeight: 500 }}>Discount:</span>
              <strong style={{ color: "#ef4444", fontSize: "0.95rem" }}>-{currency(totals.discount)}</strong>
            </div>

            <span style={{ color: "#cbd5e1" }}>•</span>

            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ color: "#64748b", fontSize: "0.85rem", fontWeight: 500 }}>Final Price:</span>
              <strong style={{ color: "#2563eb", fontSize: "1.15rem", fontWeight: 800 }}>{currency(totals.subtotal - totals.discount)}</strong>
            </div>
            <div className="margin-summary-row"><span>Total Product Cost</span><strong>{currency(totals.totalCost)}</strong></div>
            <div className="margin-summary-row"><span>Gross Margin</span><strong>{currency(grossMargin)}</strong></div>
            <div className="margin-summary-row"><span>Margin %</span><strong>{marginPercentage.toFixed(2)}%</strong></div>
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
