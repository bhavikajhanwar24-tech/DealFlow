import React from "react";
import { Truck, CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function OperationsDashboard() {
  const { user } = useAuth();

  return (
    <div className="main-content">
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a" }}>
          Operations & Fulfillment Tracking
        </h1>
        <p style={{ color: "#64748b", fontSize: "0.875rem", marginTop: "4px" }}>
          Supply chain SLA monitoring and deployment handoffs • Coordinator: {user?.full_name} ({user?.employee_id})
        </p>
      </div>

      <div className="metric-grid">
        <div className="metric-card" style={{ borderLeft: "4px solid #06b6d4" }}>
          <div>
            <div className="metric-label">Active Deployments</div>
            <div className="metric-value">22 Deals</div>
          </div>
          <div className="metric-icon-wrap" style={{ background: "#ecfeff", color: "#0891b2" }}>
            <Truck size={22} />
          </div>
        </div>

        <div className="metric-card" style={{ borderLeft: "4px solid #10b981" }}>
          <div>
            <div className="metric-label">SLA Compliance</div>
            <div className="metric-value">99.2%</div>
          </div>
          <div className="metric-icon-wrap" style={{ background: "#d1fae5", color: "#059669" }}>
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="metric-card" style={{ borderLeft: "4px solid #6366f1" }}>
          <div>
            <div className="metric-label">Delivered This Month</div>
            <div className="metric-value">114 Orders</div>
          </div>
          <div className="metric-icon-wrap" style={{ background: "#eef2ff", color: "#4f46e5" }}>
            <ShieldCheck size={22} />
          </div>
        </div>
      </div>

      <div className="data-table-card">
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-light)" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700 }}>Fulfillment Shipments</h2>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Hardware Package</th>
              <th>Dispatch SLA</th>
              <th>Fulfillment Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>ORD-9011</code></td>
              <td>Infosys Labs</td>
              <td>10x Laptop Pro Enterprise</td>
              <td>On Schedule (48h)</td>
              <td><span className="badge badge-active">DISPATCHED</span></td>
            </tr>
            <tr>
              <td><code>ORD-9012</code></td>
              <td>Acme Corporation</td>
              <td>5x Support Bundles</td>
              <td>Awaiting Provisioning</td>
              <td><span className="badge badge-pending">PROCESSING</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
