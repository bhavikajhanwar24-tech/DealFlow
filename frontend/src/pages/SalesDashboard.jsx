import { useEffect, useState } from "react";
import { ArrowRight, FilePlus2, ClipboardList, Activity } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import RevenueMarginChart from "../components/RevenueMarginChart";

const API_BASE = "http://localhost:5000/api";

export default function SalesDashboard({ onNavigate }) {
  const { token } = useAuth();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSummary() {
      try {
        const response = await fetch(
          `${API_BASE}/quotations/dashboard-summary`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.message || "Unable to load dashboard.");
        setSummary(data.data);
      } catch (loadError) {
        setError(loadError.message);
      }
    }
    loadSummary();
  }, [token]);

  const cards = [
    [
      "Pending Approvals",
      summary?.pendingApprovals,
      "Quotes awaiting review",
      "#f59e0b",
    ],
    [
      "Open Quotations",
      summary?.openQuotations,
      "Drafts and active quotes",
      "#2563eb",
    ],
    [
      "At-Risk Deals",
      summary?.atRiskDeals ?? 0,
      "Deal health coming soon",
      "#ef4444",
    ],
  ];

  return (
    <main className="main-content">
      <div style={{ marginBottom: "2rem" }}>
        <div
          style={{
            color: "#2563eb",
            fontSize: "0.75rem",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Sales Workspace
        </div>
        <h1
          style={{
            fontSize: "2rem",
            fontWeight: 800,
            color: "#0f172a",
            marginTop: "0.35rem",
          }}
        >
          Sales Dashboard / Home
        </h1>
        <p style={{ color: "#64748b", marginTop: "0.5rem" }}>
          Manage quotations, approvals, fulfillment and deals from one
          workspace.
        </p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="metric-grid">
        {cards.map(([label, value, detail, color]) => (
          <div
            className="metric-card"
            key={label}
            style={{ borderTop: `3px solid ${color}` }}
          >
            <div>
              <div className="metric-label">{label}</div>
              <div className="metric-value">{value ?? "..."}</div>
              <div
                style={{
                  color: "#94a3b8",
                  fontSize: "0.75rem",
                  marginTop: "0.25rem",
                }}
              >
                {detail}
              </div>
            </div>
            <Activity size={22} color={color} />
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          marginBottom: "2rem",
        }}
      >
        <button
          className="btn-primary"
          style={{ width: "auto" }}
          onClick={() => onNavigate("/sales/quotations/new")}
        >
          <FilePlus2 size={17} /> New Quotation
        </button>
        <button
          className="btn-secondary"
          onClick={() => onNavigate("/sales/quotations")}
        >
          <ClipboardList size={17} /> View Quotations
        </button>
      </div>

      {/* Analytics Feature: Revenue vs Margin Component */}
      <RevenueMarginChart analytics={summary?.analytics} onNavigate={onNavigate} />

      <section
        style={{
          background: "#fff",
          border: "1px solid var(--border-light)",
          borderRadius: "16px",
          padding: "1.5rem",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <div>
            <h2
              style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}
            >
              Recent Activity
            </h2>
            <p
              style={{
                color: "#64748b",
                fontSize: "0.875rem",
                marginTop: "0.35rem",
              }}
            >
              Your quotation activity will appear here as workspace modules are
              added.
            </p>
          </div>
          <ArrowRight size={20} color="#94a3b8" />
        </div>
      </section>
    </main>
  );
}
