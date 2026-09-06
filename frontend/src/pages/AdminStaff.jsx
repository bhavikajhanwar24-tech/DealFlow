import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

const API_BASE = "http://localhost:5000/api";

// Robust SVG Icons for React 19 stability
const UserPlusIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="19" y1="8" x2="19" y2="14" />
    <line x1="22" y1="11" x2="16" y2="11" />
  </svg>
);

const SearchIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const EditIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const KeyIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7.5" cy="15.5" r="5.5" />
    <path d="m21 2-9.6 9.6" />
    <path d="m15.5 7.5 3 3L22 7l-3-3" />
  </svg>
);

const CheckCircleIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const PowerIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
    <line x1="12" y1="2" x2="12" y2="12" />
  </svg>
);

const AlertTriangleIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const ShieldCheckIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const XIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const INITIAL_CREATE_STATE = {
  fullName: "",
  employeeId: "",
  email: "",
  phone: "",
  designation: "",
  department: "Sales",
  role: "SALES_REP",
  password: "",
  confirmPassword: ""
};

export default function AdminStaff() {
  const { token } = useAuth();

  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState(INITIAL_CREATE_STATE);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPasswordForm, setResetPasswordForm] = useState({ password: "", confirmPassword: "" });

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);

  const [actionLoading, setActionLoading] = useState(false);

  // Fetch Staff List
  const fetchStaff = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append("search", searchQuery.trim());
      if (deptFilter !== "ALL") params.append("department", deptFilter);
      if (roleFilter !== "ALL") params.append("role", roleFilter);
      if (statusFilter !== "ALL") params.append("status", statusFilter);

      const url = `${API_BASE}/admin/staff${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load staff list.");
      setStaffList(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [deptFilter, roleFilter, statusFilter]);

  // Handle Search on Submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchStaff();
  };

  // KPIs
  const totalStaff = staffList.length;
  const activeStaff = staffList.filter((s) => s.status === "ACTIVE").length;
  const inactiveStaff = staffList.filter((s) => s.status === "INACTIVE" || s.status === "SUSPENDED").length;
  const uniqueDepartments = Array.from(new Set(staffList.map((s) => s.department).filter(Boolean))).length;

  // Create Staff
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (createForm.password !== createForm.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setActionLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch(`${API_BASE}/admin/staff`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          fullName: createForm.fullName.trim(),
          employeeId: createForm.employeeId.trim(),
          email: createForm.email.trim(),
          phone: createForm.phone.trim(),
          designation: createForm.designation.trim(),
          department: createForm.department,
          role: createForm.role,
          password: createForm.password
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create staff account.");

      setSuccessMsg(data.message || "Staff account created successfully.");
      setCreateModalOpen(false);
      setCreateForm(INITIAL_CREATE_STATE);
      fetchStaff();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (member) => {
    setEditForm({
      id: member.id,
      fullName: member.full_name,
      employeeId: member.employee_id,
      email: member.email,
      phone: member.phone || "",
      designation: member.designation || "",
      department: member.department || "Sales",
      role: member.role,
      status: member.status
    });
    setEditModalOpen(true);
  };

  // Edit Staff Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm) return;

    setActionLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch(`${API_BASE}/admin/staff/${editForm.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          fullName: editForm.fullName.trim(),
          employeeId: editForm.employeeId.trim(),
          email: editForm.email.trim(),
          phone: editForm.phone.trim(),
          designation: editForm.designation.trim(),
          department: editForm.department,
          role: editForm.role,
          status: editForm.status
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update staff account.");

      setSuccessMsg(data.message || "Staff account updated successfully.");
      setEditModalOpen(false);
      setEditForm(null);
      fetchStaff();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Open Reset Password Modal
  const openResetModal = (member) => {
    setResetTarget(member);
    setResetPasswordForm({ password: "", confirmPassword: "" });
    setResetModalOpen(true);
  };

  // Reset Password Submit
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!resetTarget) return;

    if (resetPasswordForm.password !== resetPasswordForm.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (resetPasswordForm.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setActionLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch(`${API_BASE}/admin/staff/${resetTarget.id}/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ password: resetPasswordForm.password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reset password.");

      setSuccessMsg(data.message || `Password reset successfully for ${resetTarget.full_name}.`);
      setResetModalOpen(false);
      setResetTarget(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Open Status Toggle Modal
  const openStatusToggleModal = (member) => {
    setStatusTarget(member);
    setStatusModalOpen(true);
  };

  // Toggle Status Submit
  const handleStatusToggleSubmit = async () => {
    if (!statusTarget) return;

    const nextStatus = statusTarget.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setActionLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch(`${API_BASE}/admin/staff/${statusTarget.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update account status.");

      setSuccessMsg(data.message || `Account status changed to ${nextStatus}.`);
      setStatusModalOpen(false);
      setStatusTarget(null);
      fetchStaff();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <main className="main-content admin-page">
      {/* Header Row */}
      <div className="page-heading-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
        <div>
          <p className="eyebrow" style={{ fontSize: "0.75rem", fontWeight: 700, color: "#3b82f6", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
            Identity & Access Management
          </p>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
            Staff & Credential Management
          </h1>
          <p className="page-subtitle" style={{ color: "#64748b", fontSize: "0.875rem", marginTop: "4px" }}>
            Create and maintain internal enterprise accounts. Staff accounts cannot self-register.
          </p>
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setError("");
            setSuccessMsg("");
            setCreateForm(INITIAL_CREATE_STATE);
            setCreateModalOpen(true);
          }}
          style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "0.625rem 1.25rem", borderRadius: "8px", fontWeight: 600 }}
        >
          <UserPlusIcon size={18} />
          <span>Create Staff Account</span>
        </button>
      </div>

      {/* KPI Ribbon */}
      <div
        className="kpi-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem"
        }}
      >
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "1.25rem", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: "0.8125rem", color: "#64748b", fontWeight: 600 }}>Total Staff Accounts</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a", marginTop: "4px" }}>{totalStaff}</div>
          <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "2px" }}>Admin-provisioned users</div>
        </div>

        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "1.25rem", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: "0.8125rem", color: "#16a34a", fontWeight: 600 }}>Active Accounts</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#16a34a", marginTop: "4px" }}>{activeStaff}</div>
          <div style={{ fontSize: "0.75rem", color: "#86efac", marginTop: "2px" }}>Granted platform login</div>
        </div>

        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "1.25rem", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: "0.8125rem", color: "#dc2626", fontWeight: 600 }}>Deactivated / Suspended</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#dc2626", marginTop: "4px" }}>{inactiveStaff}</div>
          <div style={{ fontSize: "0.75rem", color: "#fca5a5", marginTop: "2px" }}>Access revoked</div>
        </div>

        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "1.25rem", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: "0.8125rem", color: "#2563eb", fontWeight: 600 }}>Departments</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#2563eb", marginTop: "4px" }}>{uniqueDepartments}</div>
          <div style={{ fontSize: "0.75rem", color: "#93c5fd", marginTop: "2px" }}>Sales, Ops, Finance, HR</div>
        </div>
      </div>

      {/* Feedback Alerts */}
      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: "1.25rem" }}>
          <CheckCircleIcon size={18} />
          <div>{successMsg}</div>
        </div>
      )}

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: "1.25rem" }}>
          <AlertTriangleIcon size={18} />
          <div>{error}</div>
        </div>
      )}

      {/* Control Bar: Search and Filters */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          padding: "1rem",
          marginBottom: "1.25rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "1rem"
        }}
      >
        <form onSubmit={handleSearchSubmit} style={{ position: "relative", flex: "1 1 260px" }}>
          <SearchIcon size={16} style={{ position: "absolute", left: "10px", top: "10px", color: "#94a3b8" }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: "2.25rem", paddingRight: "0.875rem", paddingTop: "0.45rem", paddingBottom: "0.45rem", fontSize: "0.875rem" }}
            placeholder="Search by name, email, ID, or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "0.8125rem", color: "#64748b", fontWeight: 600 }}>Dept:</span>
            <select
              className="form-select no-icon"
              style={{ padding: "0.4rem 0.75rem", fontSize: "0.8125rem" }}
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              <option value="ALL">All Departments</option>
              <option value="Sales">Sales</option>
              <option value="Finance">Finance</option>
              <option value="Operations">Operations</option>
              <option value="Human Resources">Human Resources</option>
              <option value="IT / Administration">IT / Administration</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "0.8125rem", color: "#64748b", fontWeight: 600 }}>Role:</span>
            <select
              className="form-select no-icon"
              style={{ padding: "0.4rem 0.75rem", fontSize: "0.8125rem" }}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="ALL">All Roles</option>
              <option value="STAFF">Staff</option>
              <option value="SALES_REP">Sales Representative</option>
              <option value="SALES_MANAGER">Sales Manager</option>
              <option value="FINANCE">Finance Specialist</option>
              <option value="OPERATIONS">Operations Coordinator</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "0.8125rem", color: "#64748b", fontWeight: 600 }}>Status:</span>
            <select
              className="form-select no-icon"
              style={{ padding: "0.4rem 0.75rem", fontSize: "0.8125rem" }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        </div>
      </div>

      {/* Staff Directory Table Card */}
      <div className="data-table-card" style={{ background: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Staff Member</th>
              <th>Staff ID</th>
              <th>Role & Designation</th>
              <th>Department</th>
              <th>Contact</th>
              <th>Last Login</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>
                  Loading staff directory...
                </td>
              </tr>
            ) : staffList.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>
                  No staff members match the selected filters.
                </td>
              </tr>
            ) : (
              staffList.map((member) => {
                const isActive = member.status === "ACTIVE";
                return (
                  <tr key={member.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div
                          style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "50%",
                            background: isActive ? "#eff6ff" : "#f1f5f9",
                            color: isActive ? "#2563eb" : "#64748b",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: "0.875rem",
                            flexShrink: 0
                          }}
                        >
                          {member.full_name ? member.full_name.charAt(0).toUpperCase() : "S"}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: "#0f172a" }}>{member.full_name}</div>
                          <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{member.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <code style={{ background: "#f8fafc", padding: "2px 6px", borderRadius: "4px", fontSize: "0.8125rem", color: "#334155" }}>
                        {member.employee_id || "N/A"}
                      </code>
                    </td>
                    <td>
                      <span
                        style={{
                          background: "#f0fdf4",
                          color: "#15803d",
                          padding: "0.2rem 0.5rem",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          display: "inline-block"
                        }}
                      >
                        {member.role}
                      </span>
                      {member.designation && (
                        <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px" }}>
                          {member.designation}
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: "0.8125rem", color: "#334155" }}>
                        {member.department || "General"}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>
                        {member.phone || "—"}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>
                        {member.last_login
                          ? new Date(member.last_login).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit"
                            })
                          : "Never"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          isActive
                            ? "badge-active"
                            : member.status === "INACTIVE"
                            ? "badge-rejected"
                            : "badge-suspended"
                        }`}
                      >
                        {member.status}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <div style={{ display: "inline-flex", gap: "6px" }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }}
                          onClick={() => openEditModal(member)}
                          title="Edit Details"
                        >
                          <EditIcon size={13} /> Edit
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }}
                          onClick={() => openResetModal(member)}
                          title="Reset Password"
                        >
                          <KeyIcon size={13} /> Reset Pass
                        </button>
                        <button
                          type="button"
                          className={isActive ? "btn-danger" : "btn-success"}
                          style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }}
                          onClick={() => openStatusToggleModal(member)}
                          title={isActive ? "Deactivate Account" : "Activate Account"}
                        >
                          <PowerIcon size={13} /> {isActive ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Security Governance Notice */}
      <div
        style={{
          marginTop: "1.5rem",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
          padding: "0.875rem 1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontSize: "0.8125rem",
          color: "#475569"
        }}
      >
        <ShieldCheckIcon size={18} />
        <div>
          <strong>Enterprise Access Control:</strong> Passwords are cryptographically hashed using standard bcrypt rounds before persistence. Deactivating an account revokes access instantly while retaining all linked business transaction history.
        </div>
      </div>

      {/* ================= CREATE STAFF MODAL ================= */}
      {createModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "600px", maxHeight: "90vh", overflowY: "auto" }}>
            <div className="modal-header">
              <h3 className="modal-title">Create New Staff Account</h3>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                style={{ color: "#64748b", background: "none", border: "none", cursor: "pointer" }}
              >
                <XIcon size={20} />
              </button>
            </div>

            <p style={{ fontSize: "0.8125rem", color: "#64748b", marginBottom: "1.25rem" }}>
              Issue direct credentials for an internal team member. The staff member will use these credentials on the public login page.
            </p>

            <form onSubmit={handleCreateSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input no-icon"
                    placeholder="e.g. Vikram Sharma"
                    value={createForm.fullName}
                    onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Staff ID *</label>
                  <input
                    type="text"
                    required
                    className="form-input no-icon"
                    placeholder="e.g. STF-1025"
                    value={createForm.employeeId}
                    onChange={(e) => setCreateForm({ ...createForm, employeeId: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Work Email *</label>
                  <input
                    type="email"
                    required
                    className="form-input no-icon"
                    placeholder="vikram@company.com"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    className="form-input no-icon"
                    placeholder="+91 98765 43210"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Department *</label>
                  <select
                    className="form-select no-icon"
                    value={createForm.department}
                    onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
                  >
                    <option value="Sales">Sales</option>
                    <option value="Finance">Finance</option>
                    <option value="Operations">Operations</option>
                    <option value="Human Resources">Human Resources</option>
                    <option value="IT / Administration">IT / Administration</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Designation / Title</label>
                  <input
                    type="text"
                    className="form-input no-icon"
                    placeholder="e.g. Senior Account Executive"
                    value={createForm.designation}
                    onChange={(e) => setCreateForm({ ...createForm, designation: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Platform Role *</label>
                <select
                  className="form-select no-icon"
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                >
                  <option value="SALES_REP">Sales Representative (Deals, Quotes, Catalog)</option>
                  <option value="SALES_MANAGER">Sales Manager (Discounts, Approvals)</option>
                  <option value="FINANCE">Finance Specialist (Invoices, Ledger, Payments)</option>
                  <option value="OPERATIONS">Operations Coordinator (Inventory, Dispatch)</option>
                  <option value="STAFF">General Staff</option>
                </select>
                <small style={{ fontSize: "0.6875rem", color: "#64748b", marginTop: "4px", display: "block" }}>
                  * ADMIN roles cannot be provisioned via Staff Management.
                </small>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Initial Password *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="form-input no-icon"
                    placeholder="Minimum 6 characters"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm Password *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="form-input no-icon"
                    placeholder="Re-enter password"
                    value={createForm.confirmPassword}
                    onChange={(e) => setCreateForm({ ...createForm, confirmPassword: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setCreateModalOpen(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={actionLoading}
                >
                  {actionLoading ? "Creating Staff..." : "Create Staff Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= EDIT STAFF MODAL ================= */}
      {editModalOpen && editForm && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "600px", maxHeight: "90vh", overflowY: "auto" }}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Staff Account</h3>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                style={{ color: "#64748b", background: "none", border: "none", cursor: "pointer" }}
              >
                <XIcon size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input no-icon"
                    value={editForm.fullName}
                    onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Staff ID *</label>
                  <input
                    type="text"
                    required
                    className="form-input no-icon"
                    value={editForm.employeeId}
                    onChange={(e) => setEditForm({ ...editForm, employeeId: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Work Email *</label>
                  <input
                    type="email"
                    required
                    className="form-input no-icon"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    className="form-input no-icon"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Department *</label>
                  <select
                    className="form-select no-icon"
                    value={editForm.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  >
                    <option value="Sales">Sales</option>
                    <option value="Finance">Finance</option>
                    <option value="Operations">Operations</option>
                    <option value="Human Resources">Human Resources</option>
                    <option value="IT / Administration">IT / Administration</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Designation / Title</label>
                  <input
                    type="text"
                    className="form-input no-icon"
                    value={editForm.designation}
                    onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Platform Role *</label>
                  <select
                    className="form-select no-icon"
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  >
                    <option value="SALES_REP">Sales Representative</option>
                    <option value="SALES_MANAGER">Sales Manager</option>
                    <option value="FINANCE">Finance Specialist</option>
                    <option value="OPERATIONS">Operations Coordinator</option>
                    <option value="STAFF">General Staff</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Account Status</label>
                  <select
                    className="form-select no-icon"
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive (Deactivated)</option>
                    <option value="SUSPENDED">Suspended</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditModalOpen(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={actionLoading}
                >
                  {actionLoading ? "Saving Changes..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= RESET PASSWORD MODAL ================= */}
      {resetModalOpen && resetTarget && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "480px" }}>
            <div className="modal-header">
              <h3 className="modal-title">Reset Staff Password</h3>
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                style={{ color: "#64748b", background: "none", border: "none", cursor: "pointer" }}
              >
                <XIcon size={20} />
              </button>
            </div>

            <p style={{ fontSize: "0.875rem", color: "#475569", marginBottom: "1.25rem" }}>
              Set a new secure password for <strong>{resetTarget.full_name}</strong> ({resetTarget.email}).
            </p>

            <form onSubmit={handleResetPasswordSubmit}>
              <div className="form-group">
                <label className="form-label">New Password *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  className="form-input no-icon"
                  placeholder="Minimum 6 characters"
                  value={resetPasswordForm.password}
                  onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, password: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm New Password *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  className="form-input no-icon"
                  placeholder="Re-enter password"
                  value={resetPasswordForm.confirmPassword}
                  onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, confirmPassword: e.target.value })}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setResetModalOpen(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={actionLoading}
                >
                  {actionLoading ? "Updating Password..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= TOGGLE STATUS MODAL ================= */}
      {statusModalOpen && statusTarget && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "480px" }}>
            <div className="modal-header">
              <h3 className="modal-title">
                {statusTarget.status === "ACTIVE" ? "Deactivate Staff Account" : "Activate Staff Account"}
              </h3>
              <button
                type="button"
                onClick={() => setStatusModalOpen(false)}
                style={{ color: "#64748b", background: "none", border: "none", cursor: "pointer" }}
              >
                <XIcon size={20} />
              </button>
            </div>

            <p style={{ fontSize: "0.875rem", color: "#475569", lineHeight: "1.5", marginBottom: "1.25rem" }}>
              {statusTarget.status === "ACTIVE" ? (
                <>
                  Are you sure you want to deactivate <strong>{statusTarget.full_name}</strong> ({statusTarget.employee_id})?
                  <br /><br />
                  <span style={{ color: "#b91c1c", fontWeight: 600 }}>Effect:</span> This user will be immediately blocked from signing in. All historical quotations, approvals, and audit logs will remain intact.
                </>
              ) : (
                <>
                  Are you sure you want to re-activate <strong>{statusTarget.full_name}</strong> ({statusTarget.employee_id})?
                  <br /><br />
                  <span style={{ color: "#15803d", fontWeight: 600 }}>Effect:</span> The user will regain platform access with their current credentials.
                </>
              )}
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setStatusModalOpen(false)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className={statusTarget.status === "ACTIVE" ? "btn-danger" : "btn-success"}
                onClick={handleStatusToggleSubmit}
                disabled={actionLoading}
              >
                {actionLoading
                  ? "Processing..."
                  : statusTarget.status === "ACTIVE"
                  ? "Yes, Deactivate Account"
                  : "Yes, Activate Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
