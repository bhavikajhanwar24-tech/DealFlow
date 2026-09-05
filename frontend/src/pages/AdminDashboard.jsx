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
  Package as PackageIcon,
  Users as UsersIcon,
  Calendar,
  Download,
  Printer,
  FileSpreadsheet,
  Search,
  Filter,
  CheckCircle,
  Clock,
  Briefcase,
  FileText,
  DollarSign,
  Activity,
  ArrowRight,
  TrendingDown,
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
  LabelList,
} from "recharts";
import { exportToCSV, printOrExportPDF } from "../utils/exportUtils";

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

export const normalizeQuotationStatus = (rawStatus) => {
  if (!rawStatus) return "DRAFT";
  const st = String(rawStatus).toUpperCase().trim();
  if (st === "PENDING" || st === "UNDER_REVIEW" || st === "REVIEW") return "PENDING_APPROVAL";
  if (st === "FINALIZED" || st === "WON" || st === "ACCEPTED" || st === "ORDER_CONFIRMED") return "CONFIRMED";
  if (st === "DECLINED" || st === "CANCELLED" || st === "CANCELED") return "REJECTED";
  return st;
};

const STAGE_CONFIG = {
  DRAFT: { label: "Draft", color: "#64748b" },
  PENDING_APPROVAL: { label: "Under Review", color: "#f59e0b" },
  PENDING: { label: "Under Review", color: "#f59e0b" },
  NEGOTIATION: { label: "In Negotiation", color: "#06b6d4" },
  APPROVED: { label: "Sales Approved", color: "#8b5cf6" },
  CONFIRMED: { label: "Won / Confirmed", color: "#10b981" },
  FINALIZED: { label: "Won / Confirmed", color: "#10b981" },
  REJECTED: { label: "Declined", color: "#ef4444" },
  CANCELLED: { label: "Cancelled", color: "#94a3b8" },
};

const formatCurrency = (val) =>
  `₹${Number(val || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const formatAxisCurrency = (v) => {
  if (!v || v === 0) return "₹0";
  const num = Number(v);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(1)}Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(0)}L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(0)}k`;
  return `₹${num}`;
};

export default function AdminDashboard({ onNavigate }) {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [quotationsList, setQuotationsList] = useState([]);
  const [reportsData, setReportsData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Active Report Filters (Powers BOTH the Charts and the Table)
  const [periodFilter, setPeriodFilter] = useState("ALL"); // ALL, TODAY, WEEK, MONTH
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dealSearchQuery, setDealSearchQuery] = useState("");

  // Staff Table Filters
  const [staffDeptFilter, setStaffDeptFilter] = useState("ALL");
  const [staffSearchQuery, setStaffSearchQuery] = useState("");

  // Load all core data from database
  useEffect(() => {
    if (!token) return;

    async function loadAllData() {
      setLoading(true);
      try {
        const [statsRes, alertsRes, quotesRes, reportsRes] = await Promise.all([
          fetch(`${API_BASE}/admin/stats`, {
            headers: { Authorization: `Bearer ${token}` },
          }).then((r) => r.json()).catch(() => ({ success: false })),
          fetch(`${API_BASE}/ai/smart-alerts`, {
            headers: { Authorization: `Bearer ${token}` },
          }).then((r) => r.json()).catch(() => ({ success: false })),
          fetch(`${API_BASE}/quotations`, {
            headers: { Authorization: `Bearer ${token}` },
          }).then((r) => r.json()).catch(() => ({ success: false })),
          fetch(`${API_BASE}/analytics/reports`, {
            headers: { Authorization: `Bearer ${token}` },
          }).then((r) => r.json()).catch(() => ({ success: false })),
        ]);

        if (statsRes.success) setStats(statsRes.data);
        if (alertsRes.success) setAlerts(alertsRes.data);
        if (quotesRes.success) setQuotationsList(quotesRes.data || []);
        if (reportsRes.success) setReportsData(reportsRes.data || null);
      } catch (error) {
        console.error("Failed to load admin dashboard datasets:", error);
      } finally {
        setLoading(false);
      }
    }

    loadAllData();
  }, [token]);

  // =========================================================================
  // 1. FILTERED DEALS DATASET (THE SINGLE SOURCE OF TRUTH FOR CHARTS & TABLE)
  // =========================================================================
  const filteredDeals = useMemo(() => {
    const now = new Date();
    return quotationsList.filter((q) => {
      // Status filter with normalization support
      if (statusFilter !== "ALL") {
        const norm = normalizeQuotationStatus(q.status);
        if (norm !== statusFilter && q.status !== statusFilter) return false;
      }

      // Period filter
      if (periodFilter !== "ALL") {
        const qDate = new Date(q.createdAt || q.created_at || Date.now());
        if (periodFilter === "TODAY") {
          if (qDate.toDateString() !== now.toDateString()) return false;
        } else if (periodFilter === "WEEK") {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (qDate < sevenDaysAgo) return false;
        } else if (periodFilter === "MONTH") {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (qDate < thirtyDaysAgo) return false;
        }
      }

      // Search query filter
      if (dealSearchQuery.trim()) {
        const query = dealSearchQuery.toLowerCase();
        const qNum = (q.quotationNumber || q.quotation_number || "").toLowerCase();
        const cName = (q.customer?.companyName || q.customer?.fullName || q.customer_name || "").toLowerCase();
        const repName = (q.salesRep?.fullName || q.sales_rep_name || "").toLowerCase();
        return qNum.includes(query) || cName.includes(query) || repName.includes(query);
      }

      return true;
    });
  }, [quotationsList, statusFilter, periodFilter, dealSearchQuery]);

  // =========================================================================
  // 2. DYNAMIC KPIS DERIVED DIRECTLY FROM FILTERED DEALS TABLE DATA
  // =========================================================================
  const totalFilteredCount = filteredDeals.length;
  
  const totalFilteredRevenue = useMemo(() => {
    return filteredDeals.reduce((acc, q) => acc + Number(q.finalAmount || q.final_amount || 0), 0);
  }, [filteredDeals]);

  const confirmedWonDeals = useMemo(() => {
    return filteredDeals.filter((q) => normalizeQuotationStatus(q.status) === "CONFIRMED");
  }, [filteredDeals]);

  const confirmedWonRevenue = useMemo(() => {
    return confirmedWonDeals.reduce((acc, q) => acc + Number(q.finalAmount || q.final_amount || 0), 0);
  }, [confirmedWonDeals]);

  const totalFilteredDiscount = useMemo(() => {
    return filteredDeals.reduce((acc, q) => acc + Number(q.discountAmount || q.discount_amount || 0), 0);
  }, [filteredDeals]);

  const avgFilteredMargin = useMemo(() => {
    if (!filteredDeals.length) return 0;
    const totalMargin = filteredDeals.reduce(
      (acc, q) => acc + Number(q.marginPercentage || q.margin_percentage || 25),
      0
    );
    return (totalMargin / filteredDeals.length).toFixed(1);
  }, [filteredDeals]);

  const dynamicWinRate = totalFilteredCount > 0
    ? Math.round((confirmedWonDeals.length / totalFilteredCount) * 100)
    : 0;

  const dynamicAvgDealSize = confirmedWonDeals.length > 0
    ? confirmedWonRevenue / confirmedWonDeals.length
    : totalFilteredCount > 0
    ? totalFilteredRevenue / totalFilteredCount
    : 0;

  // =========================================================================
  // 3. CHART 1: MONTHLY / PERIOD REVENUE & MARGIN TIMELINE (FROM FILTERED DEALS)
  // =========================================================================
  const chartTimelineData = useMemo(() => {
    if (!filteredDeals.length) {
      return [{ period: "No Data", revenue: 0, margin: 0, discount: 0, quotes: 0 }];
    }

    const map = {};
    filteredDeals.forEach((q) => {
      const d = new Date(q.createdAt || q.created_at || Date.now());
      // Format label based on period filter
      let label = d.toLocaleString("default", { month: "short", year: "2-digit" });
      if (periodFilter === "TODAY") {
        label = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
      } else if (periodFilter === "WEEK") {
        label = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });
      }

      if (!map[label]) {
        map[label] = { period: label, revenue: 0, margin: 0, discount: 0, quotes: 0, sortKey: d.getTime() };
      }

      const rev = Number(q.finalAmount || q.final_amount || 0);
      const disc = Number(q.discountAmount || q.discount_amount || 0);
      const marginPct = Number(q.marginPercentage || q.margin_percentage || 25) / 100;

      map[label].revenue += rev;
      map[label].margin += rev * marginPct;
      map[label].discount += disc;
      map[label].quotes += 1;
    });

    return Object.values(map).sort((a, b) => a.sortKey - b.sortKey);
  }, [filteredDeals, periodFilter]);

  // Deals filtered by period and search query (preserves complete pipeline lifecycle for Funnel & conversion tracking)
  const periodFilteredDeals = useMemo(() => {
    const now = new Date();
    return quotationsList.filter((q) => {
      // Period filter
      if (periodFilter !== "ALL") {
        const qDate = new Date(q.createdAt || q.created_at || Date.now());
        if (periodFilter === "TODAY") {
          if (qDate.toDateString() !== now.toDateString()) return false;
        } else if (periodFilter === "WEEK") {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (qDate < sevenDaysAgo) return false;
        } else if (periodFilter === "MONTH") {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (qDate < thirtyDaysAgo) return false;
        }
      }

      // Search query filter
      if (dealSearchQuery.trim()) {
        const query = dealSearchQuery.toLowerCase();
        const qNum = (q.quotationNumber || q.quotation_number || "").toLowerCase();
        const cName = (q.customer?.companyName || q.customer?.fullName || q.customer_name || "").toLowerCase();
        const repName = (q.salesRep?.fullName || q.sales_rep_name || "").toLowerCase();
        return qNum.includes(query) || cName.includes(query) || repName.includes(query);
      }

      return true;
    });
  }, [quotationsList, periodFilter, dealSearchQuery]);

  // =========================================================================
  // 4. CHART 2: QUOTATION STATUS FUNNEL (FROM TIMEFRAME QUOTATION DATASET)
  // =========================================================================
  const chartFunnelData = useMemo(() => {
    const stages = [
      { key: "DRAFT", label: "Draft", color: "#64748b" },
      { key: "PENDING_APPROVAL", label: "Under Review", color: "#f59e0b" },
      { key: "NEGOTIATION", label: "In Negotiation", color: "#06b6d4" },
      { key: "APPROVED", label: "Sales Approved", color: "#8b5cf6" },
      { key: "CONFIRMED", label: "Won / Confirmed", color: "#10b981" },
      { key: "REJECTED", label: "Declined", color: "#ef4444" },
    ];
    const statusCounts = {
      DRAFT: { count: 0, totalValue: 0 },
      PENDING_APPROVAL: { count: 0, totalValue: 0 },
      NEGOTIATION: { count: 0, totalValue: 0 },
      APPROVED: { count: 0, totalValue: 0 },
      CONFIRMED: { count: 0, totalValue: 0 },
      REJECTED: { count: 0, totalValue: 0 },
    };

    // Calculate stage distribution across all quotations in the current timeframe
    periodFilteredDeals.forEach((q) => {
      const norm = normalizeQuotationStatus(q.status);
      if (!statusCounts[norm]) {
        statusCounts[norm] = { count: 0, totalValue: 0 };
      }
      statusCounts[norm].count += 1;
      statusCounts[norm].totalValue += Number(q.finalAmount || q.final_amount || 0);
    });

    return stages.map(({ key: stKey, label, color }) => {
      const data = statusCounts[stKey] || { count: 0, totalValue: 0 };
      const isFiltered = statusFilter === stKey || (statusFilter === "FINALIZED" && stKey === "CONFIRMED");
      return {
        stage: label,
        key: stKey,
        count: data.count,
        dealValue: data.totalValue,
        fill: isFiltered ? "#2563eb" : color,
      };
    });
  }, [periodFilteredDeals, statusFilter]);

  // =========================================================================
  // 5. CHART 3: DEAL HEALTH & RISK MATRIX (FROM FILTERED DEALS)
  // =========================================================================
  const chartHealthData = useMemo(() => {
    let healthyCount = 0;
    let riskCount = 0;
    let criticalCount = 0;

    filteredDeals.forEach((q) => {
      const margin = Number(q.marginPercentage || q.margin_percentage || 25);
      const discount = Number(q.discountAmount || q.discount_amount || 0);
      const total = Number(q.finalAmount || q.final_amount || 0) + discount;
      const discountPercent = total > 0 ? (discount / total) * 100 : 0;
      const riskScore = Number(q.riskScore || q.risk_score || 0);
      const norm = normalizeQuotationStatus(q.status);

      if (margin < 15 || discountPercent > 25 || riskScore > 65 || norm === "REJECTED") {
        criticalCount += 1;
      } else if (discountPercent > 12 || margin < 22 || riskScore > 40 || norm === "PENDING_APPROVAL") {
        riskCount += 1;
      } else {
        healthyCount += 1;
      }
    });

    return [
      { name: "Healthy Deals (Good Margin)", value: healthyCount, color: "#10b981" },
      { name: "Margin / Discount Risk", value: riskCount, color: "#f59e0b" },
      { name: "Critical Exposure", value: criticalCount, color: "#ef4444" },
    ];
  }, [filteredDeals]);

  // =========================================================================
  // 6. CHART 4: SALES REP COMMERCIAL LEADERBOARD (FROM FILTERED DEALS)
  // =========================================================================
  const chartSalesRepData = useMemo(() => {
    const repMap = {};

    filteredDeals.forEach((q) => {
      const repName = q.salesRep?.fullName || q.sales_rep_name || "Unassigned";
      if (!repMap[repName]) {
        repMap[repName] = { name: repName, revenue: 0, totalDeals: 0, wonDeals: 0, discount: 0 };
      }
      const rev = Number(q.finalAmount || q.final_amount || 0);
      const disc = Number(q.discountAmount || q.discount_amount || 0);

      repMap[repName].revenue += rev;
      repMap[repName].discount += disc;
      repMap[repName].totalDeals += 1;
      if (normalizeQuotationStatus(q.status) === "CONFIRMED") repMap[repName].wonDeals += 1;
    });

    return Object.values(repMap).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [filteredDeals]);

  // =========================================================================
  // 7. CHART 5: TOP CUSTOMERS BY DEAL VALUE (FROM FILTERED DEALS)
  // =========================================================================
  const chartCustomerData = useMemo(() => {
    const custMap = {};

    filteredDeals.forEach((q) => {
      const name = q.customer?.companyName || q.customer?.fullName || q.customer_name || "Client";
      if (!custMap[name]) {
        custMap[name] = { name, value: 0, count: 0 };
      }
      custMap[name].value += Number(q.finalAmount || q.final_amount || 0);
      custMap[name].count += 1;
    });

    const list = Object.values(custMap).sort((a, b) => b.value - a.value).slice(0, 5);
    const totalTopVal = list.reduce((acc, curr) => acc + curr.value, 0);

    return list.map((item) => ({
      ...item,
      percentage: totalTopVal > 0 ? Math.round((item.value / totalTopVal) * 100) : 0,
    }));
  }, [filteredDeals]);

  // Staff Table Data
  const allStaffPerformance = useMemo(() => {
    if (reportsData?.salesRepPerformance && reportsData.salesRepPerformance.length > 0) {
      return reportsData.salesRepPerformance.map((rep) => ({
        id: rep.id,
        name: rep.full_name || "Employee",
        email: rep.email || "",
        employeeId: rep.employee_id || "N/A",
        department: rep.department || "Sales",
        role: rep.role || "SALES_REP",
        status: rep.status || "ACTIVE",
        revenue: Number(rep.revenue || 0),
        totalDeals: Number(rep.total_deals || 0),
        wonDeals: Number(rep.won_deals || 0),
        pipelineValue: Number(rep.total_pipeline_value || 0),
        discount: Number(rep.discount || 0),
      }));
    }
    return [];
  }, [reportsData]);

  const filteredStaff = useMemo(() => {
    return allStaffPerformance.filter((staff) => {
      if (staffDeptFilter !== "ALL" && staff.department !== staffDeptFilter && staff.role !== staffDeptFilter) {
        return false;
      }
      if (staffSearchQuery.trim()) {
        const query = staffSearchQuery.toLowerCase();
        return (
          staff.name.toLowerCase().includes(query) ||
          staff.email.toLowerCase().includes(query) ||
          staff.employeeId.toLowerCase().includes(query) ||
          staff.department.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [allStaffPerformance, staffDeptFilter, staffSearchQuery]);

  const staffDepartments = useMemo(() => {
    const depts = new Set(["ALL"]);
    allStaffPerformance.forEach((s) => {
      if (s.department) depts.add(s.department);
    });
    return Array.from(depts);
  }, [allStaffPerformance]);

  // Export handlers for Quotation & Deal Reports
  const handleExportDealsCSV = () => {
    const exportData = filteredDeals.map((q) => ({
      quotationNumber: q.quotationNumber || q.quotation_number,
      customer: q.customer?.companyName || q.customer?.fullName || q.customer_name || "N/A",
      customerEmail: q.customer?.email || q.customer_email || "N/A",
      salesRep: q.salesRep?.fullName || q.sales_rep_name || "N/A",
      status: q.status,
      createdDate: new Date(q.createdAt || q.created_at).toLocaleDateString("en-IN"),
      subtotal: Number(q.subtotal || 0),
      discountAmount: Number(q.discountAmount || q.discount_amount || 0),
      finalAmount: Number(q.finalAmount || q.final_amount || 0),
      marginPercentage: `${Number(q.marginPercentage || q.margin_percentage || 0).toFixed(1)}%`,
    }));

    const headers = [
      { key: "quotationNumber", label: "Quotation #" },
      { key: "customer", label: "Customer" },
      { key: "customerEmail", label: "Customer Email" },
      { key: "salesRep", label: "Sales Rep" },
      { key: "status", label: "Status" },
      { key: "createdDate", label: "Created Date" },
      { key: "subtotal", label: "Subtotal (₹)" },
      { key: "discountAmount", label: "Discount (₹)" },
      { key: "finalAmount", label: "Final Amount (₹)" },
      { key: "marginPercentage", label: "Gross Margin" },
    ];

    exportToCSV("Admin_DealFlow_Executive_Report", exportData, headers);
  };

  const handlePrintDealsPDF = () => {
    const rows = filteredDeals.map((q) => [
      q.quotationNumber || q.quotation_number,
      q.customer?.companyName || q.customer?.fullName || q.customer_name || "N/A",
      q.salesRep?.fullName || q.sales_rep_name || "N/A",
      q.status,
      new Date(q.createdAt || q.created_at).toLocaleDateString("en-IN"),
      formatCurrency(q.finalAmount || q.final_amount),
      `${Number(q.marginPercentage || q.margin_percentage || 0).toFixed(1)}%`,
    ]);

    const headers = ["Quote #", "Customer", "Sales Rep", "Status", "Date", "Final Value", "Margin"];

    const summaryCards = [
      { label: "Total Filtered Deals", value: filteredDeals.length },
      { label: "Filtered Revenue", value: formatCurrency(totalFilteredRevenue) },
      { label: "Pipeline Win Rate", value: `${dynamicWinRate}%` },
      { label: "Avg Gross Margin", value: `${avgFilteredMargin}%` },
    ];

    printOrExportPDF({
      title: "Executive Quotation & Deal Audit Report",
      subtitle: `System-wide Commercial Deals & Quotation Analysis (Generated ${new Date().toLocaleDateString("en-IN")})`,
      metadata: [
        { label: "Period Filter", value: periodFilter },
        { label: "Status Filter", value: statusFilter },
        { label: "Search Filter", value: dealSearchQuery || "None" },
      ],
      headers,
      rows,
      summaryCards,
    });
  };

  const topMetrics = [
    { label: "Pending Staff Complaints", value: stats?.pendingComplaints ?? "0", icon: AlertTriangleIcon, highlight: Number(stats?.pendingComplaints) > 0 },
    { label: "Pending Employee Approvals", value: stats?.pendingApprovals ?? "0", icon: AwardIcon, highlight: Number(stats?.pendingApprovals) > 0 },
    { label: "Active Enterprise Staff", value: stats?.activeEmployees ?? allStaffPerformance.length ?? "0", icon: ShieldCheckIcon },
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
            Multi-chart commercial intelligence generated directly from your live Quotation & Deal Export data.
          </p>
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
      <div style={{ marginBottom: "2rem" }}>
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




      {/* ========================================================================= */}
      {/* 1. INTERACTIVE FILTER TOOLBAR FOR QUOTATIONS & ANALYTICS CHARTS          */}
      {/* ========================================================================= */}
      <section
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          padding: "1.5rem",
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 14px rgba(0, 0, 0, 0.05)",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <TrendingUpIcon size={24} color="#2563eb" />
              <h2 style={{ fontSize: "1.35rem", fontWeight: 800, margin: 0, color: "#0f172a", letterSpacing: "0.01em" }}>
                Commercial Analytics & Quotation Intelligence
              </h2>
            </div>
            <p style={{ margin: "0.3rem 0 0 0", color: "#64748b", fontSize: "0.88rem" }}>
              All charts below dynamically calculate and update in real-time from the Quotation & Deal Export dataset.
            </p>
          </div>

          {/* Export Action Buttons */}
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button
              type="button"
              onClick={handleExportDealsCSV}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                padding: "0.5rem 1rem",
                fontSize: "0.82rem",
                fontWeight: 700,
                background: "#eff6ff",
                color: "#2563eb",
                border: "1px solid #bfdbfe",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              <Download size={15} color="#2563eb" /> Export CSV
            </button>
            <button
              type="button"
              onClick={handlePrintDealsPDF}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                padding: "0.5rem 1rem",
                fontSize: "0.82rem",
                fontWeight: 700,
                background: "#f8fafc",
                color: "#334155",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              <Printer size={15} color="#475569" /> Print / PDF
            </button>
          </div>
        </div>

        {/* Live Filter Controls */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.85rem",
            padding: "0.85rem 1rem",
            background: "#f8fafc",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
          }}
        >
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
            {/* Search */}
            <div style={{ display: "flex", alignItems: "center", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "0.4rem 0.75rem", gap: "0.5rem" }}>
              <Search size={15} color="#64748b" />
              <input
                type="text"
                placeholder="Search quote #, customer, rep..."
                value={dealSearchQuery}
                onChange={(e) => setDealSearchQuery(e.target.value)}
                style={{ border: "none", background: "transparent", outline: "none", fontSize: "0.84rem", width: "220px", color: "#0f172a" }}
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: "0.45rem 0.85rem",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                fontSize: "0.82rem",
                fontWeight: 600,
                color: "#334155",
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="APPROVED">Sales Approved</option>
              <option value="NEGOTIATION">In Negotiation</option>
              <option value="CONFIRMED">Confirmed / Won</option>
              <option value="REJECTED">Declined</option>
            </select>

            {/* Period Filter */}
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              style={{
                padding: "0.45rem 0.85rem",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                fontSize: "0.82rem",
                fontWeight: 600,
                color: "#334155",
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today</option>
              <option value="WEEK">Last 7 Days</option>
              <option value="MONTH">Last 30 Days</option>
            </select>
          </div>

          <div style={{ fontSize: "0.85rem", color: "#475569", fontWeight: 600 }}>
            Analyzing <strong style={{ color: "#0f172a" }}>{totalFilteredCount}</strong> deals in view | Value: <strong style={{ color: "#2563eb" }}>{formatCurrency(totalFilteredRevenue)}</strong>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. DYNAMIC LIVE KPI CARDS COMPUTED FROM FILTERED DEALS                    */}
      {/* ========================================================================= */}
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
            Pipeline Win Rate
          </span>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#10b981", marginTop: "0.2rem" }}>
            {dynamicWinRate}%
          </div>
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
            {confirmedWonDeals.length} won of {totalFilteredCount} deals in view
          </span>
        </div>

        <div style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "14px", border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Total Pipeline Volume
          </span>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#2563eb", marginTop: "0.2rem" }}>
            {formatCurrency(totalFilteredRevenue)}
          </div>
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
            Avg Deal: {formatCurrency(dynamicAvgDealSize)}
          </span>
        </div>

        <div style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "14px", border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Average Gross Margin
          </span>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: Number(avgFilteredMargin) >= 20 ? "#10b981" : "#f59e0b", marginTop: "0.2rem" }}>
            {avgFilteredMargin}%
          </div>
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
            Across {totalFilteredCount} active quotations
          </span>
        </div>

        <div style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "14px", border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Total Discounts Granted
          </span>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#8b5cf6", marginTop: "0.2rem" }}>
            {formatCurrency(totalFilteredDiscount)}
          </div>
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
            Summed from current filtered view
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MULTI-CHART GRID (COMPUTED IN REAL-TIME FROM FILTERED DEALS DATASET)   */}
      {/* ========================================================================= */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))", gap: "1.5rem", marginBottom: "1.5rem" }}>
        
        {/* CHART 1: Real Period Revenue vs Net Margin Timeline */}
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
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#2563eb", textTransform: "uppercase" }}>Timeline Breakdown</span>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a", margin: "0.1rem 0" }}>
                Revenue & Margin Progression
              </h3>
              <p style={{ fontSize: "0.82rem", color: "#64748b", margin: 0 }}>
                Aggregated directly from {totalFilteredCount} deals in the current view
              </p>
            </div>
            <div style={{ background: "#eff6ff", color: "#2563eb", padding: "0.4rem 0.75rem", borderRadius: "8px", fontSize: "0.78rem", fontWeight: 700 }}>
              {chartTimelineData.length} Periods
            </div>
          </div>

          <div style={{ height: "270px", width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartTimelineData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={formatAxisCurrency} width={55} axisLine={{ stroke: "#e2e8f0" }} />
                <Tooltip
                  formatter={(val, name) => [formatCurrency(val), name === "revenue" ? "Revenue" : name === "margin" ? "Net Margin" : "Discounts"]}
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

        {/* CHART 2: Deal Risk & Margin Health Donut Matrix */}
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
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#10b981", textTransform: "uppercase" }}>Risk Matrix</span>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a", margin: "0.1rem 0" }}>
                Deal Health & Risk Distribution
              </h3>
              <p style={{ fontSize: "0.82rem", color: "#64748b", margin: 0 }}>
                Live evaluation across {totalFilteredCount} quotations
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "center", height: "270px" }}>
            <div style={{ height: "100%", width: "100%", position: "relative" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartHealthData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                  >
                    {chartHealthData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val, name) => [`${val} Deals`, name]}
                    contentStyle={{ background: "#0f172a", color: "#ffffff", borderRadius: "10px", border: "none", fontSize: "0.82rem" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center counter */}
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
                  {totalFilteredCount}
                </div>
                <div style={{ fontSize: "0.65rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                  Deals
                </div>
              </div>
            </div>

            {/* Legend & Details */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", paddingLeft: "1rem" }}>
              {chartHealthData.map((item) => (
                <div key={item.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: item.color }} />
                    <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#334155" }}>{item.name}</span>
                  </div>
                  <strong style={{ fontSize: "0.95rem", color: "#0f172a" }}>{item.value}</strong>
                </div>
              ))}
              <div style={{ marginTop: "0.5rem", padding: "0.6rem", background: "#f8fafc", borderRadius: "8px", fontSize: "0.75rem", color: "#475569" }}>
                💡 <strong>Dynamic Guardrail:</strong> Evaluates discounts &gt;15% or margins &lt;15% in current view.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 2: Funnel + Sales Rep Comparison + Top Customers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
        
        {/* CHART 3: Quotation Funnel (From Filtered Deals) */}
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
              Live stage counts & volume in filtered view
            </p>
          </div>

          <div style={{ height: "260px", width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartFunnelData} layout="vertical" margin={{ top: 5, right: 35, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: "#334155", fontWeight: 600 }} width={115} />
                <Tooltip
                  formatter={(val, name, props) => [`${val} Quotes (${formatCurrency(props.payload.dealValue)})`, "Active Volume"]}
                  contentStyle={{ background: "#0f172a", color: "#ffffff", borderRadius: "10px", border: "none", fontSize: "0.82rem" }}
                />
                <Bar dataKey="count" name="Quotes in Stage" minPointSize={6} radius={[0, 6, 6, 0]}>
                  {chartFunnelData.map((entry, index) => (
                    <Cell key={`funnel-cell-${index}`} fill={entry.fill} />
                  ))}
                  <LabelList
                    dataKey="count"
                    position="right"
                    formatter={(val) => (val > 0 ? `${val}` : "0")}
                    style={{ fontSize: "11px", fill: "#334155", fontWeight: 700 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 4: Sales Rep Revenue in Current Filter */}
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
              Sales Rep Performance in View
            </h3>
            <p style={{ fontSize: "0.82rem", color: "#64748b", margin: 0 }}>
              Revenue & discounts by assigned representative
            </p>
          </div>

          <div style={{ height: "250px", width: "100%" }}>
            {chartSalesRepData.length === 0 ? (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#94a3b8", textAlign: "center", padding: "1rem" }}>
                <UsersIcon size={32} style={{ marginBottom: "0.5rem", opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600 }}>No Deals for Representatives</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartSalesRepData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    interval={0}
                    tickFormatter={(name) => (name.length > 11 ? name.slice(0, 9) + ".." : name)}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    tickFormatter={formatAxisCurrency}
                    width={50}
                  />
                  <Tooltip
                    formatter={(val, name) => [
                      formatCurrency(val),
                      name === "revenue" ? "Booked Deal Volume" : "Discounts Granted",
                    ]}
                    contentStyle={{ background: "#0f172a", color: "#ffffff", borderRadius: "10px", border: "none", fontSize: "0.82rem" }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "0.75rem", paddingTop: "0.4rem" }}
                    formatter={(val) => (val === "revenue" ? "Booked Deal Volume (₹)" : "Discounts Granted (₹)")}
                  />
                  <Bar dataKey="revenue" name="revenue" fill="#2563eb" radius={[5, 5, 0, 0]} barSize={16} />
                  <Bar dataKey="discount" name="discount" fill="#f43f5e" radius={[5, 5, 0, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* CHART 5: Top Customers in Current Filter */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "16px",
            padding: "1.5rem",
            border: "1px solid #e2e8f0",
            boxShadow: "0 4px 14px rgba(0, 0, 0, 0.05)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ marginBottom: "1rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#06b6d4", textTransform: "uppercase" }}>Client Contribution</span>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a", margin: "0.1rem 0" }}>
              Top Clients by Deal Value
            </h3>
            <p style={{ fontSize: "0.82rem", color: "#64748b", margin: 0 }}>
              Leading accounts in current filtered dataset
            </p>
          </div>

          <div style={{ flex: 1, minHeight: "250px" }}>
            {chartCustomerData.length === 0 ? (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#94a3b8", textAlign: "center", padding: "1rem" }}>
                <PackageIcon size={32} style={{ marginBottom: "0.5rem", opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600 }}>No Customer Records in View</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: "1rem", alignItems: "center", height: "100%" }}>
                {/* Donut Chart with Center Count */}
                <div style={{ position: "relative", width: "130px", height: "130px", margin: "0 auto" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartCustomerData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={38}
                        outerRadius={60}
                        paddingAngle={3}
                      >
                        {chartCustomerData.map((entry, index) => (
                          <Cell key={`cust-cell-${index}`} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val, name) => [formatCurrency(val), name]}
                        contentStyle={{ background: "#0f172a", color: "#ffffff", borderRadius: "10px", border: "none", fontSize: "0.82rem" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
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
                    <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>
                      {chartCustomerData.length}
                    </div>
                    <div style={{ fontSize: "0.6rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                      Clients
                    </div>
                  </div>
                </div>

                {/* Clean Custom Legend List */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", minWidth: 0 }}>
                  {chartCustomerData.map((item, index) => (
                    <div
                      key={item.name}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.35rem 0.55rem",
                        borderRadius: "8px",
                        background: "#f8fafc",
                        border: "1px solid #f1f5f9",
                        gap: "0.5rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: CHART_PALETTE[index % CHART_PALETTE.length],
                            flexShrink: 0,
                          }}
                        />
                        <span
                          title={item.name}
                          style={{
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            color: "#334155",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.name}
                        </span>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <strong style={{ fontSize: "0.8rem", color: "#0f172a" }}>{formatCurrency(item.value)}</strong>
                        <span style={{ fontSize: "0.7rem", color: "#64748b", marginLeft: "0.3rem" }}>({item.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 4. QUOTATION & DEAL EXPORT REPORTS (SYSTEM-WIDE TABLE BACKING THE CHARTS)  */}
      {/* ========================================================================= */}
      <section
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          padding: "1.5rem",
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 14px rgba(0, 0, 0, 0.05)",
          marginBottom: "2.5rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <FileSpreadsheet size={22} color="#10b981" />
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, color: "#0f172a" }}>
                Quotation & Deal Export Reports (System-Wide)
              </h2>
            </div>
            <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "0.2rem 0 0 0" }}>
              The exact dataset powering the visual charts above. Filter, inspect, and export seamlessly.
            </p>
          </div>

          <div style={{ fontSize: "0.85rem", color: "#475569", fontWeight: 600 }}>
            Showing <strong>{filteredDeals.length}</strong> of <strong>{quotationsList.length}</strong> total records
          </div>
        </div>

        {/* Deals Table */}
        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ width: "100%", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", color: "#475569", fontWeight: 700 }}>QUOTATION #</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", color: "#475569", fontWeight: 700 }}>CUSTOMER</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", color: "#475569", fontWeight: 700 }}>SALES REP</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "center", color: "#475569", fontWeight: 700 }}>CREATED</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "center", color: "#475569", fontWeight: 700 }}>STATUS</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "right", color: "#475569", fontWeight: 700 }}>MARGIN</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "right", color: "#475569", fontWeight: 700 }}>FINAL AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeals.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
                    No quotations found matching the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filteredDeals.map((q) => {
                  const statusConfig = STAGE_CONFIG[q.status] || { label: q.status, color: "#64748b" };
                  return (
                    <tr key={q.id || q.quotationNumber} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <strong style={{ color: "#2563eb" }}>{q.quotationNumber || q.quotation_number}</strong>
                      </td>
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <strong style={{ color: "#0f172a", display: "block" }}>
                          {q.customer?.companyName || q.customer?.fullName || q.customer_name || "N/A"}
                        </strong>
                        <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                          {q.customer?.email || q.customer_email || ""}
                        </span>
                      </td>
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <span style={{ fontWeight: 600, color: "#334155" }}>
                          {q.salesRep?.fullName || q.sales_rep_name || "Unassigned"}
                        </span>
                      </td>
                      <td style={{ padding: "0.85rem 1rem", textAlign: "center", color: "#64748b", fontSize: "0.8rem" }}>
                        {new Date(q.createdAt || q.created_at).toLocaleDateString("en-IN")}
                      </td>
                      <td style={{ padding: "0.85rem 1rem", textAlign: "center" }}>
                        <span
                          style={{
                            padding: "0.25rem 0.55rem",
                            borderRadius: "6px",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            background: `${statusConfig.color}18`,
                            color: statusConfig.color,
                            border: `1px solid ${statusConfig.color}40`,
                          }}
                        >
                          {statusConfig.label}
                        </span>
                      </td>
                      <td style={{ padding: "0.85rem 1rem", textAlign: "right", fontWeight: 700, color: Number(q.marginPercentage || q.margin_percentage || 0) < 20 ? "#ef4444" : "#10b981" }}>
                        {Number(q.marginPercentage || q.margin_percentage || 0).toFixed(1)}%
                      </td>
                      <td style={{ padding: "0.85rem 1rem", textAlign: "right", fontWeight: 800, color: "#0f172a" }}>
                        {formatCurrency(q.finalAmount || q.final_amount)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. COMPLETE STAFF ROSTER & DEPARTMENT PERFORMANCE AUDIT TABLE             */}
      {/* ========================================================================= */}
      <section
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          padding: "1.5rem",
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 14px rgba(0, 0, 0, 0.05)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Briefcase size={20} color="#2563eb" />
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, color: "#0f172a" }}>
                Staff Workforce & Department Audit
              </h2>
            </div>
            <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "0.2rem 0 0 0" }}>
              Live connection to all {allStaffPerformance.length} internal staff accounts across departments.
            </p>
          </div>

          {/* Department Filter & Search */}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "0.35rem 0.65rem", gap: "0.4rem" }}>
              <Search size={14} color="#64748b" />
              <input
                type="text"
                placeholder="Search staff, ID, department..."
                value={staffSearchQuery}
                onChange={(e) => setStaffSearchQuery(e.target.value)}
                style={{ border: "none", background: "transparent", outline: "none", fontSize: "0.82rem", width: "160px" }}
              />
            </div>

            <select
              value={staffDeptFilter}
              onChange={(e) => setStaffDeptFilter(e.target.value)}
              style={{
                padding: "0.4rem 0.75rem",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                fontSize: "0.82rem",
                fontWeight: 600,
                color: "#334155",
              }}
            >
              {staffDepartments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept === "ALL" ? "All Departments" : dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Staff Table */}
        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ width: "100%", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", color: "#475569", fontWeight: 700 }}>STAFF MEMBER</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", color: "#475569", fontWeight: 700 }}>STAFF ID</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", color: "#475569", fontWeight: 700 }}>DEPARTMENT / ROLE</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "center", color: "#475569", fontWeight: 700 }}>TOTAL DEALS</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "center", color: "#475569", fontWeight: 700 }}>WON DEALS</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "right", color: "#475569", fontWeight: 700 }}>CONFIRMED REVENUE</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "right", color: "#475569", fontWeight: 700 }}>TOTAL PIPELINE</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "center", color: "#475569", fontWeight: 700 }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
                    No staff members match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredStaff.map((staff) => (
                  <tr key={staff.id || staff.email} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <strong style={{ color: "#0f172a", display: "block" }}>{staff.name}</strong>
                      <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{staff.email}</span>
                    </td>
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <code style={{ background: "#f1f5f9", padding: "0.2rem 0.4rem", borderRadius: "4px", fontSize: "0.78rem" }}>
                        {staff.employeeId}
                      </code>
                    </td>
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <span style={{ fontWeight: 600, color: "#334155" }}>{staff.department}</span>
                      <span style={{ display: "block", fontSize: "0.75rem", color: "#64748b" }}>{staff.role}</span>
                    </td>
                    <td style={{ padding: "0.85rem 1rem", textAlign: "center", fontWeight: 700 }}>
                      {staff.totalDeals}
                    </td>
                    <td style={{ padding: "0.85rem 1rem", textAlign: "center", fontWeight: 700, color: staff.wonDeals > 0 ? "#10b981" : "#64748b" }}>
                      {staff.wonDeals}
                    </td>
                    <td style={{ padding: "0.85rem 1rem", textAlign: "right", fontWeight: 800, color: "#2563eb" }}>
                      {formatCurrency(staff.revenue)}
                    </td>
                    <td style={{ padding: "0.85rem 1rem", textAlign: "right", fontWeight: 600, color: "#475569" }}>
                      {formatCurrency(staff.pipelineValue)}
                    </td>
                    <td style={{ padding: "0.85rem 1rem", textAlign: "center" }}>
                      <span
                        style={{
                          padding: "0.25rem 0.55rem",
                          borderRadius: "6px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          background: staff.status === "ACTIVE" ? "#f0fdf4" : "#fef2f2",
                          color: staff.status === "ACTIVE" ? "#166534" : "#991b1b",
                        }}
                      >
                        {staff.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </section>
    </main>
  );
}
