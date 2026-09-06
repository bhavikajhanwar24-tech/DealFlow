import { useEffect, useState } from "react";
import { Sparkles, Tag, Plus, Check, AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";

const API_BASE = "http://localhost:5000/api";
const currency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CustomerRequestAiRecommendations({
  request,
  token,
  onApproveWithItem,
  onNavigate,
  onQuotationUpdated,
}) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [addedItemIds, setAddedItemIds] = useState(() => new Set());
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const requestItems = (request?.items || []).map((i) => ({
      productId: i.productId || i.id,
      quantity: Number(i.quantity || 1),
      unitPrice: Number(i.unitPrice || 0),
      name: i.name,
      category: i.category,
    }));

    if (!requestItems.length) {
      setRecommendations([]);
      return;
    }

    setLoading(true);
    setError("");

    fetch(`${API_BASE}/recommendations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        items: requestItems,
        customerId: request.customer_id || request.customerId,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          if (data.success && Array.isArray(data.data)) {
            setRecommendations(data.data);
          } else {
            setRecommendations([]);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Unable to load AI recommendations.");
          setRecommendations([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [request, token]);

  const handleAddRecommendation = async (recItem) => {
    const pId = recItem.productId || recItem.id;
    setActionLoading(pId);
    setError("");
    setSuccessMessage("");

    try {
      const quotationId = request.quotation_id || request.quotationId;

      if (quotationId) {
        // Direct addition to existing / auto-approved quotation
        const res = await fetch(`${API_BASE}/quotations/${quotationId}/add-item`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            productId: pId,
            quantity: 1,
            discountPercent: 0,
            unitPrice: recItem.unitPrice,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "Failed to add item to quotation.");
        }

        setAddedItemIds((prev) => new Set([...prev, pId]));
        setSuccessMessage(`✓ Added "${recItem.name}" to Quotation ${request.quotation_number || ""}!`);
        if (onQuotationUpdated) onQuotationUpdated(data.data);
      } else if (onApproveWithItem) {
        // Converting pending request with the recommended item
        await onApproveWithItem(request.id, recItem);
        setAddedItemIds((prev) => new Set([...prev, pId]));
        setSuccessMessage(`✓ Created Quotation with "${recItem.name}" included!`);
      }
    } catch (err) {
      setError(err.message || "Could not add recommended item.");
    } finally {
      setActionLoading(null);
    }
  };

  const isPending = request.status === "PENDING";
  const hasQuotation = Boolean(request.quotation_id || request.quotationId);

  return (
    <div
      style={{
        background: "linear-gradient(180deg, #f5f3ff 0%, #ffffff 100%)",
        border: "1px solid #ddd6fe",
        borderRadius: "12px",
        padding: "1.25rem",
        marginTop: "0.75rem",
        boxShadow: "0 4px 12px -2px rgba(124, 58, 237, 0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
          marginBottom: "1rem",
          paddingBottom: "0.75rem",
          borderBottom: "1px solid #e9d5ff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "8px",
              background: "#7c3aed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
            }}
          >
            <Sparkles size={16} />
          </div>
          <div>
            <strong style={{ fontSize: "0.95rem", color: "#581c87" }}>
              AI Recommendations & Cross-Sell Opportunities
            </strong>
            <span style={{ fontSize: "0.75rem", color: "#7c3aed", marginLeft: "0.5rem", fontWeight: 600 }}>
              1-Click Add to {hasQuotation ? `Quote ${request.quotation_number || ""}` : "Deal"}
            </span>
          </div>
        </div>

        {/* Status Indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {hasQuotation && (
            <span
              style={{
                fontSize: "0.75rem",
                background: "#ecfdf5",
                color: "#047857",
                border: "1px solid #a7f3d0",
                padding: "0.2rem 0.6rem",
                borderRadius: "9999px",
                fontWeight: 700,
              }}
            >
              Deal: {request.quotation_number || "Active"}
            </span>
          )}
          {isPending && (
            <span
              style={{
                fontSize: "0.75rem",
                background: "#fef3c7",
                color: "#b45309",
                border: "1px solid #fde68a",
                padding: "0.2rem 0.6rem",
                borderRadius: "9999px",
                fontWeight: 700,
              }}
            >
              ⏳ Pending Staff Review
            </span>
          )}
          {hasQuotation && onNavigate && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onNavigate(`/sales/quotations/${request.quotation_id || request.quotationId}`)}
              style={{
                fontSize: "0.75rem",
                padding: "0.25rem 0.55rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              Open Quote <ArrowRight size={12} />
            </button>
          )}
        </div>
      </div>

      {successMessage && (
        <div
          style={{
            padding: "0.6rem 0.85rem",
            marginBottom: "0.85rem",
            background: "#ecfdf5",
            color: "#047857",
            border: "1px solid #a7f3d0",
            borderRadius: "8px",
            fontSize: "0.825rem",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={16} /> {successMessage}
        </div>
      )}

      {loading && (
        <div style={{ padding: "1.5rem", textAlign: "center", color: "#7c3aed", fontSize: "0.85rem" }}>
          <Sparkles size={18} style={{ animation: "spin 1.5s linear infinite", display: "inline-block", marginRight: "0.4rem" }} />
          AI Engine is analyzing catalog pairings & customer purchase profile...
        </div>
      )}

      {error && (
        <div style={{ padding: "0.75rem", marginBottom: "0.85rem", background: "#fef2f2", color: "#b91c1c", borderRadius: "8px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {!loading && !error && recommendations.length === 0 && (
        <div style={{ padding: "1rem", textAlign: "center", color: "#64748b", fontSize: "0.825rem", background: "#ffffff", borderRadius: "8px", border: "1px dashed #cbd5e1" }}>
          No additional add-on recommendations found for the requested catalog items.
        </div>
      )}

      {!loading && recommendations.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "0.85rem",
          }}
        >
          {recommendations.map((rec) => {
            const recId = rec.productId || rec.id;
            const isAdded = addedItemIds.has(recId);
            const isRecLoading = actionLoading === recId;

            return (
              <div
                key={recId}
                style={{
                  background: "#ffffff",
                  border: isAdded ? "1.5px solid #10b981" : "1px solid #e2e8f0",
                  borderRadius: "10px",
                  padding: "0.9rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.03)",
                  transition: "all 0.2s ease",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.4rem" }}>
                    <strong style={{ fontSize: "0.9rem", color: "#0f172a" }}>{rec.name}</strong>
                    <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#7c3aed" }}>
                      {currency(rec.unitPrice)}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        padding: "0.15rem 0.45rem",
                        borderRadius: "4px",
                        background: rec.type === "upsell" ? "#ecfdf5" : "#eff6ff",
                        color: rec.type === "upsell" ? "#047857" : "#1d4ed8",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.25rem",
                      }}
                    >
                      <Tag size={11} /> {rec.type === "upsell" ? "Upsell" : "Cross-sell"}
                    </span>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        padding: "0.15rem 0.45rem",
                        borderRadius: "4px",
                        background: "#f1f5f9",
                        color: "#475569",
                        fontWeight: 600,
                      }}
                    >
                      {rec.category || "Add-on"}
                    </span>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        padding: "0.15rem 0.45rem",
                        borderRadius: "4px",
                        background: "#f5f3ff",
                        color: "#7c3aed",
                        fontWeight: 700,
                      }}
                    >
                      Fit: {Math.round(Number(rec.score || 0.85) * 100)}%
                    </span>
                  </div>

                  {rec.marginDelta !== undefined && (
                    <div style={{ fontSize: "0.75rem", color: "#475569", marginBottom: "0.45rem" }}>
                      Margin impact:{" "}
                      <strong style={{ color: Number(rec.marginDelta || 0) >= 0 ? "#16a34a" : "#dc2626" }}>
                        {Number(rec.marginDelta || 0) >= 0 ? "+" : ""}
                        {currency(rec.marginDelta)}
                      </strong>
                    </div>
                  )}

                  <p style={{ fontSize: "0.78rem", color: "#64748b", margin: "0 0 0.75rem", lineHeight: "1.4" }}>
                    {rec.reason || rec.llmExplanation || "Recommended compliment for the requested products."}
                  </p>
                </div>

                {/* Card Action - Simple 1-Click Button */}
                <div style={{ paddingTop: "0.6rem", borderTop: "1px solid #f1f5f9" }}>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={isAdded || isRecLoading}
                    onClick={() => handleAddRecommendation(rec)}
                    style={{
                      width: "100%",
                      fontSize: "0.78rem",
                      padding: "0.45rem 0.75rem",
                      background: isAdded
                        ? "#10b981"
                        : "linear-gradient(135deg, #7c3aed, #6d28d9)",
                      borderColor: isAdded ? "#10b981" : "#7c3aed",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.35rem",
                      cursor: isAdded ? "default" : "pointer",
                    }}
                  >
                    {isAdded ? (
                      <>
                        <Check size={14} /> Added to Quotation
                      </>
                    ) : isRecLoading ? (
                      "Adding..."
                    ) : (
                      <>
                        <Plus size={14} /> {hasQuotation ? "Add to Quotation" : "Approve & Add to Quote"}
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

