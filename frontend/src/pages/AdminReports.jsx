import { useEffect, useState } from "react";
import { BarChart2, TrendingUp, Users, Package, ShieldCheck, Sparkles, Lightbulb } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const API_BASE = "http://localhost:5000/api";

export default function AdminReports() {
  const { token } = useAuth();
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateRange, setDateRange] = useState("30");
  const [salesRep, setSalesRep] = useState("All");

  const [aiInsights, setAiInsights] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const fetchAiInsights = async (reportData) => {
    setAiLoading(true);
    try {
      const response = await fetch(`${API_BASE}/ai/sales-insights`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(reportData)
      });
      const data = await response.json();
      if (response.ok) {
        setAiInsights(data.data);
      }
    } catch (err) {
      console.error("AI Insights Error:", err);
    } finally {
      setAiLoading(false);
    }
  };

  const loadReports = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/analytics/reports?dateRange=${dateRange}&salesRep=${salesRep}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load reports.");
      setReports(data.data);
      fetchAiInsights(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [token, dateRange, salesRep]);

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0);

  return (
    <main className="main-content admin-page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Operations & Analytics</p>
          <h1>Business Reports</h1>
          <p className="page-subtitle">Track sales performance, approvals, and product analytics over time.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="form-group" style={{ margin: 0, minWidth: '200px' }}>
          <label className="form-label" style={{ fontSize: '0.8rem' }}>Date Range</label>
          <select className="form-select no-icon" value={dateRange} onChange={e => setDateRange(e.target.value)}>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
            <option value="ALL">All Time</option>
          </select>
        </div>
        <div className="form-group" style={{ margin: 0, minWidth: '200px' }}>
          <label className="form-label" style={{ fontSize: '0.8rem' }}>Sales Representative</label>
          <select className="form-select no-icon" value={salesRep} onChange={e => setSalesRep(e.target.value)}>
            <option value="All">All Representatives</option>
            {/* Populate dynamically if needed */}
          </select>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="empty-state">Loading report data...</div>
      ) : reports ? (
        <>
          {aiLoading ? (
            <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '12px', marginBottom: '1.5rem', color: '#64748b', textAlign: 'center' }}>
              <Sparkles size={20} className="spin" style={{ marginBottom: '0.5rem' }} />
              <div>Generating AI Management Insights...</div>
            </div>
          ) : aiInsights ? (
            <div style={{
              marginBottom: '1.5rem',
              padding: '1.5rem',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
              border: '1px solid #bbf7d0',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#166534', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={18} /> AI Sales Insights
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#15803d', marginBottom: '0.5rem' }}>Key Observations</h4>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.9rem', color: '#14532d', lineHeight: '1.5' }}>
                    {aiInsights.insights?.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                </div>
                <div>
                  <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#15803d', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Lightbulb size={14} /> Strategic Recommendations
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.9rem', color: '#14532d', lineHeight: '1.5' }}>
                    {aiInsights.recommendations?.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}

          <div className="metric-grid">
            <div className="metric-card">
              <div className="metric-label"><TrendingUp size={14} style={{ marginRight: '0.25rem' }} /> Total Revenue</div>
              <div className="metric-value">{formatCurrency(reports.kpis.total_revenue)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Confirmed Deals</div>
              <div className="metric-value">{reports.kpis.confirmed_deals || 0}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Total Quotes</div>
              <div className="metric-value">{reports.kpis.total_quotes || 0}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Total Discount</div>
              <div className="metric-value">{formatCurrency(reports.kpis.total_discount)}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
            
            {/* Sales Rep Performance */}
            <div className="admin-panel" style={{ margin: 0 }}>
              <div className="panel-heading">
                <div className="panel-icon"><Users size={16} /></div>
                <h3 style={{ fontSize: '1rem', margin: 0 }}>Sales Rep Performance</h3>
              </div>
              <table className="data-table">
                <thead>
                  <tr><th>Name</th><th>Deals</th><th>Revenue</th></tr>
                </thead>
                <tbody>
                  {reports.salesRepPerformance.map((rep, idx) => (
                    <tr key={idx}>
                      <td>{rep.full_name}</td>
                      <td>{rep.total_deals}</td>
                      <td><strong>{formatCurrency(rep.revenue)}</strong></td>
                    </tr>
                  ))}
                  {reports.salesRepPerformance.length === 0 && (
                    <tr><td colSpan="3" className="empty-state">No data for selected range.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Top Products */}
            <div className="admin-panel" style={{ margin: 0 }}>
              <div className="panel-heading">
                <div className="panel-icon"><Package size={16} /></div>
                <h3 style={{ fontSize: '1rem', margin: 0 }}>Top Selling Products</h3>
              </div>
              <table className="data-table">
                <thead>
                  <tr><th>Product</th><th>Qty</th><th>Revenue</th></tr>
                </thead>
                <tbody>
                  {reports.topProducts.map((prod, idx) => (
                    <tr key={idx}>
                      <td>{prod.name}</td>
                      <td>{prod.quantity_sold}</td>
                      <td><strong>{formatCurrency(prod.revenue)}</strong></td>
                    </tr>
                  ))}
                  {reports.topProducts.length === 0 && (
                    <tr><td colSpan="3" className="empty-state">No product data for selected range.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Approvals */}
            <div className="admin-panel" style={{ margin: 0 }}>
              <div className="panel-heading">
                <div className="panel-icon"><ShieldCheck size={16} /></div>
                <h3 style={{ fontSize: '1rem', margin: 0 }}>Quotation Approvals</h3>
              </div>
              <div style={{ padding: '1.5rem' }}>
                <p><strong>Approved:</strong> {reports.approvals.approved || 0}</p>
                <p><strong>Pending:</strong> {reports.approvals.pending || 0}</p>
                <p><strong>Rejected:</strong> {reports.approvals.rejected || 0}</p>
              </div>
            </div>

          </div>
        </>
      ) : null}
    </main>
  );
}
