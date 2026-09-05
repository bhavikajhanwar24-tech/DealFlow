import React, { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const API_BASE = "http://localhost:5000/api";

export default function AdminDealHealth() {
  const { token } = useAuth();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [explainingDealId, setExplainingDealId] = useState(null);
  const [aiExplanations, setAiExplanations] = useState({});

  const handleExplainDeal = async (deal) => {
    if (explainingDealId === deal.id || aiExplanations[deal.id]) return;
    setExplainingDealId(deal.id);
    try {
      const response = await fetch(`${API_BASE}/ai/deal-health-explanation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          healthScore: deal.healthScore,
          status: deal.healthStatus,
          reasons: deal.reasons,
          dealDetails: {
            discountPercent: deal.discountPercent,
            margin_percentage: deal.margin_percentage,
            status: deal.status
          }
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to fetch explanation");
      
      setAiExplanations(prev => ({
        ...prev,
        [deal.id]: data.data
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setExplainingDealId(null);
    }
  };

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
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" className="empty-state">Loading deal health...</td></tr>
              ) : deals.length === 0 ? (
                <tr><td colSpan="8" className="empty-state">No active deals found.</td></tr>
              ) : (
                deals.map((deal) => (
                  <React.Fragment key={deal.id}>
                    <tr>
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
                      <td style={{ textAlign: "right" }}>
                        <button 
                          className="btn-secondary" 
                          style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                          onClick={() => handleExplainDeal(deal)}
                          disabled={explainingDealId === deal.id}
                        >
                          {explainingDealId === deal.id ? "Analyzing..." : "Ask AI to Explain"}
                        </button>
                      </td>
                    </tr>
                    
                    {aiExplanations[deal.id] && (
                      <tr>
                        <td colSpan="8" style={{ padding: 0 }}>
                          <div style={{ background: '#f8fafc', padding: '1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ color: '#0f172a' }}>
                              <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#334155' }}>AI Diagnosis:</strong>
                              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#475569' }}>
                                {aiExplanations[deal.id].explanation?.map((item, i) => <li key={i}>{item}</li>)}
                              </ul>
                            </div>
                            <div style={{ color: '#0f172a' }}>
                              <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#0369a1' }}>Recommended Actions:</strong>
                              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#0ea5e9' }}>
                                {aiExplanations[deal.id].recommendations?.map((item, i) => <li key={i}>{item}</li>)}
                              </ul>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
