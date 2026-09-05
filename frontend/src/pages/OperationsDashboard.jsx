import { useEffect, useMemo, useState } from "react";

import {
  Download,
  Printer,
  Filter,
  Calendar,
  Search,
  RefreshCw,
  Truck,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  TrendingDown,
  Layers,
  ShieldCheck,
  Navigation,
  Info,
  MapPin,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";

import L from "leaflet";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";

import { exportToCSV, printOrExportPDF } from "../utils/exportUtils";

import "leaflet/dist/leaflet.css";

const API_BASE = "http://localhost:5000/api";

const currency = (val) =>
  `₹${Number(val || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/* =========================================================
   LEAFLET MARKERS
========================================================= */

const warehouseIcon = L.divIcon({
  className: "custom-leaflet-marker",
  html: `
    <div style="
      background:#2563eb;
      color:white;
      padding:5px 10px;
      border-radius:20px;
      font-weight:800;
      font-size:11px;
      border:2px solid white;
      box-shadow:0 4px 10px rgba(0,0,0,0.3);
    ">
      📍 Warehouse
    </div>
  `,
  iconSize: [100, 32],
  iconAnchor: [50, 16],
});

const selectedWarehouseIcon = L.divIcon({
  className: "custom-leaflet-marker",
  html: `
    <div style="
      background:#16a34a;
      color:white;
      padding:6px 12px;
      border-radius:20px;
      font-weight:800;
      font-size:12px;
      border:3px solid #bbf7d0;
      box-shadow:0 6px 16px rgba(22,163,74,0.4);
    ">
      🚚 Selected WH
    </div>
  `,
  iconSize: [125, 36],
  iconAnchor: [62, 18],
});

const destinationIcon = L.divIcon({
  className: "custom-leaflet-marker",
  html: `
    <div style="
      background:#dc2626;
      color:white;
      padding:6px 12px;
      border-radius:20px;
      font-weight:800;
      font-size:12px;
      border:3px solid #fecaca;
      box-shadow:0 6px 16px rgba(220,38,38,0.4);
    ">
      🎯 Customer
    </div>
  `,
  iconSize: [115, 36],
  iconAnchor: [57, 18],
});

/* =========================================================
   MAP AUTO FIT
========================================================= */

function MapBoundsRecenter({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length === 0) return;

    const validPoints = points.filter(
      (p) =>
        Array.isArray(p) &&
        !Number.isNaN(Number(p[0])) &&
        !Number.isNaN(Number(p[1])),
    );

    if (validPoints.length > 0) {
      const bounds = L.latLngBounds(validPoints);

      map.fitBounds(bounds, {
        padding: [60, 60],
        maxZoom: 8,
      });
    }
  }, [points, map]);

  return null;
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function OperationsDashboard({ onNavigate }) {
  const { token, user } = useAuth();

  /* -------------------------------------------------------
     STATE
  ------------------------------------------------------- */

  const [orders, setOrders] = useState([]);
  const [warehousesList, setWarehousesList] = useState([]);

  const [selectedOrderId, setSelectedOrderId] = useState("");

  const [routeOptions, setRouteOptions] = useState(null);

  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedOptionId, setSelectedOptionId] =
    useState("OPTION-1");

  /* Filters MUST be inside the component,
     but NOT inside another function. */

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [periodFilter, setPeriodFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  /* =========================================================
     LOAD FULFILLMENT OPTIONS
  ========================================================= */

  async function loadFulfillmentOptions(orderId) {
    if (!orderId) return;

    setOptionsLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/operations/orders/${orderId}/fulfillment-options`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to calculate route optimization.",
        );
      }

      setRouteOptions(data.data || null);
      setSelectedOptionId("OPTION-1");
    } catch (err) {
      setError(err.message);
      setRouteOptions(null);
    } finally {
      setOptionsLoading(false);
    }
  }

  /* =========================================================
     LOAD INITIAL DATA
  ========================================================= */

  async function loadInitialData() {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [ordersRes, warehousesRes] = await Promise.all([
        fetch(`${API_BASE}/fulfillment/orders`, {
          headers,
        }),

        fetch(`${API_BASE}/operations/warehouses`, {
          headers,
        }),
      ]);

      const ordersData = await ordersRes.json();
      const warehousesData = await warehousesRes.json();

      if (!ordersRes.ok) {
        throw new Error(
          ordersData.message || "Failed to load orders.",
        );
      }

      if (!warehousesRes.ok) {
        throw new Error(
          warehousesData.message ||
            "Failed to load warehouses.",
        );
      }

      const fetchedOrders = ordersData.data || [];
      const fetchedWarehouses = warehousesData.data || [];

      setOrders(fetchedOrders);
      setWarehousesList(fetchedWarehouses);

      if (fetchedOrders.length > 0) {
        const initialId = fetchedOrders[0].id;

        setSelectedOrderId(initialId);

        await loadFulfillmentOptions(initialId);
      } else {
        setSelectedOrderId("");
        setRouteOptions(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     INITIAL LOAD
  ========================================================= */

  useEffect(() => {
    loadInitialData();
  }, [token]);

  /* =========================================================
     ORDER CHANGE
  ========================================================= */

  function handleOrderChange(event) {
    const id = event.target.value;

    setSelectedOrderId(id);
    setSuccess("");
    setError("");

    loadFulfillmentOptions(id);
  }

  /* =========================================================
     FILTER ORDERS
  ========================================================= */

  const filteredOrders = useMemo(() => {
    const now = new Date();

    return orders.filter((order) => {
      /* STATUS */

      if (
        statusFilter !== "ALL" &&
        order.fulfillment_status !== statusFilter
      ) {
        return false;
      }

      /* PERIOD */

      if (periodFilter !== "ALL") {
        const orderDate = new Date(order.created_at);

        if (periodFilter === "TODAY") {
          if (
            orderDate.toDateString() !== now.toDateString()
          ) {
            return false;
          }
        }

        if (periodFilter === "WEEK") {
          const sevenDaysAgo = new Date(
            now.getTime() - 7 * 24 * 60 * 60 * 1000,
          );

          if (orderDate < sevenDaysAgo) {
            return false;
          }
        }
      }

      /* SEARCH */

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();

        const orderNumber = (
          order.order_number || ""
        ).toLowerCase();

        const customerName = (
          order.company_name ||
          order.customer_name ||
          ""
        ).toLowerCase();

        return (
          orderNumber.includes(query) ||
          customerName.includes(query)
        );
      }

      return true;
    });
  }, [
    orders,
    statusFilter,
    periodFilter,
    searchQuery,
  ]);

  /* =========================================================
     SUMMARY
  ========================================================= */

  const summary = useMemo(
    () => ({
      pending: orders.filter(
        (order) =>
          order.fulfillment_status === "PENDING",
      ).length,

      inProgress: orders.filter((order) =>
        ["READY", "MANUAL_SPLIT"].includes(
          order.fulfillment_status,
        ),
      ).length,

      partial: orders.filter(
        (order) =>
          order.fulfillment_status ===
          "PARTIAL_BACKORDER",
      ).length,

      backordered: orders.filter(
        (order) =>
          order.fulfillment_status === "BACKORDER",
      ).length,

      fulfilled: orders.filter((order) =>
        ["FULFILLED", "COMPLETED"].includes(
          order.fulfillment_status,
        ),
      ).length,

      inventoryAlerts: orders.filter(
        (order) =>
          Number(order.backorder_quantity) > 0,
      ).length,
    }),
    [orders],
  );

  /* =========================================================
     KPI CARDS
  ========================================================= */

  const summaryCards = [
    {
      label: "Total Orders",
      value: filteredOrders.length,
      color: "#2563eb",
    },
    {
      label: "Pending Orders",
      value: summary.pending,
      color: "#f59e0b",
    },
    {
      label: "Backorders",
      value: summary.backordered,
      color: "#ef4444",
    },
    {
      label: "Fulfilled Orders",
      value: summary.fulfilled,
      color: "#10b981",
    },
  ];

  /* =========================================================
     SELECTED ORDER
  ========================================================= */

  const selectedOrder = orders.find(
    (order) => order.id === selectedOrderId,
  );

  /* =========================================================
     ACTIVE PLAN
  ========================================================= */

  const activePlan =
    routeOptions?.allOptions?.find(
      (option) =>
        option.optionId === selectedOptionId,
    ) ||
    routeOptions?.optimalPlan;

  /* =========================================================
     MAP POINTS
  ========================================================= */

  const allMapPoints = [];

  if (routeOptions?.mapData?.destinationMarker) {
    const destination =
      routeOptions.mapData.destinationMarker;

    allMapPoints.push([
      destination.latitude,
      destination.longitude,
    ]);
  }

  if (routeOptions?.mapData?.warehouseMarkers) {
    routeOptions.mapData.warehouseMarkers.forEach(
      (warehouse) => {
        allMapPoints.push([
          warehouse.latitude,
          warehouse.longitude,
        ]);
      },
    );
  }

  /* =========================================================
     APPROVE PLAN
  ========================================================= */

  async function approvePlan() {
    if (
      !selectedOrderId ||
      !routeOptions?.optimalPlan
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Approve Optimal Fulfillment Plan (${currency(
        routeOptions.optimalPlan.totalCost,
      )})?`,
    );

    if (!confirmed) return;

    setApproveLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_BASE}/operations/orders/${selectedOrderId}/fulfillment/approve`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Plan approval failed.",
        );
      }

      setSuccess(
        data.data?.message ||
          "Optimal fulfillment plan approved successfully!",
      );

      await loadInitialData();

      await loadFulfillmentOptions(
        selectedOrderId,
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setApproveLoading(false);
    }
  }

  /* =========================================================
     EXPORT CSV
  ========================================================= */

  function handleExportCSV() {
    const exportData = filteredOrders.map(
      (order) => ({
        orderNumber: order.order_number,
        customer:
          order.company_name ||
          order.customer_name ||
          "N/A",

        fulfillmentStatus:
          order.fulfillment_status,

        reservedQty:
          order.allocated_quantity || 0,

        backorderQty:
          order.backorder_quantity || 0,

        warehouseCount:
          order.warehouse_count || 1,

        shippingCost: Number(
          order.shipping_cost || 0,
        ).toFixed(2),

        createdDate: new Date(
          order.created_at,
        ).toLocaleDateString("en-IN"),
      }),
    );

    const headers = [
      {
        key: "orderNumber",
        label: "Order Number",
      },
      {
        key: "customer",
        label: "Customer",
      },
      {
        key: "fulfillmentStatus",
        label: "Fulfillment Status",
      },
      {
        key: "reservedQty",
        label: "Reserved Qty",
      },
      {
        key: "backorderQty",
        label: "Backorder Qty",
      },
      {
        key: "warehouseCount",
        label: "Depots",
      },
      {
        key: "shippingCost",
        label: "Est. Shipping (INR)",
      },
      {
        key: "createdDate",
        label: "Order Date",
      },
    ];

    exportToCSV(
      "Operations_Order_Manifests",
      exportData,
      headers,
    );
  }

  /* =========================================================
     EXPORT PDF
  ========================================================= */

  function handleExportPDF() {
    const exportData = filteredOrders.map(
      (order) => ({
        orderNumber: order.order_number,

        customer:
          order.company_name ||
          order.customer_name ||
          "N/A",

        status: order.fulfillment_status,

        reserved: `${
          order.allocated_quantity || 0
        } Units`,

        backorder: `${
          order.backorder_quantity || 0
        } Units`,

        warehouses: `${
          order.warehouse_count || 1
        } Depot(s)`,

        shipping: currency(
          order.shipping_cost,
        ),
      }),
    );

    const headers = [
      {
        key: "orderNumber",
        label: "Order Number",
      },
      {
        key: "customer",
        label: "Customer",
      },
      {
        key: "status",
        label: "Fulfillment Status",
      },
      {
        key: "reserved",
        label: "Reserved Stock",
      },
      {
        key: "backorder",
        label: "Backorder",
      },
      {
        key: "warehouses",
        label: "Warehouses",
      },
      {
        key: "shipping",
        label: "Freight Est.",
      },
    ];

    const metadata = [
      {
        label: "Coordinator",
        value:
          user?.full_name ||
          "Operations Lead",
      },
      {
        label: "Fulfillment Filter",
        value: statusFilter,
      },
      {
        label: "Period Filter",
        value: periodFilter,
      },
    ];

    printOrExportPDF({
      title:
        "Warehouse Fulfillment & Dispatch Manifest",

      subtitle: `Official manifest report containing ${filteredOrders.length} active fulfillment orders.`,

      metadata,

      headers,

      rows: exportData,

      summaryCards,
    });
  }

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <>
      <main className="main-content">

        {/* =================================================
            HEADER
        ================================================= */}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "1rem",
            flexWrap: "wrap",
            marginBottom: "1.75rem",
          }}
        >
          <div>
            <div
              style={{
                color: "#2563eb",
                fontSize: "0.75rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <Sparkles size={15} />

              DealFlow360 Operations Core
            </div>

            <h1
              style={{
                fontSize: "1.9rem",
                fontWeight: 800,
                color: "#0f172a",
                marginTop: "0.25rem",
              }}
            >
              Operations & Fulfillment Dashboard
            </h1>

            <p
              style={{
                color: "#64748b",
                marginTop: "0.35rem",
                fontSize: "0.95rem",
              }}
            >
              Coordinate confirmed orders,
              warehouse allocation, stock
              reservations, shipping manifests,
              and backorders.
            </p>

            <p
              style={{
                color: "#94a3b8",
                fontSize: "0.8rem",
                marginTop: "0.35rem",
              }}
            >
              Coordinator:{" "}
              {user?.full_name ||
                "Operations Lead"}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {/* ORDER SELECTOR */}

            <div
              style={{
                background: "#ffffff",
                padding: "0.5rem 0.85rem",
                borderRadius: "12px",
                border:
                  "1px solid #cbd5e1",
                boxShadow:
                  "0 4px 12px rgba(0,0,0,0.03)",
              }}
            >
              <label
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "#64748b",
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                Select Confirmed Order:
              </label>

              <select
                value={selectedOrderId}
                onChange={handleOrderChange}
                style={{
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontWeight: 800,
                  color: "#0f172a",
                  fontSize: "0.95rem",
                  cursor: "pointer",
                }}
              >
                {orders.length === 0 ? (
                  <option value="">
                    No confirmed orders found
                  </option>
                ) : (
                  orders.map((order) => (
                    <option
                      key={order.id}
                      value={order.id}
                    >
                      {order.order_number} —{" "}
                      {order.company_name ||
                        order.customer_name}{" "}
                      ({order.fulfillment_status})
                    </option>
                  ))
                )}
              </select>
            </div>

            <button
              className="btn-secondary"
              onClick={loadInitialData}
              disabled={loading}
            >
              <RefreshCw size={15} />

              {loading
                ? "Refreshing..."
                : "Refresh"}
            </button>

            <button
              className="btn-primary"
              style={{ width: "auto" }}
              onClick={() =>
                onNavigate(
                  "/sales/fulfillment",
                )
              }
            >
              <Truck size={16} />

              Open Fulfillment Queue
            </button>
          </div>
        </div>

        {/* =================================================
            ALERTS
        ================================================= */}

        {error && (
          <div
            className="alert alert-danger"
            style={{
              marginBottom: "1.25rem",
              borderRadius: "12px",
            }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            className="alert alert-success"
            style={{
              marginBottom: "1.25rem",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <CheckCircle size={18} />

            {success}
          </div>
        )}

        {/* =================================================
            KPI CARDS
        ================================================= */}

        <div
          className="metric-grid"
          style={{
            marginBottom: "2rem",
          }}
        >
          {summaryCards.map(
            ({
              label,
              value,
              color,
            }) => (
              <div
                className="metric-card"
                key={label}
                style={{
                  borderTop:
                    `3px solid ${color}`,
                }}
              >
                <div className="metric-label">
                  {label}
                </div>

                <div className="metric-value">
                  {loading
                    ? "..."
                    : value}
                </div>

                <div
                  style={{
                    color: "#94a3b8",
                    fontSize: "0.75rem",
                  }}
                >
                  Live database count
                </div>
              </div>
            ),
          )}

          <button
            className="btn-secondary"
            onClick={() =>
              onNavigate(
                "/sales/fulfillment",
              )
            }
            style={{
              height: "46px",
            }}
          >
            Fulfillment Queue
          </button>
        </div>

        {/* =================================================
            LOADING ROUTE
        ================================================= */}

        {optionsLoading && (
          <div
            style={{
              background: "#eff6ff",
              border:
                "1px solid #bfdbfe",
              borderRadius: "12px",
              padding: "0.85rem 1rem",
              marginBottom: "1rem",
              color: "#1d4ed8",
              fontWeight: 700,
            }}
          >
            <RefreshCw
              size={16}
              style={{
                verticalAlign: "middle",
                marginRight: "0.4rem",
              }}
            />

            Calculating minimum-cost
            fulfillment routes...
          </div>
        )}

        {/* =================================================
            SHORTAGE WARNING
        ================================================= */}

        {routeOptions &&
          !routeOptions.fulfillmentPossible && (
            <div
              style={{
                background:
                  "linear-gradient(135deg,#fef2f2,#fff1f2)",
                border:
                  "2px solid #ef4444",
                borderRadius: "16px",
                padding: "1.5rem",
                marginBottom: "1.5rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  color: "#991b1b",
                  marginBottom: "0.75rem",
                }}
              >
                <AlertTriangle
                  size={24}
                />

                <h2
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 800,
                  }}
                >
                  ⚠️ FULFILLMENT NOT POSSIBLE
                </h2>
              </div>

              <p
                style={{
                  color: "#7f1d1d",
                  fontSize: "0.95rem",
                  marginBottom: "1rem",
                }}
              >
                Total inventory across all
                active DealFlow360 warehouses
                is insufficient to fulfill
                this order completely.
              </p>

              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "12px",
                  border:
                    "1px solid #fca5a5",
                  padding: "1rem",
                }}
              >
                <h4
                  style={{
                    fontWeight: 800,
                    color: "#991b1b",
                    marginBottom:
                      "0.5rem",
                  }}
                >
                  Shortage Breakdown:
                </h4>

                <div
                  style={{
                    display: "grid",
                    gap: "0.5rem",
                  }}
                >
                  {routeOptions.shortages?.map(
                    (item) => (
                      <div
                        key={
                          item.productId
                        }
                        style={{
                          display: "flex",
                          justifyContent:
                            "space-between",
                          alignItems:
                            "center",
                          padding:
                            "0.6rem 0.85rem",
                          background:
                            "#fef2f2",
                          borderRadius:
                            "8px",
                        }}
                      >
                        <span>
                          <strong>
                            {
                              item.productName
                            }
                          </strong>{" "}
                          (SKU:{" "}
                          {item.sku})
                        </span>

                        <span
                          style={{
                            color:
                              "#dc2626",
                            fontWeight:
                              800,
                          }}
                        >
                          Required:{" "}
                          {
                            item.requiredQuantity
                          }{" "}
                          · Available:{" "}
                          {
                            item.totalAvailableQuantity
                          }{" "}
                          · Shortage:{" "}
                          {
                            item.shortageQuantity
                          }
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          )}

        {/* =================================================
            DESTINATION PENDING
        ================================================= */}

        {routeOptions &&
          routeOptions.fulfillmentPossible &&
          !routeOptions.hasDestination && (
            <div
              style={{
                background: "#fffbe6",
                border:
                  "2px solid #f59e0b",
                borderRadius: "16px",
                padding: "1.5rem",
                marginBottom: "1.5rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  color: "#b45309",
                  marginBottom: "0.5rem",
                }}
              >
                <MapPin size={22} />

                <h3
                  style={{
                    fontSize: "1.15rem",
                    fontWeight: 800,
                  }}
                >
                  Customer Delivery
                  Destination Pending
                </h3>
              </div>

              <p
                style={{
                  color: "#78350f",
                  fontSize: "0.9rem",
                }}
              >
                The customer has not yet
                confirmed their delivery
                destination. Route optimization
                will run after the customer
                submits the destination.
              </p>
            </div>
          )}

        {/* =================================================
            MAIN OPTIMIZER
        ================================================= */}

        {routeOptions &&
          routeOptions.hasDestination &&
          routeOptions.fulfillmentPossible && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(0, 1fr) 420px",
                gap: "1.5rem",
                alignItems: "start",
              }}
            >

              {/* ===============================
                  LEFT COLUMN
              =============================== */}

              <div
                style={{
                  display: "flex",
                  flexDirection:
                    "column",
                  gap: "1.5rem",
                }}
              >

                {/* MAP */}

                <section
                  className="data-table-card"
                  style={{
                    padding: "1.25rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems:
                        "center",
                      marginBottom:
                        "1rem",
                      gap: "1rem",
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          fontSize:
                            "1.1rem",
                          fontWeight: 800,
                          display:
                            "flex",
                          alignItems:
                            "center",
                          gap: "0.5rem",
                        }}
                      >
                        <Navigation
                          size={18}
                          color="#2563eb"
                        />

                        Live Warehouse &
                        Fulfillment Route Map
                      </h3>

                      <p
                        style={{
                          color:
                            "#64748b",
                          fontSize:
                            "0.8rem",
                          marginTop:
                            "0.2rem",
                        }}
                      >
                        Warehouses →
                        Customer Destination
                      </p>
                    </div>

                    <span
                      className="badge badge-active"
                      style={{
                        fontSize:
                          "0.75rem",
                      }}
                    >
                      OpenStreetMap
                    </span>
                  </div>

                  <div
                    style={{
                      height: "420px",
                      borderRadius:
                        "12px",
                      overflow:
                        "hidden",
                      border:
                        "1px solid #cbd5e1",
                    }}
                  >
                    <MapContainer
                      center={[
                        routeOptions
                          .destination
                          ?.latitude ||
                          28.6139,

                        routeOptions
                          .destination
                          ?.longitude ||
                          77.209,
                      ]}
                      zoom={5}
                      style={{
                        height: "100%",
                        width: "100%",
                      }}
                      scrollWheelZoom={
                        false
                      }
                    >
                      <TileLayer
                        attribution='&copy; OpenStreetMap contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />

                      <MapBoundsRecenter
                        points={
                          allMapPoints
                        }
                      />

                      {/* CUSTOMER */}

                      {routeOptions.destination && (
                        <Marker
                          position={[
                            routeOptions
                              .destination
                              .latitude,

                            routeOptions
                              .destination
                              .longitude,
                          ]}
                          icon={
                            destinationIcon
                          }
                        >
                          <Popup>
                            <strong>
                              🎯 Customer
                              Destination
                            </strong>

                            <div
                              style={{
                                marginTop:
                                  "0.35rem",
                                fontSize:
                                  "12px",
                              }}
                            >
                              {
                                routeOptions
                                  .destination
                                  .address
                              }
                              <br />

                              {
                                routeOptions
                                  .destination
                                  .city
                              }
                              ,{" "}
                              {
                                routeOptions
                                  .destination
                                  .state
                              }
                            </div>
                          </Popup>
                        </Marker>
                      )}

                      {/* WAREHOUSES */}

                      {routeOptions.mapData?.warehouseMarkers?.map(
                        (warehouse) => {
                          const shipment =
                            activePlan?.shipments?.find(
                              (item) =>
                                item.warehouseId ===
                                warehouse.id,
                            );

                          const selected =
                            Boolean(
                              shipment,
                            );

                          return (
                            <Marker
                              key={
                                warehouse.id
                              }
                              position={[
                                warehouse.latitude,
                                warehouse.longitude,
                              ]}
                              icon={
                                selected
                                  ? selectedWarehouseIcon
                                  : warehouseIcon
                              }
                            >
                              <Popup>
                                <div
                                  style={{
                                    minWidth:
                                      "210px",
                                  }}
                                >
                                  <strong>
                                    📍{" "}
                                    {
                                      warehouse.name
                                    }
                                  </strong>

                                  <div
                                    style={{
                                      marginTop:
                                        "0.5rem",
                                      fontSize:
                                        "12px",
                                    }}
                                  >
                                    <strong>
                                      City:
                                    </strong>{" "}
                                    {
                                      warehouse.city
                                    }

                                    <br />

                                    <strong>
                                      Distance:
                                    </strong>{" "}
                                    {
                                      warehouse.distanceKm
                                    }{" "}
                                    km

                                    <br />

                                    <strong>
                                      Est. Shipment:
                                    </strong>{" "}
                                    {currency(
                                      warehouse.shipmentCost,
                                    )}
                                  </div>

                                  {shipment && (
                                    <div
                                      style={{
                                        marginTop:
                                          "0.5rem",
                                        padding:
                                          "0.5rem",
                                        background:
                                          "#f0fdf4",
                                        border:
                                          "1px solid #bbf7d0",
                                        borderRadius:
                                          "6px",
                                      }}
                                    >
                                      <strong>
                                        Allocated:
                                      </strong>

                                      {shipment.items?.map(
                                        (
                                          item,
                                        ) => (
                                          <div
                                            key={
                                              item.productId
                                            }
                                          >
                                            {
                                              item.allocatedQuantity
                                            }{" "}
                                            ×{" "}
                                            {
                                              item.productName
                                            }
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  )}
                                </div>
                              </Popup>
                            </Marker>
                          );
                        },
                      )}

                      {/* ROUTES */}

                      {routeOptions.mapData?.warehouseMarkers?.map(
                        (warehouse) => {
                          const shipment =
                            activePlan?.shipments?.find(
                              (item) =>
                                item.warehouseId ===
                                warehouse.id,
                            );

                          const destination =
                            routeOptions.destination;

                          if (
                            !destination
                          ) {
                            return null;
                          }

                          return (
                            <Polyline
                              key={`route-${warehouse.id}`}
                              positions={[
                                [
                                  warehouse.latitude,
                                  warehouse.longitude,
                                ],
                                [
                                  destination.latitude,
                                  destination.longitude,
                                ],
                              ]}
                              pathOptions={{
                                color:
                                  shipment
                                    ? "#16a34a"
                                    : "#94a3b8",

                                weight:
                                  shipment
                                    ? 5
                                    : 2,

                                dashArray:
                                  shipment
                                    ? undefined
                                    : "6,8",

                                opacity:
                                  shipment
                                    ? 0.9
                                    : 0.4,
                              }}
                            />
                          );
                        },
                      )}
                    </MapContainer>
                  </div>

                  {/* LEGEND */}

                  <div
                    style={{
                      display: "flex",
                      gap: "1rem",
                      flexWrap:
                        "wrap",
                      marginTop:
                        "0.85rem",
                      fontSize:
                        "0.8rem",
                      color:
                        "#475569",
                    }}
                  >
                    <span>
                      🟢 Selected Route
                    </span>

                    <span>
                      🔵 Warehouse
                    </span>

                    <span>
                      🔴 Customer
                    </span>
                  </div>
                </section>

                {/* ROUTE OPTIONS */}

                <section
                  className="data-table-card"
                  style={{
                    padding: "1.25rem",
                  }}
                >
                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      marginBottom:
                        "1rem",
                    }}
                  >
                    <h3
                      style={{
                        fontSize:
                          "1.05rem",
                        fontWeight: 800,
                        display:
                          "flex",
                        alignItems:
                          "center",
                        gap: "0.5rem",
                      }}
                    >
                      <Layers
                        size={18}
                        color="#2563eb"
                      />

                      Fulfillment Options
                    </h3>

                    <span
                      style={{
                        fontSize:
                          "0.8rem",
                        color:
                          "#64748b",
                      }}
                    >
                      {routeOptions
                        .allOptions
                        ?.length ||
                        0}{" "}
                      options
                    </span>
                  </div>

                  <div
                    style={{
                      display:
                        "grid",
                      gap:
                        "0.75rem",
                    }}
                  >
                    {routeOptions.allOptions?.map(
                      (option) => {
                        const selected =
                          option.optionId ===
                          selectedOptionId;

                        return (
                          <div
                            key={
                              option.optionId
                            }
                            onClick={() =>
                              setSelectedOptionId(
                                option.optionId,
                              )
                            }
                            style={{
                              padding:
                                "1rem",
                              borderRadius:
                                "12px",
                              border:
                                selected
                                  ? "2px solid #2563eb"
                                  : "1px solid #e2e8f0",

                              background:
                                selected
                                  ? "#eff6ff"
                                  : "#f8fafc",

                              cursor:
                                "pointer",
                            }}
                          >
                            <div
                              style={{
                                display:
                                  "flex",
                                justifyContent:
                                  "space-between",
                                alignItems:
                                  "center",
                              }}
                            >
                              <strong>
                                {
                                  option.badge
                                }
                              </strong>

                              <strong
                                style={{
                                  color:
                                    option.isOptimal
                                      ? "#166534"
                                      : "#0f172a",
                                }}
                              >
                                {currency(
                                  option.totalCost,
                                )}
                              </strong>
                            </div>

                            <p
                              style={{
                                color:
                                  "#475569",
                                fontSize:
                                  "0.85rem",
                                marginTop:
                                  "0.4rem",
                              }}
                            >
                              {
                                option.summary
                              }
                            </p>

                            <div
                              style={{
                                display:
                                  "flex",
                                gap:
                                  "1rem",
                                fontSize:
                                  "0.75rem",
                                color:
                                  "#166534",
                                marginTop:
                                  "0.4rem",
                              }}
                            >
                              <span>
                                ✓ Full inventory
                              </span>

                              <span>
                                {
                                  option.warehousesCount
                                }{" "}
                                warehouse
                                {option.warehousesCount >
                                1
                                  ? "s"
                                  : ""}
                              </span>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                </section>
              </div>

              {/* ===============================
                  RIGHT COLUMN
              =============================== */}

              <div
                style={{
                  display:
                    "flex",
                  flexDirection:
                    "column",
                  gap:
                    "1.25rem",
                }}
              >

                {/* OPTIMAL PLAN */}

                <section className="data-table-card">
                  <div
                    style={{
                      background:
                        "linear-gradient(135deg,#ffffff,#f0fdf4)",
                      borderRadius:
                        "16px",
                      border:
                        "2px solid #16a34a",
                      padding:
                        "1.5rem",
                    }}
                  >
                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "center",
                      }}
                    >
                      <h3
                        style={{
                          color:
                            "#14532d",
                          fontWeight:
                            800,
                          fontSize:
                            "1.1rem",
                        }}
                      >
                        🚚 OPTIMAL
                        FULFILLMENT PLAN
                      </h3>

                      <span className="badge badge-approved">
                        RECOMMENDED
                      </span>
                    </div>

                    <div
                      style={{
                        background:
                          "#ffffff",
                        padding:
                          "0.85rem",
                        borderRadius:
                          "10px",
                        marginTop:
                          "1rem",
                        border:
                          "1px solid #bbf7d0",
                        fontSize:
                          "0.85rem",
                      }}
                    >
                      <div>
                        <strong>
                          Order:
                        </strong>{" "}
                        {
                          routeOptions.orderNumber
                        }
                      </div>

                      <div>
                        <strong>
                          Customer:
                        </strong>{" "}
                        {
                          routeOptions.customerName
                        }
                      </div>

                      <div>
                        <strong>
                          Destination:
                        </strong>{" "}
                        {
                          routeOptions
                            .destination
                            ?.city
                        }
                        ,{" "}
                        {
                          routeOptions
                            .destination
                            ?.state
                        }
                      </div>
                    </div>

                    <h4
                      style={{
                        marginTop:
                          "1rem",
                        marginBottom:
                          "0.5rem",
                        color:
                          "#166534",
                      }}
                    >
                      Recommended Warehouses
                    </h4>

                    <div
                      style={{
                        display:
                          "grid",
                        gap:
                          "0.6rem",
                      }}
                    >
                      {activePlan?.shipments?.map(
                        (shipment) => (
                          <div
                            key={
                              shipment.warehouseId
                            }
                            style={{
                              background:
                                "#ffffff",
                              border:
                                "1px solid #cbd5e1",
                              borderRadius:
                                "10px",
                              padding:
                                "0.75rem",
                            }}
                          >
                            <strong>
                              📍{" "}
                              {
                                shipment.warehouseName
                              }
                            </strong>

                            <div
                              style={{
                                marginTop:
                                  "0.3rem",
                                color:
                                  "#2563eb",
                                fontSize:
                                  "0.8rem",
                              }}
                            >
                              {shipment.items?.map(
                                (item) => (
                                  <div
                                    key={
                                      item.productId
                                    }
                                  >
                                    •{" "}
                                    {
                                      item.allocatedQuantity
                                    }{" "}
                                    ×{" "}
                                    {
                                      item.productName
                                    }
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        ),
                      )}
                    </div>

                    <h4
                      style={{
                        marginTop:
                          "1rem",
                        marginBottom:
                          "0.5rem",
                        color:
                          "#166534",
                      }}
                    >
                      Shipment Cost
                    </h4>

                    {activePlan?.shipments?.map(
                      (shipment) => (
                        <div
                          key={`cost-${shipment.warehouseId}`}
                          style={{
                            display:
                              "flex",
                            justifyContent:
                              "space-between",
                            padding:
                              "0.5rem 0.75rem",
                            background:
                              "#f8fafc",
                            borderRadius:
                              "8px",
                            marginBottom:
                              "0.4rem",
                            fontSize:
                              "0.85rem",
                          }}
                        >
                          <span>
                            {
                              shipment.city
                            }{" "}
                            →{" "}
                            {
                              routeOptions
                                .destination
                                ?.city
                            }{" "}
                            (
                            {
                              shipment.distanceKm
                            }{" "}
                            km)
                          </span>

                          <strong
                            style={{
                              color:
                                "#166534",
                            }}
                          >
                            {currency(
                              shipment.totalShipmentCost,
                            )}
                          </strong>
                        </div>
                      ),
                    )}

                    <div
                      style={{
                        borderTop:
                          "2px dashed #bbf7d0",
                        marginTop:
                          "1rem",
                        paddingTop:
                          "0.85rem",
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "center",
                      }}
                    >
                      <strong>
                        TOTAL COST
                      </strong>

                      <strong
                        style={{
                          fontSize:
                            "1.4rem",
                          color:
                            "#166534",
                        }}
                      >
                        {currency(
                          activePlan?.totalCost,
                        )}
                      </strong>
                    </div>

                    {routeOptions.savingsVsNextBest >
                      0 && (
                      <div
                        style={{
                          marginTop:
                            "1rem",
                          padding:
                            "0.75rem",
                          background:
                            "#dcfce7",
                          border:
                            "1px solid #86efac",
                          borderRadius:
                            "10px",
                          color:
                            "#14532d",
                          fontWeight:
                            800,
                        }}
                      >
                        <TrendingDown
                          size={17}
                          style={{
                            verticalAlign:
                              "middle",
                            marginRight:
                              "0.4rem",
                          }}
                        />

                        Company saves{" "}
                        {currency(
                          routeOptions.savingsVsNextBest,
                        )}
                      </div>
                    )}

                    <button
                      className="btn-primary"
                      onClick={
                        approvePlan
                      }
                      disabled={
                        approveLoading
                      }
                      style={{
                        width:
                          "100%",
                        marginTop:
                          "1.25rem",
                        background:
                          "#16a34a",
                        borderColor:
                          "#15803d",
                      }}
                    >
                      <ShieldCheck
                        size={18}
                      />

                      {approveLoading
                        ? "Approving Plan..."
                        : "Approve Fulfillment Plan"}
                    </button>
                  </div>
                </section>

                {/* COST MODEL */}

                <section
                  className="data-table-card"
                  style={{
                    padding:
                      "1.15rem",
                  }}
                >
                  <h4
                    style={{
                      fontSize:
                        "0.9rem",
                      fontWeight:
                        800,
                      marginBottom:
                        "0.5rem",
                      display:
                        "flex",
                      alignItems:
                        "center",
                      gap:
                        "0.4rem",
                    }}
                  >
                    <Info
                      size={16}
                      color="#2563eb"
                    />

                    Cost Calculation
                  </h4>

                  <div
                    style={{
                      fontSize:
                        "0.8rem",
                      color:
                        "#475569",
                      display:
                        "grid",
                      gap:
                        "0.35rem",
                    }}
                  >
                    <div>
                      • Distance: ₹
                      {
                        routeOptions
                          .costParameters
                          ?.distanceCostPerKm
                      }
                      /km
                    </div>

                    <div>
                      • Fixed Shipment: ₹
                      {
                        routeOptions
                          .costParameters
                          ?.fixedShipmentCost
                      }
                    </div>

                    <div>
                      • Warehouse Handling:
                      ₹
                      {
                        routeOptions
                          .costParameters
                          ?.warehouseHandlingCost
                      }
                    </div>

                    <div
                      style={{
                        background:
                          "#f8fafc",
                        padding:
                          "0.5rem",
                        borderRadius:
                          "6px",
                        fontFamily:
                          "monospace",
                        marginTop:
                          "0.25rem",
                      }}
                    >
                      Cost = Distance ×
                      Rate + Fixed Cost +
                      Handling
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}

        {/* =================================================
            ORDERS TABLE
        ================================================= */}

        <section
          className="data-table-card"
          style={{
            marginTop: "2rem",
          }}
        >
          {/* TABLE HEADER */}

          <div
            style={{
              padding:
                "1.25rem 1.5rem",
              borderBottom:
                "1px solid #e2e8f0",
              display:
                "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              gap:
                "1rem",
              flexWrap:
                "wrap",
            }}
          >
            <div>
              <h2
                style={{
                  fontSize:
                    "1.1rem",
                  fontWeight:
                    800,
                }}
              >
                Operational Orders Queue
              </h2>

              <p
                style={{
                  color:
                    "#64748b",
                  fontSize:
                    "0.8rem",
                  marginTop:
                    "0.25rem",
                }}
              >
                Select an order to
                inspect live inventory
                solver routes.
              </p>
            </div>

            <div
              style={{
                display:
                  "flex",
                gap:
                  "0.6rem",
                flexWrap:
                  "wrap",
              }}
            >
              <button
                type="button"
                className="btn-secondary"
                onClick={
                  handleExportCSV
                }
                style={{
                  padding:
                    "0.45rem 0.85rem",
                  fontSize:
                    "0.825rem",
                }}
              >
                <Download
                  size={15}
                />

                Export CSV
              </button>

              <button
                type="button"
                className="btn-primary"
                onClick={
                  handleExportPDF
                }
                style={{
                  padding:
                    "0.45rem 0.95rem",
                  fontSize:
                    "0.825rem",
                }}
              >
                <Printer
                  size={15}
                />

                Export / Print PDF
              </button>
            </div>
          </div>

          {/* FILTER BAR */}

          <div
            style={{
              display:
                "flex",
              gap:
                "0.75rem",
              flexWrap:
                "wrap",
              alignItems:
                "center",
              padding:
                "0.75rem 1.5rem",
              background:
                "#f8fafc",
              borderBottom:
                "1px solid #e2e8f0",
            }}
          >
            {/* STATUS */}

            <div
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                gap:
                  "0.35rem",
              }}
            >
              <Filter
                size={15}
                color="#64748b"
              />

              <span
                style={{
                  fontSize:
                    "0.78rem",
                  fontWeight:
                    700,
                  color:
                    "#475569",
                }}
              >
                Status:
              </span>

              <select
                className="form-input no-icon"
                value={
                  statusFilter
                }
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value,
                  )
                }
                style={{
                  padding:
                    "0.35rem 0.65rem",
                  fontSize:
                    "0.8rem",
                  width:
                    "auto",
                }}
              >
                <option value="ALL">
                  All Statuses
                </option>

                <option value="PENDING">
                  PENDING
                </option>

                <option value="READY">
                  READY
                </option>

                <option value="MANUAL_SPLIT">
                  MANUAL SPLIT
                </option>

                <option value="PARTIAL_BACKORDER">
                  PARTIAL BACKORDER
                </option>

                <option value="BACKORDER">
                  BACKORDER
                </option>

                <option value="FULFILLED">
                  FULFILLED
                </option>
              </select>
            </div>

            {/* PERIOD */}

            <div
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                gap:
                  "0.35rem",
              }}
            >
              <Calendar
                size={15}
                color="#64748b"
              />

              <span
                style={{
                  fontSize:
                    "0.78rem",
                  fontWeight:
                    700,
                  color:
                    "#475569",
                }}
              >
                Period:
              </span>

              <select
                className="form-input no-icon"
                value={
                  periodFilter
                }
                onChange={(e) =>
                  setPeriodFilter(
                    e.target.value,
                  )
                }
                style={{
                  padding:
                    "0.35rem 0.65rem",
                  fontSize:
                    "0.8rem",
                  width:
                    "auto",
                }}
              >
                <option value="ALL">
                  All Time
                </option>

                <option value="TODAY">
                  Today
                </option>

                <option value="WEEK">
                  Last 7 Days
                </option>
              </select>
            </div>

            {/* SEARCH */}

            <div
              style={{
                flex: 1,
                minWidth:
                  "220px",
                position:
                  "relative",
              }}
            >
              <Search
                size={15}
                color="#94a3b8"
                style={{
                  position:
                    "absolute",
                  left: "10px",
                  top: "10px",
                }}
              />

              <input
                type="text"
                className="form-input"
                placeholder="Search order ref or customer..."
                value={
                  searchQuery
                }
                onChange={(e) =>
                  setSearchQuery(
                    e.target.value,
                  )
                }
                style={{
                  paddingLeft:
                    "32px",
                  fontSize:
                    "0.8rem",
                  height:
                    "35px",
                }}
              />
            </div>

            <div
              style={{
                fontSize:
                  "0.8rem",
                color:
                  "#64748b",
                fontWeight:
                  600,
              }}
            >
              Showing{" "}
              <strong>
                {
                  filteredOrders.length
                }
              </strong>{" "}
              orders
            </div>
          </div>

          {/* TABLE */}

          <div
            style={{
              overflowX:
                "auto",
            }}
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    Order Number
                  </th>

                  <th>
                    Customer
                  </th>

                  <th>
                    Fulfillment Status
                  </th>

                  <th>
                    Reserved Qty
                  </th>

                  <th>
                    Backorder
                  </th>

                  <th>
                    Warehouses Used
                  </th>

                  <th>
                    Shipping Cost
                  </th>

                  <th>
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="8"
                      style={{
                        textAlign:
                          "center",
                        padding:
                          "3rem",
                        color:
                          "#64748b",
                      }}
                    >
                      Loading operational
                      orders...
                    </td>
                  </tr>
                ) : filteredOrders.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan="8"
                      style={{
                        textAlign:
                          "center",
                        padding:
                          "3rem",
                        color:
                          "#64748b",
                      }}
                    >
                      No confirmed orders
                      available.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(
                    (order) => (
                      <tr
                        key={
                          order.id
                        }
                        onClick={() => {
                          setSelectedOrderId(
                            order.id,
                          );

                          loadFulfillmentOptions(
                            order.id,
                          );
                        }}
                        style={{
                          cursor:
                            "pointer",

                          background:
                            order.id ===
                            selectedOrderId
                              ? "rgba(239,246,255,0.8)"
                              : "transparent",
                        }}
                      >
                        <td
                          style={{
                            color:
                              "#1d4ed8",
                            fontWeight:
                              800,
                          }}
                        >
                          {
                            order.order_number
                          }
                        </td>

                        <td>
                          {order.company_name ||
                            order.customer_name}
                        </td>

                        <td>
                          <span
                            className={`badge ${
                              order.fulfillment_status ===
                              "FULFILLED"
                                ? "badge-approved"
                                : order.fulfillment_status ===
                                    "BACKORDER" ||
                                  order.fulfillment_status ===
                                    "PARTIAL_BACKORDER"
                                ? "badge-rejected"
                                : "badge-active"
                            }`}
                          >
                            {order.fulfillment_status ||
                              "PENDING"}
                          </span>
                        </td>

                        <td>
                          {
                            order.allocated_quantity ||
                            0
                          }{" "}
                          Units
                        </td>

                        <td>
                          {Number(
                            order.backorder_quantity,
                          ) > 0 ? (
                            <span
                              style={{
                                color:
                                  "#b91c1c",
                                fontWeight:
                                  700,
                              }}
                            >
                              {
                                order.backorder_quantity
                              }{" "}
                              Units
                            </span>
                          ) : (
                            "0 Units"
                          )}
                        </td>

                        <td>
                          {
                            order.warehouse_count ||
                            1
                          }{" "}
                          Depot(s)
                        </td>

                        <td>
                          {currency(
                            order.shipping_cost ||
                              0,
                          )}
                        </td>

                        <td>
                          <button
                            className="btn-secondary"
                            style={{
                              padding:
                                "0.3rem 0.65rem",
                              fontSize:
                                "0.78rem",
                            }}
                            onClick={(
                              event,
                            ) => {
                              event.stopPropagation();

                              onNavigate(
                                "/sales/fulfillment",
                              );
                            }}
                          >
                            Manage{" "}
                            <ArrowRight
                              size={13}
                            />
                          </button>
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}