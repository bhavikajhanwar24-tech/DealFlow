import { useEffect, useState } from "react";
import { ArrowLeft, AlertTriangle, CheckCircle2, Mail, Printer, Download } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { printOrExportPDF } from "../utils/exportUtils";

const API_BASE = "http://localhost:5000/api";
const currency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function QuotationDetail({ quotationId, onNavigate }) {
  const { token } = useAuth();
  const [quotation, setQuotation] = useState(null);
  const [error, setError] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [notification, setNotification] = useState(null);
  const [pricingAiLoading, setPricingAiLoading] = useState(false);
  const [pricingAiResult, setPricingAiResult] = useState(null);

  const handleRecommendPricing = async () => {
    setPricingAiLoading(true);
    setPricingAiResult(null);
    try {
      const response = await fetch(`${API_BASE}/ai/pricing-recommendation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productCosts: quotation.items.map(i => ({ name: i.name, category: i.category, unitPrice: i.unitPrice })),
          currentMargin: quotation.marginPercentage,
          tierMaxDiscount: quotation.customer?.tierMaxDiscount || 15
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to fetch AI pricing");
      setPricingAiResult(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setPricingAiLoading(false);
    }
  };

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

  async function handleFinalizeQuotation() {
    setFinalizing(true);
    setError("");
    setNotification(null);
    try {
      const response = await fetch(`${API_BASE}/quotations/${quotationId}/finalize`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to finalize quotation.");

      setQuotation(data.data);
      setNotification({
        title: "Quotation Finalized",
        quotationNumber: data.data.quotationNumber,
        emailSent: Boolean(data.notification?.emailSent),
        email: data.notification?.email || data.data.customer?.email || data.data.salesRep?.email,
        error: data.notification?.error,
      });
    } catch (finalizeErr) {
      setError(finalizeErr.message);
    } finally {
      setFinalizing(false);
    }
  }

  const handlePrintQuotation = () => {
    if (!quotation) return;

    const itemsData = (quotation.items || []).map((item) => ({
      product: item.product?.name || item.name || "Item",
      category: item.product?.category || "Standard",
      qty: item.quantity,
      unitPrice: currency(item.unitPrice),
      discount: `${item.discountPercent || 0}%`,
      total: currency(item.totalPrice),
    }));

    const headers = [
      { key: "product", label: "Product / Line Item" },
      { key: "category", label: "Category" },
      { key: "qty", label: "Qty" },
      { key: "unitPrice", label: "Unit Price" },
      { key: "discount", label: "Discount" },
      { key: "total", label: "Line Total" },
    ];

    const summaryCards = [
      { label: "Subtotal", value: currency(quotation.subtotal), color: "#0f172a" },
      { label: "Total Discount", value: currency(quotation.discountAmount), color: "#b91c1c" },
      { label: "Final Amount", value: currency(quotation.finalAmount), color: "#1e40af" },
      { label: "Deal Margin", value: `${quotation.marginPercent || 25}%`, color: "#166534" },
    ];

    const metadata = [
      { label: "Quotation Ref", value: quotation.quotationNumber },
      { label: "Customer", value: quotation.customer?.companyName || quotation.customer?.fullName || "Client" },
      { label: "Sales Representative", value: quotation.salesRep?.fullName || "Representative" },
      { label: "Status", value: quotation.status },
    ];

    printOrExportPDF({
      title: `Commercial Quotation: ${quotation.quotationNumber}`,
      subtitle: `Official quotation proposal issued for ${quotation.customer?.companyName || quotation.customer?.fullName}.`,
      metadata,
      headers,
      rows: itemsData,
      summaryCards,
    });
  };

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
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handlePrintQuotation}
            style={{ padding: "0.5rem 0.95rem", fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
          >
            <Printer size={16} color="#2563eb" /> Print / Save PDF Proposal
          </button>
          <span className={`badge ${quotation.status === "FINALIZED" ? "badge-active" : quotation.status === "REJECTED" ? "badge-rejected" : "badge-pending"}`}>
            {quotation.status}
          </span>
          {quotation.status !== "FINALIZED" && (
            <button
              className="btn-success"
              onClick={handleFinalizeQuotation}
              disabled={finalizing}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
            >
              {finalizing ? (
                "Finalizing..."
              ) : (
                <>
                  <CheckCircle2 size={16} /> Finalize Quotation
                </>
              )}
            </button>
          )}
          {quotation.status !== "FINALIZED" && (
            <button
              className="btn-secondary"
              onClick={handleRecommendPricing}
              disabled={pricingAiLoading}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
            >
              {pricingAiLoading ? "Analyzing Pricing..." : "✨ AI Pricing Suggestion"}
            </button>
          )}
        </div>
      </div>

      {pricingAiResult && (
        <div style={{
          margin: '0 0 1.5rem',
          padding: '1.25rem',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%)',
          border: '1px solid #f5d0fe',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#86198f', margin: 0 }}>
              AI Pricing Strategy
            </h3>
            <button 
              onClick={() => setPricingAiResult(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c026d3' }}
            >
              ✕
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ padding: '0.5rem 1rem', background: '#fdf4ff', border: '2px solid #d946ef', borderRadius: '8px', color: '#a21caf', fontWeight: 800, fontSize: '1.25rem' }}>
              Recommend: {pricingAiResult.recommendedDiscount}% Discount
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#701a75', lineHeight: '1.5' }}>
            <strong>Reasoning:</strong> {pricingAiResult.reasoning}
          </p>
        </div>
      )}

      {notification && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "14px",
            padding: "1.25rem 1.5rem",
            marginBottom: "1.5rem",
            boxShadow: "0 4px 12px rgba(16, 185, 129, 0.1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#15803d", fontWeight: 800, fontSize: "1.05rem" }}>
            <CheckCircle2 size={20} color="#16a34a" /> ✓ Quotation Finalized
          </div>
          <div style={{ color: "#166534", marginTop: "0.35rem", fontWeight: 700, fontSize: "0.95rem" }}>
            {notification.quotationNumber} has been finalized successfully.
          </div>

          {notification.emailSent ? (
            <div
              style={{
                marginTop: "0.75rem",
                padding: "0.6rem 0.85rem",
                background: "#ffffff",
                border: "1px solid #86efac",
                borderRadius: "8px",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                color: "#14532d",
                fontSize: "0.875rem",
                fontWeight: 600,
              }}
            >
              <Mail size={16} color="#16a34a" />
              <span>Confirmation email sent to:</span>
              <strong style={{ color: "#15803d", textDecoration: "underline" }}>
                {notification.email}
              </strong>
            </div>
          ) : (
            <div
              style={{
                marginTop: "0.75rem",
                padding: "0.6rem 0.85rem",
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: "8px",
                color: "#92400e",
                fontSize: "0.85rem",
              }}
            >
              ⚠️ Status updated to FINALIZED in database.
            </div>
          )}

          <div style={{ marginTop: "0.85rem", paddingTop: "0.85rem", borderTop: "1px dashed #bbf7d0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.875rem", color: "#166534", fontWeight: 700 }}>
              🚚 Order created in fulfillment queue. Customer has been prompted to submit delivery address.
            </span>
            <button
              className="btn-primary"
              onClick={() => onNavigate("/operations/dashboard")}
              style={{ fontSize: "0.85rem", padding: "0.45rem 0.95rem", width: "auto" }}
            >
              Open Operations Route Optimizer →
            </button>
          </div>
        </div>
      )}
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
      {quotation.risk && (
        <section
          style={{
            marginTop: "1.25rem",
            background: "#fff",
            border: "1px solid var(--border-light)",
            borderRadius: "16px",
            padding: "1.5rem",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "flex-start" }}>
            <div>
              <div style={{ color: "#2563eb", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>Risk engine analysis</div>
              <h2 style={{ fontSize: "1.2rem", marginTop: "0.35rem" }}>Submission governance</h2>
            </div>
            <span className={`badge ${quotation.risk.level === "CRITICAL" || quotation.risk.level === "HIGH" ? "badge-rejected" : quotation.risk.level === "MEDIUM" ? "badge-pending" : "badge-active"}`}>
              {quotation.risk.level} · {quotation.risk.score.toFixed(1)}/100
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.85rem", marginTop: "1.25rem" }}>
            <div><strong>Approval route</strong><br />{quotation.risk.approvalRoute}</div>
            <div><strong>Analyzed at</strong><br />{new Date(quotation.risk.analyzedAt).toLocaleString("en-IN")}</div>
          </div>
          <div style={{ marginTop: "1.25rem" }}>
            <strong>Risk factors</strong>
            <div style={{ display: "grid", gap: "0.65rem", marginTop: "0.65rem" }}>
              {quotation.risk.factors.map((factor) => (
                <div key={factor.name} style={{ display: "grid", gridTemplateColumns: "minmax(150px, 0.7fr) minmax(0, 1.5fr) auto", gap: "0.75rem", alignItems: "center", padding: "0.75rem", borderRadius: "8px", background: "#f8fafc" }}>
                  <strong>{factor.name.replaceAll("_", " ")}</strong>
                  <span style={{ color: "#64748b", fontSize: "0.85rem" }}>{factor.reason}</span>
                  <span style={{ fontWeight: 800, color: "#2563eb" }}>+{Number(factor.contribution).toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
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
            display: "flex",
            alignItems: "center",
            gap: "1.25rem",
            flexWrap: "wrap",
            background: "#fff",
            border: "1px solid var(--border-light)",
            borderRadius: "14px",
            padding: "0.85rem 1.25rem",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ color: "#64748b", fontSize: "0.85rem", fontWeight: 500 }}>Subtotal:</span>
            <strong style={{ color: "#0f172a", fontSize: "0.95rem" }}>{currency(quotation.subtotal)}</strong>
          </div>

          <span style={{ color: "#cbd5e1" }}>•</span>

          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ color: "#64748b", fontSize: "0.85rem", fontWeight: 500 }}>Discount:</span>
            <strong style={{ color: "#ef4444", fontSize: "0.95rem" }}>-{currency(quotation.discountAmount)}</strong>
          </div>

          <span style={{ color: "#cbd5e1" }}>•</span>

          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ color: "#64748b", fontSize: "0.85rem", fontWeight: 500 }}>Final Price:</span>
            <strong style={{ color: "#2563eb", fontSize: "1.15rem", fontWeight: 800 }}>{currency(quotation.finalAmount)}</strong>
          </div>
          <div className="margin-summary-row"><span>Total Product Cost</span><strong>{currency(quotation.totalCost)}</strong></div>
          <div className="margin-summary-row"><span>Gross Margin</span><strong>{currency(quotation.grossMargin)}</strong></div>
          <div className="margin-summary-row"><span>Margin %</span><strong>{Number(quotation.marginPercentage || 0).toFixed(2)}%</strong></div>
        </div>
      </div>
    </main>
  );
}
