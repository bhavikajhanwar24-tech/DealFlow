import { useEffect, useState, useMemo, useRef } from "react";
import {
  Sparkles,
  Plus,
  X,
  TrendingUp,
  ArrowUpRight,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Tag,
  ChevronRight,
  ChevronLeft,
  Layers,
  Cpu,
} from "lucide-react";

const API_BASE = "http://localhost:5000/api";

const currency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function UpsellCrossSellPanel({
  items,
  customerId,
  onAddItem,
  token,
}) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [history, setHistory] = useState([]); // For undo feature: [{ action: 'dismiss'|'add', item }]

  // Session-level dismissed set
  const [dismissed, setDismissed] = useState(() => {
    try {
      const saved = sessionStorage.getItem("dealflow_dismissed_recommendations");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Swipe drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [flyDirection, setFlyDirection] = useState(null); // 'left' | 'right' | null
  const [isAnimating, setIsAnimating] = useState(false);
  const cardRef = useRef(null);

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

  // Fetch recommendations
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
          throw new Error(
            data.message || "Recommendations are temporarily unavailable."
          );
        }

        setRecommendations(data.data || []);
      } catch (loadError) {
        if (!isCancelled) {
          console.warn("[UpsellCrossSellPanel]", loadError.message);
          setError("Recommendations temporarily unavailable.");
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

  // Filter recommendations that are not yet dismissed
  const activeDeck = useMemo(() => {
    return recommendations.filter(
      (rec) => !dismissed.has(rec.id) && !dismissed.has(rec.productId)
    );
  }, [recommendations, dismissed]);

  const topCard = activeDeck[0] || null;
  const nextCard = activeDeck[1] || null;
  const thirdCard = activeDeck[2] || null;

  // Swipe Action: Choose / Add item to quotation (Swipe Right)
  const triggerSwipeRight = (itemToSwipe = topCard) => {
    if (!itemToSwipe || isAnimating) return;
    setIsAnimating(true);
    setFlyDirection("right");

    setTimeout(() => {
      try {
        onAddItem(itemToSwipe);
        setToastMessage(`Added "${itemToSwipe.name}" to quotation!`);
        setTimeout(() => setToastMessage(""), 3200);

        setHistory((prev) => [...prev, { action: "add", item: itemToSwipe }]);

        const updated = new Set(dismissed);
        updated.add(itemToSwipe.id);
        if (itemToSwipe.productId) updated.add(itemToSwipe.productId);
        saveDismissed(updated);
      } finally {
        setFlyDirection(null);
        setDragOffset({ x: 0, y: 0 });
        setIsAnimating(false);
      }
    }, 300);
  };

  // Swipe Action: Dismiss item (Swipe Left)
  const triggerSwipeLeft = (itemToSwipe = topCard) => {
    if (!itemToSwipe || isAnimating) return;
    setIsAnimating(true);
    setFlyDirection("left");

    setTimeout(() => {
      try {
        setHistory((prev) => [...prev, { action: "dismiss", item: itemToSwipe }]);

        const updated = new Set(dismissed);
        updated.add(itemToSwipe.id);
        if (itemToSwipe.productId) updated.add(itemToSwipe.productId);
        saveDismissed(updated);
      } finally {
        setFlyDirection(null);
        setDragOffset({ x: 0, y: 0 });
        setIsAnimating(false);
      }
    }, 300);
  };

  // Undo Last Swipe
  const handleUndo = () => {
    if (history.length === 0 || isAnimating) return;
    const lastEntry = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));

    const updated = new Set(dismissed);
    updated.delete(lastEntry.item.id);
    if (lastEntry.item.productId) updated.delete(lastEntry.item.productId);
    saveDismissed(updated);

    setToastMessage(`Restored "${lastEntry.item.name}"`);
    setTimeout(() => setToastMessage(""), 2500);
  };

  // Reset All Dismissed Items to review deck again
  const handleResetAll = () => {
    const updated = new Set();
    saveDismissed(updated);
    setHistory([]);
    setToastMessage("Reset all recommendations!");
    setTimeout(() => setToastMessage(""), 2500);
  };

  // Pointer / Mouse / Touch Drag Handlers
  const handlePointerDown = (e) => {
    if (isAnimating || !topCard) return;
    // Don't drag if clicking a button
    if (e.target.closest("button")) return;

    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragOffset({ x: 0, y: 0 });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignored if capture unsupported
    }
  };

  const handlePointerMove = (e) => {
    if (!isDragging || isAnimating) return;
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    setDragOffset({ x: deltaX, y: deltaY });
  };

  const handlePointerUp = (e) => {
    if (!isDragging || isAnimating) return;
    setIsDragging(false);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignored
    }

    const threshold = 75; // px to trigger card swipe
    if (dragOffset.x > threshold) {
      triggerSwipeRight();
    } else if (dragOffset.x < -threshold) {
      triggerSwipeLeft();
    } else {
      // Snap back to origin
      setDragOffset({ x: 0, y: 0 });
    }
  };

  // Calculate dynamic card transform & rotation
  const getCardTransform = () => {
    if (flyDirection === "right") {
      return "translate3d(480px, 20px, 0) rotate(26deg)";
    }
    if (flyDirection === "left") {
      return "translate3d(-480px, 20px, 0) rotate(-26deg)";
    }
    const rotateDeg = (dragOffset.x / 14);
    return `translate3d(${dragOffset.x}px, ${dragOffset.y * 0.18}px, 0) rotate(${rotateDeg}deg)`;
  };

  // Opacities for swipe stamp badges
  const rightOpacity = Math.min(1, Math.max(0, dragOffset.x / 65));
  const leftOpacity = Math.min(1, Math.max(0, -dragOffset.x / 65));

  // If no quotation items yet
  if (!items || items.length === 0) {
    return (
      <aside
        style={{
          background: "#ffffff",
          border: "1px dashed #cbd5e1",
          borderRadius: "16px",
          padding: "2rem 1.25rem",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.75rem",
          color: "#64748b",
          boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))",
          minHeight: "380px",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)",
            color: "#2563eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 12px rgba(37, 99, 235, 0.15)",
          }}
        >
          <Sparkles size={24} />
        </div>
        <div>
          <h4
            style={{
              margin: "0 0 0.35rem",
              color: "#0f172a",
              fontSize: "0.98rem",
              fontWeight: 800,
            }}
          >
            AI Deal Recommendations
          </h4>
          <p
            style={{
              margin: 0,
              fontSize: "0.825rem",
              color: "#64748b",
              maxWidth: "260px",
              lineHeight: 1.45,
            }}
          >
            Add quotation items to generate real-time AI upsell and cross-sell suggestions.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-label="AI Deal Recommendations Swipe Deck"
      style={{
        background: "#ffffff",
        border: "1px solid var(--border-light, #e2e8f0)",
        borderRadius: "16px",
        overflow: "hidden",
        boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))",
        display: "flex",
        flexDirection: "column",
        userSelect: isDragging ? "none" : "auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "0.85rem 1.15rem",
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
              background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 6px rgba(37, 99, 235, 0.3)",
            }}
          >
            <Sparkles size={16} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: "0.92rem",
                  fontWeight: 800,
                  color: "#0f172a",
                }}
              >
                AI Recommendations
              </h3>
              
            </div>
            <span style={{ fontSize: "0.71rem", color: "#64748b" }}>
              Swipe card left to skip · right to add
            </span>
          </div>
        </div>

        {activeDeck.length > 0 && !loading && (
          <span
            style={{
              fontSize: "0.72rem",
              fontWeight: 800,
              background: "#eff6ff",
              color: "#1d4ed8",
              padding: "0.2rem 0.55rem",
              borderRadius: "9999px",
              border: "1px solid #bfdbfe",
            }}
          >
            {activeDeck.length} left
          </span>
        )}
      </div>

      {/* Toast Notification */}
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
          <CheckCircle2 size={15} color="#10b981" />
          <span style={{ flex: 1 }}>{toastMessage}</span>
        </div>
      )}

      {/* Panel Body */}
      <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
        {/* Error notification */}
        {error && (
          <div
            style={{
              padding: "0.65rem 0.85rem",
              background: "#fffbeb",
              border: "1px solid #fde68a",
              borderRadius: "8px",
              color: "#92400e",
              fontSize: "0.78rem",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <AlertCircle size={15} color="#d97706" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && (
          <div
            style={{
              height: "360px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "16px",
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                border: "3px solid #e2e8f0",
                borderTopColor: "#2563eb",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>
              AI engine analyzing pairings & margins...
            </span>
          </div>
        )}

        {/* Swipe Card Deck Area */}
        {!loading && activeDeck.length > 0 && topCard && (
          <div
            style={{
              position: "relative",
              height: "380px",
              width: "100%",
              perspective: "1000px",
            }}
          >
            {/* Third Card in Stack */}
            {thirdCard && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  borderRadius: "16px",
                  transform: "scale(0.88) translateY(24px)",
                  opacity: 0.5,
                  pointerEvents: "none",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                }}
              />
            )}

            {/* Second Card in Stack */}
            {nextCard && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "16px",
                  transform: "scale(0.94) translateY(12px)",
                  opacity: 0.85,
                  pointerEvents: "none",
                  boxShadow: "0 4px 10px rgba(0,0,0,0.04)",
                  padding: "1.1rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 700 }}>
                      NEXT SUGGESTION
                    </span>
                    <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>
                      {nextCard.category}
                    </span>
                  </div>
                  <h4 style={{ margin: "0.5rem 0 0", fontSize: "0.95rem", color: "#334155" }}>
                    {nextCard.name}
                  </h4>
                </div>
                <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                  {currency(nextCard.unitPrice)}
                </div>
              </div>
            )}

            {/* Active Top Card (Draggable & Swipeable) */}
            <div
              ref={cardRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{
                position: "absolute",
                inset: 0,
                background: "#ffffff",
                border: topCard.type === "upsell" ? "1.5px solid #c7d2fe" : "1.5px solid #bbf7d0",
                borderRadius: "16px",
                boxShadow: isDragging
                  ? "0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
                  : "0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.03)",
                padding: "1.2rem",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                cursor: isDragging ? "grabbing" : "grab",
                touchAction: "none",
                transform: getCardTransform(),
                transition: isDragging
                  ? "none"
                  : flyDirection
                  ? "transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.32s ease"
                  : "transform 0.28s ease, box-shadow 0.2s ease",
                opacity: flyDirection ? 0 : 1,
                overflow: "hidden",
                zIndex: 20,
              }}
            >
              {/* Swipe Right Stamp: ADD TO QUOTE */}
              <div
                style={{
                  position: "absolute",
                  top: "1.2rem",
                  left: "1.2rem",
                  background: "#16a34a",
                  color: "#ffffff",
                  border: "2px solid #22c55e",
                  padding: "0.4rem 0.8rem",
                  borderRadius: "8px",
                  fontWeight: 800,
                  fontSize: "0.85rem",
                  letterSpacing: "0.05em",
                  transform: "rotate(-12deg)",
                  opacity: rightOpacity,
                  boxShadow: "0 4px 12px rgba(22, 163, 74, 0.35)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  pointerEvents: "none",
                  zIndex: 30,
                }}
              >
                <Plus size={16} strokeWidth={3} /> ADD TO QUOTE
              </div>

              {/* Swipe Left Stamp: DISMISS */}
              <div
                style={{
                  position: "absolute",
                  top: "1.2rem",
                  right: "1.2rem",
                  background: "#dc2626",
                  color: "#ffffff",
                  border: "2px solid #ef4444",
                  padding: "0.4rem 0.8rem",
                  borderRadius: "8px",
                  fontWeight: 800,
                  fontSize: "0.85rem",
                  letterSpacing: "0.05em",
                  transform: "rotate(12deg)",
                  opacity: leftOpacity,
                  boxShadow: "0 4px 12px rgba(220, 38, 38, 0.35)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  pointerEvents: "none",
                  zIndex: 30,
                }}
              >
                <X size={16} strokeWidth={3} /> DISMISS
              </div>

              {/* Top Meta: Badges & Category */}
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.6rem",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      padding: "0.2rem 0.55rem",
                      borderRadius: "6px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      background: topCard.type === "upsell" ? "#e0e7ff" : "#dcfce7",
                      color: topCard.type === "upsell" ? "#4338ca" : "#15803d",
                      border:
                        topCard.type === "upsell"
                          ? "1px solid #c7d2fe"
                          : "1px solid #bbf7d0",
                    }}
                  >
                    {topCard.type === "upsell" ? (
                      <ArrowUpRight size={12} />
                    ) : (
                      <TrendingUp size={12} />
                    )}
                    {topCard.type === "upsell" ? "Upsell Upgrade" : "Cross-Sell Addon"}
                  </span>

                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      color: "#1e40af",
                      background: "#eff6ff",
                      border: "1px solid #bfdbfe",
                      padding: "0.15rem 0.45rem",
                      borderRadius: "6px",
                    }}
                  >
                    ⭐ {Math.round(Number(topCard.score || 0.9) * 100)}% Match
                  </span>
                </div>

                {/* Product Name */}
                <h4
                  style={{
                    margin: "0 0 0.25rem",
                    fontWeight: 800,
                    color: "#0f172a",
                    fontSize: "1.05rem",
                    lineHeight: 1.35,
                  }}
                >
                  {topCard.name}
                </h4>

                <span
                  style={{
                    fontSize: "0.74rem",
                    color: "#64748b",
                    fontWeight: 600,
                    textTransform: "capitalize",
                  }}
                >
                  Category: {topCard.category || "General"}
                </span>

                {/* AI Explanation / Reasoning Box */}
                {(topCard.reason || topCard.llmExplanation) && (
                  <div
                    style={{
                      marginTop: "0.75rem",
                      background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
                      borderLeft: "3px solid #6366f1",
                      borderRadius: "0 8px 8px 0",
                      padding: "0.6rem 0.75rem",
                      fontSize: "0.77rem",
                      color: "#334155",
                      lineHeight: 1.45,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.3rem",
                        color: "#4f46e5",
                        fontWeight: 700,
                        fontSize: "0.72rem",
                        marginBottom: "0.15rem",
                      }}
                    >
                      <Sparkles size={11} />
                      <span>AI RECOMMENDATION</span>
                    </div>
                    {topCard.reason || topCard.llmExplanation}
                  </div>
                )}
              </div>

              {/* Bottom Card Metrics */}
              <div>
                {/* Active Promotion Tag (if any) */}
                {topCard.promotionTag && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      fontSize: "0.73rem",
                      fontWeight: 700,
                      color: "#b45309",
                      background: "#fef3c7",
                      border: "1px solid #fde68a",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "6px",
                      marginBottom: "0.6rem",
                    }}
                  >
                    <Tag size={12} />
                    <span>{topCard.promotionTag}</span>
                  </div>
                )}

                {/* Price & Margin Delta */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.55rem 0.75rem",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                  }}
                >
                  <div>
                    <span style={{ color: "#64748b", fontSize: "0.7rem", display: "block" }}>
                      Unit Price
                    </span>
                    <strong style={{ color: "#0f172a", fontSize: "0.92rem" }}>
                      {currency(topCard.unitPrice)}
                    </strong>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <span style={{ color: "#64748b", fontSize: "0.7rem", display: "block" }}>
                      Margin Delta
                    </span>
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: "0.85rem",
                        color: Number(topCard.marginDelta || 0) >= 0 ? "#16a34a" : "#dc2626",
                      }}
                    >
                      {Number(topCard.marginDelta || 0) >= 0 ? "+" : ""}
                      {currency(topCard.marginDelta)}{" "}
                      <small style={{ fontSize: "0.72rem", fontWeight: 700 }}>
                        ({Number(topCard.marginDeltaPercent || 0) > 0 ? "+" : ""}
                        {topCard.marginDeltaPercent}%)
                      </small>
                    </span>
                  </div>
                </div>

                {/* Swipe Helper Guide */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "0.6rem",
                    paddingTop: "0.4rem",
                    borderTop: "1px dashed #e2e8f0",
                    fontSize: "0.7rem",
                    color: "#94a3b8",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
                    <ChevronLeft size={13} /> Swipe Left to Skip
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
                    Swipe Right to Add <ChevronRight size={13} />
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* All Reviewed / Empty State */}
        {!loading && activeDeck.length === 0 && (
          <div
            style={{
              padding: "2rem 1rem",
              textAlign: "center",
              background: "#f8fafc",
              border: "1px dashed #cbd5e1",
              borderRadius: "16px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background: "#ecfdf5",
                color: "#10b981",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h4 style={{ margin: "0 0 0.25rem", fontSize: "0.95rem", fontWeight: 800, color: "#0f172a" }}>
                All Recommendations Reviewed!
              </h4>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b", maxWidth: "250px" }}>
                You have examined all available upsell and cross-sell options for this quote.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetAll}
              style={{
                marginTop: "0.5rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                padding: "0.45rem 0.85rem",
                fontSize: "0.78rem",
                fontWeight: 700,
                color: "#334155",
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f1f5f9";
                e.currentTarget.style.borderColor = "#94a3b8";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#ffffff";
                e.currentTarget.style.borderColor = "#cbd5e1";
              }}
            >
              <RotateCcw size={13} /> Reset & Review Again
            </button>
          </div>
        )}

        {/* Tactile Control Buttons (Swipe Left / Undo / Swipe Right) */}
        {!loading && activeDeck.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              gap: "0.5rem",
              alignItems: "center",
              marginTop: "0.25rem",
            }}
          >
            {/* Left Button: Dismiss / Skip */}
            <button
              type="button"
              title="Swipe Left to Dismiss"
              disabled={isAnimating || !topCard}
              onClick={() => triggerSwipeLeft()}
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#dc2626",
                borderRadius: "10px",
                padding: "0.6rem 0.5rem",
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: isAnimating ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.35rem",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (!isAnimating) {
                  e.currentTarget.style.background = "#fee2e2";
                  e.currentTarget.style.borderColor = "#f87171";
                }
              }}
              onMouseLeave={(e) => {
                if (!isAnimating) {
                  e.currentTarget.style.background = "#fef2f2";
                  e.currentTarget.style.borderColor = "#fecaca";
                }
              }}
            >
              <X size={15} strokeWidth={2.5} /> Skip
            </button>

            {/* Middle Button: Undo */}
            <button
              type="button"
              title="Undo last action"
              disabled={history.length === 0 || isAnimating}
              onClick={handleUndo}
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                color: history.length > 0 ? "#475569" : "#cbd5e1",
                borderRadius: "10px",
                width: "38px",
                height: "38px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: history.length > 0 && !isAnimating ? "pointer" : "default",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (history.length > 0 && !isAnimating) {
                  e.currentTarget.style.background = "#e2e8f0";
                  e.currentTarget.style.color = "#0f172a";
                }
              }}
              onMouseLeave={(e) => {
                if (history.length > 0 && !isAnimating) {
                  e.currentTarget.style.background = "#f8fafc";
                  e.currentTarget.style.color = "#475569";
                }
              }}
            >
              <RotateCcw size={15} />
            </button>

            {/* Right Button: Choose / Add to Quote */}
            <button
              type="button"
              title="Swipe Right to Add to Quote"
              disabled={isAnimating || !topCard}
              onClick={() => triggerSwipeRight()}
              style={{
                background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                border: "none",
                color: "#ffffff",
                borderRadius: "10px",
                padding: "0.6rem 0.5rem",
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: isAnimating ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.35rem",
                boxShadow: "0 2px 6px rgba(22, 163, 74, 0.3)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (!isAnimating) {
                  e.currentTarget.style.filter = "brightness(1.1)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isAnimating) {
                  e.currentTarget.style.filter = "none";
                  e.currentTarget.style.transform = "translateY(0)";
                }
              }}
            >
              <Plus size={15} strokeWidth={2.5} /> Add to Quote
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
