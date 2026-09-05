import { useEffect, useState, useMemo } from "react";
import {
  Download,
  Printer,
  FileSpreadsheet,
  Filter,
  Calendar,
  Search,
  RefreshCw,
  Truck,
  Building2,
  Package,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { exportToCSV, printOrExportPDF } from "../utils/exportUtils";

const API_BASE = "http://localhost:5000/api";
const currency = (val) => `₹${Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function OperationsDashboard({ onNavigate }) {
  const { token, user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [periodFilter, setPeriodFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  async function loadOrders() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/fulfillment/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Unable to load operations data.");
      setOrders(data.data || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, [token]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    const now = new Date();
    return orders.filter((order) => {
      // Status filter
      if (statusFilter !== "ALL" && order.fulfillment_status !== statusFilter) return false;

      // Period filter
      if (periodFilter !== "ALL") {
        const oDate = new Date(order.created_at);
        if (periodFilter === "TODAY") {
          if (oDate.toDateString() !== now.toDateString()) return false;
        } else if (periodFilter === "WEEK") {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (oDate < sevenDaysAgo) return false;
        }
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const oNum = (order.order_number || "").toLowerCase();
        const cName = (order.company_name || order.customer_name || "").toLowerCase();
        return oNum.includes(query) || cName.includes(query);
      }

      return true;
    });
  }, [orders, statusFilter, periodFilter, searchQuery]);

  const summary = {
    pending: orders.filter((order) => order.fulfillment_status === "PENDING").length,
    inProgress: orders.filter((order) =>
      ["READY", "MANUAL_SPLIT"].includes(order.fulfillment_status),
    ).length,
    partial: orders.filter(
      (order) => order.fulfillment_status === "PARTIAL_BACKORDER",
    ).length,
    backordered: orders.filter(
      (order) => order.fulfillment_status === "BACKORDER",
    ).length,
    fulfilled: orders.filter((order) =>
      ["FULFILLED", "COMPLETED"].includes(order.fulfillment_status),
    ).length,
    inventoryAlerts: orders.filter(
      (order) => Number(order.backorder_quantity) > 0,
    ).length,
  };

  const cards = [
    ["Pending Fulfillment", summary.pending, "#f59e0b"],
    ["In Progress", summary.inProgress, "#2563eb"],
    ["Partially Fulfilled", summary.partial, "#06b6d4"],
    ["Backordered", summary.backordered, "#ef4444"],
    ["Fulfilled", summary.fulfilled, "#10b981"],
  ];

  // Export CSV
  const handleExportCSV = () => {
    const exportData = filteredOrders.map((order) => ({
      orderNumber: order.order_number,
      customer: order.company_name || order.customer_name || "N/A",
      fulfillmentStatus: order.fulfillment_status,
      reservedQty: order.allocated_quantity || 0,
      backorderQty: order.backorder_quantity || 0,
      warehouseCount: order.warehouse_count || 1,
      shippingCost: Number(order.shipping_cost || 0).toFixed(2),
      createdDate: new Date(order.created_at).toLocaleDateString("en-IN"),
    }));

    const headers = [
      { key: "orderNumber", label: "Order Number" },
      { key: "customer", label: "Customer" },
      { key: "fulfillmentStatus", label: "Fulfillment Status" },
      { key: "reservedQty", label: "Reserved Qty" },
      { key: "backorderQty", label: "Backorder Qty" },
      { key: "warehouseCount", label: "Depots" },
      { key: "shippingCost", label: "Est. Shipping (INR)" },
      { key: "createdDate", label: "Order Date" },
    ];

    exportToCSV("Operations_Order_Manifests", exportData, headers);
  };

  // Export PDF Manifest
  const handleExportPDF = () => {
    const exportData = filteredOrders.map((order) => ({
      orderNumber: order.order_number,
      customer: order.company_name || order.customer_name || "N/A",
      status: order.fulfillment_status,
      reserved: `${order.allocated_quantity || 0} Units`,
      backorder: `${order.backorder_quantity || 0} Units`,
      warehouses: `${order.warehouse_count || 1} Depot(s)`,
      shipping: currency(order.shipping_cost),
    }));

    const headers = [
      { key: "orderNumber", label: "Order Number" },
      { key: "customer", label: "Customer" },
      { key: "status", label: "Fulfillment Status" },
      { key: "reserved", label: "Reserved Stock" },
      { key: "backorder", label: "Backorder" },
      { key: "warehouses", label: "Warehouses" },
      { key: "shipping", label: "Freight Est." },
    ];

    const summaryCards = [
      { label: "Total Orders", value: filteredOrders.length, color: "#2563eb" },
      { label: "Pending Orders", value: summary.pending, color: "#f59e0b" },
      { label: "Backorders", value: summary.backordered, color: "#ef4444" },
      { label: "Fulfilled Orders", value: summary.fulfilled, color: "#10b981" },
    ];

    const metadata = [
      { label: "Coordinator", value: user?.full_name || "Operations Lead" },
      { label: "Fulfillment Filter", value: statusFilter },
      { label: "Period Filter", value: periodFilter },
    ];

    printOrExportPDF({
      title: "Warehouse Fulfillment & Dispatch Manifest",
      subtitle: `Official manifest report containing ${filteredOrders.length} active fulfillment orders.`,
      metadata,
      headers,
      rows: exportData,
      summaryCards,
    });
  };

  return (
    <main className="main-content">
      {/* Top Banner */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
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
            }}
          >
            Operations Workspace
          </div>
          <h1
            style={{
              fontSize: "1.95rem",
              fontWeight: 800,
              color: "#0f172a",
              marginTop: "0.35rem",
            }}
          >
            Operations & Fulfillment Dashboard
          </h1>
          <p style={{ color: "#64748b", marginTop: "0.4rem" }}>
            Coordinate confirmed orders, warehouse allocation, stock reservations, shipping manifests, and backorders.
          </p>
          <p
            style={{
              color: "#94a3b8",
              fontSize: "0.8rem",
              marginTop: "0.35rem",
            }}
          >
            Coordinator: {user?.full_name}
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
          <button className="btn-secondary" onClick={loadOrders} disabled={loading}>
            <RefreshCw size={15} /> Refresh
          </button>
          <button
            className="btn-primary"
            style={{ width: "auto" }}
            onClick={() => onNavigate("/sales/fulfillment")}
          >
            <Truck size={16} /> Open Fulfillment Queue
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: "1.5rem" }}>{error}</div>}

      {/* KPI Metric Cards */}
      <div className="metric-grid" style={{ marginBottom: "2rem" }}>
        {cards.map(([label, value, color]) => (
          <div
            className="metric-card"
            key={label}
            style={{ borderTop: `3px solid ${color}` }}
          >
            <div>
              <div className="metric-label">{label}</div>
              <div className="metric-value">{loading ? "..." : value}</div>
              <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
                Live database count
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Section A7 & B6: Fulfillment Reports and Manifest Export Panel */}
      <section className="data-table-card">
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid var(--border-light)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Package size={20} color="#2563eb" />
              <h2 style={{ fontSize: "1.15rem", fontWeight: 800, margin: 0 }}>
                Orders & Warehouse Manifest Reports
              </h2>
            </div>
            <p
              style={{
                color: "#64748b",
                fontSize: "0.8rem",
                marginTop: "0.25rem",
              }}
            >
              Filter orders by status and date. Export dispatch packing slips, warehouse split manifests, and reports.
            </p>
          </div>

          {/* Export Actions */}
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleExportCSV}
              style={{ padding: "0.45rem 0.85rem", fontSize: "0.825rem", display: "inline-flex", gap: "0.35rem" }}
            >
              <Download size={15} color="#166534" /> Export Manifest (CSV)
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleExportPDF}
              style={{
                padding: "0.45rem 0.95rem",
                fontSize: "0.825rem",
                background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
                border: "none",
                display: "inline-flex",
                gap: "0.35rem",
              }}
            >
              <Printer size={15} /> Export / Print Manifest (PDF)
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            flexWrap: "wrap",
            alignItems: "center",
            padding: "0.75rem 1.5rem",
            background: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          {/* Status Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <Filter size={15} color="#64748b" />
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#475569" }}>Status:</span>
            <select
              className="form-input no-icon"
              style={{ padding: "0.35rem 0.65rem", fontSize: "0.8rem", width: "auto" }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="READY">READY</option>
              <option value="MANUAL_SPLIT">MANUAL SPLIT</option>
              <option value="PARTIAL_BACKORDER">PARTIAL BACKORDER</option>
              <option value="BACKORDER">BACKORDER</option>
              <option value="FULFILLED">FULFILLED</option>
            </select>
          </div>

          {/* Period Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <Calendar size={15} color="#64748b" />
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#475569" }}>Period:</span>
            <select
              className="form-input no-icon"
              style={{ padding: "0.35rem 0.65rem", fontSize: "0.8rem", width: "auto" }}
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today</option>
              <option value="WEEK">Last 7 Days</option>
            </select>
          </div>

          {/* Search Box */}
          <div style={{ flex: 1, minWidth: "220px", position: "relative" }}>
            <Search size={15} color="#94a3b8" style={{ position: "absolute", left: "10px", top: "10px" }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: "32px", fontSize: "0.8rem", height: "35px" }}
              placeholder="Search order ref or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>
            Showing <strong>{filteredOrders.length}</strong> orders
          </div>
        </div>

        {/* Data Table */}
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Order Number</th>
                <th>Customer</th>
                <th>Fulfillment Status</th>
                <th>Reserved Stock</th>
                <th>Backorder</th>
                <th>Warehouses</th>
                <th>Shipping Est.</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="8"
                    style={{
                      textAlign: "center",
                      padding: "3rem",
                      color: "#64748b",
                    }}
                  >
                    Loading operational orders...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan="8"
                    style={{
                      textAlign: "center",
                      padding: "3rem",
                      color: "#64748b",
                    }}
                  >
                    No confirmed orders match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td style={{ color: "#1d4ed8", fontWeight: 800 }}>
                      {order.order_number}
                    </td>
                    <td>{order.company_name || order.customer_name}</td>
                    <td>
                      <span
                        className={`badge ${
                          order.fulfillment_status === "FULFILLED"
                            ? "badge-approved"
                            : order.fulfillment_status === "BACKORDER" || order.fulfillment_status === "PARTIAL_BACKORDER"
                            ? "badge-rejected"
                            : "badge-active"
                        }`}
                      >
                        {order.fulfillment_status}
                      </span>
                    </td>
                    <td>{order.allocated_quantity || 0} Units</td>
                    <td>
                      {Number(order.backorder_quantity) > 0 ? (
                        <span style={{ color: "#b91c1c", fontWeight: 700 }}>
                          {order.backorder_quantity} Units
                        </span>
                      ) : (
                        "0 Units"
                      )}
                    </td>
                    <td>{order.warehouse_count || 1} Depot(s)</td>
                    <td>{currency(order.shipping_cost)}</td>
                    <td>
                      <button
                        className="btn-secondary"
                        style={{ padding: "0.3rem 0.65rem", fontSize: "0.78rem" }}
                        onClick={() => onNavigate("/sales/fulfillment")}
                      >
                        Manage <ArrowRight size={13} />
                      </button>
                    </td>
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
