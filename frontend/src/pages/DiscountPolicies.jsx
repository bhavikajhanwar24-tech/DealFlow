import { useCallback, useEffect, useMemo, useState } from "react";
import { Edit3, Percent, Plus, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const API_BASE = "http://localhost:5000/api";
const TIERS = ["BRONZE", "SILVER", "GOLD"];
const CATEGORIES = ["HARDWARE", "SERVICE", "SUBSCRIPTION", "ELECTRONICS", "FURNITURE", "SOFTWARE", "SERVICES", "OTHER"];
const EMPTY_FORM = { customerTier: "BRONZE", productCategory: "HARDWARE", maxDiscount: "", status: "ACTIVE" };

export default function DiscountPolicies() {
  const { token } = useAuth();
  const [policies, setPolicies] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadPolicies = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/admin/discount-policies`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load discount policies.");
      setPolicies(data.data || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(loadPolicies, 0);
    return () => window.clearTimeout(timer);
  }, [loadPolicies]);

  const categories = useMemo(() => [...new Set([...CATEGORIES, ...policies.map((policy) => policy.productCategory)])], [policies]);
  const policyMap = useMemo(() => new Map(policies.map((policy) => [`${policy.customerTier}:${policy.productCategory}`, policy])), [policies]);

  const openAdd = () => {
    const firstMissing = TIERS.flatMap((tier) => CATEGORIES.map((category) => ({ customerTier: tier, productCategory: category }))).find((rule) => !policyMap.has(`${rule.customerTier}:${rule.productCategory}`));
    setEditingPolicy(null);
    setForm(firstMissing ? { ...EMPTY_FORM, ...firstMissing } : { ...EMPTY_FORM, productCategory: "" });
    setModalOpen(true);
    setError("");
    setSuccess("");
  };

  const openEdit = (policy) => {
    setEditingPolicy(policy);
    setForm({ customerTier: policy.customerTier, productCategory: policy.productCategory, maxDiscount: String(policy.maxDiscount), status: policy.status });
    setModalOpen(true);
    setError("");
    setSuccess("");
  };

  const updateField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const savePolicy = async (event) => {
    event.preventDefault();
    const discount = Number(form.maxDiscount);
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
      setError("Maximum discount must be a number between 0 and 100.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    const isEditing = Boolean(editingPolicy);
    try {
      const response = await fetch(`${API_BASE}/admin/discount-policies${isEditing ? `/${editingPolicy.id}` : ""}`, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, maxDiscount: discount }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to save discount policy.");
      setSuccess(data.message);
      setModalOpen(false);
      await loadPolicies();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const togglePolicy = async (policy) => {
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`${API_BASE}/admin/discount-policies/${policy.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ customerTier: policy.customerTier, productCategory: policy.productCategory, maxDiscount: policy.maxDiscount, status: policy.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to change discount policy status.");
      setSuccess(data.message);
      await loadPolicies();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <main className="main-content admin-page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Commercial controls</p>
          <h1>Discount Policy Configuration</h1>
          <p className="page-subtitle">Manage maximum discount limits for customer tiers and product categories.</p>
        </div>
        <div className="discount-policy-actions">
          <button className="btn-primary" onClick={openAdd} disabled={loading}><Plus size={16} /> Add Discount Rule</button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <section className="admin-panel discount-policy-panel">
        <div className="panel-heading panel-heading-spread">
          <div><div className="panel-icon"><Percent size={18} /></div><div><h2>Maximum allowed discount</h2><p>Click any percentage to edit its ceiling. Inactive rules remain available for historical reference.</p></div></div>
          <span className="staff-count">{policies.length} / 24 rules</span>
        </div>
        <div className="discount-table-wrap">
          <table className="data-table discount-policy-table">
            <thead><tr><th>Customer Tier</th>{categories.map((category) => <th key={category}>{category}</th>)}</tr></thead>
            <tbody>{loading ? <tr><td colSpan={categories.length + 1} className="empty-state">Loading discount policies...</td></tr> : TIERS.map((tier) => <tr key={tier}><td><strong>{tier}</strong></td>{categories.map((category) => { const policy = policyMap.get(`${tier}:${category}`); return <td key={category}>{policy ? <div className="discount-cell-group"><button className={`discount-cell ${policy.status === "INACTIVE" ? "inactive" : ""}`} onClick={() => openEdit(policy)} title={`Edit ${tier} ${category} discount`}><strong>{policy.maxDiscount}%</strong><small>{policy.status}</small></button><button className="discount-toggle" onClick={() => togglePolicy(policy)}>{policy.status === "ACTIVE" ? "Disable" : "Enable"}</button></div> : <button className="discount-cell missing" onClick={() => { setEditingPolicy(null); setForm({ ...EMPTY_FORM, customerTier: tier, productCategory: category }); setModalOpen(true); }}><Plus size={14} /> Add</button>}</td>; })}</tr>)}</tbody>
          </table>
        </div>
      </section>

      {modalOpen && <div className="modal-backdrop" onClick={() => setModalOpen(false)}><form className="modal-card discount-policy-modal" onSubmit={savePolicy} onClick={(event) => event.stopPropagation()}><div className="modal-header"><h3 className="modal-title">{editingPolicy ? "Edit discount rule" : "Add discount rule"}</h3><button type="button" onClick={() => setModalOpen(false)} aria-label="Close"><X size={20} /></button></div><div className="form-group"><label className="form-label" htmlFor="policy-tier">Customer tier</label><select id="policy-tier" name="customerTier" className="form-select no-icon" value={form.customerTier} onChange={updateField} disabled={Boolean(editingPolicy)}>{TIERS.map((tier) => <option key={tier}>{tier}</option>)}</select></div><div className="form-group"><label className="form-label" htmlFor="policy-category">Product category</label><input id="policy-category" name="productCategory" className="form-input no-icon" list="policy-categories" placeholder="e.g. ELECTRONICS" value={form.productCategory} onChange={updateField} disabled={Boolean(editingPolicy)} required maxLength="30" /><datalist id="policy-categories">{categories.map((category) => <option key={category} value={category} />)}</datalist></div><div className="form-group"><label className="form-label" htmlFor="policy-discount">Maximum discount (%)</label><input id="policy-discount" name="maxDiscount" type="number" min="0" max="100" step="0.01" className="form-input no-icon" value={form.maxDiscount} onChange={updateField} required /></div><div className="form-group"><label className="form-label" htmlFor="policy-status">Status</label><select id="policy-status" name="status" className="form-select no-icon" value={form.status} onChange={updateField}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></div><div className="form-actions"><button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}><X size={15} /> Cancel</button><button type="submit" className="btn-primary" disabled={saving}>{editingPolicy ? <Edit3 size={16} /> : <Plus size={16} />}{saving ? "Saving..." : "Save"}</button></div></form></div>}
    </main>
  );
}
