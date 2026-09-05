import { useEffect, useRef, useState } from "react";
import { Edit3, MapPin, Package, Plus, Search, Trash2, Warehouse as WarehouseIcon, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const API_BASE = "http://localhost:5000/api";
const DEFAULT_CENTER = [20.5937, 78.9629];
const EMPTY_FORM = {
  name: "",
  address: "",
  latitude: "20.5937",
  longitude: "78.9629",
  isActive: true,
};
const CHART_COLORS = ["#2563eb", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

function WarehouseMap({ position, onSelect }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    const L = window.L;
    if (!L || !containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView(position, 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const warehouseIcon = new L.DivIcon({
      className: "warehouse-map-marker",
      html: "<span></span>",
      iconSize: [24, 30],
      iconAnchor: [12, 30],
    });

    const marker = L.marker(position, { icon: warehouseIcon }).addTo(map);
    markerRef.current = marker;

    map.on("click", (event) => {
      if (onSelect) {
        onSelect(event.latlng.lat, event.latlng.lng);
      }
    });

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (mapRef.current && position && Number.isFinite(position[0]) && Number.isFinite(position[1])) {
      mapRef.current.flyTo(position, Math.max(mapRef.current.getZoom(), 12), { duration: 0.7 });
      if (markerRef.current) {
        markerRef.current.setLatLng(position);
      }
    }
  }, [position[0], position[1]]);

  return <div ref={containerRef} className="warehouse-map" style={{ width: "100%", height: "100%", minHeight: "380px" }} />;
}

export default function AdminWarehouses() {
  const { token } = useAuth();
  const [warehouses, setWarehouses] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [products, setProducts] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [inventoryForm, setInventoryForm] = useState({ productId: "", quantity: "0" });
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventorySaving, setInventorySaving] = useState(false);
  const [analytics, setAnalytics] = useState({ warehouses: [], products: [], warehouseMix: [] });

  const latitude = Number(form.latitude);
  const longitude = Number(form.longitude);
  const position = [
    Number.isFinite(latitude) ? latitude : DEFAULT_CENTER[0],
    Number.isFinite(longitude) ? longitude : DEFAULT_CENTER[1],
  ];

  const loadWarehouses = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/admin/warehouses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load warehouses.");
      setWarehouses(data.data || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWarehouses();
  }, [token]);

  const loadProducts = async () => {
    const response = await fetch(`${API_BASE}/admin/products`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Unable to load products.");
    setProducts(data.data || []);
  };

  const loadAnalytics = async () => {
    const response = await fetch(`${API_BASE}/admin/warehouses/analytics`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Unable to load warehouse analytics.");
    setAnalytics(data.data || { warehouses: [], products: [], warehouseMix: [] });
  };

  useEffect(() => {
    loadAnalytics().catch((requestError) => setError(requestError.message));
  }, [token]);

  const selectWarehouse = async (warehouse) => {
    setSelectedWarehouse(warehouse);
    setInventoryLoading(true);
    setError("");
    try {
      const [inventoryResponse] = await Promise.all([
        fetch(`${API_BASE}/admin/warehouses/${warehouse.id}/inventory`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        loadProducts(),
      ]);
      const data = await inventoryResponse.json();
      if (!inventoryResponse.ok) throw new Error(data.message || "Unable to load warehouse inventory.");
      setInventory(data.data || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setInventoryLoading(false);
    }
  };

  const saveInventory = async (event) => {
    event.preventDefault();
    if (!selectedWarehouse) return;
    setInventorySaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`${API_BASE}/admin/warehouses/${selectedWarehouse.id}/inventory`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(inventoryForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to save inventory.");
      setSuccess(data.message);
      setInventoryForm({ productId: "", quantity: "0" });
      await selectWarehouse(selectedWarehouse);
      await loadAnalytics();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setInventorySaving(false);
    }
  };

  const removeInventory = async (item) => {
    if (!selectedWarehouse || !window.confirm(`Remove ${item.name} from ${selectedWarehouse.name}?`)) return;
    try {
      const response = await fetch(`${API_BASE}/admin/warehouses/${selectedWarehouse.id}/inventory/${item.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to remove inventory.");
      setSuccess(data.message);
      await selectWarehouse(selectedWarehouse);
      await loadAnalytics();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const updateField = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const selectLocation = (latitude, longitude, address = form.address) => {
    setForm((current) => ({
      ...current,
      address,
      latitude: Number(latitude).toFixed(7),
      longitude: Number(longitude).toFixed(7),
    }));
  };

  const searchAddress = async (event) => {
    event?.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setError("");
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(searchQuery.trim())}`,
        { headers: { Accept: "application/json" } },
      );
      if (!response.ok) throw new Error("Address search is unavailable right now.");
      const results = await response.json();
      setSearchResults(results);
      if (results.length === 0) {
        setError("No matching address found. Try a broader search.");
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSearching(false);
    }
  };

  const chooseSearchResult = (result) => {
    selectLocation(result.lat, result.lon, result.display_name);
    setSearchQuery(result.display_name);
    setSearchResults([]);
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingWarehouse(null);
    setSearchQuery("");
    setSearchResults([]);
  };

  const editWarehouse = (warehouse) => {
    setEditingWarehouse(warehouse);
    setForm({
      name: warehouse.name,
      address: warehouse.address,
      latitude: String(warehouse.latitude),
      longitude: String(warehouse.longitude),
      isActive: warehouse.is_active,
    });
    setSearchQuery(warehouse.address);
    setSearchResults([]);
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveWarehouse = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    const isEditing = Boolean(editingWarehouse);
    try {
      const response = await fetch(
        `${API_BASE}/admin/warehouses${isEditing ? `/${editingWarehouse.id}` : ""}`,
        {
          method: isEditing ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(form),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to save warehouse.");
      setSuccess(data.message);
      resetForm();
      await loadWarehouses();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="main-content admin-page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Operations master data</p>
          <h1>Warehouses & locations</h1>
          <p className="page-subtitle">Create warehouse locations, search their address, and place an exact map pin for fulfillment planning.</p>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <section className="warehouse-analytics-grid">
        <div className="admin-panel warehouse-chart-panel warehouse-chart-wide">
          <div className="panel-heading-spread warehouse-chart-heading">
            <div><p className="eyebrow">All warehouses</p><h2>Units by warehouse</h2></div>
            <span className="staff-count">{analytics.warehouses.length} locations</span>
          </div>
          <div className="warehouse-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.warehouses.map((item) => ({ ...item, total_units: Number(item.total_units) }))}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="total_units" name="Units" fill="#2563eb" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </div>
        <div className="admin-panel warehouse-chart-panel">
          <div className="warehouse-chart-heading"><p className="eyebrow">Inventory value</p><h2>Value trend</h2></div>
          <div className="warehouse-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={analytics.warehouses.map((item) => ({ ...item, inventory_value: Number(item.inventory_value) }))}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Value"]} /><Line type="monotone" dataKey="inventory_value" name="Value" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer></div>
        </div>
        <div className="admin-panel warehouse-chart-panel">
          <div className="warehouse-chart-heading"><p className="eyebrow">Product distribution</p><h2>Units across network</h2></div>
          <div className="warehouse-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={analytics.products.map((item) => ({ ...item, total_units: Number(item.total_units) }))} dataKey="total_units" nameKey="name" innerRadius={48} outerRadius={82} paddingAngle={3}>{analytics.products.map((item, index) => <Cell key={item.id} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Pie><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer></div>
        </div>
      </section>

      <section className="admin-panel warehouse-pies-panel">
        <div className="warehouse-chart-heading"><p className="eyebrow">Warehouse detail</p><h2>Product mix by warehouse</h2></div>
        <div className="warehouse-pie-grid">
          {analytics.warehouses.map((warehouse) => {
            const warehouseProducts = analytics.warehouseMix
              .filter((item) => item.warehouse_id === warehouse.id)
              .map((item) => ({ name: item.product_name, total_units: Number(item.total_units), id: item.product_id }));
            return (
              <article className="warehouse-mini-pie" key={warehouse.id}>
                <h3>{warehouse.name}</h3>
                {warehouseProducts.length ? (
                  <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={warehouseProducts} dataKey="total_units" nameKey="name" innerRadius={35} outerRadius={62} paddingAngle={3}>{warehouseProducts.map((item, index) => <Cell key={item.id} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Pie><Tooltip /><Legend wrapperStyle={{ fontSize: 10 }} /></PieChart></ResponsiveContainer>
                ) : <p className="empty-state">No stock assigned</p>}
              </article>
            );
          })}
          {!analytics.warehouses.length && <p className="empty-state">Create a warehouse to see its product mix.</p>}
        </div>
      </section>

      <section className="warehouse-layout">
        <form className="admin-panel warehouse-form" onSubmit={saveWarehouse}>
          <div className="panel-heading">
            <div className="panel-icon"><WarehouseIcon size={18} /></div>
            <div>
              <h2>{editingWarehouse ? "Edit warehouse" : "Create warehouse"}</h2>
              <p>{editingWarehouse ? "Update the warehouse identity or map location." : "Save a named warehouse with its exact operating location."}</p>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="warehouse-name">Warehouse name</label>
            <input id="warehouse-name" name="name" className="form-input no-icon" placeholder="Mumbai Fulfillment Hub" value={form.name} onChange={updateField} required />
          </div>

          <div className="form-group warehouse-search-group">
            <label className="form-label" htmlFor="warehouse-search">Search address</label>
            <div className="warehouse-search-row">
              <input id="warehouse-search" className="form-input no-icon" placeholder="Search city, street, or landmark" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && searchAddress(event)} />
              <button type="button" className="btn-secondary warehouse-search-button" onClick={searchAddress} disabled={searching} title="Search address">
                <Search size={16} /> {searching ? "Searching" : "Search"}
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="warehouse-search-results">
                {searchResults.map((result) => (
                  <button type="button" key={`${result.place_id}-${result.lat}`} onClick={() => chooseSearchResult(result)}>
                    <MapPin size={15} />
                    <span>{result.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="warehouse-address">Saved address</label>
            <textarea id="warehouse-address" name="address" className="form-input no-icon" rows="3" value={form.address} onChange={updateField} required />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="warehouse-latitude">Latitude</label>
              <input id="warehouse-latitude" name="latitude" type="number" step="any" className="form-input no-icon" value={form.latitude} onChange={updateField} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="warehouse-longitude">Longitude</label>
              <input id="warehouse-longitude" name="longitude" type="number" step="any" className="form-input no-icon" value={form.longitude} onChange={updateField} required />
            </div>
          </div>

          {editingWarehouse && (
            <label className="warehouse-active-toggle">
              <input type="checkbox" name="isActive" checked={form.isActive} onChange={updateField} />
              Active warehouse
            </label>
          )}

          <div className="form-actions">
            {editingWarehouse && <button type="button" className="btn-secondary" onClick={resetForm}><X size={15} /> Cancel</button>}
            <button type="submit" className="btn-primary" disabled={saving}>
              {editingWarehouse ? <Edit3 size={16} /> : <Plus size={16} />}
              {saving ? "Saving..." : editingWarehouse ? "Save changes" : "Create warehouse"}
            </button>
          </div>
        </form>

        <section className="admin-panel warehouse-map-panel">
          <div className="panel-heading panel-heading-spread">
            <div>
              <p className="eyebrow">Location pin</p>
              <h2>Place the warehouse on the map</h2>
            </div>
            <span className="warehouse-coordinates">{position[0].toFixed(5)}, {position[1].toFixed(5)}</span>
          </div>
          <div className="warehouse-map-wrap">
            <WarehouseMap position={position} onSelect={selectLocation} />
          </div>
          <p className="warehouse-map-help"><MapPin size={15} /> Search an address or click anywhere on the map to move the pin. The selected coordinates are stored with this warehouse.</p>
        </section>
      </section>

      <section className="admin-panel warehouse-list-panel">
        <div className="panel-heading panel-heading-spread">
          <div><p className="eyebrow">Saved locations</p><h2>Warehouse directory</h2></div>
          <span className="staff-count">{warehouses.length} locations</span>
        </div>
        <div className="staff-table-wrap">
          <table className="data-table staff-table">
            <thead><tr><th>Warehouse</th><th>Address</th><th>Coordinates</th><th>Status</th><th /></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="5" className="empty-state">Loading warehouses...</td></tr> : warehouses.length === 0 ? <tr><td colSpan="5" className="empty-state">No warehouses created yet.</td></tr> : warehouses.map((warehouse) => (
                <tr key={warehouse.id} className={`warehouse-row ${selectedWarehouse?.id === warehouse.id ? "selected" : ""}`} onClick={() => selectWarehouse(warehouse)}>
                  <td><strong>{warehouse.name}</strong></td>
                  <td className="warehouse-address-cell">{warehouse.address}</td>
                  <td><code>{Number(warehouse.latitude).toFixed(5)}, {Number(warehouse.longitude).toFixed(5)}</code></td>
                  <td><span className={`badge ${warehouse.is_active ? "badge-active" : "badge-suspended"}`}>{warehouse.is_active ? "ACTIVE" : "INACTIVE"}</span></td>
                  <td><div className="warehouse-row-actions"><button className="icon-button" title={`Edit ${warehouse.name}`} onClick={(event) => { event.stopPropagation(); editWarehouse(warehouse); }}><Edit3 size={16} /></button><span className="warehouse-row-hint">Manage stock</span></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedWarehouse && (
        <section className="admin-panel inventory-panel">
          <div className="panel-heading panel-heading-spread">
            <div>
              <p className="eyebrow">Warehouse inventory</p>
              <h2>{selectedWarehouse.name}</h2>
              <p>{selectedWarehouse.address}</p>
            </div>
            <button className="icon-button" title="Close inventory" onClick={() => setSelectedWarehouse(null)}><X size={16} /></button>
          </div>
          <form className="inventory-form" onSubmit={saveInventory}>
            <div className="form-group">
              <label className="form-label" htmlFor="inventory-product">Product from catalog</label>
              <select id="inventory-product" className="form-select no-icon" value={inventoryForm.productId} onChange={(event) => setInventoryForm((current) => ({ ...current, productId: event.target.value }))} required>
                <option value="">Select a product</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.name} ({product.sku})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="inventory-quantity">Quantity available</label>
              <input id="inventory-quantity" className="form-input no-icon" type="number" min="0" step="1" value={inventoryForm.quantity} onChange={(event) => setInventoryForm((current) => ({ ...current, quantity: event.target.value }))} required />
            </div>
            <button className="btn-primary inventory-save-button" type="submit" disabled={inventorySaving}>{inventorySaving ? "Saving..." : "Add / update product"}</button>
          </form>
          <div className="selected-warehouse-chart">
            <div><p className="eyebrow">Selected warehouse</p><h3>Product mix</h3></div>
            <div className="warehouse-chart warehouse-pie-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={inventory.map((item) => ({ ...item, quantity: Number(item.quantity) })).filter((item) => item.quantity > 0)} dataKey="quantity" nameKey="name" innerRadius={52} outerRadius={88} paddingAngle={3}>{inventory.map((item, index) => <Cell key={item.id} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Pie><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer></div>
          </div>
          <div className="inventory-table-wrap">
            {inventoryLoading ? <p className="empty-state">Loading inventory...</p> : inventory.length === 0 ? <p className="empty-state">No products assigned to this warehouse yet.</p> : (
              <table className="data-table">
                <thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Quantity</th><th /></tr></thead>
                <tbody>{inventory.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td><code>{item.sku}</code></td><td>{item.category}</td><td className="inventory-quantity">{item.quantity}</td><td><button className="icon-button danger-icon" title={`Remove ${item.name}`} onClick={() => removeInventory(item)}><Trash2 size={16} /></button></td></tr>)}</tbody>
              </table>
            )}
          </div>
          <p className="warehouse-map-help"><Package size={15} /> Choose an existing catalog product and save its available quantity for this warehouse. Saving the same product updates its quantity.</p>
        </section>
      )}
    </main>
  );
}
