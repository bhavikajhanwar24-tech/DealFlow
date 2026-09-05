import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

const API_BASE = "http://localhost:5000/api";

// Inline SVG Icon components for React 19 stability
const UserCheckIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <polyline points="16 11 18 13 22 9" />
  </svg>
);

const UserXIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="17" y1="8" x2="22" y2="13" />
    <line x1="22" y1="8" x2="17" y2="13" />
  </svg>
);

const ClockIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const CheckCircleIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const AlertTriangleIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const SearchIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const RefreshCwIcon = ({ size = 15, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </svg>
);

const XIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default function AdminApprovals() {
  const { token } = useAuth();

  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filter tab: 'PENDING_APPROVAL' | 'ACTIVE' | 'REJECTED' | 'ALL'
  const [statusTab, setStatusTab] = useState("PENDING_APPROVAL");
  const [searchQuery, setSearchQuery] = useState("");

  // Rejection modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch registrations
  const fetchRegistrations = async () => {
    setLoading(true);
    setError("");
    try {
      const url =
        statusTab === "ALL"
          ? `${API_BASE}/admin/employee-approvals`
          : `${API_BASE}/admin/employee-approvals?status=${statusTab}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to load employee approvals.");
      }

      setRegistrations(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
  }, [statusTab]);

  // Handle Approve
  const handleApprove = async (employee) => {
    if (!window.confirm(`Approve employee registration for ${employee.full_name} (${employee.employee_id})?`)) {
      return;
    }

    setActionLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch(`${API_BASE}/admin/employee-approvals/${employee.id}/approve`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to approve employee.");
      }

      setSuccessMsg(data.message);
      fetchRegistrations();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Open Reject Modal
  const openRejectModal = (employee) => {
    setSelectedUser(employee);
    setRejectReason("");
    setRejectModalOpen(true);
  };

  // Submit Reject
  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser || !rejectReason.trim()) return;

    setActionLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch(`${API_BASE}/admin/employee-approvals/${selectedUser.id}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reason: rejectReason.trim() })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to reject employee.");
      }

      setSuccessMsg(data.message);
      setRejectModalOpen(false);
      setSelectedUser(null);
      fetchRegistrations();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredRegistrations = registrations.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.full_name?.toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q) ||
      r.employee_id?.toLowerCase().includes(q) ||
      r.department?.toLowerCase().includes(q) ||
      r.role?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="main-content">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a" }}>
            Employee Registration Approvals
          </h1>
          <p style={{ color: "#64748b", fontSize: "0.875rem", marginTop: "4px" }}>
            Review, verify, and activate internal employees before granting DealFlow360 platform access.
          </p>
        </div>

        <button
          className="btn-secondary"
          onClick={fetchRegistrations}
          disabled={loading || actionLoading}
        >
          <RefreshCwIcon size={15} className={loading ? "spin" : ""} /> Refresh
        </button>
      </div>

      {/* Feedback Messages */}
      {successMsg && (
        <div className="alert alert-success">
          <CheckCircleIcon size={18} />
          <div>{successMsg}</div>
        </div>
      )}

      {error && (
        <div className="alert alert-danger">
          <AlertTriangleIcon size={18} />
          <div>{error}</div>
        </div>
      )}

      {/* Control Bar: Tabs & Search */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          marginBottom: "1.25rem"
        }}
      >
        <div style={{ display: "flex", background: "#ffffff", border: "1px solid var(--border-light)", borderRadius: "8px", padding: "3px" }}>
          <button
            className={`tab-btn ${statusTab === "PENDING_APPROVAL" ? "active" : ""}`}
            style={{ padding: "0.45rem 1rem", fontSize: "0.8125rem" }}
            onClick={() => setStatusTab("PENDING_APPROVAL")}
          >
            Pending Approvals
          </button>
          <button
            className={`tab-btn ${statusTab === "ACTIVE" ? "active" : ""}`}
            style={{ padding: "0.45rem 1rem", fontSize: "0.8125rem" }}
            onClick={() => setStatusTab("ACTIVE")}
          >
            Approved
          </button>
          <button
            className={`tab-btn ${statusTab === "REJECTED" ? "active" : ""}`}
            style={{ padding: "0.45rem 1rem", fontSize: "0.8125rem" }}
            onClick={() => setStatusTab("REJECTED")}
          >
            Rejected
          </button>
          <button
            className={`tab-btn ${statusTab === "ALL" ? "active" : ""}`}
            style={{ padding: "0.45rem 1rem", fontSize: "0.8125rem" }}
            onClick={() => setStatusTab("ALL")}
          >
            All Registrations
          </button>
        </div>

        <div style={{ position: "relative", minWidth: "260px" }}>
          <SearchIcon size={16} style={{ position: "absolute", left: "10px", top: "10px", color: "#94a3b8" }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: "2.25rem", paddingRight: "0.875rem", paddingTop: "0.45rem", paddingBottom: "0.45rem", fontSize: "0.875rem" }}
            placeholder="Search by name, ID, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Registrations Data Table */}
      <div className="data-table-card">
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Name</th>
                <th>Work Email</th>
                <th>Department</th>
                <th>Requested Role</th>
                <th>Registration Date</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>
                    Loading employee registration queue...
                  </td>
                </tr>
              ) : filteredRegistrations.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>
                    No registrations found in this category.
                  </td>
                </tr>
              ) : (
                filteredRegistrations.map((emp) => {
                  const isPending = emp.status === "PENDING_APPROVAL";
                  const isActive = emp.status === "ACTIVE";
                  const isRejected = emp.status === "REJECTED";

                  return (
                    <tr key={emp.id}>
                      <td style={{ fontWeight: 700, color: "#1e293b" }}>
                        <code>{emp.employee_id}</code>
                      </td>
                      <td style={{ fontWeight: 600 }}>{emp.full_name}</td>
                      <td>
                        <a href={`mailto:${emp.email}`} style={{ color: "#475569" }}>
                          {emp.email}
                        </a>
                      </td>
                      <td>{emp.department || "Sales"}</td>
                      <td>
                        <span
                          style={{
                            background: "#eff6ff",
                            color: "#1d4ed8",
                            padding: "0.2rem 0.6rem",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                            fontWeight: 700
                          }}
                        >
                          {emp.role}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.8125rem", color: "#64748b" }}>
                        {new Date(emp.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric"
                        })}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            isPending
                              ? "badge-pending"
                              : isActive
                              ? "badge-active"
                              : isRejected
                              ? "badge-rejected"
                              : "badge-suspended"
                          }`}
                        >
                          {isPending && <ClockIcon size={12} />}
                          {isActive && <CheckCircleIcon size={12} />}
                          {isRejected && <UserXIcon size={12} />}
                          {emp.status}
                        </span>
                        {isRejected && emp.rejection_reason && (
                          <div style={{ fontSize: "0.6875rem", color: "#991b1b", marginTop: "3px" }}>
                            Reason: {emp.rejection_reason}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {isPending ? (
                          <div style={{ display: "inline-flex", gap: "0.5rem" }}>
                            <button
                              className="btn-success"
                              style={{ padding: "0.45rem 0.75rem", fontSize: "0.8125rem" }}
                              onClick={() => handleApprove(emp)}
                              disabled={actionLoading}
                            >
                              <CheckCircleIcon size={14} /> Approve
                            </button>
                            <button
                              className="btn-danger"
                              style={{ padding: "0.45rem 0.75rem", fontSize: "0.8125rem" }}
                              onClick={() => openRejectModal(emp)}
                              disabled={actionLoading}
                            >
                              <UserXIcon size={14} /> Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                            {isActive ? "Approved" : "Rejected"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation & Reason Dialog for Rejection */}
      {rejectModalOpen && selectedUser && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title">Reject Employee Registration</h3>
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                style={{ color: "#64748b" }}
              >
                <XIcon size={20} />
              </button>
            </div>

            <p style={{ fontSize: "0.875rem", color: "#475569", marginBottom: "1rem" }}>
              Are you sure you want to reject registration for <strong>{selectedUser.full_name}</strong> ({selectedUser.employee_id})?
            </p>

            <form onSubmit={handleRejectSubmit}>
              <div className="form-group">
                <label className="form-label">Reason for rejection *</label>
                <textarea
                  required
                  rows="3"
                  className="form-input no-icon"
                  style={{ resize: "vertical" }}
                  placeholder="e.g. Work email could not be verified with HR records"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.25rem" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setRejectModalOpen(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-danger"
                  disabled={actionLoading || !rejectReason.trim()}
                >
                  {actionLoading ? "Rejecting..." : "Reject Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
