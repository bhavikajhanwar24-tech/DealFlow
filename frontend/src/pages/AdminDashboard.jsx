import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

const API_BASE = "http://localhost:5000/api";

export default function AdminDashboard({ onNavigate }) {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const response = await fetch(`${API_BASE}/admin/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (data.success) setStats(data.data);
      } catch (error) {
        console.error("Failed to load admin stats:", error);
      }
    }

    loadStats();
  }, [token]);

  const metrics = [
    ["Pending Employee Approvals", stats?.pendingApprovals],
    ["Active Employees", stats?.activeEmployees],
    ["Registered Customers", stats?.totalCustomers],
    ["Audit Log Events", stats?.totalAuditLogs],
  ];

  return (
    <main className="main-content admin-page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Control center</p>
          <h1>Good morning, administrator.</h1>
          <p className="page-subtitle">A clear view of access, approvals, and platform activity.</p>
        </div>
      </div>

      <div className="metric-grid">
        {metrics.map(([label, value]) => (
          <div className="metric-card" key={label}>
            <div className="metric-label">{label}</div>
            <div className="metric-value">{value ?? "..."}</div>
          </div>
        ))}
      </div>

      <section className="admin-action-grid">
        <button className="admin-action-card" onClick={() => onNavigate("/admin/employee-approvals")}>
          <span className="admin-action-kicker">Review queue</span>
          <strong>Employee approvals</strong>
          <span>Review legacy registration requests and access decisions.</span>
        </button>
        <button className="admin-action-card" onClick={() => onNavigate("/admin/staff")}>
          <span className="admin-action-kicker">Access control</span>
          <strong>Manage staff</strong>
          <span>Create and edit staff IDs, credentials, roles, and status.</span>
        </button>
        <button className="admin-action-card" onClick={() => onNavigate("/admin/products")}>
          <span className="admin-action-kicker">Catalog control</span>
          <strong>Manage products</strong>
          <span>Maintain product prices, costs, categories, and availability for quotations.</span>
        </button>
      </section>
    </main>
  );
}
