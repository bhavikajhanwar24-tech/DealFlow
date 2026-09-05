import { useEffect, useState } from "react";
import { Edit3, MapPin, Plus, RefreshCw, Search, Warehouse as WarehouseIcon, X } from "lucide-react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useAuth } from "../context/AuthContext";

const API_BASE = "http://localhost:5000/api";
const DEFAULT_CENTER = [20.5937, 78.9629];
const EMPTY_FORM = {
  name: "",
  address: "",
  latitude: "20.5937",
  longitude: "78.9629",
  isActive: true,
};

const warehouseIcon = new L.DivIcon({
  className: "warehouse-map-marker",
  html: "<span></span>",
  iconSize: [24, 30],
  iconAnchor: [12, 30],
});

function MapViewport({ latitude, longitude }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo([latitude, longitude], Math.max(map.getZoom(), 12), { duration: 0.7 });
  }, [map, latitude, longitude]);

  return null;
}

function MapClickHandler({ onSelect }) {
  useMapEvents({
    click(event) {
      onSelect(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
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
        <button className="btn-secondary" onClick={loadWarehouses} disabled={loading}>
          <RefreshCw size={15} className={loading ? "spin" : ""} /> Refresh
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

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
            <MapContainer center={DEFAULT_CENTER} zoom={5} scrollWheelZoom className="warehouse-map">
              <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapViewport latitude={position[0]} longitude={position[1]} />
              <MapClickHandler onSelect={selectLocation} />
              <Marker position={position} icon={warehouseIcon} />
            </MapContainer>
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
                <tr key={warehouse.id}>
                  <td><strong>{warehouse.name}</strong></td>
                  <td className="warehouse-address-cell">{warehouse.address}</td>
                  <td><code>{Number(warehouse.latitude).toFixed(5)}, {Number(warehouse.longitude).toFixed(5)}</code></td>
                  <td><span className={`badge ${warehouse.is_active ? "badge-active" : "badge-suspended"}`}>{warehouse.is_active ? "ACTIVE" : "INACTIVE"}</span></td>
                  <td><button className="icon-button" title={`Edit ${warehouse.name}`} onClick={() => editWarehouse(warehouse)}><Edit3 size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
