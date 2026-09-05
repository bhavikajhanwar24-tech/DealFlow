import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import {
  Truck,
  MapPin,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  TrendingDown,
  Layers,
  ArrowRight,
  ShieldCheck,
  PackageCheck,
  Navigation,
  Info,
} from "lucide-react";

const API_BASE = "http://localhost:5000/api";

const currency = (val) =>
  `₹${Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

// Custom Leaflet Markers
const warehouseIcon = L.divIcon({
  className: "custom-leaflet-marker",
  html: `<div style="background-color: #2563eb; color: white; padding: 5px 10px; border-radius: 20px; font-weight: 800; font-size: 11px; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 4px;">📍 Warehouse</div>`,
  iconSize: [100, 32],
  iconAnchor: [50, 16],
});

const selectedWarehouseIcon = L.divIcon({
  className: "custom-leaflet-marker",
  html: `<div style="background-color: #16a34a; color: white; padding: 6px 12px; border-radius: 20px; font-weight: 800; font-size: 12px; border: 3px solid #bbf7d0; box-shadow: 0 6px 16px rgba(22, 163, 74, 0.4); display: flex; align-items: center; gap: 4px;">🚚 Selected WH</div>`,
  iconSize: [125, 36],
  iconAnchor: [62, 18],
});

const destinationIcon = L.divIcon({
  className: "custom-leaflet-marker",
  html: `<div style="background-color: #dc2626; color: white; padding: 6px 12px; border-radius: 20px; font-weight: 800; font-size: 12px; border: 3px solid #fecaca; box-shadow: 0 6px 16px rgba(220, 38, 38, 0.4); display: flex; align-items: center; gap: 4px;">🎯 Customer</div>`,
  iconSize: [115, 36],
  iconAnchor: [57, 18],
});

function MapBoundsRecenter({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points && points.length > 0) {
      const validPoints = points.filter((p) => Array.isArray(p) && !isNaN(p[0]) && !isNaN(p[1]));
      if (validPoints.length > 0) {
        const bounds = L.latLngBounds(validPoints);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 8 });
      }
    }
  }, [points, map]);
  return null;
}

export default function OperationsDashboard({ onNavigate }) {
  const { token, user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [routeOptions, setRouteOptions] = useState(null);
  const [warehousesList, setWarehousesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedOptionId, setSelectedOptionId] = useState("OPTION-1");

  async function loadInitialData() {
    setLoading(true);
    setError("");
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [ordersRes, whRes] = await Promise.all([
        fetch(`${API_BASE}/fulfillment/orders`, { headers }),
        fetch(`${API_BASE}/operations/warehouses`, { headers }),
      ]);
      const ordersData = await ordersRes.json();
      const whData = await whRes.json();

      if (!ordersRes.ok) throw new Error(ordersData.message || "Failed to load orders.");
      if (!whRes.ok) throw new Error(whData.message || "Failed to load warehouses.");

      const fetchedOrders = ordersData.data || [];
      setOrders(fetchedOrders);
      setWarehousesList(whData.data || []);

      if (fetchedOrders.length > 0) {
        const initialId = fetchedOrders[0].id;
        setSelectedOrderId(initialId);
        await loadFulfillmentOptions(initialId);
      }
    } catch (loadErr) {
      setError(loadErr.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadFulfillmentOptions(orderId) {
    if (!orderId) return;
    setOptionsLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/operations/orders/${orderId}/fulfillment-options`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to calculate route optimization.");
      setRouteOptions(data.data);
      setSelectedOptionId("OPTION-1");
    } catch (err) {
      setError(err.message);
      setRouteOptions(null);
    } finally {
      setOptionsLoading(false);
    }
  }

  useEffect(() => {
    loadInitialData();
  }, [token]);

  function handleOrderChange(event) {
    const id = event.target.value;
    setSelectedOrderId(id);
    setSuccess("");
    loadFulfillmentOptions(id);
  }

  async function approvePlan() {
    if (!selectedOrderId || !routeOptions?.optimalPlan) return;
    if (!window.confirm(`Approve Optimal Fulfillment Plan (${currency(routeOptions.optimalPlan.totalCost)})?`)) return;
    setApproveLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`${API_BASE}/operations/orders/${selectedOrderId}/fulfillment/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Plan approval failed.");
      setSuccess(data.data?.message || "Optimal fulfillment plan approved successfully!");
      await loadInitialData();
      await loadFulfillmentOptions(selectedOrderId);
    } catch (err) {
      setError(err.message);
    } finally {
      setApproveLoading(false);
    }
  }

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);
  const activePlan =
    routeOptions?.allOptions?.find((opt) => opt.optionId === selectedOptionId) ||
    routeOptions?.optimalPlan;

  // Compute points for Leaflet bounds fitting
  const allMapPoints = [];
  if (routeOptions?.mapData?.destinationMarker) {
    allMapPoints.push([
      routeOptions.mapData.destinationMarker.latitude,
      routeOptions.mapData.destinationMarker.longitude,
    ]);
  }
  if (routeOptions?.mapData?.warehouseMarkers) {
    routeOptions.mapData.warehouseMarkers.forEach((w) => {
      allMapPoints.push([w.latitude, w.longitude]);
    });
  }

  return (
    <main className="main-content">
      {/* Header Banner */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <div>
          <div style={{ color: "#2563eb", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Sparkles size={15} color="#2563eb" /> DealFlow360 Operations Core
          </div>
          <h1 style={{ fontSize: "1.9rem", fontWeight: 800, color: "#0f172a", marginTop: "0.25rem" }}>
            Smart Warehouse Route Optimizer
          </h1>
          <p style={{ color: "#64748b", marginTop: "0.35rem", fontSize: "0.95rem" }}>
            Automated multi-warehouse combinatorial inventory solver & minimum-cost fulfillment routing.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          {/* Order Selector */}
          <div style={{ background: "#ffffff", padding: "0.5rem 0.85rem", borderRadius: "12px", border: "1px solid #cbd5e1", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", display: "block", marginBottom: "0.25rem" }}>
              Select Confirmed Order:
            </label>
            <select
              value={selectedOrderId}
              onChange={handleOrderChange}
              style={{ background: "transparent", border: "none", outline: "none", fontWeight: 800, color: "#0f172a", fontSize: "0.95rem", cursor: "pointer" }}
            >
              {orders.length === 0 ? (
                <option value="">No confirmed orders found</option>
              ) : (
                orders.map((ord) => (
                  <option key={ord.id} value={ord.id}>
                    {ord.order_number} — {ord.company_name || ord.customer_name} ({ord.fulfillment_status})
                  </option>
                ))
              )}
            </select>
          </div>

          <button
            className="btn-secondary"
            onClick={() => onNavigate("/sales/fulfillment")}
            style={{ height: "46px" }}
          >
            Fulfillment Queue
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: "1.25rem", borderRadius: "12px" }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: "1.25rem", borderRadius: "12px" }}><CheckCircle size={18} /> {success}</div>}

      {/* PART 13: SHORTAGE WARNING IF FULFILLMENT NOT POSSIBLE */}
      {routeOptions && !routeOptions.fulfillmentPossible && (
        <div
          style={{
            background: "linear-gradient(135deg, #fef2f2, #fff1f2)",
            border: "2px solid #ef4444",
            borderRadius: "16px",
            padding: "1.5rem",
            marginBottom: "1.5rem",
            boxShadow: "0 10px 25px -5px rgba(239, 68, 68, 0.15)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", color: "#991b1b", marginBottom: "0.75rem" }}>
            <AlertTriangle size={24} color="#dc2626" />
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800 }}>⚠️ FULFILLMENT NOT POSSIBLE</h2>
          </div>
          <p style={{ color: "#7f1d1d", fontSize: "0.95rem", marginBottom: "1rem" }}>
            Total inventory across all active DealFlow360 warehouses is insufficient to fulfill this order completely.
          </p>

          <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #fca5a5", padding: "1rem" }}>
            <h4 style={{ fontWeight: 800, color: "#991b1b", marginBottom: "0.5rem" }}>Shortage Breakdown:</h4>
            <div style={{ display: "grid", gap: "0.5rem" }}>
              {routeOptions.shortages?.map((item) => (
                <div key={item.productId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0.85rem", background: "#fef2f2", borderRadius: "8px", border: "1px solid #fecaca" }}>
                  <span><strong>{item.productName}</strong> (SKU: {item.sku})</span>
                  <span style={{ color: "#dc2626", fontWeight: 800 }}>
                    Required: {item.requiredQuantity} · Available: {item.totalAvailableQuantity} · <span style={{ textDecoration: "underline" }}>Shortage: {item.shortageQuantity}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PART 1: CUSTOMER DESTINATION REQUIRED NOTICE */}
      {routeOptions && routeOptions.fulfillmentPossible && !routeOptions.hasDestination && (
        <div style={{ background: "#fffbe6", border: "2px solid #f59e0b", borderRadius: "16px", padding: "1.5rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", color: "#b45309", marginBottom: "0.5rem" }}>
            <MapPin size={22} color="#f59e0b" />
            <h3 style={{ fontSize: "1.15rem", fontWeight: 800 }}>Customer Delivery Destination Pending</h3>
          </div>
          <p style={{ color: "#78350f", fontSize: "0.9rem" }}>
            The customer has not yet confirmed their delivery destination address. The Smart Route Optimizer will execute automatically as soon as the customer submits their location in the Customer Portal.
          </p>
        </div>
      )}

      {/* MAIN OPTIMIZER INTERFACE */}
      {routeOptions && routeOptions.hasDestination && routeOptions.fulfillmentPossible && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: "1.5rem", alignItems: "start" }}>
          
          {/* LEFT COLUMN: INTERACTIVE LEAFLET MAP & ALTERNATIVES */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            
            {/* PART 3 & PART 8: LEAFLET OPERATIONS MAP */}
            <div style={{ background: "#ffffff", borderRadius: "16px", border: "1px solid #e2e8f0", padding: "1.25rem", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Navigation size={18} color="#2563eb" /> Live Warehouse & Fulfillment Route Map
                  </h3>
                  <p style={{ color: "#64748b", fontSize: "0.8rem", marginTop: "0.2rem" }}>
                    Showing DealFlow360 Warehouses, Customer Destination, and Minimum Cost Vector Routes
                  </p>
                </div>
                <span className="badge badge-active" style={{ fontSize: "0.75rem", background: "#f0fdf4", color: "#166534" }}>
                  OpenStreetMap · Haversine Engine
                </span>
              </div>

              <div style={{ height: "420px", borderRadius: "12px", overflow: "hidden", border: "1px solid #cbd5e1", position: "relative" }}>
                <MapContainer
                  center={[
                    routeOptions.destination?.latitude || 28.6139,
                    routeOptions.destination?.longitude || 77.2090,
                  ]}
                  zoom={5}
                  style={{ height: "100%", width: "100%" }}
                  scrollWheelZoom={false}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapBoundsRecenter points={allMapPoints} />

                  {/* Customer Destination Marker */}
                  {routeOptions.destination && (
                    <Marker
                      position={[routeOptions.destination.latitude, routeOptions.destination.longitude]}
                      icon={destinationIcon}
                    >
                      <Popup>
                        <div style={{ padding: "4px" }}>
                          <strong style={{ color: "#dc2626", fontSize: "14px" }}>🎯 Customer Destination</strong>
                          <div style={{ fontSize: "12px", color: "#334155", marginTop: "4px" }}>
                            <strong>{routeOptions.mapData?.destinationMarker?.name}</strong><br />
                            {routeOptions.destination.address}, {routeOptions.destination.city}, {routeOptions.destination.state}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  )}

                  {/* Warehouse Markers */}
                  {routeOptions.mapData?.warehouseMarkers?.map((w) => {
                    const isSelected = activePlan?.shipments?.some((s) => s.warehouseId === w.id);
                    const allocShipment = activePlan?.shipments?.find((s) => s.warehouseId === w.id);
                    return (
                      <Marker
                        key={w.id}
                        position={[w.latitude, w.longitude]}
                        icon={isSelected ? selectedWarehouseIcon : warehouseIcon}
                      >
                        <Popup>
                          <div style={{ padding: "6px", maxWidth: "230px" }}>
                            <h4 style={{ margin: 0, color: isSelected ? "#166534" : "#1e40af", fontSize: "14px", fontWeight: 800 }}>
                              📍 {w.name} ({w.city})
                            </h4>
                            <div style={{ fontSize: "12px", color: "#475569", marginTop: "4px" }}>
                              <strong>Available Stock:</strong>
                              <ul style={{ margin: "4px 0", paddingLeft: "16px" }}>
                                {w.inventory.map((inv) => (
                                  <li key={inv.productId}>{inv.productName}: {inv.availableQuantity}</li>
                                ))}
                              </ul>
                              <strong>Distance:</strong> {w.distanceKm} km<br />
                              <strong>Est. Shipment:</strong> {currency(w.shipmentCost)}
                              {allocShipment && (
                                <div style={{ marginTop: "6px", background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "4px 8px", borderRadius: "6px", color: "#166534", fontWeight: 700 }}>
                                  Allocated to order: {allocShipment.items.map((i) => `${i.allocatedQuantity} ${i.productName}`).join(", ")}
                                </div>
                              )}
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}

                  {/* Route Lines (Polylines) */}
                  {routeOptions.mapData?.warehouseMarkers?.map((w) => {
                    const shipment = activePlan?.shipments?.find((s) => s.warehouseId === w.id);
                    const dest = routeOptions.destination;
                    if (!dest) return null;
                    const coords = [
                      [w.latitude, w.longitude],
                      [dest.latitude, dest.longitude],
                    ];
                    const isSelected = Boolean(shipment);
                    return (
                      <Polyline
                        key={`route-${w.id}`}
                        positions={coords}
                        pathOptions={{
                          color: isSelected ? "#16a34a" : "#94a3b8",
                          weight: isSelected ? 5 : 2,
                          dashArray: isSelected ? undefined : "6, 8",
                          opacity: isSelected ? 0.9 : 0.4,
                        }}
                      />
                    );
                  })}
                </MapContainer>
              </div>

              {/* Map Legend */}
              <div style={{ display: "flex", gap: "1.25rem", marginTop: "0.85rem", fontSize: "0.8rem", color: "#475569", flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#16a34a" }}></span>
                  <strong>Selected Warehouse Route</strong>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#2563eb" }}></span>
                  <strong>Active Warehouse Stock</strong>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#dc2626" }}></span>
                  <strong>Customer Destination</strong>
                </span>
              </div>
            </div>

            {/* PART 9: ALTERNATIVE ROUTES RANKING */}
            <div style={{ background: "#ffffff", borderRadius: "16px", border: "1px solid #e2e8f0", padding: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Layers size={18} color="#2563eb" /> Evaluated Fulfillment Options Ranking
                </h3>
                <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>
                  {routeOptions.allOptions?.length || 0} Valid Combinations
                </span>
              </div>

              <div style={{ display: "grid", gap: "0.75rem" }}>
                {routeOptions.allOptions?.map((opt) => {
                  const isSelected = opt.optionId === selectedOptionId;
                  const isOptimal = opt.isOptimal;
                  return (
                    <div
                      key={opt.optionId}
                      onClick={() => setSelectedOptionId(opt.optionId)}
                      style={{
                        padding: "1rem 1.15rem",
                        borderRadius: "12px",
                        border: isSelected ? "2px solid #2563eb" : "1px solid #e2e8f0",
                        background: isSelected ? "rgba(239, 246, 255, 0.6)" : "#f8fafc",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <strong style={{ fontSize: "1rem", color: "#0f172a" }}>{opt.badge}</strong>
                          {isOptimal && (
                            <span className="badge badge-approved" style={{ fontSize: "0.7rem" }}>
                              MINIMUM COST
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: "1.1rem", fontWeight: 800, color: isOptimal ? "#166534" : "#0f172a" }}>
                          {currency(opt.totalCost)}
                        </span>
                      </div>

                      <p style={{ color: "#475569", fontSize: "0.85rem", margin: "0.25rem 0" }}>
                        {opt.summary}
                      </p>

                      <div style={{ display: "flex", gap: "1rem", fontSize: "0.75rem", color: "#166534", marginTop: "0.4rem" }}>
                        <span>✓ Full inventory available</span>
                        <span>{opt.warehousesCount} Warehouse{opt.warehousesCount > 1 ? "s" : ""}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: OPTIMAL ROUTE CARD & COST BREAKDOWN */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            {/* PART 7 & PART 10: OPTIMAL FULFILLMENT PLAN CARD */}
            <div
              style={{
                background: "linear-gradient(135deg, #ffffff, #f0fdf4)",
                borderRadius: "16px",
                border: "2px solid #16a34a",
                padding: "1.5rem",
                boxShadow: "0 12px 30px -5px rgba(22, 163, 74, 0.15)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Truck size={22} color="#16a34a" />
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#14532d", letterSpacing: "0.02em" }}>
                    OPTIMAL FULFILLMENT PLAN
                  </h3>
                </div>
                <span className="badge badge-approved" style={{ fontSize: "0.75rem" }}>
                  RECOMMENDED
                </span>
              </div>

              <div style={{ background: "#ffffff", padding: "0.85rem", borderRadius: "10px", border: "1px solid #bbf7d0", marginBottom: "1rem", fontSize: "0.85rem", color: "#334155" }}>
                <div><strong>Order:</strong> {routeOptions.orderNumber}</div>
                <div><strong>Customer:</strong> {routeOptions.customerName}</div>
                <div><strong>Destination:</strong> {routeOptions.destination?.city}, {routeOptions.destination?.state}</div>
              </div>

              {/* RECOMMENDED WAREHOUSES ALLOCATION */}
              <h4 style={{ fontSize: "0.85rem", fontWeight: 800, color: "#166534", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                Recommended Warehouses:
              </h4>

              <div style={{ display: "grid", gap: "0.6rem", marginBottom: "1rem" }}>
                {activePlan?.shipments?.map((shipment) => (
                  <div key={shipment.warehouseId} style={{ background: "#ffffff", borderRadius: "10px", padding: "0.75rem", border: "1px solid #cbd5e1" }}>
                    <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "0.9rem" }}>
                      📍 {shipment.warehouseName} ({shipment.city})
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#475569", marginTop: "0.25rem" }}>
                      {shipment.items.map((i) => (
                        <div key={i.productId} style={{ color: "#2563eb", fontWeight: 700 }}>
                          • {i.allocatedQuantity} {i.productName}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* SHIPMENTS BREAKDOWN */}
              <h4 style={{ fontSize: "0.85rem", fontWeight: 800, color: "#166534", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                Shipments:
              </h4>

              <div style={{ display: "grid", gap: "0.5rem", marginBottom: "1rem" }}>
                {activePlan?.shipments?.map((shipment) => (
                  <div key={`ship-${shipment.warehouseId}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", padding: "0.5rem 0.75rem", background: "rgba(255,255,255,0.8)", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <span>{shipment.city} → {routeOptions.destination?.city} ({shipment.distanceKm} km)</span>
                    <strong style={{ color: "#166534" }}>{currency(shipment.totalShipmentCost)}</strong>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: "2px dashed #bbf7d0", paddingTop: "0.85rem", marginTop: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "1rem", fontWeight: 800, color: "#0f172a" }}>TOTAL COST</span>
                  <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "#166534" }}>
                    {currency(activePlan?.totalCost)}
                  </span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.2rem" }}>
                  💡 Lowest-cost valid fulfillment plan
                </div>
              </div>

              {/* PART 10: SAVINGS WOW ELEMENT */}
              {routeOptions.savingsVsNextBest > 0 && (
                <div
                  style={{
                    marginTop: "1rem",
                    background: "linear-gradient(135deg, #dcfce7, #f0fdf4)",
                    border: "1px solid #86efac",
                    borderRadius: "10px",
                    padding: "0.75rem 1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    color: "#14532d",
                    fontWeight: 800,
                    fontSize: "0.9rem",
                  }}
                >
                  <TrendingDown size={18} color="#16a34a" />
                  <span>💰 Company saves {currency(routeOptions.savingsVsNextBest)} with recommended route</span>
                </div>
              )}

              {/* APPROVE BUTTON */}
              <button
                className="btn-primary"
                onClick={approvePlan}
                disabled={approveLoading}
                style={{
                  marginTop: "1.25rem",
                  width: "100%",
                  padding: "0.85rem",
                  fontSize: "1rem",
                  fontWeight: 800,
                  background: "#16a34a",
                  borderColor: "#15803d",
                  boxShadow: "0 4px 14px rgba(22, 163, 74, 0.3)",
                }}
              >
                <ShieldCheck size={18} /> {approveLoading ? "Approving Plan..." : "Approve Fulfillment Plan"}
              </button>
            </div>

            {/* PART 5: TRANSPARENT COST CALCULATION EXPLANATION */}
            <div style={{ background: "#ffffff", borderRadius: "14px", border: "1px solid #e2e8f0", padding: "1.15rem" }}>
              <h4 style={{ fontSize: "0.9rem", fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.5rem" }}>
                <Info size={16} color="#2563eb" /> Configurable Cost Model Formula
              </h4>
              <div style={{ fontSize: "0.8rem", color: "#475569", display: "grid", gap: "0.35rem" }}>
                <div>• <strong>Distance Rate:</strong> ₹{routeOptions.costParameters?.distanceCostPerKm}/km</div>
                <div>• <strong>Fixed Base Shipment:</strong> ₹{routeOptions.costParameters?.fixedShipmentCost} per shipment</div>
                <div>• <strong>Warehouse Handling:</strong> ₹{routeOptions.costParameters?.warehouseHandlingCost} per location</div>
                <div style={{ background: "#f8fafc", padding: "0.5rem", borderRadius: "6px", fontFamily: "monospace", fontSize: "0.75rem", marginTop: "0.25rem", border: "1px solid #cbd5e1" }}>
                  Cost = (Distance × ₹10) + ₹2,000 + ₹500
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Orders Table below */}
      <section className="data-table-card" style={{ marginTop: "2rem" }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 800 }}>Operational Orders Queue</h2>
            <p style={{ color: "#64748b", fontSize: "0.8rem", marginTop: "0.25rem" }}>
              Select an order to inspect live inventory solver routes.
            </p>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Fulfillment Status</th>
                <th>Reserved Qty</th>
                <th>Backorder</th>
                <th>Warehouses Used</th>
                <th>Shipping Cost</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>
                    Loading orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>
                    No confirmed orders available.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => {
                      setSelectedOrderId(order.id);
                      loadFulfillmentOptions(order.id);
                    }}
                    style={{
                      cursor: "pointer",
                      background: order.id === selectedOrderId ? "rgba(239, 246, 255, 0.8)" : "transparent",
                    }}
                  >
                    <td style={{ color: "#1d4ed8", fontWeight: 800 }}>{order.order_number}</td>
                    <td>{order.company_name || order.customer_name}</td>
                    <td>
                      <span className="badge badge-active">{order.fulfillment_status}</span>
                    </td>
                    <td>{order.allocated_quantity}</td>
                    <td>{order.backorder_quantity}</td>
                    <td>{order.warehouse_count}</td>
                    <td>{currency(order.shipping_cost)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
