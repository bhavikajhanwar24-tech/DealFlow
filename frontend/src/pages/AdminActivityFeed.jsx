import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const API_BASE = "http://localhost:5000/api";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getAuditPointers(action, rawDetails) {
  if (!rawDetails) return [];
  let details = rawDetails;
  if (typeof rawDetails === "string") {
    try {
      details = JSON.parse(rawDetails);
    } catch {
      return [rawDetails];
    }
  }
  if (typeof details !== "object" || details === null) {
    return [String(details)];
  }

  const pointers = [];

  // 1. Contextual summaries
  if (action === "STAFF_COMPLAINT_REJECTED") {
    pointers.push("Status: Complaint Rejected by Admin");
    if (details.rejectionReason) {
      pointers.push(`Rejection Reason: ${details.rejectionReason}`);
    }
    return pointers;
  }

  if (action === "STAFF_COMPLAINT_ACTION_TAKEN") {
    pointers.push("Status: Administrative Action Taken");
    if (details.adminNotes) {
      pointers.push(`Resolution Note: ${details.adminNotes}`);
    }
    return pointers;
  }

  if (action === "STAFF_COMPLAINT_LODGED_AI_VERIFIED" || action === "STAFF_COMPLAINT_LODGED") {
    if (details.staffName) pointers.push(`Staff Member: ${details.staffName}`);
    if (details.subject) pointers.push(`Subject: ${details.subject}`);
    if (details.category) pointers.push(`Category: ${details.category}`);
    if (details.aiClassification) {
      pointers.push(`AI Screening: ${details.aiClassification.replace(/_/g, " ")}`);
    } else if (details.aiRelevant !== undefined) {
      pointers.push(`AI Screening: ${details.aiRelevant ? "Verified Relevant" : "Pending Review"}`);
    }
    if (details.status) pointers.push(`Complaint Status: ${details.status}`);
    return pointers.length > 0 ? pointers : ["Staff complaint lodged and verified"];
  }

  if (action === "STAFF_COMPLAINT_AUTO_REJECTED_AI") {
    pointers.push("Status: Auto-Rejected by AI Screener");
    const reason = details.aiReason || details.rejectionReason || "Complaint marked irrelevant by AI screener";
    pointers.push(`AI Reason: ${reason}`);
    return pointers;
  }

  if (action === "USER_LOGIN_SUCCESS") {
    pointers.push("Status: Signed In Successfully");
    if (details.role) pointers.push(`User Role: ${details.role}`);
    return pointers;
  }

  if (action === "USER_LOGIN_FAILED") {
    pointers.push("Status: Authentication Failed");
    if (details.reason) pointers.push(`Failure Reason: ${details.reason}`);
    return pointers;
  }

  if (action === "USER_REGISTER_SUCCESS") {
    pointers.push("Status: Account Created");
    if (details.role) pointers.push(`Assigned Role: ${details.role}`);
    return pointers;
  }

  if (action === "BILLING_CONFIGURATION_UPDATED") {
    if (details.currency) pointers.push(`Currency: ${details.currency}`);
    if (details.defaultTaxRate !== undefined) pointers.push(`Default Tax Rate: ${details.defaultTaxRate}%`);
    if (details.paymentTerms) pointers.push(`Payment Terms: ${details.paymentTerms}`);
    if (details.invoiceDuePeriod) pointers.push(`Invoice Due Period: ${details.invoiceDuePeriod} days`);
    return pointers.length > 0 ? pointers : ["Billing configuration updated"];
  }

  // 2. Generic fallback: Strip IDs, primary keys, and UUIDs
  const cleanEntries = Object.entries(details).filter(([key, val]) => {
    if (!key || typeof key !== "string") return false;
    const lowerKey = key.toLowerCase();
    if (
      lowerKey === "id" ||
      lowerKey.endsWith("id") ||
      lowerKey.endsWith("_id") ||
      lowerKey.includes("uuid") ||
      lowerKey.includes("token")
    ) {
      return false;
    }
    if (typeof val === "string" && UUID_REGEX.test(val.trim())) {
      return false;
    }
    return val !== null && val !== undefined && val !== "";
  });

  if (cleanEntries.length === 0) {
    return [];
  }

  cleanEntries.forEach(([key, val]) => {
    const formattedKey = key
      .replace(/([A-Z])/g, " $1")
      .replace(/_/g, " ")
      .replace(/^\w/, (c) => c.toUpperCase())
      .trim();
    const formattedVal = typeof val === "object" ? JSON.stringify(val) : String(val);
    pointers.push(`${formattedKey}: ${formattedVal}`);
  });

  return pointers;
}

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
              {activities.map((act) => {
                const pointers = getAuditPointers(act.action, act.details);
                return (
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
                    <div style={{ fontSize: '0.875rem', color: '#475569', marginTop: '0.25rem' }}>
                      {act.actor_name ? `By ${act.actor_name}` : 'System Event'} 
                      {pointers.length > 0 && (
                        <div style={{ 
                          marginTop: '0.4rem', background: '#f8fafc', padding: '0.6rem 0.85rem', 
                          borderRadius: '8px', border: '1px solid #e2e8f0'
                        }}>
                          <ul style={{ margin: 0, paddingLeft: '1.1rem', listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.825rem' }}>
                            {pointers.map((pointer, pIdx) => {
                              const colonIdx = pointer.indexOf(':');
                              if (colonIdx !== -1) {
                                const label = pointer.slice(0, colonIdx);
                                const val = pointer.slice(colonIdx + 1);
                                return (
                                  <li key={pIdx} style={{ lineHeight: '1.4' }}>
                                    <strong style={{ color: '#1e293b', marginRight: '0.25rem' }}>{label}:</strong>
                                    <span style={{ color: '#475569' }}>{val}</span>
                                  </li>
                                );
                              }
                              return (
                                <li key={pIdx} style={{ lineHeight: '1.4', color: '#475569' }}>
                                  {pointer}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
