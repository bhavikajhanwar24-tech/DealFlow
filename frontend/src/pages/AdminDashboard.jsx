import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import {
  Bell as BellIcon,
  AlertTriangle as AlertTriangleIcon,
  Info as InfoIcon,
  AlertCircle as AlertCircleIcon,
  TrendingUp as TrendingUpIcon,
  BarChart3 as BarChart3Icon,
  Layers as LayersIcon,
  ShieldCheck as ShieldCheckIcon,
  Award as AwardIcon,
  ArrowUpRight as ArrowUpRightIcon,
  Package as PackageIcon,
  Users as UsersIcon,
  Calendar,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const API_BASE = "http://localhost:5000/api";

const CHART_PALETTE = [
  "#2563eb", // Royal Blue
  "#10b981", // Emerald Green
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#06b6d4", // Cyan
  "#ec4899", // Pink
  "#64748b", // Slate
];

const STAGE_CONFIG = {
  DRAFT: { label: "1. Draft", color: "#64748b" },
  PENDING_APPROVAL: { label: "2. Under Review", color: "#f59e0b" },
  NEGOTIATION: { label: "3. Negotiation", color: "#06b6d4" },
  APPROVED: { label: "4. Approved", color: "#8b5cf6" },
  CONFIRMED: { label: "5. Won / Confirmed", color: "#10b981" },
  REJECTED: { label: "6. Declined", color: "#ef4444" },
  CANCELLED: { label: "7. Cancelled", color: "#94a3b8" },
};

const formatCurrency = (val) =>
  `₹${Number(val || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function AdminDashboard({ onNavigate }) {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [reportsData, setReportsData] = useState(null);
  const [dealHealthData, setDealHealthData] = useState([]);
  const [quotationsList, setQuotationsList] = useState([]);
  const [productsList, setProductsList] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [timeframe, setTimeframe] = useState("all"); // '30', '90', 'all'

  // Load platform stats & smart alerts
  useEffect(() => {
    if (!token) return;

    async function loadStats() {
      try {
        const response = await fetch(`${API_BASE}/admin/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (data.success) setStats(data.data);
      } catch (error) {
        console.error("Failed to load admin stats:", error);
      }
    }

    async function loadAlerts() {
      setAlertsLoading(true);
      try {
        const response = await fetch(`${API_BASE}/ai/smart-alerts`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (data.success) setAlerts(data.data);
      } catch (error) {
        console.error("Failed to load smart alerts:", error);
      } finally {
        setAlertsLoading(false);
      }
    }

    loadStats();
    loadAlerts();
  }, [token]);


  // Load real database analytics based on timeframe filter
  useEffect(() => {
    if (!token) return;

    async function loadAnalytics() {
      setAnalyticsLoading(true);
      try {
        const queryParam = timeframe === "all" ? "" : `?dateRange=${timeframe}`;

        const [reportsRes, healthRes, quotesRes, prodsRes] = await Promise.all([
          fetch(`${API_BASE}/analytics/reports${queryParam}`, {
            headers: { Authorization: `Bearer ${token}` },
          }).then((r) => r.json()).catch(() => ({ success: false })),
          fetch(`${API_BASE}/analytics/deal-health`, {
            headers: { Authorization: `Bearer ${token}` },
          }).then((r) => r.json()).catch(() => ({ success: false })),
          fetch(`${API_BASE}/quotations`, {
            headers: { Authorization: `Bearer ${token}` },
          }).then((r) => r.json()).catch(() => ({ success: false })),
          fetch(`${API_BASE}/admin/products`, {
            headers: { Authorization: `Bearer ${token}` },
          }).then((r) => r.json()).catch(() => ({ success: false })),
        ]);

        if (reportsRes.success) setReportsData(reportsRes.data);
        if (healthRes.success) setDealHealthData(healthRes.data || []);
        if (quotesRes.success) setQuotationsList(quotesRes.data || []);
        if (prodsRes.success) setProductsList(prodsRes.data || []);
      } catch (error) {
        console.error("Failed to load analytics data:", error);
      } finally {
        setAnalyticsLoading(false);
      }
    }

    loadAnalytics();
  }, [token, timeframe]);

  // Real Computed: Deal Health Distribution from Database
  const healthDistribution = useMemo(() => {
    if (!dealHealthData.length) {
      return [
        { name: "Healthy Deals", value: 0, color: "#10b981", status: "HEALTHY" },
        { name: "Margin / Discount Risk", value: 0, color: "#f59e0b", status: "AT RISK" },
        { name: "Critical Exposure", value: 0, color: "#ef4444", status: "CRITICAL" },
      ];
    }
    const counts = { HEALTHY: 0, "AT RISK": 0, CRITICAL: 0 };
    dealHealthData.forEach((d) => {
      const status = d.healthStatus || "HEALTHY";
      counts[status] = (counts[status] || 0) + 1;
    });
    return [
      { name: "Healthy Deals", value: counts.HEALTHY, color: "#10b981", status: "HEALTHY" },
      { name: "Margin / Discount Risk", value: counts["AT RISK"], color: "#f59e0b", status: "AT RISK" },
      { name: "Critical Exposure", value: counts.CRITICAL, color: "#ef4444", status: "CRITICAL" },
    ];
  }, [dealHealthData]);

  const avgHealthScore = useMemo(() => {
    if (!dealHealthData.length) return 100;
    const total = dealHealthData.reduce((acc, curr) => acc + Number(curr.healthScore || 0), 0);
    return Math.round(total / dealHealthData.length);
  }, [dealHealthData]);

  // Real Computed: Monthly Trends from Database
  const monthlyTrendData = useMemo(() => {
    if (reportsData?.monthlyTrends && reportsData.monthlyTrends.length > 0) {
      return reportsData.monthlyTrends.map((row) => ({
        month: row.month,
        revenue: Number(row.revenue || 0),
        margin: Number(row.margin || 0),
        discount: Number(row.discount || 0),
        quotes: Number(row.total_quotes || 0),
      }));
    }

    // If no monthly trends yet, derive from quotations list or return 0 entries
    if (quotationsList.length > 0) {
      const monthMap = {};
      quotationsList.forEach((q) => {
        const d = new Date(q.created_at || q.createdAt || Date.now());
        const key = d.toLocaleString("default", { month: "short" });
        if (!monthMap[key]) monthMap[key] = { month: key, revenue: 0, margin: 0, discount: 0 };
        if (q.status === "CONFIRMED") {
          monthMap[key].revenue += Number(q.final_amount || q.finalAmount || 0);
          monthMap[key].margin += Number(q.final_amount || q.finalAmount || 0) * ((Number(q.margin_percentage || 25)) / 100);
          monthMap[key].discount += Number(q.discount_amount || q.discountAmount || 0);
        }
      });
      const entries = Object.values(monthMap);
      if (entries.length > 0) return entries;
    }

    return [{ month: "Current", revenue: 0, margin: 0, discount: 0 }];
  }, [reportsData, quotationsList]);

  // Real Computed: Pipeline Funnel from Database
  const pipelineFunnelData = useMemo(() => {
    const defaultStages = ["DRAFT", "PENDING_APPROVAL", "NEGOTIATION", "APPROVED", "CONFIRMED"];
    
    // Check if backend reports sent pipelineFunnel
    const funnelMap = {};
    if (reportsData?.pipelineFunnel && reportsData.pipelineFunnel.length > 0) {
      reportsData.pipelineFunnel.forEach((item) => {
        funnelMap[item.status] = {
          count: Number(item.count || 0),
          total_value: Number(item.total_value || 0),
        };
      });
    } else if (quotationsList.length > 0) {
      quotationsList.forEach((q) => {
        const st = q.status || "DRAFT";
        if (!funnelMap[st]) funnelMap[st] = { count: 0, total_value: 0 };
        funnelMap[st].count += 1;
        funnelMap[st].total_value += Number(q.final_amount || q.finalAmount || 0);
      });
    }

    return defaultStages.map((stageKey) => {
      const config = STAGE_CONFIG[stageKey] || { label: stageKey, color: "#64748b" };
      const stageData = funnelMap[stageKey] || { count: 0, total_value: 0 };
      return {
        stage: config.label,
        key: stageKey,
        count: stageData.count,
        dealValue: stageData.total_value,
        fill: config.color,
      };
    });
  }, [reportsData, quotationsList]);

  // Real Computed: Sales Rep Performance from Database
  const salesRepData = useMemo(() => {
    if (reportsData?.salesRepPerformance && reportsData.salesRepPerformance.length > 0) {
      return reportsData.salesRepPerformance.map((rep) => ({
        name: rep.full_name || "Sales Rep",
        revenue: Number(rep.revenue || 0),
        deals: Number(rep.total_deals || 0),
        discount: Number(rep.discount || 0),
      }));
    }
    return [];
  }, [reportsData]);

  // Real Computed: Category Breakdown from Database
  const categoryData = useMemo(() => {
    if (reportsData?.categoryBreakdown && reportsData.categoryBreakdown.length > 0) {
      return reportsData.categoryBreakdown.map((c) => ({
        name: c.name || "General",
        value: Number(c.value || 0),
        count: Number(c.count || 0),
      })).filter((c) => c.value > 0 || c.count > 0);
    }

    if (productsList.length > 0) {
      const catMap = {};
      productsList.forEach((prod) => {
        const cat = prod.category || "General";
        const val = Number(prod.unit_price || prod.unitPrice || 0) * Number(prod.stock_quantity || prod.stockQuantity || 0);
        if (!catMap[cat]) catMap[cat] = { name: cat, value: 0, count: 0 };
        catMap[cat].value += val;
        catMap[cat].count += 1;
      });
      return Object.values(catMap);
    }

    return [];
  }, [reportsData, productsList]);

  // Real Summary KPIs from Database
  const totalRevenue = Number(reportsData?.kpis?.total_revenue || 0);
  const totalDeals = Number(reportsData?.kpis?.confirmed_deals || 0);
  const totalQuotes = Number(reportsData?.kpis?.total_quotes || quotationsList.length || 0);
  const totalDiscount = Number(reportsData?.kpis?.total_discount || 0);
  const avgDiscount = Number(reportsData?.kpis?.avg_discount || 0);
  const winRate = totalQuotes > 0 ? Math.round((totalDeals / totalQuotes) * 100) : 0;
  const avgDealSize = totalDeals > 0 ? totalRevenue / totalDeals : 0;

  const topMetrics = [
    { label: "Pending Staff Complaints", value: stats?.pendingComplaints ?? "0", icon: AlertTriangleIcon, highlight: Number(stats?.pendingComplaints) > 0 },
    { label: "Pending Employee Approvals", value: stats?.pendingApprovals ?? "0", icon: AwardIcon, highlight: Number(stats?.pendingApprovals) > 0 },
    { label: "Active Enterprise Staff", value: stats?.activeEmployees ?? "0", icon: ShieldCheckIcon },
    { label: "Total Registered Clients", value: stats?.totalCustomers ?? "0", icon: LayersIcon },
    { label: "Audit & Compliance Events", value: stats?.totalAuditLogs ?? "0", icon: BarChart3Icon },

  ];

  return (
    <main className="main-content admin-page" style={{ paddingBottom: "3rem" }}>
      {/* Page Header */}
      <div className="page-heading-row" style={{ alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <p className="eyebrow" style={{ color: "#2563eb", fontWeight: 700, letterSpacing: "0.08em" }}>
            EXECUTIVE CONTROL CENTER
          </p>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#0f172a", marginTop: "0.2rem" }}>
            Platform Overview & Analytics
          </h1>
          <p className="page-subtitle" style={{ color: "#64748b", fontSize: "0.95rem" }}>
            Real-time business intelligence, margin protection, quotation pipelines, and risk distribution from database records.
          </p>
        </div>

        {/* Action Controls & Navigation Shortcuts */}
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
          <button
            className="btn-secondary"
            onClick={() => onNavigate("/admin/staff")}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 1rem", fontSize: "0.85rem", fontWeight: 600 }}
          >
            <UsersIcon size={15} /> Manage Staff ({stats?.activeEmployees ?? 0})
          </button>
          <button
            className="btn-secondary"
            onClick={() => onNavigate("/admin/products")}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 1rem", fontSize: "0.85rem", fontWeight: 600 }}
          >
            <PackageIcon size={15} /> Product Catalog ({productsList.length})
          </button>
          <button
            className="btn-primary"
            onClick={() => onNavigate("/admin/reports")}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 1.1rem", fontSize: "0.85rem", fontWeight: 700 }}
          >
            <ArrowUpRightIcon size={16} /> Deep Reports
          </button>
        </div>
      </div>

      {/* Primary KPI Ribbon */}
      <div className="metric-grid" style={{ marginTop: "1.25rem", marginBottom: "2rem" }}>
        {topMetrics.map((item) => {
          const Icon = item.icon;
          return (
            <div
              className="metric-card"
              key={item.label}
              style={{
                border: item.highlight ? "1px solid #f59e0b" : "1px solid #e2e8f0",
                background: item.highlight ? "linear-gradient(135deg, #fffbeb 0%, #ffffff 100%)" : "#ffffff",
                boxShadow: "0 4px 12px -2px rgba(0,0,0,0.05)",
                padding: "1.25rem",
                borderRadius: "14px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <div className="metric-label" style={{ fontWeight: 600, color: "#475569", fontSize: "0.85rem" }}>
                  {item.label}
                </div>
                <div style={{ padding: "0.4rem", borderRadius: "8px", background: item.highlight ? "#fef3c7" : "#eff6ff", color: item.highlight ? "#d97706" : "#2563eb" }}>
                  <Icon size={16} />
                </div>
              </div>
              <div className="metric-value" style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a" }}>
                {item.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Smart Alerts Section */}
      <div style={{ marginBottom: "2.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.85rem" }}>
          <h2 style={{ fontSize: "1.15rem", display: "flex", alignItems: "center", gap: "0.5rem", margin: 0, fontWeight: 700, color: "#1e293b" }}>
            <BellIcon size={18} color="#0284c7" /> Smart Operational Alerts & Guardrails
          </h2>
          <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 500 }}>
            Automated platform risk scanners
          </span>
        </div>

        {alertsLoading ? (
          <div style={{ padding: "1.25rem", background: "#f8fafc", borderRadius: "12px", color: "#64748b", textAlign: "center", border: "1px dashed #cbd5e1" }}>
            Analyzing platform activity for anomalies and alerts...
          </div>
        ) : alerts && alerts.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {alerts.map((alert, idx) => {
              const isWarning = alert.type === "WARNING";
              const isCritical = alert.type === "CRITICAL";
              return (
                <div
                  key={alert.id || idx}
                  style={{
                    padding: "1rem 1.25rem",
                    background: isCritical ? "#fef2f2" : isWarning ? "#fffbeb" : "#f0f9ff",
                    border: `1px solid ${isCritical ? "#fecaca" : isWarning ? "#fde68a" : "#bae6fd"}`,
                    borderRadius: "12px",
                    display: "flex",
                    gap: "0.85rem",
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ marginTop: "0.15rem" }}>
                    {isCritical ? (
                      <AlertCircleIcon size={18} color="#dc2626" />
                    ) : isWarning ? (
                      <AlertTriangleIcon size={18} color="#d97706" />
                    ) : (
                      <InfoIcon size={18} color="#0284c7" />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <strong
                      style={{
                        color: isCritical ? "#991b1b" : isWarning ? "#92400e" : "#075985",
                        display: "block",
                        fontSize: "0.9rem",
                      }}
                    >
                      {alert.message}
                    </strong>
                    {alert.actionRequired && (
                      <div
                        style={{
                          marginTop: "0.25rem",
                          color: isCritical ? "#b91c1c" : isWarning ? "#b45309" : "#0369a1",
                          fontSize: "0.82rem",
                        }}
                      >
                        <strong>Action:</strong> {alert.actionRequired}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: "1rem 1.25rem", background: "#f8fafc", borderRadius: "12px", color: "#64748b", textAlign: "center", border: "1px solid #e2e8f0", fontSize: "0.88rem" }}>
            No immediate alerts. All margin policies and authorization flows are healthy!
          </div>
        )}
      </div>


      <section className="admin-action-grid">
        <button className="admin-action-card" onClick={() => onNavigate("/admin/staff")}>
          <span className="admin-action-kicker">Access control</span>
          <strong>Manage staff</strong>
          <span>Create and edit staff IDs, credentials, roles, and status.</span>
        </button>
        <button className="admin-action-card" onClick={() => onNavigate("/admin/products")}>
          <span className="admin-action-kicker">Catalog control</span>
          <strong>Manage products</strong>
          <span>Maintain product prices, costs, categories, and availability for quotations.</span>
        </button>
        <button className="admin-action-card" onClick={() => onNavigate("/admin/complaints")}>
          <span className="admin-action-kicker" style={{ color: stats?.pendingComplaints > 0 ? "#dc2626" : "#2563eb" }}>
            {stats?.pendingComplaints > 0 ? `${stats.pendingComplaints} Pending Review` : "Customer Oversight"}
          </span>
          <strong>Staff Complaints</strong>
          <span>Review client complaints against staff, take corrective actions, and respond to customers.</span>
        </button>
      </section>


      {/* ========================================================================= */}
      {/* 100% REAL DATABASE MULTI-CHART BUSINESS INTELLIGENCE SECTION             */}
      {/* ========================================================================= */}
      <section style={{ marginTop: "1rem" }}>
        {/* Section Header with Timeframe Filter */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
            padding: "1.25rem 1.5rem",
            background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            borderRadius: "16px",
            color: "#ffffff",
            marginBottom: "1.5rem",
            boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.2)",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <TrendingUpIcon size={22} color="#38bdf8" />
              <h2 style={{ fontSize: "1.35rem", fontWeight: 800, margin: 0, color: "#ffffff", letterSpacing: "0.01em" }}>
                Executive Analytics & Commercial Intelligence
              </h2>
            </div>
            <p style={{ margin: "0.3rem 0 0 0", color: "#94a3b8", fontSize: "0.88rem" }}>
              Real-time analytics querying active database records for revenue, margins, deal health, and pipeline flow.
            </p>
          </div>

          {/* Timeframe selector pill */}
          <div style={{ display: "flex", background: "rgba(255, 255, 255, 0.1)", padding: "0.25rem", borderRadius: "10px", gap: "0.25rem" }}>
            {[
              { key: "30", label: "Last 30 Days" },
              { key: "90", label: "Last 90 Days" },
              { key: "all", label: "All Time" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setTimeframe(tab.key)}
                style={{
                  border: "none",
                  padding: "0.4rem 0.85rem",
                  borderRadius: "8px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  background: timeframe === tab.key ? "#2563eb" : "transparent",
                  color: timeframe === tab.key ? "#ffffff" : "#cbd5e1",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Executive KPI Pulse Cards from Real DB Data */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "14px", border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Commercial Win Rate
            </span>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#10b981", marginTop: "0.2rem" }}>
              {winRate}%
            </div>
            <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
              {totalDeals} won of {totalQuotes} total quotations
            </span>
          </div>

          <div style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "14px", border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Gross Revenue Booked
            </span>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#2563eb", marginTop: "0.2rem" }}>
              {formatCurrency(totalRevenue)}
            </div>
            <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
              Avg Deal: {formatCurrency(avgDealSize)}
            </span>
          </div>

          <div style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "14px", border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Pipeline Health Score
            </span>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, color: avgHealthScore >= 75 ? "#10b981" : "#f59e0b", marginTop: "0.2rem" }}>
              {avgHealthScore} / 100
            </div>
            <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
              Calculated across {dealHealthData.length} active deals
            </span>
          </div>

          <div style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "14px", border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Total Discounts Granted
            </span>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#8b5cf6", marginTop: "0.2rem" }}>
              {formatCurrency(totalDiscount)}
            </div>
            <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
              Avg discount: {formatCurrency(avgDiscount)} / quote
            </span>
          </div>
        </div>

        {/* MULTI-CHART GRID: ROW 1 (Revenue & Margin Trend + Deal Health Risk Donut) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))", gap: "1.5rem", marginBottom: "1.5rem" }}>
          
          {/* CHART 1: Real Monthly Revenue & Margin Performance */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              padding: "1.5rem",
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 14px rgba(0, 0, 0, 0.05)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <div>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#2563eb", textTransform: "uppercase" }}>Financial Trend</span>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a", margin: "0.1rem 0" }}>
                  Monthly Revenue vs Net Margin
                </h3>
                <p style={{ fontSize: "0.82rem", color: "#64748b", margin: 0 }}>
                  Real transaction values & profit contribution from database
                </p>
              </div>
              <div style={{ background: "#eff6ff", color: "#2563eb", padding: "0.4rem 0.75rem", borderRadius: "8px", fontSize: "0.78rem", fontWeight: 700 }}>
                {monthlyTrendData.length} Periods Recorded
              </div>
            </div>

            <div style={{ height: "270px", width: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => `₹${v >= 1000 ? v / 1000 + 'k' : v}`} axisLine={{ stroke: "#e2e8f0" }} />
                  <Tooltip
                    formatter={(val, name) => [formatCurrency(val), name === "revenue" ? "Gross Revenue" : name === "margin" ? "Net Margin" : "Discount"]}
                    contentStyle={{ background: "#0f172a", color: "#ffffff", borderRadius: "10px", border: "none", fontSize: "0.82rem" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "0.8rem", paddingTop: "0.5rem" }} />
                  <Bar dataKey="revenue" name="Revenue" fill="url(#revGrad)" radius={[6, 6, 0, 0]} barSize={28} />
                  <Line type="monotone" dataKey="margin" name="Net Margin" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: "#10b981" }} />
                  <Line type="monotone" dataKey="discount" name="Discount Given" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CHART 2: Deal Health & Margin Risk Matrix (Donut Chart) */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              padding: "1.5rem",
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 14px rgba(0, 0, 0, 0.05)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <div>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#10b981", textTransform: "uppercase" }}>Risk Scanner</span>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a", margin: "0.1rem 0" }}>
                  Active Deal Risk Distribution
                </h3>
                <p style={{ fontSize: "0.82rem", color: "#64748b", margin: 0 }}>
                  Real risk score and discount assessment ({dealHealthData.length} deals)
                </p>
              </div>
              <button
                className="btn-secondary"
                onClick={() => onNavigate("/admin/reports")}
                style={{ fontSize: "0.75rem", padding: "0.35rem 0.65rem" }}
              >
                Inspect Deals
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "center", height: "270px" }}>
              <div style={{ height: "100%", width: "100%", position: "relative" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={healthDistribution}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                    >
                      {healthDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val, name) => [`${val} Deals`, name]}
                      contentStyle={{ background: "#0f172a", color: "#ffffff", borderRadius: "10px", border: "none", fontSize: "0.82rem" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center score indicator */}
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    textAlign: "center",
                    pointerEvents: "none",
                  }}
                >
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>
                    {avgHealthScore}
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                    Health
                  </div>
                </div>
              </div>

              {/* Legend & Details */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", paddingLeft: "1rem" }}>
                {healthDistribution.map((item) => (
                  <div key={item.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: item.color }} />
                      <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#334155" }}>{item.name}</span>
                    </div>
                    <strong style={{ fontSize: "0.95rem", color: "#0f172a" }}>{item.value}</strong>
                  </div>
                ))}
                <div style={{ marginTop: "0.5rem", padding: "0.6rem", background: "#f8fafc", borderRadius: "8px", fontSize: "0.75rem", color: "#475569" }}>
                  💡 <strong>Threshold:</strong> Automated triggers flag deals with discount &gt;15% or risk &gt;60.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MULTI-CHART GRID: ROW 2 (Pipeline Funnel + Sales Rep Leaderboard + Category Mix) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "1.5rem" }}>
          
          {/* CHART 3: Real Quotation Status & Conversion Pipeline Funnel */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              padding: "1.5rem",
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 14px rgba(0, 0, 0, 0.05)",
            }}
          >
            <div style={{ marginBottom: "1.25rem" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#8b5cf6", textTransform: "uppercase" }}>Lifecycle Pipeline</span>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a", margin: "0.1rem 0" }}>
                Quotation Conversion Funnel
              </h3>
              <p style={{ fontSize: "0.82rem", color: "#64748b", margin: 0 }}>
                Live distribution of quotes across all sales stages
              </p>
            </div>

            <div style={{ height: "250px", width: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineFunnelData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                  <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: "#334155", fontWeight: 600 }} width={100} />
                  <Tooltip
                    formatter={(val, name, props) => [`${val} Quotes (${formatCurrency(props.payload.dealValue)})`, "Active Volume"]}
                    contentStyle={{ background: "#0f172a", color: "#ffffff", borderRadius: "10px", border: "none", fontSize: "0.82rem" }}
                  />
                  <Bar dataKey="count" name="Quotes in Stage" radius={[0, 6, 6, 0]}>
                    {pipelineFunnelData.map((entry, index) => (
                      <Cell key={`funnel-cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CHART 4: Real Sales Rep Performance Leaderboard */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              padding: "1.5rem",
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 14px rgba(0, 0, 0, 0.05)",
            }}
          >
            <div style={{ marginBottom: "1.25rem" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#f59e0b", textTransform: "uppercase" }}>Sales Execution</span>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a", margin: "0.1rem 0" }}>
                Sales Rep Revenue Leaderboard
              </h3>
              <p style={{ fontSize: "0.82rem", color: "#64748b", margin: 0 }}>
                Individual deal closure volume vs generated revenue
              </p>
            </div>

            <div style={{ height: "250px", width: "100%" }}>
              {salesRepData.length === 0 ? (
                <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#94a3b8", textAlign: "center", padding: "1rem" }}>
                  <UsersIcon size={32} style={{ marginBottom: "0.5rem", opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600 }}>No Sales Rep Records in Timeframe</p>
                  <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.78rem" }}>Confirmed deals will automatically populate rep performance.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesRepData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => `₹${v >= 1000 ? v / 1000 + 'k' : v}`} />
                    <Tooltip
                      formatter={(val, name) => [formatCurrency(val), name === "revenue" ? "Revenue" : "Discounts"]}
                      contentStyle={{ background: "#0f172a", color: "#ffffff", borderRadius: "10px", border: "none", fontSize: "0.82rem" }}
                    />
                    <Bar dataKey="revenue" name="Booked Revenue" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={22} />
                    <Bar dataKey="discount" name="Discounts Granted" fill="#fca5a5" radius={[6, 6, 0, 0]} barSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* CHART 5: Real Product Category Revenue & Inventory Valuation */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              padding: "1.5rem",
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 14px rgba(0, 0, 0, 0.05)",
            }}
          >
            <div style={{ marginBottom: "1.25rem" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#06b6d4", textTransform: "uppercase" }}>Catalog Mix</span>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a", margin: "0.1rem 0" }}>
                Product Category Valuation
              </h3>
              <p style={{ fontSize: "0.82rem", color: "#64748b", margin: 0 }}>
                Inventory capitalization by catalog category
              </p>
            </div>

            <div style={{ height: "250px", width: "100%" }}>
              {categoryData.length === 0 ? (
                <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#94a3b8", textAlign: "center", padding: "1rem" }}>
                  <PackageIcon size={32} style={{ marginBottom: "0.5rem", opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600 }}>No Product Categories Found</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cat-cell-${index}`} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val, name) => [formatCurrency(val), name]}
                      contentStyle={{ background: "#0f172a", color: "#ffffff", borderRadius: "10px", border: "none", fontSize: "0.82rem" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

        </div>

      </section>
    </main>
  );
}
