import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Edit3, Package, Plus, RefreshCw, Search, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const API_BASE = "http://localhost:5000/api";
const CATEGORIES = ["HARDWARE", "SERVICE", "SUBSCRIPTION", "ELECTRONICS", "FURNITURE", "SOFTWARE", "SERVICES", "OTHER"];
const EMPTY_FORM = {
  name: "",
  sku: "",
  category: "HARDWARE",
  unitPrice: "",
  cost: "",
  inventoryReference: "",
  status: "ACTIVE",
  description: "",
};

const currency = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ProductManagement() {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingProduct, setEditingProduct] = useState(null);
  const [viewingProduct, setViewingProduct] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/admin/products`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load products.");
      setProducts(data.data || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const loadTimer = window.setTimeout(loadProducts, 0);
    return () => window.clearTimeout(loadTimer);
  }, [loadProducts]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) => [product.name, product.productId, product.category, product.inventoryReference].some((value) => String(value || "").toLowerCase().includes(query)));
  }, [products, search]);

  const updateField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingProduct(null);
  };

  const editProduct = (product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      sku: product.productId,
      category: product.category,
      unitPrice: String(product.sellingPrice),
      cost: String(product.cost),
      inventoryReference: product.inventoryReference,
      status: product.status,
      description: product.description,
    });
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveProduct = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    const isEditing = Boolean(editingProduct);
    try {
      const response = await fetch(`${API_BASE}/admin/products${isEditing ? `/${editingProduct.id}` : ""}`, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to save product.");
      setSuccess(data.message);
      resetForm();
      await loadProducts();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleProduct = async (product) => {
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`${API_BASE}/admin/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: product.name,
          category: product.category,
          unitPrice: product.sellingPrice,
          cost: product.cost,
          inventoryReference: product.inventoryReference,
          status: product.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
          description: product.description,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to update product status.");
      setSuccess(`${product.name} is now ${data.data.status.toLowerCase()}.`);
      await loadProducts();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <main className="main-content admin-page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Catalog control</p>
          <h1>Products</h1>
          <p className="page-subtitle">Manage the catalog used when creating quotations and deals.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            className="btn-secondary"
            onClick={() => window.location.href = "/admin/bulk-upload"}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
          >
            <Package size={15} /> Bulk Upload (CSV/Excel)
          </button>
          <button className="btn-secondary" onClick={loadProducts} disabled={loading}>
            <RefreshCw size={15} className={loading ? "spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <section className="product-layout">
        <form className="admin-panel product-form" onSubmit={saveProduct}>
          <div className="panel-heading">
            <div className="panel-icon"><Package size={18} /></div>
            <div>
              <h2>{editingProduct ? "Edit product" : "Add product"}</h2>
              <p>{editingProduct ? "Update the catalog record, including price and cost." : "Add a product to the quotation catalog."}</p>
            </div>
          </div>
          <div className="form-group"><label className="form-label" htmlFor="product-name">Product name</label><input id="product-name" name="name" className="form-input no-icon" value={form.name} onChange={updateField} required /></div>
          <div className="form-group"><label className="form-label" htmlFor="product-sku">Product ID</label><input id="product-sku" name="sku" className="form-input no-icon" placeholder="P001" value={form.sku} onChange={updateField} required disabled={Boolean(editingProduct)} /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label" htmlFor="product-category">Category</label><select id="product-category" name="category" className="form-select no-icon" value={form.category} onChange={updateField}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></div>
            <div className="form-group"><label className="form-label" htmlFor="product-status">Status</label><select id="product-status" name="status" className="form-select no-icon" value={form.status} onChange={updateField}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label" htmlFor="product-price">Selling price (₹)</label><input id="product-price" type="number" min="0" step="0.01" name="unitPrice" className="form-input no-icon" value={form.unitPrice} onChange={updateField} required /></div>
            <div className="form-group"><label className="form-label" htmlFor="product-cost">Cost (₹)</label><input id="product-cost" type="number" min="0" step="0.01" name="cost" className="form-input no-icon" value={form.cost} onChange={updateField} required /></div>
          </div>
          <div className="form-group"><label className="form-label" htmlFor="product-inventory">Inventory reference</label><input id="product-inventory" name="inventoryReference" className="form-input no-icon" placeholder="INV-LAP-001" value={form.inventoryReference} onChange={updateField} /></div>
          <div className="form-group"><label className="form-label" htmlFor="product-description">Description</label><textarea id="product-description" name="description" className="form-input no-icon" rows="3" value={form.description} onChange={updateField} /></div>
          <div className="form-actions">{editingProduct && <button type="button" className="btn-secondary" onClick={resetForm}><X size={15} /> Cancel</button>}<button type="submit" className="btn-primary" disabled={saving}>{editingProduct ? <Edit3 size={16} /> : <Plus size={16} />}{saving ? "Saving..." : editingProduct ? "Save changes" : "Add product"}</button></div>
        </form>

        <section className="admin-panel product-list-panel">
          <div className="panel-heading panel-heading-spread">
            <div><p className="eyebrow">Catalog</p><h2>{products.length} products</h2></div>
            <div className="product-search"><Search size={15} /><input aria-label="Search products" placeholder="Search products..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          </div>
          <div className="product-table-wrap"><table className="data-table product-table"><thead><tr><th>Product</th><th>ID</th><th>Category</th><th>Price</th><th>Cost</th><th>Inventory</th><th>Status</th><th /></tr></thead><tbody>
            {loading ? <tr><td colSpan="8" className="empty-state">Loading products...</td></tr> : filteredProducts.length === 0 ? <tr><td colSpan="8" className="empty-state">No products match your search.</td></tr> : filteredProducts.map((product) => <tr key={product.id}>
              <td><strong>{product.name}</strong><small>{product.description || "No description"}</small></td><td><code>{product.productId}</code></td><td><span className="role-chip">{product.category}</span></td><td>{currency(product.sellingPrice)}</td><td>{currency(product.cost)}</td><td>{product.inventoryReference || "-"}</td><td><span className={`badge ${product.status === "ACTIVE" ? "badge-active" : "badge-suspended"}`}>{product.status}</span></td><td><div className="product-actions"><button className="icon-button" title={`View ${product.name}`} onClick={() => setViewingProduct(product)}><Eye size={15} /></button><button className="icon-button" title={`Edit ${product.name}`} onClick={() => editProduct(product)}><Edit3 size={15} /></button><button className="text-action-button" onClick={() => toggleProduct(product)}>{product.status === "ACTIVE" ? "Deactivate" : "Activate"}</button></div></td>
            </tr>)}
          </tbody></table></div>
        </section>
      </section>

      {viewingProduct && <div className="modal-backdrop" onClick={() => setViewingProduct(null)}><div className="modal-card product-view-modal" onClick={(event) => event.stopPropagation()}><div className="modal-header"><h3 className="modal-title">Product details</h3><button type="button" onClick={() => setViewingProduct(null)} aria-label="Close"><X size={20} /></button></div><div className="product-detail-grid"><strong>Name</strong><span>{viewingProduct.name}</span><strong>Product ID</strong><span>{viewingProduct.productId}</span><strong>Category</strong><span>{viewingProduct.category}</span><strong>Selling price</strong><span>{currency(viewingProduct.sellingPrice)}</span><strong>Cost</strong><span>{currency(viewingProduct.cost)}</span><strong>Inventory reference</strong><span>{viewingProduct.inventoryReference || "-"}</span><strong>Status</strong><span>{viewingProduct.status}</span></div>{viewingProduct.description && <p className="product-description">{viewingProduct.description}</p>}</div></div>}
    </main>
  );
}
