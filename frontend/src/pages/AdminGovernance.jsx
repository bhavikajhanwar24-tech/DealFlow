import { useCallback, useEffect, useState } from "react";
import { Edit3, Filter, Plus, RotateCcw, Save, Search, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const API_BASE = "http://localhost:5000/api";
const currencyOptions = ["INR", "USD", "EUR", "GBP"];
const frequencies = ["MONTHLY", "QUARTERLY", "YEARLY"];
const EMPTY_PLAN = { name: "", billingFrequency: "MONTHLY", discountIncentive: 0, status: "ACTIVE" };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getAuditPointers(action, rawDetails) {
  if (!rawDetails) return ["System event completed"];
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

  // 1. Specialized contextual summaries
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
    return pointers.length > 0 ? pointers : ["Staff complaint submitted and verified"];
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

  if (action === "SUBSCRIPTION_PLAN_CREATED" || action === "SUBSCRIPTION_PLAN_UPDATED") {
    if (details.name) pointers.push(`Plan Name: ${details.name}`);
    if (details.status) pointers.push(`Status: ${details.status}`);
    if (details.billingFrequency) pointers.push(`Billing Cycle: ${details.billingFrequency}`);
    return pointers.length > 0 ? pointers : ["Subscription plan updated"];
  }

  if (action === "CUSTOMER_TIER_UPDATED") {
    if (details.name) pointers.push(`Tier Name: ${details.name}`);
    if (details.status) pointers.push(`Tier Status: ${details.status}`);
    return pointers.length > 0 ? pointers : ["Customer tier updated"];
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
    return [action.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())];
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

export default function AdminGovernance({ mode }) {
  const { token } = useAuth();
  const [records, setRecords] = useState([]);
  const [config, setConfig] = useState({ currency: "INR", invoicePrefix: "INV-", paymentTerms: "NET_30", taxEnabled: true, defaultTaxRate: 18, invoiceDuePeriod: 30 });
  const [plan, setPlan] = useState(EMPTY_PLAN);
  const [editingPlan, setEditingPlan] = useState(null);
  const [editingTier, setEditingTier] = useState(null);
  const [filters, setFilters] = useState({ search: "", action: "", from: "", to: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(apiError(data, "Request failed."));
    return data;
  }, [token]);

  const load = useCallback(async (activeFilters = filters) => {
    setLoading(true);
    setError("");
    try {
      if (mode === "audit") {
        const cleanParams = new URLSearchParams();
        if (activeFilters.search?.trim()) cleanParams.append("search", activeFilters.search.trim());
        if (activeFilters.action?.trim()) cleanParams.append("action", activeFilters.action.trim());
        if (activeFilters.from?.trim()) cleanParams.append("from", activeFilters.from.trim());
        if (activeFilters.to?.trim()) cleanParams.append("to", activeFilters.to.trim());
        const qs = cleanParams.toString();
        const res = await request(`/admin/audit-logs${qs ? `?${qs}` : ""}`);
        setRecords(res.data || []);
      }
      if (mode === "billing") {
        const data = (await request("/admin/billing-configuration")).data;
        if (data) setConfig(data);
      }
      if (mode === "plans") setRecords((await request("/admin/subscription-plans")).data || []);
      if (mode === "tiers") setRecords((await request("/admin/customer-tiers")).data || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [mode, request, filters]);

  useEffect(() => {
    const timer = window.setTimeout(() => load(filters), 0);
    return () => window.clearTimeout(timer);
  }, [mode]);

  const handleFilterSubmit = (e) => {
    if (e) e.preventDefault();
    load(filters);
  };

  const handleResetFilters = () => {
    const cleared = { search: "", action: "", from: "", to: "" };
    setFilters(cleared);
    load(cleared);
  };

  const handleActionChange = (e) => {
    const newAction = e.target.value;
    const updated = { ...filters, action: newAction };
    setFilters(updated);
    load(updated);
  };

  const saveBilling = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const data = await request("/admin/billing-configuration", { method: "PUT", body: JSON.stringify(config) });
      setConfig(data.data);
      setSuccess(data.message);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const savePlan = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const data = await request(`/admin/subscription-plans${editingPlan ? `/${editingPlan.id}` : ""}`, {
        method: editingPlan ? "PUT" : "POST",
        body: JSON.stringify({ ...plan, discountIncentive: Number(plan.discountIncentive) }),
      });
      setSuccess(data.message);
      setEditingPlan(null);
      setPlan(EMPTY_PLAN);
      await load(filters);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const saveTier = async (tier) => {
    setSaving(true);
    setError("");
    try {
      const data = await request(`/admin/customer-tiers/${tier.id}`, {
        method: "PUT",
        body: JSON.stringify({ description: tier.description, status: tier.status }),
      });
      setSuccess(data.message);
      setEditingTier(null);
      await load(filters);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const heading = {
    audit: ["Audit Logs", "Review real-time system actions, security logs, and changes."],
    billing: ["Billing Configuration", "Configure defaults used by the billing and invoice flow."],
    plans: ["Subscription Plans", "Manage plans used by recurring deals and billing."],
    tiers: ["Customer Tiers", "Manage the fixed customer tiers used by discount policies and risk rules."],
  }[mode];

  const hasActiveFilters = Boolean(filters.search || filters.action || filters.from || filters.to);

  return (
    <main className="main-content admin-page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Admin governance</p>
          <h1>{heading[0]}</h1>
          <p className="page-subtitle">{heading[1]}</p>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {mode === "audit" && (
        <section className="admin-panel governance-panel">
          <form className="governance-filters" onSubmit={handleFilterSubmit}>
            <div style={{ position: "relative", width: "100%" }}>
              <input
                className="form-input no-icon"
                placeholder="Search action, details, user..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
            <select
              className="form-select no-icon"
              value={filters.action}
              onChange={handleActionChange}
            >
              <option value="">All Actions</option>
              <option value="CREATED">Created (All Entities)</option>
              <option value="UPDATED">Updated (All Entities)</option>
              <option value="STATUS">Status / Activation</option>
              <option value="APPROVED">Approvals</option>
              <option value="REJECTED">Rejections</option>
              <option value="DISABLED">Deactivated / Disabled</option>
              <option value="USER">Staff & Users</option>
              <option value="PRODUCT">Products & Catalog</option>
              <option value="INVOICE">Invoices & Payments</option>
              <option value="WAREHOUSE">Warehouses</option>
              <option value="BILLING">Billing & Config</option>
              <option value="DISCOUNT">Discount Policies</option>
            </select>
            <input
              className="form-input no-icon"
              type="date"
              title="From Date"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            />
            <input
              className="form-input no-icon"
              type="date"
              title="To Date"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            />
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="submit" className="btn-primary" style={{ width: "auto", padding: "0.5rem 1.1rem", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                <Filter size={15} /> Filter
              </button>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleResetFilters}
                  style={{ width: "auto", padding: "0.5rem 0.85rem", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
                  title="Reset all filters"
                >
                  <RotateCcw size={14} /> Clear
                </button>
              )}
            </div>
          </form>

          <div className="governance-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>User</th>
                  <th>Activity</th>
                  <th>Action</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className="empty-state">Loading audit logs...</td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="empty-state">
                      {hasActiveFilters ? "No audit events match your filter criteria." : "No audit events found."}
                    </td>
                  </tr>
                ) : (
                  records.map((log) => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{new Date(log.createdAt).toLocaleString("en-IN")}</td>
                      <td>
                        <strong>{log.user?.name || "System"}</strong>
                        {log.user?.email && <small style={{ display: "block", color: "var(--text-muted)", fontSize: "0.75rem" }}>{log.user.email}</small>}
                      </td>
                      <td>{log.action.replaceAll("_", " ")}</td>
                      <td>
                        <span className={`badge ${log.action.includes("REJECT") || log.action.includes("DISABLE") ? "badge-rejected" : log.action.includes("UPDATE") ? "badge-pending" : "badge-active"}`}>
                          {log.action.split("_").pop()}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.825rem", color: "#334155", maxWidth: "460px", minWidth: "260px" }}>
                        <ul style={{ margin: 0, paddingLeft: "1.1rem", listStyleType: "disc", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                          {getAuditPointers(log.action, log.details).map((pointer, pIdx) => {
                            const colonIdx = pointer.indexOf(":");
                            if (colonIdx !== -1) {
                              const label = pointer.slice(0, colonIdx);
                              const val = pointer.slice(colonIdx + 1);
                              return (
                                <li key={pIdx} style={{ lineHeight: "1.4" }}>
                                  <strong style={{ color: "#1e293b", marginRight: "0.25rem" }}>{label}:</strong>
                                  <span style={{ color: "#475569" }}>{val}</span>
                                </li>
                              );
                            }
                            return (
                              <li key={pIdx} style={{ lineHeight: "1.4", color: "#475569" }}>
                                {pointer}
                              </li>
                            );
                          })}
                        </ul>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {mode === "billing" && (
        <form className="admin-panel governance-form" onSubmit={saveBilling}>
          <div className="form-row">
            <label className="form-group">
              <span className="form-label">Default Currency</span>
              <select className="form-select no-icon" value={config.currency} onChange={(e) => setConfig({ ...config, currency: e.target.value })}>
                {currencyOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">Invoice Prefix</span>
              <input className="form-input no-icon" value={config.invoicePrefix} onChange={(e) => setConfig({ ...config, invoicePrefix: e.target.value })} required />
            </label>
          </div>
          <div className="form-row">
            <label className="form-group">
              <span className="form-label">Payment Terms</span>
              <select className="form-select no-icon" value={config.paymentTerms} onChange={(e) => setConfig({ ...config, paymentTerms: e.target.value })}>
                {[["DUE_ON_RECEIPT", "Due on Receipt"], ["NET_15", "Net 15"], ["NET_30", "Net 30"], ["NET_45", "Net 45"], ["NET_60", "Net 60"]].map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">Invoice Due Period (days)</span>
              <input className="form-input no-icon" type="number" min="0" value={config.invoiceDuePeriod} onChange={(e) => setConfig({ ...config, invoiceDuePeriod: e.target.value })} required />
            </label>
          </div>
          <label className="governance-checkbox">
            <input type="checkbox" checked={config.taxEnabled} onChange={(e) => setConfig({ ...config, taxEnabled: e.target.checked })} /> Tax / GST enabled
          </label>
          {config.taxEnabled && (
            <label className="form-group">
              <span className="form-label">Default Tax Rate (%)</span>
              <input className="form-input no-icon" type="number" min="0" max="100" step="0.01" value={config.defaultTaxRate} onChange={(e) => setConfig({ ...config, defaultTaxRate: e.target.value })} required />
            </label>
          )}
          <button className="btn-primary" disabled={saving}>
            <Save size={16} /> Save Configuration
          </button>
        </form>
      )}

      {mode === "plans" && (
        <>
          <section className="admin-panel governance-form">
            <form onSubmit={savePlan}>
              <div className="form-row">
                <label className="form-group">
                  <span className="form-label">Plan Name</span>
                  <input className="form-input no-icon" value={plan.name} onChange={(e) => setPlan({ ...plan, name: e.target.value })} required />
                </label>
                <label className="form-group">
                  <span className="form-label">Billing Frequency</span>
                  <select className="form-select no-icon" value={plan.billingFrequency} onChange={(e) => setPlan({ ...plan, billingFrequency: e.target.value })}>
                    {frequencies.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label className="form-group">
                  <span className="form-label">Discount Incentive (%)</span>
                  <input className="form-input no-icon" type="number" min="0" max="100" value={plan.discountIncentive} onChange={(e) => setPlan({ ...plan, discountIncentive: e.target.value })} required />
                </label>
                <label className="form-group">
                  <span className="form-label">Status</span>
                  <select className="form-select no-icon" value={plan.status} onChange={(e) => setPlan({ ...plan, status: e.target.value })}>
                    <option>ACTIVE</option>
                    <option>INACTIVE</option>
                  </select>
                </label>
              </div>
              <div className="form-actions">
                {editingPlan && (
                  <button type="button" className="btn-secondary" onClick={() => { setEditingPlan(null); setPlan(EMPTY_PLAN); }}>
                    <X size={15} /> Cancel
                  </button>
                )}
                <button className="btn-primary">
                  <Plus size={16} /> {editingPlan ? "Save changes" : "Add Subscription Plan"}
                </button>
              </div>
            </form>
          </section>
          <section className="admin-panel governance-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Frequency</th>
                  <th>Discount</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {records.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.billingFrequency}</td>
                    <td>{item.discountIncentive}%</td>
                    <td>{item.status}</td>
                    <td>
                      <button className="icon-button" onClick={() => { setEditingPlan(item); setPlan(item); }}>
                        <Edit3 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {mode === "tiers" && (
        <section className="admin-panel governance-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tier</th>
                <th>Description</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {records.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.name}</strong></td>
                  <td>
                    {editingTier?.id === item.id ? (
                      <input className="form-input no-icon" value={editingTier.description || ""} onChange={(e) => setEditingTier({ ...editingTier, description: e.target.value })} />
                    ) : (
                      item.description || "-"
                    )}
                  </td>
                  <td>
                    {editingTier?.id === item.id ? (
                      <select className="form-select no-icon" value={editingTier.status} onChange={(e) => setEditingTier({ ...editingTier, status: e.target.value })}>
                        <option>ACTIVE</option>
                        <option>INACTIVE</option>
                      </select>
                    ) : (
                      item.status
                    )}
                  </td>
                  <td>
                    {editingTier?.id === item.id ? (
                      <button className="btn-primary" onClick={() => saveTier(editingTier)} disabled={saving}>Save</button>
                    ) : (
                      <button className="icon-button" onClick={() => setEditingTier(item)}>
                        <Edit3 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
