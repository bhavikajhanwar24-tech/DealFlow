import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

const API_BASE = "http://localhost:5000/api";

export default function AdminDashboard({ onNavigate }) {
  const { token, logout } = useAuth();
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
    <main className="main-content">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a" }}>
          Platform Administration
        </h1>
        <button className="btn-secondary" onClick={logout}>
          Logout
        </button>
      </div>
      <p style={{ color: "#64748b", margin: "4px 0 2rem" }}>
        System governance and workspace oversight for DealFlow360.
      </p>

      <div className="metric-grid">
        {metrics.map(([label, value]) => (
          <div className="metric-card" key={label}>
            <div className="metric-label">{label}</div>
            <div className="metric-value">{value ?? "..."}</div>
          </div>
        ))}
      </div>

      <section
        style={{
          marginTop: "1.5rem",
          background: "#ffffff",
          border: "1px solid var(--border-light)",
          borderRadius: "16px",
          padding: "1.5rem",
          boxShadow: "var(--shadow-sm)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2
            style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a" }}
          >
            Employee Registration Approvals
          </h2>
          <p
            style={{
              color: "#64748b",
              fontSize: "0.875rem",
              marginTop: "0.35rem",
            }}
          >
            Review new employee registrations and approve or reject access
            requests.
          </p>
        </div>
        <button
          className="btn-primary"
          style={{ width: "auto" }}
          onClick={() => onNavigate("/admin/employee-approvals")}
        >
          Review Approvals
        </button>
      </section>
    </main>
  );
}
