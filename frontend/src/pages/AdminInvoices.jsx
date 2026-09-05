import { useEffect, useState } from "react";
import { FileText, X, DollarSign, CheckCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const API_BASE = "http://localhost:5000/api";

export default function AdminInvoices() {
  const { token } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [success, setSuccess] = useState("");

  const loadInvoices = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/invoices`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load invoices.");
      setInvoices(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [token]);

  const fetchInvoiceDetails = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/invoices/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setSelectedInvoice(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    setPaymentSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_BASE}/invoices/${selectedInvoice.id}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: Number(paymentAmount),
          paymentMethod,
          reference: paymentRef,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to record payment.");

      setSuccess("Payment recorded successfully.");
      setPaymentAmount("");
      setPaymentRef("");
      
      // Reload everything
      await fetchInvoiceDetails(selectedInvoice.id);
      await loadInvoices();
    } catch (err) {
      setError(err.message);
    } finally {
      setPaymentSaving(false);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString();

  return (
    <main className="main-content admin-page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Finance & Billing</p>
          <h1>Invoices & Payments</h1>
          <p className="page-subtitle">Manage generated invoices and record manual payments against them.</p>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="admin-panel" style={{ marginTop: '1rem' }}>
        <div className="panel-heading">
          <div className="panel-icon"><FileText size={18} /></div>
          <h2>Invoice Records</h2>
        </div>
        
        <div className="staff-table-wrap">
          <table className="data-table staff-table">
            <thead>
              <tr>
                <th>Invoice No.</th>
                <th>Customer</th>
                <th>Order</th>
                <th>Total</th>
                <th>Amount Paid</th>
                <th>Due Date</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" className="empty-state">Loading invoices...</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan="8" className="empty-state">No invoices generated yet.</td></tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td><strong>{inv.invoice_number}</strong></td>
                    <td>{inv.customer_name}</td>
                    <td><code>{inv.order_number}</code></td>
                    <td>{formatCurrency(inv.total)}</td>
                    <td>{formatCurrency(inv.amount_paid)}</td>
                    <td>{formatDate(inv.due_date)}</td>
                    <td>
                      <span className={`badge ${inv.status === 'PAID' ? 'badge-active' : inv.status === 'OVERDUE' ? 'badge-suspended' : 'badge-pending'}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td>
                      <button className="btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }} onClick={() => fetchInvoiceDetails(inv.id)}>
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedInvoice && (
        <div style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Invoice {selectedInvoice.invoice_number}</h2>
            <button className="icon-button" onClick={() => setSelectedInvoice(null)}><X size={20} /></button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            {/* Invoice Details */}
            <div>
              <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Details</h3>
              <p><strong>Customer:</strong> {selectedInvoice.customer_name} ({selectedInvoice.customer_email})</p>
              <p><strong>Order Ref:</strong> {selectedInvoice.order_number}</p>
              <p><strong>Status:</strong> {selectedInvoice.status}</p>
              <p><strong>Subtotal:</strong> {formatCurrency(selectedInvoice.subtotal)}</p>
              <p><strong>Tax:</strong> {formatCurrency(selectedInvoice.tax)}</p>
              <p><strong>Discount:</strong> {formatCurrency(selectedInvoice.discount)}</p>
              <p><strong>Total:</strong> {formatCurrency(selectedInvoice.total)}</p>
              <p><strong>Amount Paid:</strong> {formatCurrency(selectedInvoice.amount_paid)}</p>
              <p><strong>Remaining:</strong> {formatCurrency(Number(selectedInvoice.total) - Number(selectedInvoice.amount_paid))}</p>
              
              <h3 style={{ fontSize: '1rem', marginTop: '1.5rem', marginBottom: '1rem' }}>Payment History</h3>
              {selectedInvoice.payments && selectedInvoice.payments.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {selectedInvoice.payments.map(p => (
                    <li key={p.id} style={{ fontSize: '0.875rem', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
                      <CheckCircle size={14} color="#10b981" style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                      {formatCurrency(p.amount)} via {p.payment_method} on {formatDate(p.payment_date)}
                      {p.reference && <span> (Ref: {p.reference})</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ fontSize: '0.875rem', color: '#64748b' }}>No payments recorded yet.</p>
              )}
            </div>

            {/* Payment Form */}
            <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '0.5rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <DollarSign size={16} /> Record Payment
              </h3>
              
              {selectedInvoice.status === 'PAID' ? (
                <div className="alert alert-success">This invoice is fully paid.</div>
              ) : (
                <form onSubmit={handleRecordPayment}>
                  <div className="form-group">
                    <label className="form-label">Amount (INR)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      max={Number(selectedInvoice.total) - Number(selectedInvoice.amount_paid)}
                      value={paymentAmount}
                      onChange={e => setPaymentAmount(e.target.value)}
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Method</label>
                    <select className="form-select" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cash">Cash</option>
                      <option value="Cheque">Cheque</option>
                      <option value="UPI">UPI</option>
                      <option value="Card">Card</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Reference ID (Optional)</label>
                    <input type="text" className="form-input" value={paymentRef} onChange={e => setPaymentRef(e.target.value)} />
                  </div>
                  <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={paymentSaving}>
                    {paymentSaving ? "Recording..." : "Submit Payment"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
