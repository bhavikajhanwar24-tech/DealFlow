import { useEffect, useState } from "react";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const API_BASE = "http://localhost:5000/api";
const currency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function QuotationDetail({ quotationId, onNavigate }) {
  const { token } = useAuth();
  const [quotation, setQuotation] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadQuotation() {
      try {
        const response = await fetch(`${API_BASE}/quotations/${quotationId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.message || "Unable to load quotation.");
        setQuotation(data.data);
      } catch (loadError) {
        setError(loadError.message);
      }
    }
    loadQuotation();
  }, [quotationId, token]);

  if (error)
    return (
      <main className="main-content">
        <div className="alert alert-danger">
          <AlertTriangle size={17} /> {error}
        </div>
        <button
          className="btn-secondary"
          onClick={() => onNavigate("/sales/quotations")}
        >
          <ArrowLeft size={16} /> Back to Quotations
        </button>
      </main>
    );
  if (!quotation)
    return (
      <main className="main-content">
        <div style={{ color: "#64748b" }}>Loading quotation...</div>
      </main>
    );

  return (
    <main className="main-content">
      <button
        className="btn-secondary"
        onClick={() => onNavigate("/sales/quotations")}
      >
        <ArrowLeft size={16} /> Back to Quotations
      </button>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1rem",
          flexWrap: "wrap",
          margin: "1.25rem 0 1.5rem",
        }}
      >
        <div>
          <div
            style={{
              color: "#2563eb",
              fontSize: "0.75rem",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Quotation Detail
          </div>
          <h1
            style={{
              fontSize: "1.9rem",
              fontWeight: 800,
              color: "#0f172a",
              marginTop: "0.35rem",
            }}
          >
            {quotation.quotationNumber}
          </h1>
          <p style={{ color: "#64748b", marginTop: "0.4rem" }}>
            Created {new Date(quotation.createdAt).toLocaleString("en-IN")}
          </p>
        </div>
        <span className="badge badge-active">{quotation.status}</span>
      </div>
      <section
        style={{
          background: "#fff",
          border: "1px solid var(--border-light)",
          borderRadius: "16px",
          padding: "1.5rem",
          boxShadow: "var(--shadow-sm)",
          marginBottom: "1.25rem",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: "1rem",
        }}
      >
        <div>
          <strong>Customer</strong>
          <br />
          {quotation.customer?.companyName || quotation.customer?.fullName}
        </div>
        <div>
          <strong>Customer ID</strong>
          <br />
          {quotation.customer?.customerCode}
        </div>
        <div>
          <strong>Email</strong>
          <br />
          {quotation.customer?.email}
        </div>
        <div>
          <strong>Sales Rep</strong>
          <br />
          {quotation.salesRep?.fullName}
        </div>
      </section>
      {quotation.customerRequest && (
        <div
          className="alert alert-warning"
          style={{ marginBottom: "1.25rem" }}
        >
          Customer response: {quotation.customerRequest.status}
          {quotation.customerRequest.requestedDiscountPercent !== null &&
            ` · Requested discount: ${quotation.customerRequest.requestedDiscountPercent}%`}
          {quotation.customerRequest.requestedDeliveryDate &&
            ` · Requested delivery: ${quotation.customerRequest.requestedDeliveryDate}`}
          {quotation.customerRequest.customerComment &&
            ` · ${quotation.customerRequest.customerComment}`}
        </div>
      )}
      <div className="data-table-card">
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Discount</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {quotation.items.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 700 }}>{item.name}</td>
                  <td>{item.category}</td>
                  <td>{item.quantity}</td>
                  <td>{currency(item.unitPrice)}</td>
                  <td>{item.discountPercent}%</td>
                  <td style={{ fontWeight: 800 }}>
                    {currency(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: "1.25rem",
        }}
      >
        <div
          className="pricing-margin-card"
          style={{
            minWidth: "280px",
            background: "#fff",
            border: "1px solid var(--border-light)",
            borderRadius: "16px",
            padding: "1.25rem",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <h2 className="pricing-margin-heading">Pricing &amp; Margin</h2>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              color: "#64748b",
              marginBottom: "0.65rem",
            }}
          >
            <span>Subtotal</span>
            <strong>{currency(quotation.subtotal)}</strong>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              color: "#ef4444",
              marginBottom: "0.65rem",
            }}
          >
            <span>Discount Total</span>
            <strong>-{currency(quotation.discountAmount)}</strong>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              color: "#0f172a",
              fontSize: "1.15rem",
              fontWeight: 800,
              borderTop: "1px solid #e2e8f0",
              paddingTop: "0.75rem",
            }}
          >
            <span>Final Price</span>
            <strong>{currency(quotation.finalAmount)}</strong>
          </div>
          <div className="margin-summary-row"><span>Total Product Cost</span><strong>{currency(quotation.totalCost)}</strong></div>
          <div className="margin-summary-row"><span>Gross Margin</span><strong>{currency(quotation.grossMargin)}</strong></div>
          <div className="margin-summary-row"><span>Margin %</span><strong>{Number(quotation.marginPercentage || 0).toFixed(2)}%</strong></div>
        </div>
      </div>
    </main>
  );
}
