import { useEffect, useRef, useState, useMemo, Fragment } from "react";
import {
  Edit3,
  MapPin,
  Package,
  Plus,
  Search,
  Trash2,
  Warehouse as WarehouseIcon,
  X,
  PieChart as PieChartIcon,
  BarChart3,
  TrendingUp,
  Layers,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Filter,
  Tag,
  Boxes,
  DollarSign,
  Table as TableIcon,
  LayoutGrid,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Area,
  AreaChart,
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
const CHART_COLORS = ["#2563eb", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

const CATEGORY_THEMES = {
  HARDWARE: { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe", color: "#2563eb", bar: "linear-gradient(90deg, #2563eb, #3b82f6)" },
  SERVICE: { bg: "#ecfdf5", text: "#047857", border: "#a7f3d0", color: "#10b981", bar: "linear-gradient(90deg, #10b981, #34d399)" },
  SERVICES: { bg: "#ecfdf5", text: "#047857", border: "#a7f3d0", color: "#10b981", bar: "linear-gradient(90deg, #10b981, #34d399)" },
  SOFTWARE: { bg: "#f5f3ff", text: "#6d28d9", border: "#ddd6fe", color: "#8b5cf6", bar: "linear-gradient(90deg, #8b5cf6, #a78bfa)" },
  SUBSCRIPTION: { bg: "#fdf4ff", text: "#a21caf", border: "#f5d0fe", color: "#d946ef", bar: "linear-gradient(90deg, #d946ef, #e879f9)" },
  ACCESSORIES: { bg: "#fffbeb", text: "#b45309", border: "#fde68a", color: "#f59e0b", bar: "linear-gradient(90deg, #f59e0b, #fbbf24)" },
  CONSUMABLES: { bg: "#ecfeff", text: "#0e7490", border: "#a5f3fc", color: "#06b6d4", bar: "linear-gradient(90deg, #06b6d4, #22d3ee)" },
  OTHER: { bg: "#f8fafc", text: "#334155", border: "#cbd5e1", color: "#64748b", bar: "linear-gradient(90deg, #64748b, #94a3b8)" },
};

const getCategoryTheme = (category = "") => {
  const key = String(category || "").trim().toUpperCase();
  return CATEGORY_THEMES[key] || {
    bg: "#f8fafc",
    text: "#475569",
    border: "#cbd5e1",
    color: "#64748b",
    bar: "linear-gradient(90deg, #64748b, #94a3b8)",
  };
};

function WarehouseMap({ position, onSelect }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    const L = window.L;
    if (!L || !containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView(position, 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
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

  // UI state for Product Mix modal/section toggle & directory filter
  const [showProductMix, setShowProductMix] = useState(false);
  const [productMixMode, setProductMixMode] = useState("CATEGORY"); // "CATEGORY" | "WAREHOUSE"
  const [mixLayoutMode, setMixLayoutMode] = useState("TABLE"); // "TABLE" | "GRID"
  const [expandedCategory, setExpandedCategory] = useState(null); // category string or null
  const [expandedMixWarehouse, setExpandedMixWarehouse] = useState(null); // warehouse id or null
  const [showMixCharts, setShowMixCharts] = useState(false); // toggle visual charts
  const [selectedMixWarehouseId, setSelectedMixWarehouseId] = useState("ALL");
  const [directoryFilter, setDirectoryFilter] = useState("");
  const [localMixMode, setLocalMixMode] = useState("CATEGORY"); // "CATEGORY" | "PRODUCT"

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

  // Filter warehouses for the Directory list
  const filteredDirectoryWarehouses = useMemo(() => {
    if (!directoryFilter.trim()) return warehouses;
    const q = directoryFilter.toLowerCase();
    return warehouses.filter(
      (w) =>
        w.name?.toLowerCase().includes(q) ||
        w.address?.toLowerCase().includes(q) ||
        (w.is_active ? "active" : "inactive").includes(q)
    );
  }, [warehouses, directoryFilter]);

  // Total inventory units across all products
  const totalNetworkUnits = useMemo(() => {
    return analytics.products.reduce((acc, p) => acc + Number(p.total_units || 0), 0);
  }, [analytics.products]);

  // Product-to-Category lookup map
  const productCategoryMap = useMemo(() => {
    const map = {};
    for (const p of products) {
      if (p.id) {
        map[p.id] = (p.category || "HARDWARE").toUpperCase();
      }
    }
    return map;
  }, [products]);

  // Aggregate Product Mix by Category (network-wide or filtered by selected warehouse)
  const categoryMixData = useMemo(() => {
    const mixRows = analytics.warehouseMix || [];
    const filteredRows =
      selectedMixWarehouseId === "ALL"
        ? mixRows
        : mixRows.filter((row) => row.warehouse_id === selectedMixWarehouseId);

    const catMap = {};

    for (const row of filteredRows) {
      const catName = (
        row.category ||
        productCategoryMap[row.product_id] ||
        "HARDWARE"
      ).toUpperCase();
      const units = Number(row.total_units || 0);
      const prodMatch = products.find((p) => p.id === row.product_id);
      const unitPrice = prodMatch ? Number(prodMatch.unitPrice || prodMatch.unit_price || 0) : 0;
      const value = Number(row.inventory_value || 0) || units * unitPrice;

      if (!catMap[catName]) {
        catMap[catName] = {
          category: catName,
          total_units: 0,
          inventory_value: 0,
          products: {},
          warehouses: {},
        };
      }

      catMap[catName].total_units += units;
      catMap[catName].inventory_value += value;

      // Group products in this category
      if (!catMap[catName].products[row.product_id]) {
        catMap[catName].products[row.product_id] = {
          id: row.product_id,
          name: row.product_name,
          sku: row.sku || (prodMatch ? prodMatch.sku : ""),
          total_units: 0,
          inventory_value: 0,
        };
      }
      catMap[catName].products[row.product_id].total_units += units;
      catMap[catName].products[row.product_id].inventory_value += value;

      // Group warehouses holding this category
      if (!catMap[catName].warehouses[row.warehouse_id]) {
        catMap[catName].warehouses[row.warehouse_id] = {
          id: row.warehouse_id,
          name: row.warehouse_name,
          total_units: 0,
        };
      }
      catMap[catName].warehouses[row.warehouse_id].total_units += units;
    }

    const list = Object.values(catMap).map((cat) => ({
      category: cat.category,
      total_units: cat.total_units,
      inventory_value: cat.inventory_value,
      products: Object.values(cat.products).sort((a, b) => b.total_units - a.total_units),
      warehouses: Object.values(cat.warehouses).sort((a, b) => b.total_units - a.total_units),
    }));

    return list.sort((a, b) => b.total_units - a.total_units);
  }, [analytics.warehouseMix, selectedMixWarehouseId, productCategoryMap, products]);

  const totalMixCategoryUnits = useMemo(() => {
    return categoryMixData.reduce((acc, c) => acc + c.total_units, 0);
  }, [categoryMixData]);

  const totalMixCategoryValue = useMemo(() => {
    return categoryMixData.reduce((acc, c) => acc + c.inventory_value, 0);
  }, [categoryMixData]);

  const leadingCategory = categoryMixData[0] || null;
  const leadingCategoryPct =
    totalMixCategoryUnits > 0 && leadingCategory
      ? ((leadingCategory.total_units / totalMixCategoryUnits) * 100).toFixed(1)
      : "0";

  // Local warehouse category breakdown (for the selected warehouse in directory)
  const localCategoryBreakdown = useMemo(() => {
    const catMap = {};
    for (const item of inventory) {
      const cat = (item.category || productCategoryMap[item.productId || item.product_id] || "HARDWARE").toUpperCase();
      const qty = Number(item.quantity || 0);
      if (!catMap[cat]) {
        catMap[cat] = {
          name: cat,
          quantity: 0,
          sku_count: 0,
          items: [],
        };
      }
      catMap[cat].quantity += qty;
      catMap[cat].sku_count += 1;
      catMap[cat].items.push(item);
    }
    return Object.values(catMap).sort((a, b) => b.quantity - a.quantity);
  }, [inventory, productCategoryMap]);

  return (
    <main className="main-content admin-page" style={{ paddingBottom: "3rem" }}>
      <style>{`
        .warehouse-analytics-grid {
          display: grid;
          grid-template-columns: 1.3fr 1fr 1fr;
          gap: 1.25rem;
          margin-bottom: 1.5rem;
        }
        @media (max-width: 1100px) {
          .warehouse-analytics-grid {
            grid-template-columns: 1fr;
          }
        }
        .warehouse-dir-scroll-wrap::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .warehouse-dir-scroll-wrap::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
      `}</style>

      {/* Page Header with Action Button for Product Mix */}
      <div className="page-heading-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
        <div>
          <p className="eyebrow">Operations master data</p>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: "0.2rem 0" }}>Warehouses & Locations</h1>
          <p className="page-subtitle">Configure fulfillment hubs, geocode facility addresses, inspect inventory density, and govern multi-warehouse route planning.</p>
        </div>

        {/* Button to toggle Product Mix separate section */}
        <button
          type="button"
          onClick={() => setShowProductMix((prev) => !prev)}
          className={showProductMix ? "btn-primary" : "btn-secondary"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.6rem 1.15rem",
            fontWeight: 700,
            fontSize: "0.85rem",
            borderRadius: "9px",
            cursor: "pointer",
            boxShadow: showProductMix ? "0 4px 14px rgba(37, 99, 235, 0.28)" : "none",
            height: "40px",
          }}
        >
          <Tag size={16} />
          <span>{showProductMix ? "Hide Product Mix" : "Product Mix by Category"}</span>
          <span
            style={{
              background: showProductMix ? "rgba(255,255,255,0.25)" : "#eff6ff",
              color: showProductMix ? "#ffffff" : "#2563eb",
              padding: "0.15rem 0.5rem",
              borderRadius: "9999px",
              fontSize: "0.725rem",
              fontWeight: 800,
            }}
          >
            {categoryMixData.length} categories · {totalMixCategoryUnits.toLocaleString()} units
          </span>
        </button>
      </div>

      {error && <div className="alert alert-danger" style={{ borderRadius: "10px", marginBottom: "1.25rem" }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ borderRadius: "10px", marginBottom: "1.25rem" }}>{success}</div>}

      {/* ------------------------------------------------------------------
          SEPARATE SECTION: PRODUCT MIX BY CATEGORY & WAREHOUSE
         ------------------------------------------------------------------ */}
      {showProductMix && (
        <section
          className="admin-panel"
          style={{
            marginBottom: "1.75rem",
            padding: "1.5rem",
            background: "linear-gradient(180deg, #ffffff, #f8fafc)",
            border: "1.5px solid #bfdbfe",
            borderRadius: "14px",
            boxShadow: "0 10px 25px -5px rgba(37, 99, 235, 0.08)",
          }}
        >
          {/* Section Header with View Mode Switcher, Facility Filter, and Close */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.25rem",
              borderBottom: "1px solid #e2e8f0",
              paddingBottom: "1rem",
              flexWrap: "wrap",
              gap: "0.85rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #dbeafe, #eff6ff)",
                  border: "1px solid #bfdbfe",
                  color: "#2563eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {productMixMode === "CATEGORY" ? <Tag size={20} /> : <WarehouseIcon size={20} />}
              </div>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, color: "#0f172a" }}>
                  {productMixMode === "CATEGORY" ? "Product Mix by Category" : "Product Mix by Warehouse"}
                </h2>
                <p style={{ margin: "0.15rem 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                  {productMixMode === "CATEGORY"
                    ? "Category volume breakdown, asset valuation, and SKU distribution segmented across your fulfillment network."
                    : "Inspect SKU inventory volume, product breakdown, and stock concentration for each warehouse."}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
              {/* Mode Switcher Tabs: By Category vs By Warehouse */}
              <div
                style={{
                  display: "flex",
                  gap: "0.2rem",
                  background: "#e0f2fe",
                  padding: "3px",
                  borderRadius: "8px",
                  border: "1px solid #bae6fd",
                }}
              >
                <button
                  type="button"
                  onClick={() => setProductMixMode("CATEGORY")}
                  style={{
                    padding: "0.35rem 0.75rem",
                    fontSize: "0.775rem",
                    fontWeight: 700,
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    background: productMixMode === "CATEGORY" ? "#2563eb" : "transparent",
                    color: productMixMode === "CATEGORY" ? "#ffffff" : "#0284c7",
                    boxShadow: productMixMode === "CATEGORY" ? "0 1px 3px rgba(37,99,235,0.3)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Tag size={13} /> Mix by Category
                </button>
                <button
                  type="button"
                  onClick={() => setProductMixMode("WAREHOUSE")}
                  style={{
                    padding: "0.35rem 0.75rem",
                    fontSize: "0.775rem",
                    fontWeight: 700,
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    background: productMixMode === "WAREHOUSE" ? "#2563eb" : "transparent",
                    color: productMixMode === "WAREHOUSE" ? "#ffffff" : "#0284c7",
                    boxShadow: productMixMode === "WAREHOUSE" ? "0 1px 3px rgba(37,99,235,0.3)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <WarehouseIcon size={13} /> Mix by Warehouse
                </button>
              </div>

              {/* Facility Filter Dropdown (Replaces overflowing button list) */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                <MapPin size={15} color="#2563eb" />
                <select
                  id="mix-facility-select"
                  value={selectedMixWarehouseId}
                  onChange={(e) => setSelectedMixWarehouseId(e.target.value)}
                  style={{
                    height: "34px",
                    fontSize: "0.785rem",
                    fontWeight: 700,
                    padding: "0 1.75rem 0 0.65rem",
                    borderRadius: "7px",
                    border: "1.5px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#0f172a",
                    minWidth: "190px",
                    maxWidth: "280px",
                    cursor: "pointer",
                  }}
                >
                  <option value="ALL">All Facilities ({analytics.warehouses.length})</option>
                  {analytics.warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* View Orientation Switcher: Tabular vs Cards */}
              <div
                style={{
                  display: "inline-flex",
                  gap: "0.2rem",
                  background: "#f1f5f9",
                  padding: "3px",
                  borderRadius: "7px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <button
                  type="button"
                  onClick={() => setMixLayoutMode("TABLE")}
                  title="Tabular Data Table View"
                  style={{
                    padding: "0.3rem 0.65rem",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    borderRadius: "5px",
                    border: "none",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.3rem",
                    background: mixLayoutMode === "TABLE" ? "#ffffff" : "transparent",
                    color: mixLayoutMode === "TABLE" ? "#2563eb" : "#64748b",
                    boxShadow: mixLayoutMode === "TABLE" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  }}
                >
                  <TableIcon size={13} /> Tabular
                </button>
                <button
                  type="button"
                  onClick={() => setMixLayoutMode("GRID")}
                  title="Card Grid View"
                  style={{
                    padding: "0.3rem 0.65rem",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    borderRadius: "5px",
                    border: "none",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.3rem",
                    background: mixLayoutMode === "GRID" ? "#ffffff" : "transparent",
                    color: mixLayoutMode === "GRID" ? "#2563eb" : "#64748b",
                    boxShadow: mixLayoutMode === "GRID" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  }}
                >
                  <LayoutGrid size={13} /> Cards
                </button>
              </div>

              {/* Toggle Visual Charts */}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowMixCharts((prev) => !prev)}
                style={{
                  padding: "0.35rem 0.7rem",
                  fontSize: "0.775rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  height: "34px",
                  background: showMixCharts ? "#eff6ff" : undefined,
                  borderColor: showMixCharts ? "#bfdbfe" : undefined,
                  color: showMixCharts ? "#2563eb" : undefined,
                }}
              >
                <PieChartIcon size={14} /> {showMixCharts ? "Hide Visual Charts" : "Show Visual Charts"}
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowProductMix(false)}
                style={{
                  padding: "0.35rem 0.75rem",
                  fontSize: "0.8rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  height: "34px",
                }}
              >
                <X size={14} /> Close Section
              </button>
            </div>
          </div>

          {/* ================================================================
              CATEGORY VIEW MODE
             ================================================================ */}
          {productMixMode === "CATEGORY" && (
            <div>
              {/* Category KPI Metric Cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "0.85rem",
                  marginBottom: "1.25rem",
                }}
              >
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "10px",
                    padding: "0.85rem 1.1rem",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                    <span style={{ fontSize: "0.725rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Active Categories
                    </span>
                    <div style={{ width: "24px", height: "24px", borderRadius: "6px", background: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Tag size={13} />
                    </div>
                  </div>
                  <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a" }}>
                    {categoryMixData.length}
                  </div>
                  <span style={{ fontSize: "0.7rem", color: "#64748b" }}>
                    {selectedMixWarehouseId === "ALL" ? `Across all ${analytics.warehouses.length} facilities` : "In selected facility"}
                  </span>
                </div>

                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "10px",
                    padding: "0.85rem 1.1rem",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                    <span style={{ fontSize: "0.725rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Categorized Stock
                    </span>
                    <div style={{ width: "24px", height: "24px", borderRadius: "6px", background: "#ecfeff", color: "#0891b2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Boxes size={13} />
                    </div>
                  </div>
                  <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a" }}>
                    {totalMixCategoryUnits.toLocaleString()}
                  </div>
                  <span style={{ fontSize: "0.7rem", color: "#0891b2", fontWeight: 600 }}>
                    Physical units on hand
                  </span>
                </div>

                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "10px",
                    padding: "0.85rem 1.1rem",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                    <span style={{ fontSize: "0.725rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Total Valuation
                    </span>
                    <div style={{ width: "24px", height: "24px", borderRadius: "6px", background: "#ecfdf5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <DollarSign size={13} />
                    </div>
                  </div>
                  <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a" }}>
                    ₹{totalMixCategoryValue >= 100000 ? `${(totalMixCategoryValue / 100000).toFixed(2)}L` : totalMixCategoryValue.toLocaleString("en-IN")}
                  </div>
                  <span style={{ fontSize: "0.7rem", color: "#059669", fontWeight: 600 }}>
                    Calculated at unit price
                  </span>
                </div>

                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "10px",
                    padding: "0.85rem 1.1rem",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                    <span style={{ fontSize: "0.725rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Leading Category
                    </span>
                    <div style={{ width: "24px", height: "24px", borderRadius: "6px", background: "#f5f3ff", color: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <TrendingUp size={13} />
                    </div>
                  </div>
                  <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0f172a", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                    {leadingCategory ? leadingCategory.category : "N/A"}
                  </div>
                  <span style={{ fontSize: "0.7rem", color: "#7c3aed", fontWeight: 600 }}>
                    {leadingCategoryPct}% volume share
                  </span>
                </div>
              </div>

              {/* Optional Visual Charts (Toggled via button) */}
              {showMixCharts && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                    gap: "1.25rem",
                    marginBottom: "1.25rem",
                  }}
                >
                  <div style={{ background: "#ffffff", borderRadius: "10px", padding: "1.25rem", border: "1px solid #e2e8f0" }}>
                    <h4 style={{ fontSize: "0.9rem", fontWeight: 800, margin: "0 0 0.5rem 0" }}>Volume Share by Category</h4>
                    <div style={{ width: "100%", height: "220px" }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryMixData}
                            dataKey="total_units"
                            nameKey="category"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={3}
                          >
                            {categoryMixData.map((item) => (
                              <Cell key={item.category} fill={getCategoryTheme(item.category).color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(val, name) => [`${Number(val).toLocaleString()} units`, name]} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div style={{ background: "#ffffff", borderRadius: "10px", padding: "1.25rem", border: "1px solid #e2e8f0" }}>
                    <h4 style={{ fontSize: "0.9rem", fontWeight: 800, margin: "0 0 0.5rem 0" }}>Inventory Value by Category</h4>
                    <div style={{ width: "100%", height: "220px" }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={categoryMixData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                          <XAxis dataKey="category" tick={{ fontSize: 10, fill: "#475569" }} />
                          <YAxis tick={{ fontSize: 10, fill: "#475569" }} tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}K`} />
                          <Tooltip formatter={(val) => [`₹${Number(val).toLocaleString("en-IN")}`, "Inventory Value"]} />
                          <Bar dataKey="inventory_value" radius={[6, 6, 0, 0]}>
                            {categoryMixData.map((item) => (
                              <Cell key={item.category} fill={getCategoryTheme(item.category).color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* TABULAR LAYOUT FOR CATEGORIES */}
              {mixLayoutMode === "TABLE" ? (
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "10px",
                    border: "1.5px solid #e2e8f0",
                    overflow: "hidden",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  <div style={{ maxHeight: "460px", overflowY: "auto", overflowX: "auto" }}>
                    <table className="data-table" style={{ margin: 0, width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                      <thead
                        style={{
                          position: "sticky",
                          top: 0,
                          zIndex: 5,
                          background: "#f8fafc",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                        }}
                      >
                        <tr>
                          <th style={{ width: "38px", padding: "10px 8px", textAlign: "center" }}></th>
                          <th style={{ padding: "10px 14px" }}>Product Category</th>
                          <th style={{ padding: "10px 14px", textAlign: "center" }}>SKUs</th>
                          <th style={{ padding: "10px 14px", textAlign: "right" }}>Physical Units</th>
                          <th style={{ padding: "10px 14px", minWidth: "160px" }}>Volume Share</th>
                          <th style={{ padding: "10px 14px", textAlign: "right" }}>Total Valuation</th>
                          <th style={{ padding: "10px 14px" }}>Stocked Facilities</th>
                          <th style={{ padding: "10px 14px", minWidth: "220px" }}>Top SKUs Preview</th>
                          <th style={{ padding: "10px 14px", textAlign: "center" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryMixData.length === 0 ? (
                          <tr>
                            <td colSpan="9" className="empty-state" style={{ padding: "3rem" }}>
                              No product categories found for this facility selection.
                            </td>
                          </tr>
                        ) : (
                          categoryMixData.map((catItem) => {
                            const isExpanded = expandedCategory === catItem.category;
                            const theme = getCategoryTheme(catItem.category);
                            const catShare = totalMixCategoryUnits > 0
                              ? ((catItem.total_units / totalMixCategoryUnits) * 100).toFixed(1)
                              : "0";

                            return (
                              <Fragment key={catItem.category}>
                                <tr
                                  onClick={() => setExpandedCategory(isExpanded ? null : catItem.category)}
                                  style={{
                                    cursor: "pointer",
                                    background: isExpanded ? "rgba(37, 99, 235, 0.05)" : undefined,
                                    borderLeft: isExpanded ? `4px solid ${theme.color}` : "4px solid transparent",
                                    transition: "background 0.15s ease",
                                  }}
                                >
                                  <td style={{ textAlign: "center", padding: "10px 8px", color: "#64748b" }}>
                                    {isExpanded ? <ChevronUp size={16} color="#2563eb" /> : <ChevronDown size={16} />}
                                  </td>
                                  <td style={{ padding: "10px 14px" }}>
                                    <span
                                      style={{
                                        background: theme.bg,
                                        color: theme.text,
                                        border: `1px solid ${theme.border}`,
                                        padding: "0.25rem 0.65rem",
                                        borderRadius: "6px",
                                        fontSize: "0.8rem",
                                        fontWeight: 800,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "0.35rem",
                                      }}
                                    >
                                      <Tag size={12} /> {catItem.category}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: "center", padding: "10px 14px" }}>
                                    <span className="badge badge-neutral" style={{ fontSize: "0.75rem", fontWeight: 700 }}>
                                      {catItem.products.length} SKUs
                                    </span>
                                  </td>
                                  <td style={{ textAlign: "right", padding: "10px 14px" }}>
                                    <strong style={{ fontSize: "0.95rem", color: "#0f172a" }}>
                                      {catItem.total_units.toLocaleString()}
                                    </strong>{" "}
                                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>units</span>
                                  </td>
                                  <td style={{ padding: "10px 14px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                      <div style={{ flex: 1, height: "6px", background: "#f1f5f9", borderRadius: "3px", overflow: "hidden" }}>
                                        <div style={{ height: "100%", width: `${catShare}%`, background: theme.bar, borderRadius: "3px" }} />
                                      </div>
                                      <span style={{ fontSize: "0.775rem", fontWeight: 700, color: "#334155", minWidth: "42px" }}>
                                        {catShare}%
                                      </span>
                                    </div>
                                  </td>
                                  <td style={{ textAlign: "right", padding: "10px 14px" }}>
                                    <strong style={{ color: "#059669", fontSize: "0.95rem" }}>
                                      ₹{catItem.inventory_value.toLocaleString("en-IN")}
                                    </strong>
                                  </td>
                                  <td style={{ padding: "10px 14px" }}>
                                    <span style={{ fontSize: "0.775rem", color: "#475569" }}>
                                      📍 {catItem.warehouses.length} {catItem.warehouses.length === 1 ? "facility" : "facilities"}
                                    </span>
                                  </td>
                                  <td style={{ padding: "10px 14px" }}>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                                      {catItem.products.slice(0, 2).map((p) => (
                                        <span
                                          key={p.id}
                                          style={{
                                            fontSize: "0.725rem",
                                            background: "#f8fafc",
                                            border: "1px solid #e2e8f0",
                                            borderRadius: "4px",
                                            padding: "1px 6px",
                                            color: "#334155",
                                          }}
                                        >
                                          {p.name} ({p.total_units})
                                        </span>
                                      ))}
                                      {catItem.products.length > 2 && (
                                        <span style={{ fontSize: "0.7rem", color: "#64748b", alignSelf: "center" }}>
                                          +{catItem.products.length - 2} more
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td style={{ textAlign: "center", padding: "10px 14px" }}>
                                    <button
                                      type="button"
                                      className="btn-secondary"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedCategory(isExpanded ? null : catItem.category);
                                      }}
                                      style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
                                    >
                                      {isExpanded ? "Collapse" : "View SKUs"}
                                    </button>
                                  </td>
                                </tr>

                                {/* Expanded Sub-Table: All Products in this category */}
                                {isExpanded && (
                                  <tr style={{ background: "#f8fafc" }}>
                                    <td colSpan="9" style={{ padding: "0.85rem 1.25rem", borderBottom: "2px solid #e2e8f0" }}>
                                      <div
                                        style={{
                                          background: "#ffffff",
                                          border: `1.5px solid ${theme.border}`,
                                          borderRadius: "8px",
                                          padding: "0.85rem 1rem",
                                          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                                        }}
                                      >
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem", flexWrap: "wrap", gap: "0.5rem" }}>
                                          <span style={{ fontSize: "0.825rem", fontWeight: 800, color: theme.text, display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                                            <Package size={14} /> Products in {catItem.category} ({catItem.products.length} catalog items)
                                          </span>
                                          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                                            Category Total: <strong>{catItem.total_units.toLocaleString()} units</strong> · <strong>₹{catItem.inventory_value.toLocaleString("en-IN")}</strong>
                                          </span>
                                        </div>
                                        <table className="data-table" style={{ margin: 0, width: "100%", fontSize: "0.8rem" }}>
                                          <thead>
                                            <tr style={{ background: "#f8fafc" }}>
                                              <th style={{ padding: "7px 10px" }}>Product Name</th>
                                              <th style={{ padding: "7px 10px" }}>SKU</th>
                                              <th style={{ padding: "7px 10px", textAlign: "right" }}>Quantity</th>
                                              <th style={{ padding: "7px 10px", textAlign: "right" }}>Total Value</th>
                                              <th style={{ padding: "7px 10px", minWidth: "140px" }}>Category Share</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {catItem.products.map((prod) => {
                                              const prodPct = catItem.total_units > 0
                                                ? ((prod.total_units / catItem.total_units) * 100).toFixed(1)
                                                : "0";
                                              return (
                                                <tr key={prod.id}>
                                                  <td style={{ padding: "7px 10px" }}>
                                                    <strong>{prod.name}</strong>
                                                  </td>
                                                  <td style={{ padding: "7px 10px" }}>
                                                    <code>{prod.sku || "-"}</code>
                                                  </td>
                                                  <td style={{ padding: "7px 10px", textAlign: "right" }}>
                                                    <strong>{prod.total_units.toLocaleString()}</strong> units
                                                  </td>
                                                  <td style={{ padding: "7px 10px", textAlign: "right", color: "#059669", fontWeight: 600 }}>
                                                    ₹{prod.inventory_value ? prod.inventory_value.toLocaleString("en-IN") : "-"}
                                                  </td>
                                                  <td style={{ padding: "7px 10px" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                                      <div style={{ flex: 1, height: "5px", background: "#f1f5f9", borderRadius: "2px", overflow: "hidden" }}>
                                                        <div style={{ height: "100%", width: `${prodPct}%`, background: theme.color, borderRadius: "2px" }} />
                                                      </div>
                                                      <span style={{ fontSize: "0.725rem", color: "#64748b", minWidth: "36px" }}>
                                                        {prodPct}%
                                                      </span>
                                                    </div>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>

                                        {/* Warehouses holding this category */}
                                        <div style={{ marginTop: "0.75rem", paddingTop: "0.5rem", borderTop: "1px solid #f1f5f9" }}>
                                          <span style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                                            Stocked Facilities:
                                          </span>
                                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.3rem" }}>
                                            {catItem.warehouses.map((wh) => (
                                              <span
                                                key={wh.id}
                                                style={{
                                                  fontSize: "0.725rem",
                                                  padding: "2px 7px",
                                                  background: "#f8fafc",
                                                  border: "1px solid #e2e8f0",
                                                  borderRadius: "5px",
                                                  color: "#334155",
                                                }}
                                              >
                                                📍 {wh.name}: <strong>{wh.total_units.toLocaleString()}</strong>
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* CARDS GRID VIEW FOR CATEGORIES */
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
                    gap: "1.25rem",
                  }}
                >
                  {categoryMixData.length === 0 ? (
                    <p className="empty-state" style={{ padding: "3rem", gridColumn: "1 / -1" }}>
                      No product categories found for this filter selection.
                    </p>
                  ) : (
                    categoryMixData.map((catItem) => {
                      const theme = getCategoryTheme(catItem.category);
                      const catShare = totalMixCategoryUnits > 0
                        ? ((catItem.total_units / totalMixCategoryUnits) * 100).toFixed(1)
                        : "0";

                      return (
                        <div
                          key={catItem.category}
                          style={{
                            background: "#ffffff",
                            border: `1.5px solid ${theme.border}`,
                            borderRadius: "12px",
                            padding: "1.25rem",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.85rem", paddingBottom: "0.65rem", borderBottom: "1px solid #f1f5f9" }}>
                              <span style={{ background: theme.bg, color: theme.text, border: `1px solid ${theme.border}`, padding: "0.25rem 0.65rem", borderRadius: "7px", fontSize: "0.825rem", fontWeight: 800 }}>
                                <Tag size={13} /> {catItem.category}
                              </span>
                              <span style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "0.2rem 0.5rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 700 }}>
                                {catShare}% share
                              </span>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", background: "#f8fafc", padding: "0.65rem 0.85rem", borderRadius: "8px", marginBottom: "0.85rem" }}>
                              <div>
                                <span style={{ fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Physical Stock</span>
                                <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>{catItem.total_units.toLocaleString()} units</div>
                              </div>
                              <div>
                                <span style={{ fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Total Valuation</span>
                                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#059669" }}>₹{catItem.inventory_value.toLocaleString("en-IN")}</div>
                              </div>
                            </div>
                            <div style={{ display: "grid", gap: "0.5rem" }}>
                              {catItem.products.map((prod) => (
                                <div key={prod.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.775rem" }}>
                                  <span>{prod.name}</span>
                                  <strong>{prod.total_units.toLocaleString()} units</strong>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================================================================
              WAREHOUSE VIEW MODE
             ================================================================ */}
          {productMixMode === "WAREHOUSE" && (
            <div>
              {/* TABULAR LAYOUT FOR WAREHOUSES */}
              {mixLayoutMode === "TABLE" ? (
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "10px",
                    border: "1.5px solid #e2e8f0",
                    overflow: "hidden",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  <div style={{ maxHeight: "460px", overflowY: "auto", overflowX: "auto" }}>
                    <table className="data-table" style={{ margin: 0, width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                      <thead
                        style={{
                          position: "sticky",
                          top: 0,
                          zIndex: 5,
                          background: "#f8fafc",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                        }}
                      >
                        <tr>
                          <th style={{ width: "38px", padding: "10px 8px", textAlign: "center" }}></th>
                          <th style={{ padding: "10px 14px" }}>Warehouse Facility</th>
                          <th style={{ padding: "10px 14px" }}>Location Address</th>
                          <th style={{ padding: "10px 14px", textAlign: "center" }}>SKUs Stocked</th>
                          <th style={{ padding: "10px 14px", textAlign: "right" }}>Total Units</th>
                          <th style={{ padding: "10px 14px", textAlign: "right" }}>Inventory Value</th>
                          <th style={{ padding: "10px 14px" }}>Category Mix</th>
                          <th style={{ padding: "10px 14px", textAlign: "center" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.warehouses.length === 0 ? (
                          <tr>
                            <td colSpan="8" className="empty-state" style={{ padding: "3rem" }}>
                              No warehouses found.
                            </td>
                          </tr>
                        ) : (
                          analytics.warehouses
                            .filter((w) => selectedMixWarehouseId === "ALL" || w.id === selectedMixWarehouseId)
                            .map((warehouse) => {
                              const isExpanded = expandedMixWarehouse === warehouse.id;
                              const warehouseProducts = (analytics.warehouseMix || [])
                                .filter((item) => item.warehouse_id === warehouse.id)
                                .map((item) => ({
                                  name: item.product_name,
                                  total_units: Number(item.total_units),
                                  id: item.product_id,
                                  sku: item.sku,
                                  category: item.category || productCategoryMap[item.product_id] || "HARDWARE",
                                }));
                              const totalUnits = warehouseProducts.reduce((sum, p) => sum + p.total_units, 0);
                              const warehouseValue = Number(warehouse.inventory_value || 0);

                              return (
                                <Fragment key={warehouse.id}>
                                  <tr
                                    onClick={() => setExpandedMixWarehouse(isExpanded ? null : warehouse.id)}
                                    style={{
                                      cursor: "pointer",
                                      background: isExpanded ? "rgba(37, 99, 235, 0.05)" : undefined,
                                      borderLeft: isExpanded ? "4px solid #2563eb" : "4px solid transparent",
                                      transition: "background 0.15s ease",
                                    }}
                                  >
                                    <td style={{ textAlign: "center", padding: "10px 8px", color: "#64748b" }}>
                                      {isExpanded ? <ChevronUp size={16} color="#2563eb" /> : <ChevronDown size={16} />}
                                    </td>
                                    <td style={{ padding: "10px 14px" }}>
                                      <strong style={{ color: "#0f172a", fontSize: "0.9rem" }}>{warehouse.name}</strong>
                                    </td>
                                    <td style={{ padding: "10px 14px", fontSize: "0.775rem", color: "#64748b", maxWidth: "240px" }}>
                                      {warehouse.address}
                                    </td>
                                    <td style={{ textAlign: "center", padding: "10px 14px" }}>
                                      <span className="badge badge-neutral" style={{ fontSize: "0.75rem", fontWeight: 700 }}>
                                        {warehouseProducts.length} SKUs
                                      </span>
                                    </td>
                                    <td style={{ textAlign: "right", padding: "10px 14px" }}>
                                      <strong style={{ fontSize: "0.95rem", color: "#0f172a" }}>
                                        {totalUnits.toLocaleString()}
                                      </strong>{" "}
                                      <span style={{ fontSize: "0.75rem", color: "#64748b" }}>units</span>
                                    </td>
                                    <td style={{ textAlign: "right", padding: "10px 14px" }}>
                                      <strong style={{ color: "#059669", fontSize: "0.95rem" }}>
                                        ₹{warehouseValue.toLocaleString("en-IN")}
                                      </strong>
                                    </td>
                                    <td style={{ padding: "10px 14px" }}>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                                        {[...new Set(warehouseProducts.map((p) => p.category))].slice(0, 3).map((cat) => {
                                          const theme = getCategoryTheme(cat);
                                          return (
                                            <span
                                              key={cat}
                                              style={{
                                                fontSize: "0.7rem",
                                                padding: "1px 6px",
                                                borderRadius: "4px",
                                                background: theme.bg,
                                                color: theme.text,
                                                border: `1px solid ${theme.border}`,
                                                fontWeight: 600,
                                              }}
                                            >
                                              {cat}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    </td>
                                    <td style={{ textAlign: "center", padding: "10px 14px" }}>
                                      <button
                                        type="button"
                                        className="btn-secondary"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setExpandedMixWarehouse(isExpanded ? null : warehouse.id);
                                        }}
                                        style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
                                      >
                                        {isExpanded ? "Collapse" : "View Stock"}
                                      </button>
                                    </td>
                                  </tr>

                                  {/* Expanded Sub-Table: Products inside this warehouse */}
                                  {isExpanded && (
                                    <tr style={{ background: "#f8fafc" }}>
                                      <td colSpan="8" style={{ padding: "0.85rem 1.25rem", borderBottom: "2px solid #e2e8f0" }}>
                                        <div
                                          style={{
                                            background: "#ffffff",
                                            border: "1.5px solid #cbd5e1",
                                            borderRadius: "8px",
                                            padding: "0.85rem 1rem",
                                            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                                          }}
                                        >
                                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
                                            <span style={{ fontSize: "0.825rem", fontWeight: 800, color: "#1e293b", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                                              <WarehouseIcon size={14} color="#2563eb" /> Stock in {warehouse.name} ({warehouseProducts.length} SKUs)
                                            </span>
                                            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                                              Total: <strong>{totalUnits.toLocaleString()} units</strong>
                                            </span>
                                          </div>
                                          {warehouseProducts.length === 0 ? (
                                            <p style={{ margin: "0.5rem 0", fontSize: "0.775rem", color: "#94a3b8" }}>No products stocked in this warehouse.</p>
                                          ) : (
                                            <table className="data-table" style={{ margin: 0, width: "100%", fontSize: "0.8rem" }}>
                                              <thead>
                                                <tr style={{ background: "#f8fafc" }}>
                                                  <th style={{ padding: "7px 10px" }}>Product Name</th>
                                                  <th style={{ padding: "7px 10px" }}>SKU</th>
                                                  <th style={{ padding: "7px 10px" }}>Category</th>
                                                  <th style={{ padding: "7px 10px", textAlign: "right" }}>Quantity</th>
                                                  <th style={{ padding: "7px 10px", minWidth: "140px" }}>Share in Warehouse</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {warehouseProducts.map((prod) => {
                                                  const pct = totalUnits > 0 ? ((prod.total_units / totalUnits) * 100).toFixed(1) : "0";
                                                  const theme = getCategoryTheme(prod.category);
                                                  return (
                                                    <tr key={prod.id}>
                                                      <td style={{ padding: "7px 10px" }}>
                                                        <strong>{prod.name}</strong>
                                                      </td>
                                                      <td style={{ padding: "7px 10px" }}>
                                                        <code>{prod.sku || "-"}</code>
                                                      </td>
                                                      <td style={{ padding: "7px 10px" }}>
                                                        <span
                                                          style={{
                                                            fontSize: "0.7rem",
                                                            padding: "1px 6px",
                                                            borderRadius: "4px",
                                                            background: theme.bg,
                                                            color: theme.text,
                                                            border: `1px solid ${theme.border}`,
                                                          }}
                                                        >
                                                          {prod.category}
                                                        </span>
                                                      </td>
                                                      <td style={{ padding: "7px 10px", textAlign: "right" }}>
                                                        <strong>{prod.total_units.toLocaleString()}</strong> units
                                                      </td>
                                                      <td style={{ padding: "7px 10px" }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                                          <div style={{ flex: 1, height: "5px", background: "#f1f5f9", borderRadius: "2px", overflow: "hidden" }}>
                                                            <div style={{ height: "100%", width: `${pct}%`, background: theme.color, borderRadius: "2px" }} />
                                                          </div>
                                                          <span style={{ fontSize: "0.725rem", color: "#64748b", minWidth: "36px" }}>
                                                            {pct}%
                                                          </span>
                                                        </div>
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              );
                            })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* CARDS GRID VIEW FOR WAREHOUSES */
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: selectedMixWarehouseId === "ALL" ? "repeat(auto-fit, minmax(320px, 1fr))" : "1fr",
                    gap: "1.25rem",
                  }}
                >
                  {analytics.warehouses
                    .filter((w) => selectedMixWarehouseId === "ALL" || w.id === selectedMixWarehouseId)
                    .map((warehouse) => {
                      const warehouseProducts = (analytics.warehouseMix || [])
                        .filter((item) => item.warehouse_id === warehouse.id)
                        .map((item) => ({
                          name: item.product_name,
                          total_units: Number(item.total_units),
                          id: item.product_id,
                          category: item.category || productCategoryMap[item.product_id] || "HARDWARE",
                        }));
                      const totalUnits = warehouseProducts.reduce((sum, p) => sum + p.total_units, 0);

                      return (
                        <div
                          key={warehouse.id}
                          style={{
                            background: "#ffffff",
                            border: "1px solid #e2e8f0",
                            borderRadius: "12px",
                            padding: "1.25rem",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
                            <div>
                              <h3 style={{ fontSize: "1rem", fontWeight: 800, margin: 0 }}>{warehouse.name}</h3>
                              <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>{warehouse.address}</p>
                            </div>
                            <span className="badge badge-active">{totalUnits.toLocaleString()} units</span>
                          </div>
                          <div style={{ display: "grid", gap: "0.5rem" }}>
                            {warehouseProducts.map((item) => (
                              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.775rem" }}>
                                <span>{item.name}</span>
                                <strong>{item.total_units.toLocaleString()} units</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ------------------------------------------------------------------
          TOP VISUALIZATIONS: FIXED HEIGHTS, TOOLTIPS, RESPONSIVE GRIDS
         ------------------------------------------------------------------ */}
      <section className="warehouse-analytics-grid">
        {/* Visualization 1: Units by Warehouse */}
        <div className="admin-panel warehouse-chart-panel" style={{ padding: "1.25rem" }}>
          <div className="panel-heading-spread" style={{ marginBottom: "0.75rem" }}>
            <div>
              <p className="eyebrow">Facility density</p>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0 }}>Units by Warehouse</h2>
            </div>
            <span className="staff-count">{analytics.warehouses.length} locations</span>
          </div>
          <div style={{ width: "100%", height: "260px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={analytics.warehouses.map((item) => ({ ...item, total_units: Number(item.total_units) }))}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#475569" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#475569" }} />
                <Tooltip formatter={(value) => [`${value} Units`, "Total Units"]} contentStyle={{ borderRadius: "8px", borderColor: "#cbd5e1" }} />
                <Bar dataKey="total_units" name="Units" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Visualization 2: Inventory Value Trend */}
        <div className="admin-panel warehouse-chart-panel" style={{ padding: "1.25rem" }}>
          <div className="panel-heading-spread" style={{ marginBottom: "0.75rem" }}>
            <div>
              <p className="eyebrow">Capital holding</p>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0 }}>Inventory Value Trend</h2>
            </div>
            <span className="badge badge-approved" style={{ fontSize: "0.7rem" }}>INR Value</span>
          </div>
          <div style={{ width: "100%", height: "260px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={analytics.warehouses.map((item) => ({ ...item, inventory_value: Number(item.inventory_value) }))}
                margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="valGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#475569" }} />
                <YAxis tick={{ fontSize: 10, fill: "#475569" }} tickFormatter={(val) => `₹${(Number(val) / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Inventory Value"]} contentStyle={{ borderRadius: "8px", borderColor: "#cbd5e1" }} />
                <Area type="monotone" dataKey="inventory_value" name="Value" stroke="#10b981" strokeWidth={3} fill="url(#valGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Visualization 3: Product Distribution Across Network */}
        <div className="admin-panel warehouse-chart-panel" style={{ padding: "1.25rem" }}>
          <div className="panel-heading-spread" style={{ marginBottom: "0.75rem" }}>
            <div>
              <p className="eyebrow">Network distribution</p>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0 }}>Units Across Network</h2>
            </div>
            <span className="badge badge-neutral" style={{ fontSize: "0.7rem" }}>{totalNetworkUnits} Units</span>
          </div>
          <div style={{ width: "100%", height: "260px", position: "relative" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.products.map((item) => ({ ...item, total_units: Number(item.total_units) }))}
                  dataKey="total_units"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {analytics.products.map((item, index) => (
                    <Cell key={item.id} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val) => [`${val} Units`, "Quantity"]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          WAREHOUSE CREATION & MAP PINNING
         ------------------------------------------------------------------ */}
      <section className="warehouse-layout" style={{ marginBottom: "1.5rem" }}>
        <form className="admin-panel warehouse-form" onSubmit={saveWarehouse}>
          <div className="panel-heading">
            <div className="panel-icon"><WarehouseIcon size={18} /></div>
            <div>
              <h2>{editingWarehouse ? "Edit Warehouse" : "Create Warehouse"}</h2>
              <p>{editingWarehouse ? "Update warehouse address, identity or map pin." : "Save a fulfillment facility with its precise operating coordinates."}</p>
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
            <label className="warehouse-active-toggle" style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "0.5rem 0 1rem 0" }}>
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

      {/* ------------------------------------------------------------------
          FIXED HEIGHT & OVERFLOW SCROLL: WAREHOUSE DIRECTORY
         ------------------------------------------------------------------ */}
      <section className="admin-panel warehouse-list-panel" style={{ marginBottom: "1.5rem", padding: "1.25rem 1.5rem" }}>
        <div
          className="panel-heading panel-heading-spread"
          style={{ flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.85rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.75rem" }}
        >
          <div>
            <p className="eyebrow">Saved locations</p>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: 0 }}>Warehouse Directory</h2>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
            {/* Instant Filter Search Input */}
            <div style={{ position: "relative" }}>
              <Search size={14} color="#94a3b8" style={{ position: "absolute", left: "9px", top: "10px" }} />
              <input
                type="text"
                placeholder="Filter warehouses..."
                value={directoryFilter}
                onChange={(e) => setDirectoryFilter(e.target.value)}
                style={{
                  paddingLeft: "28px",
                  paddingRight: "10px",
                  height: "34px",
                  fontSize: "0.8rem",
                  border: "1.5px solid #cbd5e1",
                  borderRadius: "7px",
                  width: "190px",
                  background: "#ffffff",
                }}
              />
            </div>
            <span className="staff-count">
              {filteredDirectoryWarehouses.length} of {warehouses.length} locations
            </span>
          </div>
        </div>

        {/* Fixed Height Container with Overflow Scroll */}
        <div
          className="warehouse-dir-scroll-wrap"
          style={{
            maxHeight: "380px",
            overflowY: "auto",
            overflowX: "auto",
            borderRadius: "10px",
            border: "1.5px solid #e2e8f0",
            background: "#ffffff",
          }}
        >
          <table className="data-table staff-table" style={{ margin: 0, width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
            <thead
              style={{
                position: "sticky",
                top: 0,
                zIndex: 5,
                background: "#f8fafc",
                boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
              }}
            >
              <tr>
                <th style={{ padding: "10px 14px" }}>Warehouse</th>
                <th style={{ padding: "10px 14px" }}>Address</th>
                <th style={{ padding: "10px 14px" }}>Coordinates</th>
                <th style={{ padding: "10px 14px" }}>Status</th>
                <th style={{ padding: "10px 14px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="empty-state" style={{ padding: "2.5rem" }}>Loading warehouses...</td>
                </tr>
              ) : filteredDirectoryWarehouses.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty-state" style={{ padding: "2.5rem" }}>
                    {directoryFilter ? "No warehouses match your filter search." : "No warehouses created yet."}
                  </td>
                </tr>
              ) : (
                filteredDirectoryWarehouses.map((warehouse) => {
                  const isSelected = selectedWarehouse?.id === warehouse.id;
                  return (
                    <tr
                      key={warehouse.id}
                      className={`warehouse-row ${isSelected ? "selected" : ""}`}
                      onClick={() => selectWarehouse(warehouse)}
                      style={{
                        cursor: "pointer",
                        background: isSelected ? "rgba(37, 99, 235, 0.08)" : undefined,
                        borderLeft: isSelected ? "3px solid #2563eb" : "3px solid transparent",
                        transition: "background 0.15s ease",
                      }}
                    >
                      <td style={{ padding: "10px 14px" }}>
                        <strong style={{ color: "#0f172a" }}>{warehouse.name}</strong>
                      </td>
                      <td className="warehouse-address-cell" style={{ padding: "10px 14px" }}>
                        {warehouse.address}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <code style={{ fontSize: "0.8rem", color: "#475569" }}>
                          {Number(warehouse.latitude).toFixed(5)}, {Number(warehouse.longitude).toFixed(5)}
                        </code>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span className={`badge ${warehouse.is_active ? "badge-active" : "badge-suspended"}`}>
                          {warehouse.is_active ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>
                        <div className="warehouse-row-actions" style={{ justifyContent: "flex-end" }}>
                          <button
                            className="icon-button"
                            title={`Edit ${warehouse.name}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              editWarehouse(warehouse);
                            }}
                          >
                            <Edit3 size={16} />
                          </button>
                          <span className="warehouse-row-hint" style={{ fontSize: "0.75rem", color: "#2563eb", fontWeight: 600 }}>
                            Manage stock
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          SELECTED WAREHOUSE INVENTORY MANAGEMENT PANEL
         ------------------------------------------------------------------ */}
      {selectedWarehouse && (
        <section className="admin-panel inventory-panel" style={{ padding: "1.5rem", borderRadius: "12px", border: "1.5px solid #cbd5e1" }}>
          <div className="panel-heading panel-heading-spread" style={{ marginBottom: "1.25rem" }}>
            <div>
              <p className="eyebrow">Facility inventory management</p>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0 }}>{selectedWarehouse.name}</h2>
              <p style={{ margin: "0.2rem 0 0 0", color: "#64748b", fontSize: "0.825rem" }}>{selectedWarehouse.address}</p>
            </div>
            <button className="icon-button" title="Close inventory" onClick={() => setSelectedWarehouse(null)}>
              <X size={16} />
            </button>
          </div>

          <form className="inventory-form" onSubmit={saveInventory} style={{ marginBottom: "1.5rem" }}>
            <div className="form-group">
              <label className="form-label" htmlFor="inventory-product">Product from catalog</label>
              <select
                id="inventory-product"
                className="form-select no-icon"
                value={inventoryForm.productId}
                onChange={(event) => setInventoryForm((current) => ({ ...current, productId: event.target.value }))}
                required
                style={{ height: "38px" }}
              >
                <option value="">Select a catalog product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.sku})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="inventory-quantity">Quantity available</label>
              <input
                id="inventory-quantity"
                className="form-input no-icon"
                type="number"
                min="0"
                step="1"
                value={inventoryForm.quantity}
                onChange={(event) => setInventoryForm((current) => ({ ...current, quantity: event.target.value }))}
                required
                style={{ height: "38px" }}
              />
            </div>
            <button className="btn-primary inventory-save-button" type="submit" disabled={inventorySaving} style={{ height: "38px" }}>
              {inventorySaving ? "Saving..." : "Add / Update stock"}
            </button>
          </form>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1.3fr",
              gap: "1.5rem",
              alignItems: "center",
              marginBottom: "1.25rem",
              background: "#f8fafc",
              padding: "1.25rem",
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
            }}
          >
            <div>
              <p className="eyebrow">Warehouse stock composition</p>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, margin: "0.2rem 0" }}>
                Local Product Mix {localMixMode === "CATEGORY" ? "by Category" : "by Product"}
              </h3>
              <p style={{ fontSize: "0.8rem", color: "#64748b", margin: 0 }}>
                {localMixMode === "CATEGORY"
                  ? `Category distribution and merchandise balance in ${selectedWarehouse.name}.`
                  : `Visual allocation of available SKUs in ${selectedWarehouse.name}.`}
              </p>

              {/* Segmented control for By Category vs By Product */}
              <div
                style={{
                  display: "inline-flex",
                  background: "#e2e8f0",
                  padding: "3px",
                  borderRadius: "7px",
                  marginTop: "0.75rem",
                  gap: "2px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setLocalMixMode("CATEGORY")}
                  style={{
                    padding: "0.25rem 0.65rem",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    borderRadius: "5px",
                    border: "none",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.3rem",
                    background: localMixMode === "CATEGORY" ? "#ffffff" : "transparent",
                    color: localMixMode === "CATEGORY" ? "#2563eb" : "#64748b",
                    boxShadow: localMixMode === "CATEGORY" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  }}
                >
                  <Tag size={12} /> By Category
                </button>
                <button
                  type="button"
                  onClick={() => setLocalMixMode("PRODUCT")}
                  style={{
                    padding: "0.25rem 0.65rem",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    borderRadius: "5px",
                    border: "none",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.3rem",
                    background: localMixMode === "PRODUCT" ? "#ffffff" : "transparent",
                    color: localMixMode === "PRODUCT" ? "#2563eb" : "#64748b",
                    boxShadow: localMixMode === "PRODUCT" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  }}
                >
                  <Package size={12} /> By Product
                </button>
              </div>

              {/* Mini category summary badges in Category mode */}
              {localMixMode === "CATEGORY" && localCategoryBreakdown.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.75rem" }}>
                  {localCategoryBreakdown.map((cat) => {
                    const theme = getCategoryTheme(cat.name);
                    return (
                      <span
                        key={cat.name}
                        style={{
                          fontSize: "0.725rem",
                          padding: "2px 7px",
                          borderRadius: "5px",
                          background: theme.bg,
                          color: theme.text,
                          border: `1px solid ${theme.border}`,
                          fontWeight: 600,
                        }}
                      >
                        {cat.name}: <strong>{cat.quantity}</strong>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ width: "100%", height: "240px" }}>
              <ResponsiveContainer width="100%" height="100%">
                {localMixMode === "CATEGORY" ? (
                  <PieChart>
                    <Pie
                      data={localCategoryBreakdown}
                      dataKey="quantity"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={88}
                      paddingAngle={3}
                    >
                      {localCategoryBreakdown.map((item) => (
                        <Cell key={item.name} fill={getCategoryTheme(item.name).color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val, name) => [`${val} Units`, name]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                ) : (
                  <PieChart>
                    <Pie
                      data={inventory
                        .map((item) => ({ ...item, quantity: Number(item.quantity) }))
                        .filter((item) => item.quantity > 0)}
                      dataKey="quantity"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={88}
                      paddingAngle={3}
                    >
                      {inventory.map((item, index) => (
                        <Cell key={item.id} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val) => [`${val} Units`, "Available"]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          <div className="inventory-table-wrap">
            {inventoryLoading ? (
              <p className="empty-state">Loading inventory...</p>
            ) : inventory.length === 0 ? (
              <p className="empty-state">No products assigned to this warehouse yet.</p>
            ) : (
              <table className="data-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Category</th>
                    <th>Quantity</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.name}</strong></td>
                      <td><code>{item.sku}</code></td>
                      <td><span className="badge badge-neutral" style={{ fontSize: "0.75rem" }}>{item.category}</span></td>
                      <td className="inventory-quantity"><strong>{item.quantity}</strong> units</td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="icon-button danger-icon"
                          title={`Remove ${item.name}`}
                          onClick={() => removeInventory(item)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p className="warehouse-map-help" style={{ marginTop: "1rem" }}>
            <Package size={15} /> Choose an existing catalog product and save its available quantity for this warehouse. Saving the same product updates its quantity.
          </p>
        </section>
      )}
    </main>
  );
}
