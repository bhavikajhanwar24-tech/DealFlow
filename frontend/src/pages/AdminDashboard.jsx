import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Bell, AlertTriangle, Info, AlertCircle } from "lucide-react";

const API_BASE = "http://localhost:5000/api";

export default function AdminDashboard({ onNavigate }) {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [alertsLoading, setAlertsLoading] = useState(false);

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

    async function loadAlerts() {
      setAlertsLoading(true);
      try {
        const response = await fetch(`${API_BASE}/ai/smart-alerts`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (data.success) setAlerts(data.data);
      } catch (error) {
        console.error("Failed to load smart alerts:", error);
      } finally {
        setAlertsLoading(false);
      }
    }

    loadStats();
    loadAlerts();
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

      <div style={{ marginTop: '2rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Bell size={20} color="#0284c7" /> Smart Alerts
        </h2>
        {alertsLoading ? (
          <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '12px', color: '#64748b', textAlign: 'center' }}>
            Analyzing platform activity for alerts...
          </div>
        ) : alerts && alerts.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {alerts.map((alert, idx) => {
              const isWarning = alert.type === 'WARNING';
              const isCritical = alert.type === 'CRITICAL';
              return (
                <div key={alert.id || idx} style={{
                  padding: '1.25rem',
                  background: isCritical ? '#fef2f2' : isWarning ? '#fffbeb' : '#f0f9ff',
                  border: `1px solid ${isCritical ? '#fecaca' : isWarning ? '#fde68a' : '#bae6fd'}`,
                  borderRadius: '12px',
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'flex-start'
                }}>
                  <div style={{ marginTop: '0.2rem' }}>
                    {isCritical ? <AlertCircle size={20} color="#dc2626" /> : isWarning ? <AlertTriangle size={20} color="#d97706" /> : <Info size={20} color="#0284c7" />}
                  </div>
                  <div>
                    <strong style={{ color: isCritical ? '#991b1b' : isWarning ? '#92400e' : '#075985', display: 'block', fontSize: '0.95rem' }}>
                      {alert.message}
                    </strong>
                    {alert.actionRequired && (
                      <div style={{ marginTop: '0.4rem', color: isCritical ? '#b91c1c' : isWarning ? '#b45309' : '#0369a1', fontSize: '0.85rem' }}>
                        <strong>Action:</strong> {alert.actionRequired}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '12px', color: '#64748b', textAlign: 'center' }}>
            No immediate alerts. Everything looks healthy!
          </div>
        )}
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
