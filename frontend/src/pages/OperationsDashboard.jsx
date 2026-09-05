import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
const API_BASE = "http://localhost:5000/api";

export default function OperationsDashboard({ onNavigate }) {
  const { token, user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const summary = {
    pending: orders.filter((order) => order.fulfillment_status === "PENDING")
      .length,
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

  return (
    <main className="main-content">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "2rem",
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
              fontSize: "1.9rem",
              fontWeight: 800,
              color: "#0f172a",
              marginTop: "0.35rem",
            }}
          >
            Operations Coordinator Dashboard
          </h1>
          <p style={{ color: "#64748b", marginTop: "0.4rem" }}>
            Coordinate confirmed orders, warehouse allocation, stock
            reservations, and backorders.
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
        <button
          className="btn-primary"
          style={{ width: "auto", alignSelf: "flex-start" }}
          onClick={() => onNavigate("/sales/fulfillment")}
        >
          Open Fulfillment Queue
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      <div className="metric-grid">
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

      <section className="data-table-card">
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid var(--border-light)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 800 }}>
              Orders Awaiting Fulfillment
            </h2>
            <p
              style={{
                color: "#64748b",
                fontSize: "0.8rem",
                marginTop: "0.25rem",
              }}
            >
              Open an order to review live inventory allocation and reserve
              stock.
            </p>
          </div>
          <span className="badge badge-pending">
            Inventory Alerts: {loading ? "..." : summary.inventoryAlerts}
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Fulfillment Status</th>
                <th>Reserved</th>
                <th>Backorder</th>
                <th>Warehouses</th>
                <th>Shipping</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="7"
                    style={{
                      textAlign: "center",
                      padding: "3rem",
                      color: "#64748b",
                    }}
                  >
                    Loading operational orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    style={{
                      textAlign: "center",
                      padding: "3rem",
                      color: "#64748b",
                    }}
                  >
                    No confirmed orders available.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => onNavigate("/sales/fulfillment")}
                    style={{ cursor: "pointer" }}
                  >
                    <td style={{ color: "#1d4ed8", fontWeight: 800 }}>
                      {order.order_number}
                    </td>
                    <td>{order.company_name || order.customer_name}</td>
                    <td>
                      <span className="badge badge-active">
                        {order.fulfillment_status}
                      </span>
                    </td>
                    <td>{order.allocated_quantity}</td>
                    <td>{order.backorder_quantity}</td>
                    <td>{order.warehouse_count}</td>
                    <td>₹{Number(order.shipping_cost || 0).toFixed(2)}</td>
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
