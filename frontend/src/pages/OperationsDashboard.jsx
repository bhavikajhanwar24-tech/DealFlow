import React from "react";
import { useAuth } from "../context/AuthContext";

const TruckIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="3" width="15" height="13" />
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);

const CheckCircleIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const ShieldCheckIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

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
            <TruckIcon size={22} />
          </div>
        </div>

        <div className="metric-card" style={{ borderLeft: "4px solid #10b981" }}>
          <div>
            <div className="metric-label">SLA Compliance</div>
            <div className="metric-value">99.2%</div>
          </div>
          <div className="metric-icon-wrap" style={{ background: "#d1fae5", color: "#059669" }}>
            <CheckCircleIcon size={22} />
          </div>
        </div>

        <div className="metric-card" style={{ borderLeft: "4px solid #6366f1" }}>
          <div>
            <div className="metric-label">Delivered This Month</div>
            <div className="metric-value">114 Orders</div>
          </div>
          <div className="metric-icon-wrap" style={{ background: "#eef2ff", color: "#4f46e5" }}>
            <ShieldCheckIcon size={22} />
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
