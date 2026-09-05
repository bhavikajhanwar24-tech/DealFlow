import { useEffect, useState } from "react";
import { Edit3, Plus, ShieldCheck, UserRound, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const API_BASE = "http://localhost:5000/api";
const EMPTY_FORM = {
  fullName: "",
  employeeId: "",
  email: "",
  password: "",
  department: "Sales",
  role: "SALES_REP",
  status: "ACTIVE",
};

export default function AdminStaff() {
  const { token } = useAuth();
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingStaff, setEditingStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadStaff = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/admin/staff`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load staff.");
      setStaff(data.data || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, [token]);

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingStaff(null);
  };

  const editStaff = (member) => {
    setEditingStaff(member);
    setForm({
      fullName: member.full_name,
      employeeId: member.employee_id,
      email: member.email,
      password: "",
      department: member.department || "Sales",
      role: member.role,
      status: member.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE",
    });
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveStaff = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    const isEditing = Boolean(editingStaff);
    const payload = { ...form };
    if (isEditing && !payload.password) delete payload.password;

    try {
      const response = await fetch(
        `${API_BASE}/admin/staff${isEditing ? `/${editingStaff.id}` : ""}`,
        {
          method: isEditing ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to save staff account.");
      setSuccess(data.message);
      resetForm();
      await loadStaff();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="main-content admin-page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Staff directory</p>
          <h1>Staff & credentials</h1>
          <p className="page-subtitle">Create controlled access for internal teams. Staff accounts cannot self-register.</p>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <section className="staff-layout">
        <form className="admin-panel staff-form" onSubmit={saveStaff}>
          <div className="panel-heading">
            <div className="panel-icon"><UserRound size={18} /></div>
            <div>
              <h2>{editingStaff ? "Edit staff account" : "Create staff account"}</h2>
              <p>{editingStaff ? "Update the issued credentials and access." : "Issue the exact credentials the staff member will use to log in."}</p>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="fullName">Full name</label>
              <input id="fullName" name="fullName" className="form-input no-icon" value={form.fullName} onChange={updateField} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="employeeId">Staff ID</label>
              <input id="employeeId" name="employeeId" className="form-input no-icon" placeholder="STF-1001" value={form.employeeId} onChange={updateField} required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">Work email</label>
            <input id="email" type="email" name="email" className="form-input no-icon" value={form.email} onChange={updateField} required />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">{editingStaff ? "New password (optional)" : "Password"}</label>
            <input id="password" type="password" name="password" className="form-input no-icon" value={form.password} onChange={updateField} required={!editingStaff} minLength={6} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="department">Department</label>
              <select id="department" name="department" className="form-select no-icon" value={form.department} onChange={updateField}>
                <option>Sales</option>
                <option>Finance</option>
                <option>Operations</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="role">Role</label>
              <select id="role" name="role" className="form-select no-icon" value={form.role} onChange={updateField}>
                <option value="SALES_REP">Sales Representative</option>
                <option value="SALES_MANAGER">Sales Manager</option>
                <option value="FINANCE">Finance Specialist</option>
                <option value="OPERATIONS">Operations Coordinator</option>
              </select>
            </div>
          </div>

          {editingStaff && (
            <div className="form-group">
              <label className="form-label" htmlFor="status">Account status</label>
              <select id="status" name="status" className="form-select no-icon" value={form.status} onChange={updateField}>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>
          )}

          <div className="form-actions">
            {editingStaff && <button type="button" className="btn-secondary" onClick={resetForm}><X size={15} /> Cancel</button>}
            <button type="submit" className="btn-primary" disabled={saving}>
              {editingStaff ? <Edit3 size={16} /> : <Plus size={16} />}
              {saving ? "Saving..." : editingStaff ? "Save changes" : "Create staff account"}
            </button>
          </div>
        </form>

        <section className="admin-panel staff-list-panel  overflow-y-auto ">
          <div className="panel-heading panel-heading-spread ">
            <div>
              <p className="eyebrow">Controlled access</p>
              <h2>Issued staff accounts</h2>
            </div>
            <span className="staff-count">{staff.length} accounts</span>
          </div>
          <div className="staff-table-wrap">
            <table className="data-table staff-table">
              <thead>
                <tr><th>Staff</th><th>Staff ID</th><th>Role</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan="5" className="empty-state">Loading staff accounts...</td></tr> : staff.length === 0 ? <tr><td colSpan="5" className="empty-state">No staff accounts created yet.</td></tr> : staff.map((member) => (
                  <tr key={member.id}>
                    <td><strong>{member.full_name}</strong><small>{member.email}</small></td>
                    <td><code>{member.employee_id}</code></td>
                    <td><span className="role-chip">{member.role}</span></td>
                    <td><span className={`badge ${member.status === "ACTIVE" ? "badge-active" : "badge-suspended"}`}>{member.status}</span></td>
                    <td><button className="icon-button" title={`Edit ${member.full_name}`} onClick={() => editStaff(member)}><Edit3 size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="staff-security-note"><ShieldCheck size={17} /><span>Passwords are stored as secure hashes. Staff must use the exact email, Staff ID, and password issued here.</span></div>
        </section>
      </section>
    </main>
  );
}
