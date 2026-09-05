import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Warehouse,
  PackageCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const API_BASE = "http://localhost:5000/api";
const money = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function Fulfillment({ onNavigate }) {
  const { token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [manual, setManual] = useState(false);
  const [manualValues, setManualValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadOrders() {
    setLoading(true);
    setError("");
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [ordersResponse, warehousesResponse] = await Promise.all([
        fetch(`${API_BASE}/fulfillment/orders`, { headers }),
        fetch(`${API_BASE}/fulfillment/warehouses`, { headers }),
      ]);
      const ordersData = await ordersResponse.json();
      const warehousesData = await warehousesResponse.json();
      if (!ordersResponse.ok)
        throw new Error(
          ordersData.message || "Unable to load fulfillment orders.",
        );
      setOrders(ordersData.data || []);
      if (warehousesResponse.ok) setWarehouses(warehousesData.data || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  async function openOrder(id) {
    setError("");
    try {
      const response = await fetch(`${API_BASE}/fulfillment/orders/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Unable to load order.");
      setSelected(data.data);
      setManual(false);
      setManualValues(
        Object.fromEntries(
          data.data.items.map((item) => [
            item.id,
            item.allocations[0]?.warehouseId || "",
          ]),
        ),
      );
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => {
    loadOrders();
  }, [token]);

  async function runAction(url, body) {
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`${API_BASE}${url}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Fulfillment update failed.");
      setSuccess("Fulfillment updated successfully.");
      await openOrder(selected.id);
      await loadOrders();
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setActionLoading(false);
    }
  }

  function submitManualSplit(event) {
    event.preventDefault();
    const allocations = selected.items
      .map((item) => ({
        orderItemId: item.id,
        warehouseId: manualValues[item.id],
        quantity: item.quantity,
      }))
      .filter((item) => item.warehouseId);
    return runAction(`/fulfillment/orders/${selected.id}/manual-split`, {
      allocations,
    });
  }

  return (
    <main className="main-content">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "1.5rem",
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
            Fulfillment and Stock
          </h1>
          <p style={{ color: "#64748b", marginTop: "0.4rem" }}>
            Live warehouse allocation, shipments, and backorders for confirmed
            orders.
          </p>
        </div>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {success && (
        <div className="alert alert-success">
          <CheckCircle2 size={16} /> {success}
        </div>
      )}
      {!selected ? (
        <section className="data-table-card">
          <div
            style={{
              padding: "1.25rem 1.5rem",
              borderBottom: "1px solid var(--border-light)",
            }}
          >
            <h2 style={{ fontSize: "1.1rem", fontWeight: 800 }}>
              Orders Awaiting Fulfillment
            </h2>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Quotation</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Reserved Stock</th>
                  <th>Backorder</th>
                  <th>Warehouses</th>
                  <th>Shipping Cost</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="8"
                      style={{ textAlign: "center", padding: "3rem" }}
                    >
                      Loading fulfillment orders...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td
                      colSpan="8"
                      style={{
                        textAlign: "center",
                        padding: "3rem",
                        color: "#64748b",
                      }}
                    >
                      No confirmed orders awaiting fulfillment.
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => openOrder(order.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <td style={{ color: "#1d4ed8", fontWeight: 800 }}>
                        {order.order_number}
                      </td>
                      <td>{order.quotation_number}</td>
                      <td>{order.company_name || order.customer_name}</td>
                      <td>
                        <span className="badge badge-active">
                          {order.fulfillment_status}
                        </span>
                      </td>
                      <td>{order.allocated_quantity} units</td>
                      <td>{order.backorder_quantity}</td>
                      <td>{order.warehouse_count}</td>
                      <td>{money(order.shipping_cost)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <>
          <button className="btn-secondary" onClick={() => setSelected(null)}>
            <ArrowLeft size={16} /> Back to Fulfillment
          </button>
          <section
            style={{
              background: "#fff",
              border: "1px solid var(--border-light)",
              borderRadius: "16px",
              padding: "1.5rem",
              marginTop: "1rem",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "1rem",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    color: "#2563eb",
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                  }}
                >
                  Fulfillment Detail
                </div>
                <h2
                  style={{
                    fontSize: "1.4rem",
                    fontWeight: 800,
                    marginTop: "0.35rem",
                  }}
                >
                  {selected.order_number} ·{" "}
                  {selected.company_name || selected.customer_name}
                </h2>
              </div>
              <span className="badge badge-active">
                {selected.fulfillment_status}
              </span>
            </div>
            <div
              className="metric-grid"
              style={{ marginTop: "1.25rem", marginBottom: 0 }}
            >
              <div className="metric-card">
                <div>
                  <div className="metric-label">Stock Reserved</div>
                  <div className="metric-value">
                    {selected.totals?.reservedQuantity || 0}
                  </div>
                  <div style={{ color: "#64748b", fontSize: "0.75rem" }}>
                    Units reserved from warehouses
                  </div>
                </div>
                <Warehouse size={22} color="#2563eb" />
              </div>
              <div className="metric-card">
                <div>
                  <div className="metric-label">Open Backorder</div>
                  <div className="metric-value">
                    {selected.totals?.backorderQuantity || 0}
                  </div>
                  <div style={{ color: "#64748b", fontSize: "0.75rem" }}>
                    Units still required
                  </div>
                </div>
                <PackageCheck size={22} color="#f59e0b" />
              </div>
              <div className="metric-card">
                <div>
                  <div className="metric-label">Shipping Cost</div>
                  <div className="metric-value">
                    {money(selected.totals?.shippingCost)}
                  </div>
                  <div style={{ color: "#64748b", fontSize: "0.75rem" }}>
                    Estimated warehouse split cost
                  </div>
                </div>
                <Warehouse size={22} color="#10b981" />
              </div>
            </div>
            <div className="data-table-card" style={{ marginTop: "1.25rem" }}>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Required</th>
                      <th>Warehouse Split</th>
                      <th>Backorder</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items.map((item) => (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 700 }}>{item.name}</td>
                        <td>{item.quantity}</td>
                        <td>
                          {item.allocations.length
                            ? item.allocations.map((allocation) => (
                                <div
                                  key={`${allocation.warehouseId}-${allocation.quantity}`}
                                >
                                  {allocation.warehouseName}:{" "}
                                  {allocation.quantity} units ·{" "}
                                  {money(allocation.shippingCost)}
                                </div>
                              ))
                            : "Not allocated"}
                        </td>
                        <td>
                          {item.backorder_quantity > 0
                            ? `${item.backorder_quantity} units`
                            : "None"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                flexWrap: "wrap",
                marginTop: "1.25rem",
              }}
            >
              <button
                className="btn-primary"
                style={{ width: "auto" }}
                onClick={() => setManual((value) => !value)}
              >
                <Warehouse size={16} />{" "}
                {manual ? "Close Manual Override" : "Manual Override"}
              </button>
              <button
                className="btn-secondary"
                onClick={() =>
                  runAction(
                    `/fulfillment/orders/${selected.id}/consolidate-backorder`,
                  )
                }
                disabled={actionLoading}
              >
                <PackageCheck size={16} /> Consolidate Backorder
              </button>
            </div>
            {manual && (
              <form
                onSubmit={submitManualSplit}
                style={{
                  marginTop: "1.25rem",
                  padding: "1rem",
                  background: "#f8fafc",
                  borderRadius: "10px",
                }}
              >
                <h3
                  style={{
                    fontSize: "1rem",
                    fontWeight: 800,
                    marginBottom: "0.75rem",
                  }}
                >
                  Manual Warehouse Override
                </h3>
                {selected.items.map((item) => (
                  <label
                    key={item.id}
                    className="form-group"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 220px",
                      gap: "1rem",
                      alignItems: "center",
                    }}
                  >
                    <span>
                      {item.name} · {item.quantity} units
                    </span>
                    <select
                      className="form-input no-icon"
                      value={manualValues[item.id] || ""}
                      onChange={(event) =>
                        setManualValues((current) => ({
                          ...current,
                          [item.id]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Select warehouse</option>
                      {warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                <button
                  className="btn-primary"
                  type="submit"
                  style={{ width: "auto" }}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Saving..." : "Accept Manual Split"}
                </button>
              </form>
            )}
          </section>
        </>
      )}
    </main>
  );
}
