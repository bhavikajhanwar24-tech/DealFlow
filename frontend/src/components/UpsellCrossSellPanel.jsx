import { useEffect, useState, useMemo } from "react";
import {
  Sparkles,
  Plus,
  X,
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
  Tag,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
} from "lucide-react";

const API_BASE = "http://localhost:5000/api";

const currency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function UpsellCrossSellPanel({ items, customerId, onAddItem, token }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [addingId, setAddingId] = useState(null);
  const [toastMessage, setToastMessage] = useState("");

  // Initialize dismissed from sessionStorage for session-level persistence
  const [dismissed, setDismissed] = useState(() => {
    try {
      const saved = sessionStorage.getItem("dealflow_dismissed_recommendations");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Sync dismissed set to sessionStorage
  const saveDismissed = (newDismissedSet) => {
    setDismissed(newDismissedSet);
    try {
      sessionStorage.setItem(
        "dealflow_dismissed_recommendations",
        JSON.stringify(Array.from(newDismissedSet))
      );
    } catch {
      // Ignore storage errors
    }
  };

  useEffect(() => {
    let isCancelled = false;

    async function loadRecommendations() {
      if (!items || items.length === 0) {
        setRecommendations([]);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE}/recommendations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            items,
            customerId: customerId || undefined,
            dismissedProductIds: Array.from(dismissed),
          }),
        });

        const data = await response.json();

        if (isCancelled) return;

        if (!response.ok) {
          throw new Error(data.message || "Recommendations are temporarily unavailable.");
        }

        setRecommendations(data.data || []);
      } catch (loadError) {
        if (!isCancelled) {
          console.warn("[UpsellCrossSellPanel]", loadError.message);
          setError("Recommendations are temporarily unavailable.");
          setRecommendations([]);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    const timer = setTimeout(() => {
      loadRecommendations();
    }, 200);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [items, customerId, token]);

  const visibleRecommendations = useMemo(() => {
    return recommendations.filter((rec) => !dismissed.has(rec.id) && !dismissed.has(rec.productId));
  }, [recommendations, dismissed]);

  // Handle Add to Quote safely with double-click guard
  function handleAddItem(recommendation) {
    if (addingId === recommendation.id) return;
    setAddingId(recommendation.id);

    try {
      onAddItem(recommendation);

      // Flash temporary success message
      setToastMessage(`Added "${recommendation.name}" to quotation`);
      setTimeout(() => setToastMessage(""), 3000);

      // Automatically dismiss added item so it doesn't clutter suggestions
      const updated = new Set(dismissed);
      updated.add(recommendation.id);
      if (recommendation.productId) updated.add(recommendation.productId);
      saveDismissed(updated);
    } finally {
      setTimeout(() => setAddingId(null), 400);
    }
  }

  // Handle Dismiss for session
  function handleDismiss(id) {
    const updated = new Set(dismissed);
    updated.add(id);
    saveDismissed(updated);
  }

  // State 1: No items in quotation yet
  if (!items || items.length === 0) {
    return (
      <div
        style={{
          background: "#ffffff",
          border: "1px dashed #cbd5e1",
          borderRadius: "16px",
          padding: "2rem 1.5rem",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.75rem",
          color: "#64748b",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            background: "#eff6ff",
            color: "#2563eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Sparkles size={22} />
        </div>
        <div>
          <h4 style={{ margin: "0 0 0.25rem", color: "#0f172a", fontSize: "0.95rem", fontWeight: 700 }}>
            AI Deal Recommendations
          </h4>
          <p style={{ margin: 0, fontSize: "0.825rem", color: "#64748b", maxWidth: "260px" }}>
            Add items to your quotation above to unlock smart upsell and cross-sell opportunities.
          </p>
        </div>
      </div>
    );
  }

  return (
    <aside
      aria-label="AI Product Recommendations"
      style={{
        background: "#ffffff",
        border: "1px solid var(--border-light, #e2e8f0)",
        borderRadius: "16px",
        overflow: "hidden",
        boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Panel Header */}
      <div
        style={{
          padding: "1rem 1.25rem",
          borderBottom: "1px solid #e2e8f0",
          background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 4px rgba(37, 99, 235, 0.25)",
            }}
          >
            <Sparkles size={16} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.01em" }}>
              Smart Recommendations
            </h3>
            <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 500 }}>
              AI Margin & Affinity Engine
            </span>
          </div>
        </div>

        {visibleRecommendations.length > 0 && !loading && (
          <span
            style={{
              fontSize: "0.75rem",
              background: "#eff6ff",
              color: "#1d4ed8",
              fontWeight: 700,
              padding: "0.2rem 0.6rem",
              borderRadius: "9999px",
              border: "1px solid #bfdbfe",
            }}
          >
            {visibleRecommendations.length} available
          </span>
        )}
      </div>

      {/* Optional Notification Toast */}
      {toastMessage && (
        <div
          style={{
            padding: "0.55rem 1rem",
            background: "#ecfdf5",
            borderBottom: "1px solid #a7f3d0",
            color: "#065f46",
            fontSize: "0.78rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            animation: "fadeIn 0.2s ease-in-out",
          }}
        >
          <CheckCircle2 size={14} color="#10b981" />
          {toastMessage}
        </div>
      )}

      {/* Panel Body */}
      <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
        {/* Non-blocking Error banner */}
        {error && (
          <div
            style={{
              padding: "0.75rem",
              background: "#fffbeb",
              border: "1px solid #fde68a",
              borderRadius: "10px",
              color: "#92400e",
              fontSize: "0.8rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <AlertCircle size={16} color="#d97706" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[1, 2].map((i) => (
              <div
                key={i}
                style={{
                  padding: "1rem",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <div style={{ height: "14px", width: "65%", background: "#e2e8f0", borderRadius: "4px" }} />
                <div style={{ height: "10px", width: "40%", background: "#f1f5f9", borderRadius: "4px" }} />
                <div style={{ height: "30px", width: "100%", background: "#f1f5f9", borderRadius: "6px" }} />
              </div>
            ))}
          </div>
        )}

        {/* Empty State when no recommendations are left */}
        {!loading && !error && visibleRecommendations.length === 0 && (
          <div
            style={{
              padding: "2rem 1rem",
              textAlign: "center",
              color: "#64748b",
              background: "#f8fafc",
              border: "1px dashed #e2e8f0",
              borderRadius: "12px",
            }}
          >
            <CheckCircle2 size={24} color="#10b981" style={{ margin: "0 auto 0.5rem", display: "block" }} />
            <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 600, color: "#1e293b" }}>
              All recommendations reviewed
            </p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "#64748b" }}>
              You've optimized this quotation with relevant pairings.
            </p>
          </div>
        )}

        {/* Recommendation Cards */}
        {!loading &&
          visibleRecommendations.map((rec) => {
            const isUpsell = rec.type === "upsell";
            const scorePercent = Math.round(Number(rec.score || 0.85) * 100);
            const isPositiveMargin = Number(rec.marginDelta || 0) >= 0;

            return (
              <div
                key={rec.id}
                style={{
                  padding: "1rem",
                  background: "#ffffff",
                  border: isUpsell ? "1px solid #e0e7ff" : "1px solid #e2e8f0",
                  borderRadius: "14px",
                  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.65rem",
                  transition: "all 0.2s ease",
                  position: "relative",
                }}
              >
                {/* Header: Product Name & Badges */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                    <h4
                      style={{
                        margin: 0,
                        fontWeight: 800,
                        color: "#0f172a",
                        fontSize: "0.92rem",
                        lineHeight: 1.3,
                      }}
                    >
                      {rec.name}
                    </h4>

                    {/* Dismiss Button */}
                    <button
                      type="button"
                      title="Dismiss recommendation"
                      aria-label={`Dismiss recommendation for ${rec.name}`}
                      onClick={() => handleDismiss(rec.id)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#94a3b8",
                        cursor: "pointer",
                        padding: "2px",
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "#ef4444";
                        e.currentTarget.style.background = "#fef2f2";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "#94a3b8";
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <X size={15} />
                    </button>
                  </div>

                  {/* Badges Row: Type & Score */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.35rem", flexWrap: "wrap" }}>
                    {/* Upsell / Cross-sell Badge */}
                    <span
                      style={{
                        fontSize: "0.68rem",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        padding: "0.15rem 0.5rem",
                        borderRadius: "6px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        background: isUpsell ? "#f5f3ff" : "#ecfdf5",
                        color: isUpsell ? "#6d28d9" : "#047857",
                        border: isUpsell ? "1px solid #ddd6fe" : "1px solid #a7f3d0",
                      }}
                    >
                      {isUpsell ? <ArrowUpRight size={11} /> : <TrendingUp size={11} />}
                      {isUpsell ? "Upsell Upgrade" : "Cross-Sell Addon"}
                    </span>

                    {/* Match Score Badge */}
                    <span
                      style={{
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        padding: "0.15rem 0.45rem",
                        borderRadius: "6px",
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        border: "1px solid #bfdbfe",
                      }}
                    >
                      ⭐ {scorePercent}% Score
                    </span>

                    <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                      {rec.category}
                    </span>
                  </div>
                </div>

                {/* Why Recommended / Reason Box */}
                {(rec.reason || rec.llmExplanation) && (
                  <div
                    style={{
                      background: "#f8fafc",
                      borderLeft: "3px solid #3b82f6",
                      borderRadius: "0 8px 8px 0",
                      padding: "0.45rem 0.65rem",
                      fontSize: "0.76rem",
                      color: "#334155",
                      lineHeight: 1.4,
                    }}
                  >
                    <strong style={{ color: "#1e293b", fontWeight: 700, display: "block", marginBottom: "0.1rem" }}>
                      Why recommended:
                    </strong>
                    {rec.reason || rec.llmExplanation}
                  </div>
                )}

                {/* Financials & Promotion Tags Grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.5rem 0.65rem",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    fontSize: "0.78rem",
                  }}
                >
                  <div>
                    <span style={{ color: "#64748b", fontSize: "0.72rem", display: "block" }}>
                      Price
                    </span>
                    <strong style={{ color: "#0f172a", fontSize: "0.88rem" }}>
                      {currency(rec.unitPrice)}
                    </strong>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <span style={{ color: "#64748b", fontSize: "0.72rem", display: "block" }}>
                      Margin Delta
                    </span>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: "0.82rem",
                        color: isPositiveMargin ? "#16a34a" : "#dc2626",
                      }}
                    >
                      {isPositiveMargin ? "+" : ""}
                      {currency(rec.marginDelta)}{" "}
                      <small style={{ fontSize: "0.72rem", fontWeight: 600 }}>
                        ({rec.marginDeltaPercent > 0 ? "+" : ""}{rec.marginDeltaPercent}%)
                      </small>
                    </span>
                  </div>
                </div>

                {/* Promotion Tag (if applicable) */}
                {rec.promotionTag && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "#b45309",
                      background: "#fef3c7",
                      border: "1px solid #fde68a",
                      padding: "0.3rem 0.55rem",
                      borderRadius: "6px",
                    }}
                  >
                    <Tag size={12} />
                    <span>{rec.promotionTag}</span>
                  </div>
                )}

                {/* Action Button: Add to Quote */}
                <button
                  type="button"
                  title="Add to quotation"
                  disabled={addingId === rec.id}
                  onClick={() => handleAddItem(rec)}
                  style={{
                    background: addingId === rec.id ? "#93c5fd" : "#2563eb",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "0.5rem 0.75rem",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    cursor: addingId === rec.id ? "default" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.35rem",
                    transition: "all 0.15s ease",
                    boxShadow: "0 1px 2px rgba(37, 99, 235, 0.2)",
                  }}
                  onMouseEnter={(e) => {
                    if (addingId !== rec.id) e.currentTarget.style.background = "#1d4ed8";
                  }}
                  onMouseLeave={(e) => {
                    if (addingId !== rec.id) e.currentTarget.style.background = "#2563eb";
                  }}
                >
                  {addingId === rec.id ? (
                    <>
                      <CheckCircle2 size={14} /> Adding...
                    </>
                  ) : (
                    <>
                      <Plus size={14} /> Add to Quote
                    </>
                  )}
                </button>
              </div>
            );
          })}
      </div>
    </aside>
  );
}
