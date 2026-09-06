import { useEffect, useState } from "react";
import { AlertCircle, Check, Plus, RotateCcw, Sparkles, Tag, X } from "lucide-react";

const API_BASE = "http://localhost:5000/api";
const currency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function UpsellCrossSellPanel({ items, customerId, onAddItem, token }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(() => new Set());
  const [addedIds, setAddedIds] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;
    if (!items?.length) {
      setRecommendations([]);
      return undefined;
    }

    setLoading(true);
    setError("");

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`${API_BASE}/recommendations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ items, customerId }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Recommendations are unavailable.");
        if (!cancelled) setRecommendations(data.data || []);
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError.message);
          setRecommendations([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [items, customerId, token]);

  const handleAdd = (rec) => {
    const id = rec.productId || rec.id;
    if (onAddItem) onAddItem(rec);
    setAddedIds((prev) => new Set([...prev, id]));
  };

  const handleDismiss = (rec) => {
    const id = rec.productId || rec.id;
    setDismissed((prev) => new Set([...prev, id]));
  };

  const activeRecommendations = recommendations.filter(
    (item) => !dismissed.has(item.productId || item.id)
  );

  if (!items?.length) {
    return (
      <aside
        className="split-panel-sidebar"
        aria-label="AI Product Recommendations"
        style={{
          background: "#fff",
          border: "1px dashed #cbd5e1",
          borderRadius: "16px",
          padding: "2rem 1.25rem",
          textAlign: "center",
          color: "#64748b",
        }}
      >
        <Sparkles size={28} color="#2563eb" />
        <h4 style={{ color: "#0f172a", margin: "0.75rem 0 0.35rem" }}>
          AI Deal Recommendations
        </h4>
        <p style={{ margin: 0, fontSize: "0.825rem" }}>
          Add quotation items to generate upsell and cross-sell suggestions.
        </p>
      </aside>
    );
  }

  return (
    <aside
      className="split-panel-sidebar"
      aria-label="AI Product Recommendations"
      style={{
        background: "#fff",
        border: "1px solid var(--border-light, #e2e8f0)",
        borderRadius: "16px",
        boxShadow: "var(--shadow-sm)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "0.85rem 1.15rem",
          borderBottom: "1px solid #e2e8f0",
          background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <strong style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.9rem", color: "#1e293b" }}>
          <Sparkles size={16} color="#7c3aed" /> AI Recommendations
        </strong>
        {activeRecommendations.length > 0 && (
          <span
            style={{
              fontSize: "0.72rem",
              background: "#ede9fe",
              color: "#6d28d9",
              padding: "0.15rem 0.5rem",
              borderRadius: "9999px",
              fontWeight: 700,
            }}
          >
            {activeRecommendations.length} Suggested
          </span>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: "0.65rem 0.85rem",
            color: "#92400e",
            background: "#fffbeb",
            fontSize: "0.78rem",
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
          }}
        >
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div
        className="split-panel-sidebar-scroll"
        style={{
          padding: "0.85rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          maxHeight: "600px",
          overflowY: "auto",
        }}
      >
        {loading && (
          <div style={{ color: "#7c3aed", fontSize: "0.82rem", textAlign: "center", padding: "1.5rem 0" }}>
            <Sparkles size={16} style={{ animation: "spin 1.5s linear infinite", display: "inline-block", marginRight: "0.3rem" }} />
            Finding best matching products...
          </div>
        )}

        {!loading && !activeRecommendations.length && !error && (
          <div style={{ color: "#64748b", fontSize: "0.82rem", textAlign: "center", padding: "1.5rem 0" }}>
            No more recommendations.
            <div style={{ marginTop: "0.75rem" }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: "0.35rem 0.65rem", fontSize: "0.76rem" }}
                onClick={() => {
                  setDismissed(new Set());
                  setAddedIds(new Set());
                }}
              >
                <RotateCcw size={13} /> Reset & Review
              </button>
            </div>
          </div>
        )}

        {activeRecommendations.map((rec) => {
          const recId = rec.productId || rec.id;
          const isAdded = addedIds.has(recId) || items.some((i) => i.productId === recId);

          return (
            <article
              key={recId}
              style={{
                padding: "0.85rem",
                border: isAdded ? "1.5px solid #10b981" : "1px solid #e2e8f0",
                borderRadius: "10px",
                background: isAdded ? "#f0fdf4" : "#f8fafc",
                position: "relative",
                transition: "all 0.2s ease",
              }}
            >
              <button
                type="button"
                title="Dismiss"
                onClick={() => handleDismiss(rec)}
                style={{
                  position: "absolute",
                  top: "8px",
                  right: "8px",
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: "2px",
                  borderRadius: "4px",
                }}
              >
                <X size={14} />
              </button>

              <div style={{ paddingRight: "1.25rem", marginBottom: "0.35rem" }}>
                <strong style={{ color: "#0f172a", fontSize: "0.875rem", display: "block" }}>
                  {rec.name}
                </strong>
                <span style={{ color: "#7c3aed", fontWeight: 800, fontSize: "0.82rem" }}>
                  {currency(rec.unitPrice)}
                </span>
              </div>

              <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", margin: "0.35rem 0" }}>
                <span
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    padding: "0.1rem 0.4rem",
                    borderRadius: "4px",
                    background: rec.type === "upsell" ? "#ecfdf5" : "#eff6ff",
                    color: rec.type === "upsell" ? "#047857" : "#1d4ed8",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.2rem",
                  }}
                >
                  <Tag size={10} /> {rec.type === "upsell" ? "Upsell" : "Cross-sell"}
                </span>
                <span
                  style={{
                    fontSize: "0.68rem",
                    padding: "0.1rem 0.4rem",
                    borderRadius: "4px",
                    background: "#e2e8f0",
                    color: "#475569",
                    fontWeight: 600,
                  }}
                >
                  {rec.category || "Add-on"}
                </span>
                <span
                  style={{
                    fontSize: "0.68rem",
                    padding: "0.1rem 0.4rem",
                    borderRadius: "4px",
                    background: "#f5f3ff",
                    color: "#7c3aed",
                    fontWeight: 700,
                  }}
                >
                  Fit {Math.round(Number(rec.score || 0.85) * 100)}%
                </span>
              </div>

              {rec.marginDelta !== undefined && (
                <div style={{ fontSize: "0.72rem", color: "#475569", marginBottom: "0.35rem" }}>
                  Margin:{" "}
                  <strong style={{ color: Number(rec.marginDelta || 0) >= 0 ? "#16a34a" : "#dc2626" }}>
                    {Number(rec.marginDelta || 0) >= 0 ? "+" : ""}
                    {currency(rec.marginDelta)}
                  </strong>
                </div>
              )}

              <p style={{ color: "#64748b", fontSize: "0.74rem", lineHeight: 1.35, margin: "0 0 0.6rem" }}>
                {rec.reason || rec.llmExplanation || "Complementary product for this quotation."}
              </p>

              <button
                type="button"
                className="btn-primary"
                disabled={isAdded}
                onClick={() => handleAdd(rec)}
                style={{
                  width: "100%",
                  padding: "0.38rem 0.65rem",
                  fontSize: "0.76rem",
                  background: isAdded ? "#10b981" : "linear-gradient(135deg, #7c3aed, #6d28d9)",
                  borderColor: isAdded ? "#10b981" : "#7c3aed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.3rem",
                  cursor: isAdded ? "default" : "pointer",
                }}
              >
                {isAdded ? (
                  <>
                    <Check size={13} /> Added to Quote
                  </>
                ) : (
                  <>
                    <Plus size={13} /> + Add to Quote
                  </>
                )}
              </button>
            </article>
          );
        })}
      </div>
    </aside>
  );
}

