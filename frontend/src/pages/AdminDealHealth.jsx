import { useEffect, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const API_BASE = "http://localhost:5000/api";

export default function AdminDealHealth() {
  const { token } = useAuth();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadHealth = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/analytics/deal-health`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load deal health.");
      setDeals(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
  }, [token]);

  return (
    <main className="main-content admin-page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Operations & Analytics</p>
          <h1>Deal Health Monitor</h1>
          <p className="page-subtitle">Rule-based scoring to identify at-risk quotations and deals.</p>
        </div>
        <button className="btn-secondary" onClick={loadHealth} disabled={loading}>
          <RefreshCw size={15} className={loading ? "spin" : ""} /> Refresh
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="admin-panel" style={{ marginTop: '1.5rem' }}>
        <div className="panel-heading">
          <div className="panel-icon"><Activity size={18} /></div>
          <h2>Active Deals</h2>
        </div>
        
        <div className="staff-table-wrap">
          <table className="data-table staff-table">
            <thead>
              <tr>
                <th>Quotation</th>
                <th>Customer</th>
                <th>Discount</th>
                <th>Risk Score</th>
                <th>Health Score</th>
                <th>Status</th>
                <th>Reasons</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="empty-state">Loading deal health...</td></tr>
              ) : deals.length === 0 ? (
                <tr><td colSpan="7" className="empty-state">No active deals found.</td></tr>
              ) : (
                deals.map((deal) => (
                  <tr key={deal.id}>
                    <td><strong>{deal.quotation_number}</strong></td>
                    <td>{deal.customer_name}</td>
                    <td>{deal.discountPercent}</td>
                    <td>{deal.risk_score || 'N/A'}</td>
                    <td><strong>{deal.healthScore}/100</strong></td>
                    <td>
                      <span className={`badge ${deal.healthStatus === 'HEALTHY' ? 'badge-active' : deal.healthStatus === 'AT RISK' ? 'badge-pending' : 'badge-suspended'}`}>
                        {deal.healthStatus}
                      </span>
                    </td>
                    <td>
                      {deal.reasons.length > 0 ? (
                        <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.8rem', color: '#64748b' }}>
                          {deal.reasons.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
