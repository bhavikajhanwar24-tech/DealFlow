import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const API_BASE = "http://localhost:5000/api";

export default function AdminActivityFeed() {
  const { token } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadFeed = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/analytics/activity-feed`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load activity feed.");
      setActivities(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, [token]);

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
    });
  };

  return (
    <main className="main-content admin-page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Governance & System</p>
          <h1>Activity Feed</h1>
          <p className="page-subtitle">Real-time view of important system activities and audit events.</p>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="admin-panel" style={{ marginTop: '1.5rem' }}>
        <div className="panel-heading">
          <div className="panel-icon"><Clock size={18} /></div>
          <h2>Recent Activity</h2>
        </div>
        
        <div style={{ padding: '1.5rem' }}>
          {loading ? (
            <div className="empty-state">Loading activity feed...</div>
          ) : activities.length === 0 ? (
            <div className="empty-state">No recent activity found.</div>
          ) : (
            <div className="timeline" style={{ position: 'relative', borderLeft: '2px solid #e2e8f0', marginLeft: '1rem', paddingLeft: '1.5rem' }}>
              {activities.map((act) => (
                <div key={act.id} style={{ marginBottom: '1.5rem', position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: '-29px', top: '4px', width: '12px', height: '12px', 
                    borderRadius: '50%', background: '#3b82f6', border: '2px solid #fff'
                  }}></div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>
                    {formatDate(act.created_at)}
                  </div>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>
                    {act.action.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#475569', marginTop: '0.25rem' }}>
                    {act.actor_name ? `By ${act.actor_name}` : 'System Event'} 
                    {act.details && (
                      <pre style={{ 
                        marginTop: '0.5rem', background: '#f8fafc', padding: '0.5rem', 
                        borderRadius: '0.25rem', fontSize: '0.75rem', overflowX: 'auto', border: '1px solid #e2e8f0'
                      }}>
                        {JSON.stringify(act.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
