import React, { useState, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  PieChart as PieChartIcon,
  BarChart3,
  Calendar,
  Search,
  Filter,
  Bell,
  User,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Zap,
  Briefcase,
  Target,
  Clock,
  Layers,
  Sparkles,
  ArrowRight,
  ChevronDown,
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
import { useAuth } from "../context/AuthContext";

const currency = (val) =>
  `₹${Number(val || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;

const formatShortCurrency = (val) => {
  const num = Number(val || 0);
  if (Math.abs(num) >= 10000000) return `₹${(num / 10000000).toFixed(2)}Cr`;
  if (Math.abs(num) >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
  if (Math.abs(num) >= 1000) return `₹${(num / 1000).toFixed(0)}K`;
  return `₹${num}`;
};

// ----------------------------------------------------
// MOCK FINTECH DATASETS
// ----------------------------------------------------
const MONTHLY_TREND_DATA = [
  { month: "Jan", income: 90000, expenses: 55000, savings: 35000 },
  { month: "Feb", income: 110000, expenses: 63000, savings: 47000 },
  { month: "Mar", income: 105000, expenses: 60000, savings: 45000 },
  { month: "Apr", income: 115000, expenses: 68000, savings: 47000 },
  { month: "May", income: 120000, expenses: 72000, savings: 48000 },
  { month: "Jun", income: 122000, expenses: 70000, savings: 52000 },
  { month: "Jul", income: 128000, expenses: 75000, savings: 53000 },
  { month: "Aug", income: 130000, expenses: 74000, savings: 56000 },
  { month: "Sep", income: 135000, expenses: 68500, savings: 66500 },
];

const EXPENSE_CATEGORIES = [
  { name: "Housing", amount: 24000, color: "#2563eb", pct: 35.0 },
  { name: "Food", amount: 14500, color: "#10b981", pct: 21.2 },
  { name: "Shopping", amount: 12000, color: "#f43f5e", pct: 17.5, isOverBudget: true },
  { name: "Transportation", amount: 6500, color: "#06b6d4", pct: 9.5 },
  { name: "Bills & Utilities", amount: 5500, color: "#f59e0b", pct: 8.0 },
  { name: "Entertainment", amount: 3500, color: "#8b5cf6", pct: 5.1 },
  { name: "Education", amount: 2500, color: "#ec4899", pct: 3.6 },
];

const BUDGET_ITEMS = [
  { category: "Housing", budget: 25000, actual: 24000, color: "#2563eb" },
  { category: "Food", budget: 15000, actual: 14500, color: "#10b981" },
  { category: "Shopping", budget: 10000, actual: 12000, color: "#f43f5e" }, // Over budget
  { category: "Transportation", budget: 8000, actual: 6500, color: "#06b6d4" },
  { category: "Bills & Utilities", budget: 6000, actual: 5500, color: "#f59e0b" },
  { category: "Entertainment", budget: 5000, actual: 3500, color: "#8b5cf6" },
];

const PORTFOLIO_TRENDS = {
  "1M": [
    { day: "Aug 5", val: 3120000 },
    { day: "Aug 12", val: 3150000 },
    { day: "Aug 19", val: 3185000 },
    { day: "Aug 26", val: 3210000 },
    { day: "Sep 5", val: 3240000 },
  ],
  "3M": [
    { day: "Jun", val: 2950000 },
    { day: "Jul", val: 3080000 },
    { day: "Aug", val: 3180000 },
    { day: "Sep", val: 3240000 },
  ],
  "6M": [
    { day: "Apr", val: 2780000 },
    { day: "May", val: 2850000 },
    { day: "Jun", val: 2950000 },
    { day: "Jul", val: 3080000 },
    { day: "Aug", val: 3180000 },
    { day: "Sep", val: 3240000 },
  ],
  "1Y": [
    { day: "Oct 25", val: 2650000 },
    { day: "Jan 26", val: 2820000 },
    { day: "Apr 26", val: 2980000 },
    { day: "Jul 26", val: 3120000 },
    { day: "Sep 26", val: 3240000 },
  ],
  "5Y": [
    { day: "2022", val: 1450000 },
    { day: "2023", val: 1920000 },
    { day: "2024", val: 2400000 },
    { day: "2025", val: 2850000 },
    { day: "2026", val: 3240000 },
  ],
  ALL: [
    { day: "2020", val: 850000 },
    { day: "2022", val: 1450000 },
    { day: "2024", val: 2400000 },
    { day: "2026", val: 3240000 },
  ],
};

const ASSET_ALLOCATION = [
  { name: "Equity Stocks", val: 1458000, pct: 45, color: "#2563eb" },
  { name: "Mutual Funds", val: 972000, pct: 30, color: "#10b981" },
  { name: "ETFs & Index", val: 388800, pct: 12, color: "#06b6d4" },
  { name: "Bonds & Debt", val: 259200, pct: 8, color: "#f59e0b" },
  { name: "Crypto & Gold", val: 162000, pct: 5, color: "#8b5cf6" },
];

const FINANCIAL_GOALS = [
  { id: 1, name: "Emergency Fund", current: 150000, target: 200000, date: "Dec 2026", icon: ShieldCheck, color: "#10b981" },
  { id: 2, name: "Workstation Setup", current: 75000, target: 100000, date: "Oct 2026", icon: Briefcase, color: "#2563eb" },
  { id: 3, name: "Family Vacation", current: 35000, target: 80000, date: "Nov 2026", icon: Sparkles, color: "#06b6d4" },
  { id: 4, name: "Home Renovation", current: 210000, target: 500000, date: "Jun 2027", icon: Target, color: "#8b5cf6" },
];

const TRANSACTIONS = [
  { id: 1, date: "Sep 05, 2026", desc: "Monthly Salary Credit", category: "Income", account: "HDFC Bank", type: "Credit", amount: 135000 },
  { id: 2, date: "Sep 04, 2026", desc: "Amazon Shopping", category: "Shopping", account: "HDFC Credit Card", type: "Debit", amount: -3200 },
  { id: 3, date: "Sep 03, 2026", desc: "Apartment Rent", category: "Housing", account: "HDFC Bank", type: "Debit", amount: -24000 },
  { id: 4, date: "Sep 02, 2026", desc: "Supermarket Grocery", category: "Food", account: "ICICI Card", type: "Debit", amount: -4500 },
  { id: 5, date: "Sep 01, 2026", desc: "Nifty 50 Index SIP", category: "Investments", account: "Zerodha Demat", type: "Debit", amount: -15000 },
  { id: 6, date: "Aug 30, 2026", desc: "Electricity & Fibre Internet", category: "Bills & Utilities", account: "HDFC Bank", type: "Debit", amount: -5500 },
  { id: 7, date: "Aug 28, 2026", desc: "Uber Rides & Fuel", category: "Transportation", account: "ICICI Card", type: "Debit", amount: -2800 },
];

const UPCOMING_PAYMENTS = [
  { id: 1, name: "Credit Card Bill", amount: 12450, date: "Sep 10, 2026", urgency: "Due in 5 Days", status: "PENDING", color: "#f59e0b" },
  { id: 2, name: "Cloud Server Subscription", amount: 4200, date: "Sep 08, 2026", urgency: "Due in 3 Days", status: "URGENT", color: "#ef4444" },
  { id: 3, name: "Monthly Mutual Fund SIP", amount: 15000, date: "Sep 15, 2026", urgency: "Scheduled", status: "SCHEDULED", color: "#2563eb" },
  { id: 4, name: "Health Insurance Premium", amount: 18500, date: "Sep 28, 2026", urgency: "Scheduled", status: "SCHEDULED", color: "#10b981" },
];

// Sparkline Mini Data
const kpiSparklines = {
  netWorth: [{ v: 42 }, { v: 43.5 }, { v: 45 }, { v: 46.8 }, { v: 48.5 }],
  income: [{ v: 110 }, { v: 120 }, { v: 122 }, { v: 130 }, { v: 135 }],
  expenses: [{ v: 72 }, { v: 70 }, { v: 75 }, { v: 74 }, { v: 68.5 }],
  savings: [{ v: 48 }, { v: 52 }, { v: 53 }, { v: 56 }, { v: 66.5 }],
  investments: [{ v: 28 }, { v: 29.5 }, { v: 30.8 }, { v: 31.8 }, { v: 32.4 }],
};

export default function FinanceDashboard() {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState("2026-09");
  const [portfolioRange, setPortfolioRange] = useState("1M");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("ALL");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("ALL");

  // Dynamic filter for transactions table
  const filteredTransactions = useMemo(() => {
    return TRANSACTIONS.filter((tx) => {
      const matchSearch =
        tx.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.account.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat =
        selectedCategoryFilter === "ALL" ||
        tx.category.toLowerCase() === selectedCategoryFilter.toLowerCase();
      const matchType =
        selectedTypeFilter === "ALL" ||
        tx.type.toLowerCase() === selectedTypeFilter.toLowerCase();
      return matchSearch && matchCat && matchType;
    });
  }, [searchQuery, selectedCategoryFilter, selectedTypeFilter]);

  const totalMonthlyBudget = 74000;
  const currentActualExpenses = 68500;
  const budgetPercentUsed = ((currentActualExpenses / totalMonthlyBudget) * 100).toFixed(1);

  return (
    <main className="main-content sales-dashboard-container" style={{ paddingBottom: "3rem" }}>
      {/* ----------------------------------------------------
          DASHBOARD HEADER
         ---------------------------------------------------- */}
      <div className="page-heading-row" style={{ marginBottom: "1.5rem" }}>
        <div>
          <div className="badge badge-approved" style={{ marginBottom: "0.4rem", display: "inline-flex", gap: "0.35rem", alignItems: "center" }}>
            <Zap size={13} /> Enterprise Fintech Intelligence
          </div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>Financial Dashboard</h1>
          <p className="page-subtitle">Real-time net worth tracking, interactive cash flow, portfolio allocation, and automated budget analytics.</p>
        </div>

        {/* Header Controls & Filter Bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          {/* Month Selector */}
          <div style={{ position: "relative" }}>
            <select
              className="form-input no-icon"
              style={{ paddingRight: "2rem", height: "40px", fontSize: "0.85rem", fontWeight: 700, background: "rgba(255, 255, 255, 0.9)", borderColor: "#cbd5e1" }}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              <option value="2026-09">September 2026 (Current)</option>
              <option value="2026-08">August 2026</option>
              <option value="2026-07">July 2026</option>
              <option value="Q3 2026">Q3 2026 Summary</option>
              <option value="YTD 2026">Year to Date 2026</option>
            </select>
          </div>

          {/* User Profile Pill */}
          <div className="badge badge-neutral" style={{ padding: "0.5rem 0.85rem", fontSize: "0.825rem", display: "flex", alignItems: "center", gap: "0.4rem", background: "rgba(255, 255, 255, 0.9)", border: "1px solid #cbd5e1" }}>
            <User size={15} color="#2563eb" />
            <span><strong>{user?.full_name || "Finance Manager"}</strong></span>
          </div>

          {/* Notification Button */}
          <button className="icon-button" style={{ position: "relative", width: "40px", height: "40px", background: "rgba(255, 255, 255, 0.9)" }} title="Financial Alerts">
            <Bell size={18} color="#475569" />
            <span style={{ position: "absolute", top: "6px", right: "6px", width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444" }} />
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------
          SECTION 1: FINANCIAL OVERVIEW KPI CARDS (5 Cards)
         ---------------------------------------------------- */}
      <section className="metric-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        {/* Card 1: Net Worth */}
        <div className="metric-card" style={{ borderLeft: "4px solid #2563eb" }}>
          <div>
            <div className="metric-label">Net Worth</div>
            <div className="metric-value">₹48.5L</div>
            <div style={{ fontSize: "0.775rem", color: "#166534", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.2rem", marginTop: "0.2rem" }}>
              <ArrowUpRight size={14} /> +14.2% vs last period
            </div>
          </div>
          <div style={{ width: "60px", height: "36px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={kpiSparklines.netWorth}>
                <Line type="monotone" dataKey="v" stroke="#2563eb" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 2: Income */}
        <div className="metric-card" style={{ borderLeft: "4px solid #10b981" }}>
          <div>
            <div className="metric-label">Total Income</div>
            <div className="metric-value">₹1.35L</div>
            <div style={{ fontSize: "0.775rem", color: "#166534", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.2rem", marginTop: "0.2rem" }}>
              <ArrowUpRight size={14} /> +8.4% vs last period
            </div>
          </div>
          <div style={{ width: "60px", height: "36px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={kpiSparklines.income}>
                <Line type="monotone" dataKey="v" stroke="#10b981" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 3: Expenses */}
        <div className="metric-card" style={{ borderLeft: "4px solid #f43f5e" }}>
          <div>
            <div className="metric-label">Total Expenses</div>
            <div className="metric-value">₹68.5K</div>
            <div style={{ fontSize: "0.775rem", color: "#166534", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.2rem", marginTop: "0.2rem" }}>
              <ArrowDownRight size={14} /> -4.1% (Lower spending)
            </div>
          </div>
          <div style={{ width: "60px", height: "36px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={kpiSparklines.expenses}>
                <Line type="monotone" dataKey="v" stroke="#f43f5e" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 4: Savings */}
        <div className="metric-card" style={{ borderLeft: "4px solid #06b6d4" }}>
          <div>
            <div className="metric-label">Total Savings</div>
            <div className="metric-value">₹66.5K</div>
            <div style={{ fontSize: "0.775rem", color: "#0284c7", fontWeight: 700, marginTop: "0.2rem" }}>
              Savings Rate: <strong>49.2%</strong>
            </div>
          </div>
          <div style={{ width: "60px", height: "36px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={kpiSparklines.savings}>
                <Line type="monotone" dataKey="v" stroke="#06b6d4" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 5: Investment Portfolio */}
        <div className="metric-card" style={{ borderLeft: "4px solid #8b5cf6" }}>
          <div>
            <div className="metric-label">Investments</div>
            <div className="metric-value">₹32.4L</div>
            <div style={{ fontSize: "0.775rem", color: "#6d28d9", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.2rem", marginTop: "0.2rem" }}>
              <ArrowUpRight size={14} /> +18.6% Total Return
            </div>
          </div>
          <div style={{ width: "60px", height: "36px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={kpiSparklines.investments}>
                <Line type="monotone" dataKey="v" stroke="#8b5cf6" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------
          SECTION 2: INCOME VS EXPENSES COMBINED CHART
         ---------------------------------------------------- */}
      <section className="admin-panel" style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
        <div className="panel-heading-spread" style={{ marginBottom: "1rem" }}>
          <div>
            <p className="eyebrow">Cash Dynamics</p>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800 }}>Income vs Expenses vs Net Savings</h2>
          </div>
          <div style={{ fontSize: "0.825rem", color: "#64748b" }}>
            Bars indicate monthly inflows & outflows; line traces net capital retained.
          </div>
        </div>

        <div style={{ width: "100%", height: "320px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={MONTHLY_TREND_DATA} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#475569" }} />
              <YAxis tickFormatter={formatShortCurrency} tick={{ fontSize: 11, fill: "#475569" }} />
              <Tooltip formatter={(value) => currency(value)} contentStyle={{ borderRadius: "10px", borderColor: "#cbd5e1" }} />
              <Legend wrapperStyle={{ fontSize: "0.825rem", paddingTop: "0.5rem" }} />
              <Bar dataKey="income" name="Income (₹)" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={20} />
              <Bar dataKey="expenses" name="Expenses (₹)" fill="#f43f5e" radius={[6, 6, 0, 0]} barSize={20} />
              <Line type="monotone" dataKey="savings" name="Net Savings (₹)" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ----------------------------------------------------
          SECTION 3 & 4: EXPENSE BREAKDOWN (DONUT) & BUDGET TRACKING
         ---------------------------------------------------- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1.5rem", marginBottom: "1.5rem" }}>
        {/* SECTION 3: EXPENSE BREAKDOWN */}
        <section className="admin-panel" style={{ padding: "1.5rem" }}>
          <div className="panel-heading-spread" style={{ marginBottom: "1rem" }}>
            <div>
              <p className="eyebrow">Outflow Allocation</p>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 800 }}>Expense Breakdown</h2>
            </div>
            <span className="badge badge-neutral" style={{ fontSize: "0.75rem" }}>Sep 2026</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", alignItems: "center" }}>
            {/* Donut Chart with Center Total */}
            <div style={{ width: "100%", height: "220px", position: "relative" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={EXPENSE_CATEGORIES}
                    dataKey="amount"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    onClick={(data) => setSelectedCategoryFilter(data.name)}
                    style={{ cursor: "pointer" }}
                  >
                    {EXPENSE_CATEGORIES.map((cat, idx) => (
                      <Cell key={idx} fill={cat.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => currency(value)} />
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
                <div style={{ fontSize: "0.7rem", textTransform: "uppercase", color: "#64748b", fontWeight: 700 }}>Total Spent</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0f172a" }}>₹68.5K</div>
              </div>
            </div>

            {/* Ranked Category List */}
            <div style={{ display: "grid", gap: "0.45rem", overflowY: "auto", maxHeight: "220px", paddingRight: "0.25rem" }}>
              {EXPENSE_CATEGORIES.map((cat) => (
                <div
                  key={cat.name}
                  onClick={() => setSelectedCategoryFilter(selectedCategoryFilter === cat.name ? "ALL" : cat.name)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.35rem 0.65rem",
                    borderRadius: "8px",
                    cursor: "pointer",
                    background: selectedCategoryFilter === cat.name ? "rgba(37, 99, 235, 0.1)" : "rgba(248, 250, 252, 0.8)",
                    border: selectedCategoryFilter === cat.name ? "1px solid #2563eb" : "1px solid #e2e8f0",
                    fontSize: "0.8rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: cat.color }} />
                    <strong style={{ color: "#334155" }}>{cat.name}</strong>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontWeight: 700, color: "#0f172a" }}>{currency(cat.amount)}</span>
                    <span style={{ fontSize: "0.7rem", color: "#64748b", marginLeft: "0.3rem" }}>({cat.pct}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.75rem", margin: 0 }}>
            💡 Click any category segment or pill above to instantly filter the recent transactions table below.
          </p>
        </section>

        {/* SECTION 4: BUDGET VS ACTUAL TRACKING */}
        <section className="admin-panel" style={{ padding: "1.5rem" }}>
          <div className="panel-heading-spread" style={{ marginBottom: "1rem" }}>
            <div>
              <p className="eyebrow">Monthly Controls</p>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 800 }}>Budget vs Actual Performance</h2>
            </div>
            <span style={{ fontSize: "0.8rem", fontWeight: 800, color: budgetPercentUsed > 100 ? "#ef4444" : "#2563eb" }}>
              {budgetPercentUsed}% Spent (₹68.5K / ₹74K)
            </span>
          </div>

          {/* Monthly Overall Progress Bar */}
          <div style={{ marginBottom: "1.25rem", background: "rgba(241, 245, 249, 0.8)", padding: "0.75rem", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: 700, marginBottom: "0.35rem" }}>
              <span>Monthly Budget Cap</span>
              <span>Remaining: {currency(totalMonthlyBudget - currentActualExpenses)}</span>
            </div>
            <div style={{ height: "10px", width: "100%", background: "#cbd5e1", borderRadius: "5px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, budgetPercentUsed)}%`, background: "linear-gradient(90deg, #10b981, #2563eb)", borderRadius: "5px" }} />
            </div>
          </div>

          {/* Category Progress Bars */}
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {BUDGET_ITEMS.map((item) => {
              const pct = Math.round((item.actual / item.budget) * 100);
              const isOver = item.actual > item.budget;
              const barColor = isOver ? "#ef4444" : pct >= 90 ? "#f59e0b" : "#10b981";

              return (
                <div key={item.category}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "0.25rem" }}>
                    <span style={{ fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      {item.category} {isOver && <span className="badge badge-rejected" style={{ fontSize: "0.65rem", padding: "0.1rem 0.35rem" }}>Over Budget ⚠️</span>}
                    </span>
                    <span>
                      <strong>{currency(item.actual)}</strong> / {currency(item.budget)}
                      <span style={{ marginLeft: "0.4rem", fontWeight: 700, color: barColor }}>({pct}%)</span>
                    </span>
                  </div>
                  <div style={{ height: "7px", width: "100%", background: "#f1f5f9", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: barColor, borderRadius: "4px" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* ----------------------------------------------------
          SECTION 5 & 6: CASH FLOW WATERFALL & INVESTMENT PORTFOLIO
         ---------------------------------------------------- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1.5rem", marginBottom: "1.5rem" }}>
        {/* SECTION 5: CASH FLOW WATERFALL */}
        <section className="admin-panel" style={{ padding: "1.5rem" }}>
          <div className="panel-heading-spread" style={{ marginBottom: "1rem" }}>
            <div>
              <p className="eyebrow">Capital Flow</p>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 800 }}>Cash Flow Waterfall</h2>
            </div>
            <span className="badge badge-approved">+₹66,500 Retained</span>
          </div>

          <div style={{ display: "grid", gap: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", background: "rgba(240, 253, 244, 0.9)", border: "1px solid #bbf7d0", borderRadius: "10px" }}>
              <div>
                <div style={{ fontSize: "0.75rem", color: "#166534", fontWeight: 700, textTransform: "uppercase" }}>Total Gross Income</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#15803d" }}>+₹1,35,000</div>
              </div>
              <ArrowUpRight size={22} color="#166534" />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", background: "rgba(254, 242, 242, 0.9)", border: "1px solid #fecaca", borderRadius: "10px" }}>
              <div>
                <div style={{ fontSize: "0.75rem", color: "#991b1b", fontWeight: 700, textTransform: "uppercase" }}>Fixed Expenses (Rent & Utilities)</div>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "#b91c1c" }}>-₹29,500</div>
              </div>
              <span style={{ fontSize: "0.75rem", color: "#991b1b", fontWeight: 700 }}>21.8% of income</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", background: "rgba(254, 243, 199, 0.9)", border: "1px solid #fde68a", borderRadius: "10px" }}>
              <div>
                <div style={{ fontSize: "0.75rem", color: "#92400e", fontWeight: 700, textTransform: "uppercase" }}>Variable Expenses (Food & Transport)</div>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "#b45309" }}>-₹33,000</div>
              </div>
              <span style={{ fontSize: "0.75rem", color: "#92400e", fontWeight: 700 }}>24.4% of income</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", background: "rgba(241, 245, 249, 0.9)", border: "1px solid #cbd5e1", borderRadius: "10px" }}>
              <div>
                <div style={{ fontSize: "0.75rem", color: "#475569", fontWeight: 700, textTransform: "uppercase" }}>SIP Investments & Savings</div>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "#2563eb" }}>-₹26,000</div>
              </div>
              <span style={{ fontSize: "0.75rem", color: "#2563eb", fontWeight: 700 }}>19.2% allocated</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.85rem 1.15rem", background: "linear-gradient(135deg, #1e40af, #2563eb)", color: "#ffffff", borderRadius: "12px", boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)" }}>
              <div>
                <div style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, opacity: 0.9 }}>Net Liquidity Cash Flow</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 800 }}>+₹66,500</div>
              </div>
              <span className="badge badge-approved" style={{ background: "#ffffff", color: "#166534", fontWeight: 800 }}>+49.2% Retained</span>
            </div>
          </div>
        </section>

        {/* SECTION 6: INVESTMENT PORTFOLIO & ASSET ALLOCATION */}
        <section className="admin-panel" style={{ padding: "1.5rem" }}>
          <div className="panel-heading-spread" style={{ marginBottom: "0.75rem" }}>
            <div>
              <p className="eyebrow">Wealth Growth</p>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 800 }}>Investment Portfolio</h2>
            </div>

            {/* Time Range Tabs */}
            <div style={{ display: "flex", gap: "0.25rem", background: "#f1f5f9", padding: "3px", borderRadius: "8px" }}>
              {["1M", "3M", "6M", "1Y", "5Y", "ALL"].map((range) => (
                <button
                  key={range}
                  onClick={() => setPortfolioRange(range)}
                  style={{
                    padding: "0.25rem 0.55rem",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    background: portfolioRange === range ? "#ffffff" : "transparent",
                    color: portfolioRange === range ? "#2563eb" : "#64748b",
                    boxShadow: portfolioRange === range ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  }}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          {/* Portfolio Metrics Row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", background: "rgba(248, 250, 252, 0.8)", padding: "0.6rem 0.85rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <div>
              <span style={{ fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700, display: "block" }}>Portfolio Value</span>
              <strong style={{ fontSize: "1.1rem", color: "#0f172a" }}>₹32,40,000</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700, display: "block" }}>Invested</span>
              <strong style={{ fontSize: "0.95rem", color: "#475569" }}>₹26,50,000</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.7rem", color: "#166534", textTransform: "uppercase", fontWeight: 700, display: "block" }}>Total Gain</span>
              <strong style={{ fontSize: "0.95rem", color: "#166534" }}>+₹5,90,000 (+22.26%)</strong>
            </div>
          </div>

          {/* Portfolio Performance Area Chart */}
          <div style={{ width: "100%", height: "180px", marginBottom: "1rem" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={PORTFOLIO_TRENDS[portfolioRange]} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#64748b" }} />
                <YAxis tickFormatter={formatShortCurrency} tick={{ fontSize: 10, fill: "#64748b" }} />
                <Tooltip formatter={(val) => currency(val)} />
                <Area type="monotone" dataKey="val" name="Portfolio Value" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorPortfolio)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Asset Allocation Chips */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {ASSET_ALLOCATION.map((asset) => (
              <span key={asset.name} style={{ fontSize: "0.75rem", background: "rgba(241, 245, 249, 0.8)", border: "1px solid #e2e8f0", padding: "0.3rem 0.6rem", borderRadius: "6px", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: asset.color }} />
                <strong>{asset.name}</strong> ({asset.pct}%)
              </span>
            ))}
          </div>
        </section>
      </div>

      {/* ----------------------------------------------------
          SECTION 7 & 8: FINANCIAL GOALS & UPCOMING PAYMENTS
         ---------------------------------------------------- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1.5rem", marginBottom: "1.5rem" }}>
        {/* SECTION 7: FINANCIAL GOALS */}
        <section className="admin-panel" style={{ padding: "1.5rem" }}>
          <div className="panel-heading-spread" style={{ marginBottom: "1rem" }}>
            <div>
              <p className="eyebrow">Milestones</p>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 800 }}>Financial Goals Tracking</h2>
            </div>
            <span className="badge badge-approved">{FINANCIAL_GOALS.length} Active Goals</span>
          </div>

          <div style={{ display: "grid", gap: "0.85rem" }}>
            {FINANCIAL_GOALS.map((goal) => {
              const pct = Math.round((goal.current / goal.target) * 100);
              const GoalIcon = goal.icon;

              return (
                <div key={goal.id} style={{ background: "rgba(248, 250, 252, 0.8)", padding: "0.85rem 1rem", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(37, 99, 235, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <GoalIcon size={16} color={goal.color} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: "0.9rem", color: "#0f172a" }}>{goal.name}</div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Target Date: {goal.date}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 800, fontSize: "0.9rem", color: "#0f172a" }}>{currency(goal.current)}</div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Target: {currency(goal.target)}</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: "8px", width: "100%", background: "#e2e8f0", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: goal.color, borderRadius: "4px" }} />
                  </div>
                  <div style={{ fontSize: "0.75rem", color: goal.color, fontWeight: 700, marginTop: "0.3rem", textAlign: "right" }}>
                    {pct}% Completed
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 8: UPCOMING PAYMENTS & OBLIGATIONS */}
        <section className="admin-panel" style={{ padding: "1.5rem" }}>
          <div className="panel-heading-spread" style={{ marginBottom: "1rem" }}>
            <div>
              <p className="eyebrow">Obligations</p>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 800 }}>Upcoming Payments & SIPs</h2>
            </div>
            <span className="badge badge-pending">4 Scheduled</span>
          </div>

          <div style={{ display: "grid", gap: "0.75rem" }}>
            {UPCOMING_PAYMENTS.map((payment) => (
              <div
                key={payment.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.85rem 1rem",
                  background: "rgba(248, 250, 252, 0.8)",
                  border: `1px solid ${payment.status === "URGENT" ? "#fca5a5" : "#e2e8f0"}`,
                  borderRadius: "10px",
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "0.9rem" }}>{payment.name}</div>
                  <div style={{ fontSize: "0.775rem", color: "#64748b", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <Clock size={13} /> Due: {payment.date}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#0f172a" }}>{currency(payment.amount)}</div>
                  <span
                    className={`badge ${
                      payment.status === "URGENT"
                        ? "badge-rejected"
                        : payment.status === "PENDING"
                        ? "badge-pending"
                        : "badge-approved"
                    }`}
                    style={{ fontSize: "0.7rem", padding: "0.15rem 0.5rem" }}
                  >
                    {payment.urgency}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ----------------------------------------------------
          SECTION 9: RECENT TRANSACTIONS TABLE
         ---------------------------------------------------- */}
      <section className="admin-panel" style={{ padding: 0, overflow: "hidden", marginBottom: "1.5rem" }}>
        <div className="panel-heading-spread" style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #e2e8f0" }}>
          <div>
            <p className="eyebrow">Ledger Activity</p>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 800 }}>Recent Transactions</h2>
          </div>

          {/* Table Filters */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ position: "relative" }}>
              <Search size={14} color="#94a3b8" style={{ position: "absolute", left: "10px", top: "10px" }} />
              <input
                type="text"
                placeholder="Search description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
                style={{ paddingLeft: "30px", height: "34px", fontSize: "0.8rem", width: "180px" }}
              />
            </div>

            <select
              className="form-input no-icon"
              style={{ height: "34px", fontSize: "0.8rem", width: "130px" }}
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            >
              <option value="ALL">All Categories</option>
              <option value="Income">Income</option>
              <option value="Housing">Housing</option>
              <option value="Food">Food</option>
              <option value="Shopping">Shopping</option>
              <option value="Transportation">Transportation</option>
              <option value="Bills & Utilities">Bills & Utilities</option>
              <option value="Investments">Investments</option>
            </select>

            <select
              className="form-input no-icon"
              style={{ height: "34px", fontSize: "0.8rem", width: "110px" }}
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value)}
            >
              <option value="ALL">All Types</option>
              <option value="Credit">Credit (+)</option>
              <option value="Debit">Debit (-)</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Account</th>
                <th>Type</th>
                <th style={{ textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state" style={{ padding: "3rem" }}>
                    No transactions match your search/filter parameters.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isCredit = tx.type === "Credit";
                  return (
                    <tr key={tx.id}>
                      <td style={{ color: "#475569", fontSize: "0.85rem" }}>{tx.date}</td>
                      <td><strong style={{ color: "#0f172a" }}>{tx.desc}</strong></td>
                      <td><span className="badge badge-neutral" style={{ fontSize: "0.75rem" }}>{tx.category}</span></td>
                      <td style={{ color: "#64748b", fontSize: "0.85rem" }}>{tx.account}</td>
                      <td>
                        <span className={`badge ${isCredit ? "badge-approved" : "badge-draft"}`} style={{ fontSize: "0.725rem" }}>
                          {tx.type}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 800, color: isCredit ? "#166534" : "#0f172a" }}>
                        {isCredit ? `+${currency(tx.amount)}` : currency(tx.amount)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ----------------------------------------------------
          SECTION 10: FINANCIAL INSIGHTS (CARDS WITH ICONS)
         ---------------------------------------------------- */}
      <section className="admin-panel" style={{ padding: "1.5rem" }}>
        <div className="panel-heading-spread" style={{ marginBottom: "1rem" }}>
          <div>
            <p className="eyebrow">Smart Advisory</p>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 800 }}>Automated Financial Insights</h2>
          </div>
          <span className="badge badge-approved" style={{ display: "inline-flex", gap: "0.3rem", alignItems: "center" }}>
            <Sparkles size={13} /> AI Financial Advisor Active
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
          <div style={{ background: "rgba(240, 253, 244, 0.9)", border: "1px solid #bbf7d0", padding: "1rem", borderRadius: "12px", display: "flex", gap: "0.75rem" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#d1fae5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <TrendingUp size={20} color="#166534" />
            </div>
            <div>
              <div style={{ fontWeight: 800, color: "#14532d", fontSize: "0.875rem" }}>Savings Rate Improved</div>
              <div style={{ color: "#166534", fontSize: "0.825rem", marginTop: "0.2rem" }}>
                Your net savings rate increased from 28% to <strong>49.2%</strong> (₹66,500 retained) this month!
              </div>
            </div>
          </div>

          <div style={{ background: "rgba(254, 242, 242, 0.9)", border: "1px solid #fecaca", padding: "1rem", borderRadius: "12px", display: "flex", gap: "0.75rem" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <AlertTriangle size={20} color="#b91c1c" />
            </div>
            <div>
              <div style={{ fontWeight: 800, color: "#7f1d1d", fontSize: "0.875rem" }}>Budget Alert: Shopping ⚠️</div>
              <div style={{ color: "#991b1b", fontSize: "0.825rem", marginTop: "0.2rem" }}>
                Shopping expenses reached <strong>120%</strong> of budget (₹12,000 / ₹10,000). Exceeded cap by ₹2,000.
              </div>
            </div>
          </div>

          <div style={{ background: "rgba(240, 249, 255, 0.9)", border: "1px solid #bae6fd", padding: "1rem", borderRadius: "12px", display: "flex", gap: "0.75rem" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#e0f2fe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <ShieldCheck size={20} color="#0369a1" />
            </div>
            <div>
              <div style={{ fontWeight: 800, color: "#0c4a6e", fontSize: "0.875rem" }}>Emergency Fund Goal</div>
              <div style={{ color: "#0369a1", fontSize: "0.825rem", marginTop: "0.2rem" }}>
                You are <strong>75% complete</strong> (₹1.50L / ₹2.00L) and on track to hit 100% target by December 2026.
              </div>
            </div>
          </div>

          <div style={{ background: "rgba(245, 243, 255, 0.9)", border: "1px solid #ddd6fe", padding: "1rem", borderRadius: "12px", display: "flex", gap: "0.75rem" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Sparkles size={20} color="#6d28d9" />
            </div>
            <div>
              <div style={{ fontWeight: 800, color: "#4c1d95", fontSize: "0.875rem" }}>Portfolio Outperformance</div>
              <div style={{ color: "#6d28d9", fontSize: "0.825rem", marginTop: "0.2rem" }}>
                Your investment portfolio generated <strong>+₹5,90,000 (+22.26% total return)</strong> outperforming Nifty index benchmark.
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
