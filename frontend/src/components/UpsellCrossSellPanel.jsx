import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Plus, RotateCcw, Sparkles, Tag } from "lucide-react";

const API_BASE = "http://localhost:5000/api";
const currency = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function UpsellCrossSellPanel({ items, customerId, onAddItem, token }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(() => new Set());
  const [dragStart, setDragStart] = useState(null);
  const [dragX, setDragX] = useState(0);
  const [flying, setFlying] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!items?.length) { setRecommendations([]); return undefined; }
    setLoading(true);
    setError("");
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`${API_BASE}/recommendations`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ items, customerId }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Recommendations are unavailable.");
        if (!cancelled) setRecommendations(data.data || []);
      } catch (requestError) {
        if (!cancelled) { setError(requestError.message); setRecommendations([]); }
      } finally { if (!cancelled) setLoading(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [items, customerId, token]);

  const activeRecommendations = recommendations.filter((item) => !dismissed.has(item.id || item.productId));
  const topRecommendation = activeRecommendations[0];

  function finishSwipe(direction) {
    if (!topRecommendation || flying) return;
    const id = topRecommendation.id || topRecommendation.productId;
    setFlying(direction);
    setTimeout(() => {
      if (direction === "right") onAddItem(topRecommendation);
      setDismissed((current) => new Set([...current, id]));
      setFlying(null);
      setDragX(0);
    }, 260);
  }

  function handlePointerDown(event) {
    if (!topRecommendation || flying || event.target.closest("button")) return;
    setDragStart({ x: event.clientX });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event) {
    if (dragStart && !flying) setDragX(event.clientX - dragStart.x);
  }

  function handlePointerUp() {
    if (!dragStart) return;
    const distance = dragX;
    setDragStart(null);
    if (distance > 80) finishSwipe("right");
    else if (distance < -80) finishSwipe("left");
    else setDragX(0);
  }

  if (!items?.length) return <aside className="split-panel-sidebar" aria-label="AI Product Recommendations" style={{ background: "#fff", border: "1px dashed #cbd5e1", borderRadius: "16px", padding: "2rem 1.25rem", textAlign: "center", color: "#64748b" }}><Sparkles size={28} color="#2563eb" /><h4 style={{ color: "#0f172a", margin: "0.75rem 0 0.35rem" }}>AI Deal Recommendations</h4><p style={{ margin: 0, fontSize: "0.825rem" }}>Add quotation items to generate upsell and cross-sell suggestions.</p></aside>;

  return <aside className="split-panel-sidebar" aria-label="AI Product Recommendations" style={{ background: "#fff", border: "1px solid var(--border-light, #e2e8f0)", borderRadius: "16px", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
    <div style={{ padding: "0.85rem 1.15rem", borderBottom: "1px solid #e2e8f0", background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)" }}><strong style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}><Sparkles size={16} color="#2563eb" /> AI Recommendations</strong></div>
    {error && <div style={{ padding: "0.65rem 0.85rem", color: "#92400e", background: "#fffbeb", fontSize: "0.78rem" }}><AlertCircle size={14} /> {error}</div>}
    <div className="split-panel-sidebar-scroll" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.85rem", maxHeight: "620px", overflowY: "auto" }}>
      {loading && <div style={{ color: "#64748b", fontSize: "0.82rem" }}>Finding relevant products...</div>}
      {!loading && !activeRecommendations.length && !error && <div style={{ color: "#64748b", fontSize: "0.82rem" }}>No recommendations left.<button type="button" className="btn-secondary" style={{ marginTop: "0.75rem", padding: "0.4rem 0.7rem", fontSize: "0.78rem" }} onClick={() => setDismissed(new Set())}><RotateCcw size={14} /> Review again</button></div>}
      {topRecommendation && <>
        <article onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} style={{ padding: "1rem", border: "1px solid #e2e8f0", borderRadius: "12px", background: "#f8fafc", transform: `translate3d(${flying === "right" ? 420 : flying === "left" ? -420 : dragX}px, 0, 0) rotate(${dragX / 18}deg)`, transition: flying || !dragStart ? "transform 260ms ease" : "none", cursor: "grab", touchAction: "none", position: "relative", opacity: flying ? 0 : 1 }}>
          {dragX > 45 && <span className="recommendation-swipe-stamp accept">ADD TO QUOTE</span>}
          {dragX < -45 && <span className="recommendation-swipe-stamp reject">DISMISS</span>}
          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}><strong style={{ color: "#0f172a" }}>{topRecommendation.name}</strong><span style={{ color: "#2563eb", fontWeight: 800, fontSize: "0.8rem" }}>{currency(topRecommendation.unitPrice)}</span></div>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", margin: "0.45rem 0" }}><span className="recommendation-chip"><Tag size={12} /> {topRecommendation.type === "upsell" ? "Upsell" : "Cross-sell"}</span><span className="recommendation-chip">{topRecommendation.category}</span><span className="recommendation-chip">Score {Math.round(Number(topRecommendation.score || 0) * 100)}%</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.45rem", color: "#475569", fontSize: "0.75rem", marginBottom: "0.6rem" }}><span>Margin impact: <strong style={{ color: Number(topRecommendation.marginDelta || 0) >= 0 ? "#15803d" : "#b91c1c" }}>{Number(topRecommendation.marginDelta || 0) >= 0 ? "+" : ""}{currency(topRecommendation.marginDelta)} ({topRecommendation.marginDeltaPercent || 0}%)</strong></span><span>Purchase fit: <strong>{Math.round(Number(topRecommendation.score || 0) * 100)}%</strong></span></div>
          <div style={{ color: "#64748b", fontSize: "0.76rem", lineHeight: 1.45 }}>{topRecommendation.reason || topRecommendation.llmExplanation || "Relevant product for this quotation."}</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.75rem" }}><button type="button" className="btn-secondary" style={{ padding: "0.4rem 0.65rem", fontSize: "0.76rem" }} onClick={() => finishSwipe("left")}><ChevronLeft size={14} /> Dismiss</button><button type="button" className="btn-primary" style={{ width: "auto", padding: "0.4rem 0.65rem", fontSize: "0.76rem" }} onClick={() => finishSwipe("right")}><Plus size={14} /> Add to quote</button></div>
        </article>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem", color: "#94a3b8", fontSize: "0.7rem" }}><ChevronLeft size={13} /> Swipe left to dismiss <span style={{ margin: "0 0.25rem" }}>•</span> Swipe right to add <ChevronRight size={13} /></div>
      </>}
    </div>
  </aside>;
}
