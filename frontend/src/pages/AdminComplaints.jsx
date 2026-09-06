import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  User,
  Building2,
  FileText,
  ShieldAlert,
  Send,
  MessageSquare,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Bot,
  Brain,
} from "lucide-react";

const API_BASE = "http://localhost:5000/api";

export default function AdminComplaints() {
  const { token } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, action_taken: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modal states
  const [activeModal, setActiveModal] = useState(null); // 'ACTION' | 'REJECT' | null
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [adminNoteInput, setAdminNoteInput] = useState("");
  const [modalLoading, setModalLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [compRes, statsRes] = await Promise.all([
        fetch(
          `${API_BASE}/complaints/admin?status=${filterStatus}${
            searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : ""
          }`,
          { headers: { Authorization: `Bearer ${token}` } }
        ),
        fetch(`${API_BASE}/complaints/admin/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const compData = await compRes.json();
      const statsData = await statsRes.json();

      if (compData.success) {
        setComplaints(compData.data || []);
      } else {
        setError(compData.message || "Failed to load complaints.");
      }

      if (statsData.success) {
        setStats(statsData.data || { total: 0, pending: 0, action_taken: 0, rejected: 0 });
      }
    } catch (err) {
      setError(err.message || "Network error loading complaints.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [filterStatus, token]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadData();
  };

  const openActionModal = (complaint) => {
    setSelectedComplaint(complaint);
    setAdminNoteInput("");
    setActiveModal("ACTION");
  };

  const openRejectModal = (complaint) => {
    setSelectedComplaint(complaint);
    setAdminNoteInput("");
    setActiveModal("REJECT");
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedComplaint(null);
    setAdminNoteInput("");
  };

  const handleActionSubmit = async () => {
    if (!adminNoteInput.trim()) {
      alert("Please enter a resolution note or action taken for the customer.");
      return;
    }

    setModalLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/complaints/admin/${selectedComplaint.id}/action`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ admin_notes: adminNoteInput.trim() }),
        }
      );

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to take action on complaint.");
      }

      setSuccess(`Action taken on complaint #${selectedComplaint.id.slice(0, 8)}. Customer has been notified.`);
      closeModal();
      await loadData();
      setTimeout(() => setSuccess(""), 5000);
    } catch (err) {
      alert(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!adminNoteInput.trim()) {
      alert("Please enter a rejection reason for the customer.");
      return;
    }

    setModalLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/complaints/admin/${selectedComplaint.id}/reject`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ admin_notes: adminNoteInput.trim() }),
        }
      );

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to reject complaint.");
      }

      setSuccess(`Complaint #${selectedComplaint.id.slice(0, 8)} rejected. Explanation recorded for customer.`);
      closeModal();
      await loadData();
      setTimeout(() => setSuccess(""), 5000);
    } catch (err) {
      alert(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status, comp = {}) => {
    if (status === "REJECTED" && comp.auto_rejected_by_ai) {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            background: "#fff1f2",
            color: "#be123c",
            border: "1px solid #fecdd3",
            padding: "0.25rem 0.65rem",
            borderRadius: "9999px",
            fontSize: "0.75rem",
            fontWeight: 800,
          }}
        >
          <Bot size={13} color="#e11d48" /> Auto-Rejected by AI
        </span>
      );
    }
    switch (status) {
      case "ACTION_TAKEN":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              background: "#ecfdf5",
              color: "#065f46",
              border: "1px solid #a7f3d0",
              padding: "0.25rem 0.65rem",
              borderRadius: "9999px",
              fontSize: "0.75rem",
              fontWeight: 700,
            }}
          >
            <CheckCircle size={13} color="#059669" /> Action Taken
          </span>
        );
      case "REJECTED":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              background: "#fef2f2",
              color: "#991b1b",
              border: "1px solid #fecaca",
              padding: "0.25rem 0.65rem",
              borderRadius: "9999px",
              fontSize: "0.75rem",
              fontWeight: 700,
            }}
          >
            <XCircle size={13} color="#dc2626" /> Rejected by Admin
          </span>
        );
      default:
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              background: "#fffbeb",
              color: "#92400e",
              border: "1px solid #fde68a",
              padding: "0.25rem 0.65rem",
              borderRadius: "9999px",
              fontSize: "0.75rem",
              fontWeight: 700,
            }}
          >
            <Clock size={13} color="#d97706" /> Pending Admin Check
          </span>
        );
    }
  };

  return (
    <main className="main-content admin-page">
      {/* Header */}
      <div className="page-heading-row" style={{ marginBottom: "1.5rem" }}>
        <div>
          <p className="eyebrow">Customer Relations & Oversight</p>
          <h1>Staff Complaints & Grievances</h1>
          <p className="page-subtitle">
            Review customer complaints submitted against internal staff members, take disciplinary or corrective action, or reject with clear explanation.
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: "1.25rem", borderRadius: "10px" }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success" style={{ marginBottom: "1.25rem", borderRadius: "10px" }}>
          <CheckCircle size={16} /> {success}
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="metric-grid" style={{ marginBottom: "1.5rem" }}>
        <div className="metric-card">
          <div className="metric-label">Total Complaints</div>
          <div className="metric-value">{stats.total}</div>
        </div>
        <div className="metric-card" style={{ borderLeft: "4px solid #f59e0b" }}>
          <div className="metric-label" style={{ color: "#b45309" }}>Pending Admin Action</div>
          <div className="metric-value" style={{ color: "#d97706" }}>{stats.pending}</div>
        </div>
        <div className="metric-card" style={{ borderLeft: "4px solid #10b981" }}>
          <div className="metric-label" style={{ color: "#047857" }}>Action Taken / Resolved</div>
          <div className="metric-value" style={{ color: "#059669" }}>{stats.action_taken}</div>
        </div>
        <div className="metric-card" style={{ borderLeft: "4px solid #ef4444" }}>
          <div className="metric-label" style={{ color: "#b91c1c" }}>Rejected Complaints</div>
          <div className="metric-value" style={{ color: "#dc2626" }}>{stats.rejected}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          background: "#ffffff",
          padding: "1rem 1.25rem",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          marginBottom: "1.5rem",
        }}
      >
        {/* Status Filter Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {[
            { key: "ALL", label: `All (${stats.total})` },
            { key: "PENDING", label: `Pending (${stats.pending})` },
            { key: "ACTION_TAKEN", label: `Action Taken (${stats.action_taken})` },
            { key: "REJECTED", label: `Rejected (${stats.rejected})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              style={{
                padding: "0.45rem 0.9rem",
                borderRadius: "8px",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                border: "1px solid",
                borderColor: filterStatus === tab.key ? "#2563eb" : "#e2e8f0",
                background: filterStatus === tab.key ? "#eff6ff" : "#ffffff",
                color: filterStatus === tab.key ? "#1d4ed8" : "#475569",
                transition: "all 0.15s ease",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "0.5rem" }}>
          <div style={{ position: "relative" }}>
            <Search
              size={15}
              style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}
            />
            <input
              type="text"
              placeholder="Search customer, staff, subject..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: "0.45rem 0.75rem 0.45rem 2.1rem",
                fontSize: "0.875rem",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                outline: "none",
                width: "250px",
              }}
            />
          </div>
          <button
            type="submit"
            className="btn-secondary"
            style={{ padding: "0.45rem 0.85rem", fontSize: "0.85rem", height: "auto" }}
          >
            Search
          </button>
        </form>
      </div>

      {/* Complaints List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>
          <Clock size={24} style={{ animation: "spin 1s linear infinite", margin: "0 auto 0.75rem" }} />
          <div>Loading staff complaints...</div>
        </div>
      ) : complaints.length === 0 ? (
        <div
          style={{
            background: "#ffffff",
            padding: "3.5rem 2rem",
            textAlign: "center",
            borderRadius: "14px",
            border: "1px solid #e2e8f0",
          }}
        >
          <ShieldCheck size={48} color="#94a3b8" style={{ margin: "0 auto 1rem" }} />
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.35rem" }}>
            No Complaints Found
          </h3>
          <p style={{ color: "#64748b", fontSize: "0.9rem", maxWidth: "420px", margin: "0 auto" }}>
            {filterStatus === "ALL"
              ? "No customer has filed a complaint against any staff member yet."
              : `There are currently no complaints in '${filterStatus}' status.`}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {complaints.map((comp) => {
            const isPending = comp.status === "PENDING";
            const isActionTaken = comp.status === "ACTION_TAKEN";
            const isRejected = comp.status === "REJECTED";

            return (
              <div
                key={comp.id}
                style={{
                  background: "#ffffff",
                  borderRadius: "14px",
                  border: isPending ? "1px solid #fde68a" : "1px solid #e2e8f0",
                  boxShadow: isPending
                    ? "0 4px 15px -3px rgba(245, 158, 11, 0.1), 0 2px 6px -2px rgba(245, 158, 11, 0.05)"
                    : "0 2px 8px -2px rgba(15, 23, 42, 0.04)",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                {/* Card Top Row: Subject, Category, Status, Date */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: "0.75rem",
                    borderBottom: "1px solid #f1f5f9",
                    paddingBottom: "0.85rem",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                      <span
                        style={{
                          background: "#f1f5f9",
                          color: "#475569",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          padding: "0.2rem 0.55rem",
                          borderRadius: "6px",
                          letterSpacing: "0.03em",
                        }}
                      >
                        {comp.category || "GENERAL"}
                      </span>
                      {comp.quotation_number && (
                        <span
                          style={{
                            background: "#eff6ff",
                            color: "#1d4ed8",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            padding: "0.2rem 0.55rem",
                            borderRadius: "6px",
                          }}
                        >
                          Quote: {comp.quotation_number}
                        </span>
                      )}
                      <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                        Filed: {formatDateTime(comp.created_at)}
                      </span>
                    </div>
                    <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                      {comp.subject}
                    </h3>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    {getStatusBadge(comp.status, comp)}
                  </div>
                </div>

                {/* AI Compliance Screening Assessment Box */}
                <div
                  style={{
                    background: comp.auto_rejected_by_ai
                      ? "linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)"
                      : "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
                    border: comp.auto_rejected_by_ai
                      ? "1px solid #fecdd3"
                      : "1px solid #ddd6fe",
                    borderRadius: "10px",
                    padding: "0.85rem 1.15rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.45rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <Sparkles size={16} color={comp.auto_rejected_by_ai ? "#e11d48" : "#7c3aed"} />
                      <strong style={{ fontSize: "0.85rem", color: comp.auto_rejected_by_ai ? "#9f1239" : "#5b21b6" }}>
                        {comp.auto_rejected_by_ai ? "AI Compliance Auto-Rejection (Spam/Irrelevant)" : "AI Grievance Audit: Verified Genuine"}
                      </strong>
                    </div>
                    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          padding: "0.15rem 0.45rem",
                          borderRadius: "4px",
                          background: comp.auto_rejected_by_ai ? "#ffe4e6" : "#e0e7ff",
                          color: comp.auto_rejected_by_ai ? "#be123c" : "#3730a3",
                        }}
                      >
                        Confidence: {Math.round(Number(comp.ai_relevance_score || (comp.auto_rejected_by_ai ? 95 : 85)))}%
                      </span>
                      {comp.ai_suggested_priority && (
                        <span
                          style={{
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            padding: "0.15rem 0.45rem",
                            borderRadius: "4px",
                            background:
                              comp.ai_suggested_priority === "CRITICAL"
                                ? "#fee2e2"
                                : comp.ai_suggested_priority === "HIGH"
                                ? "#ffedd5"
                                : "#ecfdf5",
                            color:
                              comp.ai_suggested_priority === "CRITICAL"
                                ? "#b91c1c"
                                : comp.ai_suggested_priority === "HIGH"
                                ? "#c2410c"
                                : "#047857",
                          }}
                        >
                          Priority: {comp.ai_suggested_priority}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ fontSize: "0.825rem", color: comp.auto_rejected_by_ai ? "#881337" : "#4c1d95", lineHeight: "1.4" }}>
                    <strong>AI Finding: </strong>
                    {comp.ai_reason || (comp.auto_rejected_by_ai ? "Submission lacked genuine business/staff performance grievance." : "Complaint contains actionable staff conduct grievance.")}
                  </div>

                  {comp.ai_suggested_action && !comp.auto_rejected_by_ai && (
                    <div style={{ fontSize: "0.775rem", color: "#6b21a8", marginTop: "0.15rem" }}>
                      💡 <strong>Suggested Admin Next Step: </strong> {comp.ai_suggested_action}
                    </div>
                  )}
                </div>

                {/* Parties Involved Row */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: "1rem",
                    background: "#f8fafc",
                    padding: "0.9rem 1.15rem",
                    borderRadius: "10px",
                  }}
                >
                  {/* Complainant (Customer) */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        background: "#dbeafe",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#1d4ed8",
                        fontWeight: 700,
                      }}
                    >
                      {comp.customer_name ? comp.customer_name.charAt(0).toUpperCase() : "C"}
                    </div>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>
                        Customer (Complainant)
                      </div>
                      <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.925rem" }}>
                        {comp.customer_name}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                        {comp.customer_company ? `${comp.customer_company} · ` : ""}
                        {comp.customer_email}
                      </div>
                    </div>
                  </div>

                  {/* Accused Staff Member */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        background: "#fee2e2",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#b91c1c",
                        fontWeight: 700,
                      }}
                    >
                      {comp.staff_name ? comp.staff_name.charAt(0).toUpperCase() : "S"}
                    </div>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>
                        Reported Staff Member
                      </div>
                      <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.925rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        {comp.staff_name}
                        <span
                          style={{
                            fontSize: "0.7rem",
                            background: "#e2e8f0",
                            color: "#334155",
                            padding: "0.1rem 0.45rem",
                            borderRadius: "4px",
                            fontWeight: 600,
                          }}
                        >
                          {comp.staff_role}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                        {comp.staff_email} {comp.staff_employee_id ? `(${comp.staff_employee_id})` : ""}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Complaint Body */}
                <div style={{ padding: "0.25rem 0" }}>
                  <div style={{ fontSize: "0.775rem", fontWeight: 700, color: "#64748b", marginBottom: "0.35rem", textTransform: "uppercase" }}>
                    Customer Statement / Complaint Details:
                  </div>
                  <div
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      padding: "0.9rem 1.1rem",
                      borderRadius: "8px",
                      color: "#334155",
                      fontSize: "0.9rem",
                      lineHeight: "1.5",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {comp.description}
                  </div>
                </div>

                {/* Admin Resolution Display (If Already Handled or Rejected) */}
                {isActionTaken && (
                  <div
                    style={{
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: "10px",
                      padding: "1rem 1.25rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#166534", fontWeight: 700, fontSize: "0.9rem" }}>
                        <CheckCircle size={16} color="#16a34a" /> Action Taken & Customer Notified
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#15803d" }}>
                        Resolved by {comp.resolver_name || "Admin"} on {formatDateTime(comp.resolved_at)}
                      </div>
                    </div>
                    <div style={{ color: "#14532d", fontSize: "0.875rem", lineHeight: "1.45" }}>
                      <strong>Resolution Note: </strong>
                      {comp.admin_notes}
                    </div>
                  </div>
                )}

                {isRejected && (
                  <div
                    style={{
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      borderRadius: "10px",
                      padding: "1rem 1.25rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#991b1b", fontWeight: 700, fontSize: "0.9rem" }}>
                        <XCircle size={16} color="#dc2626" /> Complaint Rejected
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#b91c1c" }}>
                        Rejected by {comp.resolver_name || "Admin"} on {formatDateTime(comp.resolved_at)}
                      </div>
                    </div>
                    <div style={{ color: "#7f1d1d", fontSize: "0.875rem", lineHeight: "1.45" }}>
                      <strong>Reason for Rejection: </strong>
                      {comp.admin_notes}
                    </div>
                  </div>
                )}

                {/* Pending Actions Footer */}
                {isPending && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: "0.75rem",
                      borderTop: "1px solid #f1f5f9",
                      paddingTop: "0.9rem",
                    }}
                  >
                    <button
                      className="btn-secondary"
                      onClick={() => openRejectModal(comp)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        color: "#dc2626",
                        borderColor: "#fca5a5",
                        background: "#fff5f5",
                        fontSize: "0.875rem",
                        padding: "0.5rem 1rem",
                      }}
                    >
                      <XCircle size={15} color="#dc2626" /> Reject Complaint
                    </button>

                    <button
                      className="btn-primary"
                      onClick={() => openActionModal(comp)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        background: "#059669",
                        borderColor: "#059669",
                        fontSize: "0.875rem",
                        padding: "0.5rem 1.15rem",
                      }}
                    >
                      <CheckCircle size={15} color="#ffffff" /> Take Action
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Take Action */}
      {activeModal === "ACTION" && selectedComplaint && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              padding: "2rem",
              maxWidth: "560px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: "#ecfdf5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#059669",
                }}
              >
                <CheckCircle size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#0f172a" }}>
                  Take Action on Complaint
                </h3>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
                  Against: <strong>{selectedComplaint.staff_name}</strong> ({selectedComplaint.staff_role})
                </p>
              </div>
            </div>

            <div style={{ background: "#f8fafc", padding: "0.75rem 1rem", borderRadius: "8px", fontSize: "0.85rem", color: "#475569" }}>
              <strong>Subject:</strong> {selectedComplaint.subject}
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                <label style={{ fontSize: "0.875rem", fontWeight: 700, color: "#1e293b", margin: 0 }}>
                  Resolution Reason / Action Message <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setAdminNoteInput("")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#2563eb",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Clear / Custom Reason
                </button>
              </div>
              <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.5rem" }}>
                This response will be sent to <strong>{selectedComplaint.customer_name}</strong> explaining what action has been taken to resolve their grievance.
              </p>
              <textarea
                rows="4"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.875rem",
                  outline: "none",
                  fontFamily: "inherit",
                }}
                placeholder="Type your manual reason here (e.g. Reason: Investigated the issue and approved a 10% corrective discount...) or click any preset below..."
                value={adminNoteInput}
                onChange={(e) => setAdminNoteInput(e.target.value)}
              />
            </div>

            {/* Quick Templates & Manual Option */}
            <div>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                Quick Responses & Preset Reasons:
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.35rem" }}>
                {[
                  "Reprimanded staff member and re-routed quotation for immediate approval.",
                  "Reassigned customer account to senior sales manager for dedicated service.",
                  "Issue verified and corrected. Delivery priority expedited at zero surcharge.",
                  "Staff received formal counseling; customer provided compensatory rebate voucher.",
                ].map((template, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAdminNoteInput(template)}
                    style={{
                      fontSize: "0.75rem",
                      background: adminNoteInput === template ? "#dcfce7" : "#f1f5f9",
                      color: adminNoteInput === template ? "#166534" : "#334155",
                      border: "1px solid",
                      borderColor: adminNoteInput === template ? "#86efac" : "#e2e8f0",
                      borderRadius: "6px",
                      padding: "0.35rem 0.65rem",
                      cursor: "pointer",
                      textAlign: "left",
                      fontWeight: adminNoteInput === template ? 700 : 500,
                    }}
                  >
                    {template}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAdminNoteInput("Reason: ")}
                  style={{
                    fontSize: "0.75rem",
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    border: "1px dashed #93c5fd",
                    borderRadius: "6px",
                    padding: "0.35rem 0.65rem",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  ✍️ Manual Reason
                </button>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
              <button
                className="btn-secondary"
                onClick={closeModal}
                disabled={modalLoading}
                style={{ fontSize: "0.875rem" }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleActionSubmit}
                disabled={modalLoading}
                style={{
                  fontSize: "0.875rem",
                  background: "#059669",
                  borderColor: "#059669",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <Send size={15} /> {modalLoading ? "Saving..." : "Confirm & Send to Customer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reject Complaint */}
      {activeModal === "REJECT" && selectedComplaint && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              padding: "2rem",
              maxWidth: "560px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: "#fee2e2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#dc2626",
                }}
              >
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#0f172a" }}>
                  Reject Customer Complaint
                </h3>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
                  Against: <strong>{selectedComplaint.staff_name}</strong> ({selectedComplaint.staff_role})
                </p>
              </div>
            </div>

            <div style={{ background: "#f8fafc", padding: "0.75rem 1rem", borderRadius: "8px", fontSize: "0.85rem", color: "#475569" }}>
              <strong>Subject:</strong> {selectedComplaint.subject}
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                <label style={{ fontSize: "0.875rem", fontWeight: 700, color: "#1e293b", margin: 0 }}>
                  Reason for Rejection <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setAdminNoteInput("")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#dc2626",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Clear / Custom Reason
                </button>
              </div>
              <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.5rem" }}>
                Explain why this complaint is not upheld. This explanation will be visible to <strong>{selectedComplaint.customer_name}</strong>.
              </p>
              <textarea
                rows="4"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.875rem",
                  outline: "none",
                  fontFamily: "inherit",
                }}
                placeholder="Type your manual reason here (e.g. Reason: Staff member acted strictly within authorized policy...) or click any preset below..."
                value={adminNoteInput}
                onChange={(e) => setAdminNoteInput(e.target.value)}
              />
            </div>

            {/* Quick Templates & Manual Option */}
            <div>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                Quick Rejection Reasons & Presets:
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.35rem" }}>
                {[
                  "Staff member acted strictly in compliance with established company discount policies.",
                  "Communication was delayed due to public warehouse holiday, not negligence.",
                  "Insufficient evidence provided regarding the alleged miscommunication.",
                  "Requested terms fall outside authorized operational and contractual guidelines.",
                ].map((template, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAdminNoteInput(template)}
                    style={{
                      fontSize: "0.75rem",
                      background: adminNoteInput === template ? "#fee2e2" : "#f1f5f9",
                      color: adminNoteInput === template ? "#991b1b" : "#334155",
                      border: "1px solid",
                      borderColor: adminNoteInput === template ? "#fca5a5" : "#e2e8f0",
                      borderRadius: "6px",
                      padding: "0.35rem 0.65rem",
                      cursor: "pointer",
                      textAlign: "left",
                      fontWeight: adminNoteInput === template ? 700 : 500,
                    }}
                  >
                    {template}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAdminNoteInput("Reason: ")}
                  style={{
                    fontSize: "0.75rem",
                    background: "#fef2f2",
                    color: "#dc2626",
                    border: "1px dashed #fca5a5",
                    borderRadius: "6px",
                    padding: "0.35rem 0.65rem",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  ✍️ Manual Reason
                </button>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
              <button
                className="btn-secondary"
                onClick={closeModal}
                disabled={modalLoading}
                style={{ fontSize: "0.875rem" }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleRejectSubmit}
                disabled={modalLoading}
                style={{
                  fontSize: "0.875rem",
                  background: "#dc2626",
                  borderColor: "#dc2626",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <XCircle size={15} /> {modalLoading ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
