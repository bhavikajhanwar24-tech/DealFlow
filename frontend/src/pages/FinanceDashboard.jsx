import React, { useState, useMemo, useEffect } from "react";
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
  Download,
  FileText,
} from "lucide-react";
import { exportToCSV, printOrExportPDF } from "../utils/exportUtils";
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

const API_BASE = "http://localhost:5000/api";

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
// MULTI-PERIOD DATASETS FOR TIME FILTERS (Q3, Q2, YTD, MONTHLY)
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

const PERIOD_CONFIG = {
  "2026-09": {
    label: "September 2026 (Current)",
    shortLabel: "Sep 2026",
    months: ["Sep"],
    filterPeriods: ["2026-09"],
    kpi: {
      netWorth: "₹48.5L",
      netWorthDelta: "+14.2% vs last period",
      income: "₹1.35L",
      incomeDelta: "+8.4% vs last period",
      expenses: "₹68.5K",
      expensesDelta: "-4.1% (Lower spending)",
      savings: "₹66.5K",
      savingsRate: "49.2%",
      investments: "₹32.4L",
      investmentsDelta: "+18.6% Total Return",
      sparklines: {
        netWorth: [{ v: 42 }, { v: 43.5 }, { v: 45 }, { v: 46.8 }, { v: 48.5 }],
        income: [{ v: 110 }, { v: 120 }, { v: 122 }, { v: 130 }, { v: 135 }],
        expenses: [{ v: 72 }, { v: 70 }, { v: 75 }, { v: 74 }, { v: 68.5 }],
        savings: [{ v: 48 }, { v: 52 }, { v: 53 }, { v: 56 }, { v: 66.5 }],
        investments: [{ v: 28 }, { v: 29.5 }, { v: 30.8 }, { v: 31.8 }, { v: 32.4 }],
      },
    },
    expenseCategories: [
      { name: "Housing", amount: 24000, color: "#2563eb", pct: 35.0 },
      { name: "Food", amount: 14500, color: "#10b981", pct: 21.2 },
      { name: "Shopping", amount: 12000, color: "#f43f5e", pct: 17.5, isOverBudget: true },
      { name: "Transportation", amount: 6500, color: "#06b6d4", pct: 9.5 },
      { name: "Bills & Utilities", amount: 5500, color: "#f59e0b", pct: 8.0 },
      { name: "Entertainment", amount: 3500, color: "#8b5cf6", pct: 5.1 },
      { name: "Education", amount: 2500, color: "#ec4899", pct: 3.6 },
    ],
    totalSpent: 68500,
    budgetMultiplier: 1,
    budgetItems: [
      { category: "Housing", budget: 25000, actual: 24000, color: "#2563eb" },
      { category: "Food", budget: 15000, actual: 14500, color: "#10b981" },
      { category: "Shopping", budget: 10000, actual: 12000, color: "#f43f5e" },
      { category: "Transportation", budget: 8000, actual: 6500, color: "#06b6d4" },
      { category: "Bills & Utilities", budget: 6000, actual: 5500, color: "#f59e0b" },
      { category: "Entertainment", budget: 5000, actual: 3500, color: "#8b5cf6" },
    ],
    waterfall: {
      grossIncome: 135000,
      fixedExpenses: 29500,
      variableExpenses: 33000,
      sip: 26000,
      netRetained: 66500,
      retainedRate: "49.2%",
    },
    insights: [
      { type: "up", title: "Savings Rate Improved", desc: "Your net savings rate increased to 49.2% (₹66,500 retained) in September!" },
      { type: "alert", title: "Budget Alert: Shopping ⚠️", desc: "Shopping expenses reached 120% of budget (₹12,000 / ₹10,000). Exceeded cap by ₹2,000." },
      { type: "goal", title: "Emergency Fund Milestone", desc: "Emergency Fund is 75% complete (₹1.50L / ₹2.00L) and on track for December 2026." },
      { type: "star", title: "Portfolio Outperformance", desc: "Your portfolio reached ₹32,40,000 (+22.26% total return) outperforming index benchmarks." },
    ],
  },
  "2026-08": {
    label: "August 2026",
    shortLabel: "Aug 2026",
    months: ["Aug"],
    filterPeriods: ["2026-08"],
    kpi: {
      netWorth: "₹46.8L",
      netWorthDelta: "+11.5% vs last period",
      income: "₹1.30L",
      incomeDelta: "+1.5% vs Jul",
      expenses: "₹74.0K",
      expensesDelta: "-1.3% (Lower than Jul)",
      savings: "₹56.0K",
      savingsRate: "43.1%",
      investments: "₹31.8L",
      investmentsDelta: "+16.2% Total Return",
      sparklines: {
        netWorth: [{ v: 40 }, { v: 42 }, { v: 43.5 }, { v: 45 }, { v: 46.8 }],
        income: [{ v: 105 }, { v: 115 }, { v: 120 }, { v: 122 }, { v: 130 }],
        expenses: [{ v: 68 }, { v: 72 }, { v: 70 }, { v: 75 }, { v: 74 }],
        savings: [{ v: 45 }, { v: 47 }, { v: 48 }, { v: 52 }, { v: 56 }],
        investments: [{ v: 26.5 }, { v: 28 }, { v: 29.5 }, { v: 30.8 }, { v: 31.8 }],
      },
    },
    expenseCategories: [
      { name: "Housing", amount: 24000, color: "#2563eb", pct: 32.4 },
      { name: "Food", amount: 15200, color: "#10b981", pct: 20.5 },
      { name: "Shopping", amount: 13800, color: "#f43f5e", pct: 18.6, isOverBudget: true },
      { name: "Transportation", amount: 8400, color: "#06b6d4", pct: 11.4, isOverBudget: true },
      { name: "Bills & Utilities", amount: 6200, color: "#f59e0b", pct: 8.4 },
      { name: "Entertainment", amount: 4200, color: "#8b5cf6", pct: 5.7 },
      { name: "Education", amount: 2200, color: "#ec4899", pct: 3.0 },
    ],
    totalSpent: 74000,
    budgetMultiplier: 1,
    budgetItems: [
      { category: "Housing", budget: 25000, actual: 24000, color: "#2563eb" },
      { category: "Food", budget: 15000, actual: 15200, color: "#10b981" },
      { category: "Shopping", budget: 10000, actual: 13800, color: "#f43f5e" },
      { category: "Transportation", budget: 8000, actual: 8400, color: "#06b6d4" },
      { category: "Bills & Utilities", budget: 6000, actual: 6200, color: "#f59e0b" },
      { category: "Entertainment", budget: 5000, actual: 4200, color: "#8b5cf6" },
    ],
    waterfall: {
      grossIncome: 130000,
      fixedExpenses: 30200,
      variableExpenses: 37400,
      sip: 26000,
      netRetained: 56000,
      retainedRate: "43.1%",
    },
    insights: [
      { type: "up", title: "Robust August Savings", desc: "Maintained strong savings of ₹56,000 (43.1% rate) despite festival shopping commitments." },
      { type: "alert", title: "Transport Overrun ⚠️", desc: "Highway toll & cab fees pushed transportation to ₹8,400 (5% over budget limit)." },
      { type: "goal", title: "Workstation Setup Pacing", desc: "Workstation fund reached ₹75,000 (75% completed) with planned delivery in October." },
      { type: "star", title: "Mutual Fund Rally", desc: "Portfolio gained +₹1.0L during August rally supported by broad-based equity performance." },
    ],
  },
  "2026-07": {
    label: "July 2026",
    shortLabel: "Jul 2026",
    months: ["Jul"],
    filterPeriods: ["2026-07"],
    kpi: {
      netWorth: "₹45.0L",
      netWorthDelta: "+8.9% vs Jun",
      income: "₹1.28L",
      incomeDelta: "+4.9% vs Jun",
      expenses: "₹75.0K",
      expensesDelta: "+7.1% (Annual travel)",
      savings: "₹53.0K",
      savingsRate: "41.4%",
      investments: "₹30.8L",
      investmentsDelta: "+14.1% Total Return",
      sparklines: {
        netWorth: [{ v: 38 }, { v: 40 }, { v: 42 }, { v: 43.5 }, { v: 45 }],
        income: [{ v: 100 }, { v: 105 }, { v: 115 }, { v: 120 }, { v: 128 }],
        expenses: [{ v: 65 }, { v: 68 }, { v: 72 }, { v: 70 }, { v: 75 }],
        savings: [{ v: 42 }, { v: 45 }, { v: 47 }, { v: 48 }, { v: 53 }],
        investments: [{ v: 25 }, { v: 26.5 }, { v: 28 }, { v: 29.5 }, { v: 30.8 }],
      },
    },
    expenseCategories: [
      { name: "Housing", amount: 24000, color: "#2563eb", pct: 32.0 },
      { name: "Food", amount: 14800, color: "#10b981", pct: 19.7 },
      { name: "Shopping", amount: 11200, color: "#f43f5e", pct: 14.9, isOverBudget: true },
      { name: "Transportation", amount: 11500, color: "#06b6d4", pct: 15.3, isOverBudget: true },
      { name: "Bills & Utilities", amount: 6800, color: "#f59e0b", pct: 9.1 },
      { name: "Entertainment", amount: 4500, color: "#8b5cf6", pct: 6.0 },
      { name: "Education", amount: 2200, color: "#ec4899", pct: 3.0 },
    ],
    totalSpent: 75000,
    budgetMultiplier: 1,
    budgetItems: [
      { category: "Housing", budget: 25000, actual: 24000, color: "#2563eb" },
      { category: "Food", budget: 15000, actual: 14800, color: "#10b981" },
      { category: "Shopping", budget: 10000, actual: 11200, color: "#f43f5e" },
      { category: "Transportation", budget: 8000, actual: 11500, color: "#06b6d4" },
      { category: "Bills & Utilities", budget: 6000, actual: 6800, color: "#f59e0b" },
      { category: "Entertainment", budget: 5000, actual: 4500, color: "#8b5cf6" },
    ],
    waterfall: {
      grossIncome: 128000,
      fixedExpenses: 30800,
      variableExpenses: 38200,
      sip: 26000,
      netRetained: 53000,
      retainedRate: "41.4%",
    },
    insights: [
      { type: "up", title: "Dividend Bonus Accrued", desc: "Received an extra ₹18,000 consulting dividend boosting July gross income to ₹1.28L." },
      { type: "alert", title: "Annual Flight Bookings ⚠️", desc: "Annual family flight bookings added ₹9,400 under transportation." },
      { type: "goal", title: "Vacation Milestone Fund", desc: "Family vacation allocation reached ₹35,000 towards November getaway." },
      { type: "star", title: "Positive Cash Retained", desc: "Retained ₹53,000 despite seasonal peak travel and insurance costs." },
    ],
  },
  "Q3 2026": {
    label: "Q3 2026 Summary (Jul – Sep)",
    shortLabel: "Q3 2026",
    months: ["Jul", "Aug", "Sep"],
    filterPeriods: ["2026-07", "2026-08", "2026-09"],
    kpi: {
      netWorth: "₹48.5L",
      netWorthDelta: "+14.2% vs Q2",
      income: "₹3.93L",
      incomeDelta: "+10.1% vs Q2 Inflow",
      expenses: "₹2.18L",
      expensesDelta: "+3.6% (Within Budget Cap)",
      savings: "₹1.76L",
      savingsRate: "44.7%",
      investments: "₹32.4L",
      investmentsDelta: "+18.6% Total Return",
      sparklines: {
        netWorth: [{ v: 42 }, { v: 43.5 }, { v: 45 }, { v: 46.8 }, { v: 48.5 }],
        income: [{ v: 122 }, { v: 125 }, { v: 128 }, { v: 130 }, { v: 135 }],
        expenses: [{ v: 70 }, { v: 72 }, { v: 75 }, { v: 74 }, { v: 68.5 }],
        savings: [{ v: 52 }, { v: 53 }, { v: 53 }, { v: 56 }, { v: 66.5 }],
        investments: [{ v: 29.5 }, { v: 30 }, { v: 30.8 }, { v: 31.8 }, { v: 32.4 }],
      },
    },
    expenseCategories: [
      { name: "Housing", amount: 72000, color: "#2563eb", pct: 33.1 },
      { name: "Food", amount: 44500, color: "#10b981", pct: 20.5 },
      { name: "Shopping", amount: 37000, color: "#f43f5e", pct: 17.0, isOverBudget: true },
      { name: "Transportation", amount: 26400, color: "#06b6d4", pct: 12.1 },
      { name: "Bills & Utilities", amount: 18500, color: "#f59e0b", pct: 8.5 },
      { name: "Entertainment", amount: 12200, color: "#8b5cf6", pct: 5.6 },
      { name: "Education", amount: 6900, color: "#ec4899", pct: 3.2 },
    ],
    totalSpent: 217500,
    budgetMultiplier: 3,
    budgetItems: [
      { category: "Housing", budget: 75000, actual: 72000, color: "#2563eb" },
      { category: "Food", budget: 45000, actual: 44500, color: "#10b981" },
      { category: "Shopping", budget: 30000, actual: 37000, color: "#f43f5e" },
      { category: "Transportation", budget: 24000, actual: 26400, color: "#06b6d4" },
      { category: "Bills & Utilities", budget: 18000, actual: 18500, color: "#f59e0b" },
      { category: "Entertainment", budget: 15000, actual: 12200, color: "#8b5cf6" },
    ],
    waterfall: {
      grossIncome: 393000,
      fixedExpenses: 90500,
      variableExpenses: 108600,
      sip: 78000,
      netRetained: 175500,
      retainedRate: "44.7%",
    },
    insights: [
      { type: "up", title: "Outstanding Q3 Performance", desc: "Retained ₹1,75,500 with a 44.7% cumulative savings rate across July, August, and September." },
      { type: "alert", title: "Quarterly Budget Status", desc: "Overall spending was ₹2.18L vs ₹2.22L total budget cap (Under budget by ₹4,500 overall!)." },
      { type: "goal", title: "Emergency Fund Progress", desc: "Grew from ₹1.20L to ₹1.50L during Q3, pacing toward the December target." },
      { type: "star", title: "SIP Consistency", desc: "All 3 monthly SIPs executed without delay, compound asset value at ₹32.40L." },
    ],
  },
  "Q2 2026": {
    label: "Q2 2026 Summary (Apr – Jun)",
    shortLabel: "Q2 2026",
    months: ["Apr", "May", "Jun"],
    filterPeriods: ["2026-04", "2026-05", "2026-06"],
    kpi: {
      netWorth: "₹43.5L",
      netWorthDelta: "+11.5% vs Q1",
      income: "₹3.57L",
      incomeDelta: "+17.0% vs Q1",
      expenses: "₹2.10L",
      expensesDelta: "+18.0% vs Q1",
      savings: "₹1.47L",
      savingsRate: "41.2%",
      investments: "₹29.5L",
      investmentsDelta: "+11.3% Total Return",
      sparklines: {
        netWorth: [{ v: 39 }, { v: 40.5 }, { v: 41.8 }, { v: 42.5 }, { v: 43.5 }],
        income: [{ v: 105 }, { v: 110 }, { v: 115 }, { v: 120 }, { v: 122 }],
        expenses: [{ v: 60 }, { v: 63 }, { v: 68 }, { v: 72 }, { v: 70 }],
        savings: [{ v: 45 }, { v: 47 }, { v: 47 }, { v: 48 }, { v: 52 }],
        investments: [{ v: 26.5 }, { v: 27 }, { v: 27.8 }, { v: 28.5 }, { v: 29.5 }],
      },
    },
    expenseCategories: [
      { name: "Housing", amount: 72000, color: "#2563eb", pct: 34.3 },
      { name: "Food", amount: 42000, color: "#10b981", pct: 20.0 },
      { name: "Shopping", amount: 32000, color: "#f43f5e", pct: 15.2 },
      { name: "Transportation", amount: 24500, color: "#06b6d4", pct: 11.7 },
      { name: "Bills & Utilities", amount: 21500, color: "#f59e0b", pct: 10.2 },
      { name: "Entertainment", amount: 11500, color: "#8b5cf6", pct: 5.5 },
      { name: "Education", amount: 6500, color: "#ec4899", pct: 3.1 },
    ],
    totalSpent: 210000,
    budgetMultiplier: 3,
    budgetItems: [
      { category: "Housing", budget: 75000, actual: 72000, color: "#2563eb" },
      { category: "Food", budget: 45000, actual: 42000, color: "#10b981" },
      { category: "Shopping", budget: 30000, actual: 32000, color: "#f43f5e" },
      { category: "Transportation", budget: 24000, actual: 24500, color: "#06b6d4" },
      { category: "Bills & Utilities", budget: 18000, actual: 21500, color: "#f59e0b" },
      { category: "Entertainment", budget: 15000, actual: 11500, color: "#8b5cf6" },
    ],
    waterfall: {
      grossIncome: 357000,
      fixedExpenses: 93500,
      variableExpenses: 98500,
      sip: 78000,
      netRetained: 147000,
      retainedRate: "41.2%",
    },
    insights: [
      { type: "up", title: "Strong Q2 Inflow", desc: "Gross income expanded to ₹3.57L driven by annual compensation revisions and side projects." },
      { type: "alert", title: "Utility Surge in May", desc: "Summer electricity & annual air-conditioner maintenance increased utilities." },
      { type: "goal", title: "Retirement Corpus", desc: "Equity index asset holdings topped ₹29.5L with solid compound growth." },
      { type: "star", title: "Tax Deductions Claimed", desc: "Section 80C and ELSS deduction allocations fully utilized before fiscal deadline." },
    ],
  },
  "YTD 2026": {
    label: "Year to Date 2026 (Jan – Sep)",
    shortLabel: "YTD 2026",
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"],
    filterPeriods: ["ALL"],
    kpi: {
      netWorth: "₹48.5L",
      netWorthDelta: "+34.7% since Jan",
      income: "₹10.55L",
      incomeDelta: "+21.4% Annualized Run Rate",
      expenses: "₹6.06L",
      expensesDelta: "Under Total Budget Cap",
      savings: "₹4.50L",
      savingsRate: "42.6%",
      investments: "₹32.4L",
      investmentsDelta: "+22.26% YTD Gain",
      sparklines: {
        netWorth: [{ v: 36 }, { v: 39 }, { v: 42 }, { v: 45 }, { v: 48.5 }],
        income: [{ v: 90 }, { v: 105 }, { v: 115 }, { v: 125 }, { v: 135 }],
        expenses: [{ v: 55 }, { v: 60 }, { v: 68 }, { v: 72 }, { v: 68.5 }],
        savings: [{ v: 35 }, { v: 45 }, { v: 47 }, { v: 53 }, { v: 66.5 }],
        investments: [{ v: 24.5 }, { v: 26.5 }, { v: 28.5 }, { v: 30.8 }, { v: 32.4 }],
      },
    },
    expenseCategories: [
      { name: "Housing", amount: 216000, color: "#2563eb", pct: 35.7 },
      { name: "Food", amount: 124000, color: "#10b981", pct: 20.5 },
      { name: "Shopping", amount: 98000, color: "#f43f5e", pct: 16.2 },
      { name: "Transportation", amount: 68000, color: "#06b6d4", pct: 11.2 },
      { name: "Bills & Utilities", amount: 54000, color: "#f59e0b", pct: 8.9 },
      { name: "Entertainment", amount: 31000, color: "#8b5cf6", pct: 5.1 },
      { name: "Education", amount: 14500, color: "#ec4899", pct: 2.4 },
    ],
    totalSpent: 605500,
    budgetMultiplier: 9,
    budgetItems: [
      { category: "Housing", budget: 225000, actual: 216000, color: "#2563eb" },
      { category: "Food", budget: 135000, actual: 124000, color: "#10b981" },
      { category: "Shopping", budget: 90000, actual: 98000, color: "#f43f5e" },
      { category: "Transportation", budget: 72000, actual: 68000, color: "#06b6d4" },
      { category: "Bills & Utilities", budget: 54000, actual: 54000, color: "#f59e0b" },
      { category: "Entertainment", budget: 45000, actual: 31000, color: "#8b5cf6" },
    ],
    waterfall: {
      grossIncome: 1055000,
      fixedExpenses: 270000,
      variableExpenses: 285500,
      sip: 234000,
      netRetained: 449500,
      retainedRate: "42.6%",
    },
    insights: [
      { type: "up", title: "₹4.50L Saved YTD", desc: "Accumulated ₹4,49,500 in net retained liquidity across 9 months with an average 42.6% savings rate." },
      { type: "alert", title: "Annual Expense Discipline", desc: "Total YTD expenses of ₹6.06L stayed comfortably below the ₹6.66L cumulative budget cap." },
      { type: "goal", title: "Emergency Fund 75% Complete", desc: "Surpassed ₹1.50L benchmark, remaining on course to achieve full ₹2.00L safety net." },
      { type: "star", title: "Wealth Creation Milestone", desc: "Total net worth scaled from ₹36L to ₹48.5L (+34.7%) through disciplined investment allocations." },
    ],
  },
};

const PORTFOLIO_STATS = {
  "1M": { val: "₹32,40,000", invested: "₹31,20,000", gain: "+₹1,20,000 (+3.85%)" },
  "3M": { val: "₹32,40,000", invested: "₹29,50,000", gain: "+₹2,90,000 (+9.83%)" },
  "6M": { val: "₹32,40,000", invested: "₹27,80,000", gain: "+₹4,60,000 (+16.55%)" },
  "1Y": { val: "₹32,40,000", invested: "₹26,50,000", gain: "+₹5,90,000 (+22.26%)" },
  "5Y": { val: "₹32,40,000", invested: "₹14,50,000", gain: "+₹17,90,000 (+123.4%)" },
  ALL: { val: "₹32,40,000", invested: "₹8,50,000", gain: "+₹23,90,000 (+281.2%)" },
};

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

const ALL_TRANSACTIONS = [
  // September 2026
  { id: 101, date: "Sep 05, 2026", period: "2026-09", desc: "Monthly Salary Credit", category: "Income", account: "HDFC Bank", type: "Credit", amount: 135000 },
  { id: 102, date: "Sep 04, 2026", period: "2026-09", desc: "Amazon Shopping Festival", category: "Shopping", account: "HDFC Credit Card", type: "Debit", amount: -3200 },
  { id: 103, date: "Sep 03, 2026", period: "2026-09", desc: "Apartment Rent & Maintenance", category: "Housing", account: "HDFC Bank", type: "Debit", amount: -24000 },
  { id: 104, date: "Sep 02, 2026", period: "2026-09", desc: "Supermarket Grocery & Dairy", category: "Food", account: "ICICI Card", type: "Debit", amount: -4500 },
  { id: 105, date: "Sep 01, 2026", period: "2026-09", desc: "Nifty 50 Index Fund SIP", category: "Investments", account: "Zerodha Demat", type: "Debit", amount: -15000 },

  // August 2026
  { id: 106, date: "Aug 30, 2026", period: "2026-08", desc: "Electricity & High-Speed Fibre", category: "Bills & Utilities", account: "HDFC Bank", type: "Debit", amount: -5500 },
  { id: 107, date: "Aug 28, 2026", period: "2026-08", desc: "Uber Airport Rides & City Fuel", category: "Transportation", account: "ICICI Card", type: "Debit", amount: -2800 },
  { id: 108, date: "Aug 25, 2026", period: "2026-08", desc: "Freelance Consulting Retainer", category: "Income", account: "HDFC Bank", type: "Credit", amount: 25000 },
  { id: 109, date: "Aug 20, 2026", period: "2026-08", desc: "Electronics & Smart Watch", category: "Shopping", account: "HDFC Credit Card", type: "Debit", amount: -8800 },
  { id: 110, date: "Aug 15, 2026", period: "2026-08", desc: "Dining Out & Weekend Brunch", category: "Food", account: "ICICI Card", type: "Debit", amount: -5200 },
  { id: 111, date: "Aug 05, 2026", period: "2026-08", desc: "Monthly Salary Credit", category: "Income", account: "HDFC Bank", type: "Credit", amount: 130000 },
  { id: 112, date: "Aug 03, 2026", period: "2026-08", desc: "Apartment Rent", category: "Housing", account: "HDFC Bank", type: "Debit", amount: -24000 },

  // July 2026
  { id: 113, date: "Jul 28, 2026", period: "2026-07", desc: "Quarterly Water & Gas Bill", category: "Bills & Utilities", account: "HDFC Bank", type: "Debit", amount: -6200 },
  { id: 114, date: "Jul 22, 2026", period: "2026-07", desc: "Flight Tickets & Hotel Booking", category: "Transportation", account: "HDFC Credit Card", type: "Debit", amount: -9400 },
  { id: 115, date: "Jul 18, 2026", period: "2026-07", desc: "Client Bonus Dividend", category: "Income", account: "HDFC Bank", type: "Credit", amount: 18000 },
  { id: 116, date: "Jul 10, 2026", period: "2026-07", desc: "Gourmet Grocery & Organics", category: "Food", account: "ICICI Card", type: "Debit", amount: -4800 },
  { id: 117, date: "Jul 05, 2026", period: "2026-07", desc: "Monthly Salary Credit", category: "Income", account: "HDFC Bank", type: "Credit", amount: 128000 },
  { id: 118, date: "Jul 03, 2026", period: "2026-07", desc: "Apartment Rent", category: "Housing", account: "HDFC Bank", type: "Debit", amount: -24000 },

  // Q2 2026 (Apr - Jun)
  { id: 119, date: "Jun 25, 2026", period: "2026-06", desc: "Semi-Annual Car Insurance", category: "Bills & Utilities", account: "HDFC Bank", type: "Debit", amount: -14500 },
  { id: 120, date: "Jun 15, 2026", period: "2026-06", desc: "Software License & Cloud Tools", category: "Shopping", account: "ICICI Card", type: "Debit", amount: -6500 },
  { id: 121, date: "Jun 05, 2026", period: "2026-06", desc: "Monthly Salary Credit", category: "Income", account: "HDFC Bank", type: "Credit", amount: 122000 },
  { id: 122, date: "May 20, 2026", period: "2026-05", desc: "Home Appliance Replacement", category: "Housing", account: "HDFC Credit Card", type: "Debit", amount: -12500 },
  { id: 123, date: "May 05, 2026", period: "2026-05", desc: "Monthly Salary Credit", category: "Income", account: "HDFC Bank", type: "Credit", amount: 120000 },
  { id: 124, date: "Apr 22, 2026", period: "2026-04", desc: "Annual Tax Filing & Legal Audit", category: "Bills & Utilities", account: "HDFC Bank", type: "Debit", amount: -8500 },
  { id: 125, date: "Apr 05, 2026", period: "2026-04", desc: "Monthly Salary Credit", category: "Income", account: "HDFC Bank", type: "Credit", amount: 115000 },

  // Q1 2026 (Jan - Mar)
  { id: 126, date: "Mar 15, 2026", period: "2026-03", desc: "Q1 Performance Incentive", category: "Income", account: "HDFC Bank", type: "Credit", amount: 20000 },
  { id: 127, date: "Feb 10, 2026", period: "2026-02", desc: "Apparel & Winter Footwear", category: "Shopping", account: "ICICI Card", type: "Debit", amount: -7500 },
  { id: 128, date: "Jan 12, 2026", period: "2026-01", desc: "New Year Health Club Membership", category: "Bills & Utilities", account: "HDFC Bank", type: "Debit", amount: -9500 },
];

const UPCOMING_PAYMENTS = [
  { id: 1, name: "Credit Card Bill", amount: 12450, date: "Sep 10, 2026", urgency: "Due in 5 Days", status: "PENDING", color: "#f59e0b" },
  { id: 2, name: "Cloud Server Subscription", amount: 4200, date: "Sep 08, 2026", urgency: "Due in 3 Days", status: "URGENT", color: "#ef4444" },
  { id: 3, name: "Monthly Mutual Fund SIP", amount: 15000, date: "Sep 15, 2026", urgency: "Scheduled", status: "SCHEDULED", color: "#2563eb" },
  { id: 4, name: "Health Insurance Premium", amount: 18500, date: "Sep 28, 2026", urgency: "Scheduled", status: "SCHEDULED", color: "#10b981" },
];

export default function FinanceDashboard({ onNavigate }) {
  const { user, token } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState("2026-09");
  const [portfolioRange, setPortfolioRange] = useState("1M");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("ALL");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("ALL");

  // Real Database Invoice Metrics
  const [invoiceSummary, setInvoiceSummary] = useState(null);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);

  useEffect(() => {
    async function loadInvoiceData() {
      try {
        const [sumRes, invRes] = await Promise.all([
          fetch(`${API_BASE}/invoices/summary`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/invoices`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const sumData = await sumRes.json();
        const invData = await invRes.json();

        if (sumData.success) setInvoiceSummary(sumData.data);
        if (invData.success) setRecentInvoices(invData.data || []);
      } catch (err) {
        console.error("Failed to load invoice summary in FinanceDashboard:", err);
      } finally {
        setInvoicesLoading(false);
      }
    }

    if (token) {
      loadInvoiceData();
    }
  }, [token]);

  // Retrieve dynamic period configuration
  const activePeriod = PERIOD_CONFIG[selectedMonth] || PERIOD_CONFIG["2026-09"];

  // Filter trend chart data based on active period
  const trendChartData = useMemo(() => {
    if (activePeriod.months.length === 1) {
      const target = activePeriod.months[0];
      const idx = MONTHLY_TREND_DATA.findIndex((d) => d.month === target);
      if (idx !== -1) {
        const start = Math.max(0, idx - 4);
        return MONTHLY_TREND_DATA.slice(start, idx + 1);
      }
    }
    return MONTHLY_TREND_DATA.filter((d) => activePeriod.months.includes(d.month));
  }, [selectedMonth]);

  // Filter transactions by period first
  const periodTransactions = useMemo(() => {
    if (activePeriod.filterPeriods.includes("ALL")) {
      return ALL_TRANSACTIONS;
    }
    return ALL_TRANSACTIONS.filter((tx) =>
      activePeriod.filterPeriods.includes(tx.period)
    );
  }, [selectedMonth]);

  // Dynamic filter for transactions table by search, category, type
  const filteredTransactions = useMemo(() => {
    return periodTransactions.filter((tx) => {
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
  }, [periodTransactions, searchQuery, selectedCategoryFilter, selectedTypeFilter]);

  const totalMonthlyBudget = 74000 * activePeriod.budgetMultiplier;
  const currentActualExpenses = activePeriod.totalSpent;
  const budgetPercentUsed = ((currentActualExpenses / totalMonthlyBudget) * 100).toFixed(1);

  // Export Transactions Ledger to CSV
  const handleExportCSV = () => {
    const exportData = filteredTransactions.map((tx) => ({
      date: tx.date,
      description: tx.desc,
      category: tx.category,
      account: tx.account,
      type: tx.type,
      amount: Math.abs(tx.amount).toFixed(2),
    }));

    const headers = [
      { key: "date", label: "Date" },
      { key: "description", label: "Description" },
      { key: "category", label: "Category" },
      { key: "account", label: "Account / Gateway" },
      { key: "type", label: "Type" },
      { key: "amount", label: "Amount (INR)" },
    ];

    const cleanPeriodName = selectedMonth.replace(/[^a-zA-Z0-9_-]/g, "_");
    exportToCSV(`Finance_Ledger_${cleanPeriodName}`, exportData, headers);
  };

  // Export Financial Summary to PDF
  const handleExportPDF = () => {
    const exportData = filteredTransactions.map((tx) => ({
      date: tx.date,
      description: tx.desc,
      category: tx.category,
      account: tx.account,
      type: tx.type,
      amount: currency(tx.amount),
    }));

    const headers = [
      { key: "date", label: "Date" },
      { key: "description", label: "Description" },
      { key: "category", label: "Category" },
      { key: "account", label: "Account" },
      { key: "type", label: "Type" },
      { key: "amount", label: "Amount" },
    ];

    const summaryCards = [
      { label: "Net Revenue", value: activePeriod.kpi.income, color: "#10b981" },
      { label: "Operating Expenses", value: activePeriod.kpi.expenses, color: "#f43f5e" },
      { label: "Savings Rate", value: activePeriod.kpi.savingsRate, color: "#2563eb" },
      { label: "Portfolio Assets", value: activePeriod.kpi.investments, color: "#7c3aed" },
    ];

    const metadata = [
      { label: "Financial Period", value: activePeriod.label },
      { label: "Reporting Officer", value: user?.full_name || "Finance Controller" },
      { label: "Net Retained", value: currency(activePeriod.waterfall.netRetained) },
    ];

    printOrExportPDF({
      title: `Financial Statement: ${activePeriod.label}`,
      subtitle: `Official financial report for ${activePeriod.label} with cashflow waterfall, recurring ledger breakdown, and asset reconciliation.`,
      metadata,
      headers,
      rows: exportData,
      summaryCards,
    });
  };

  return (
    <main className="main-content sales-dashboard-container" style={{ paddingBottom: "3rem" }}>
      {/* ----------------------------------------------------
          DASHBOARD HEADER
         ---------------------------------------------------- */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1.25rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 300px", minWidth: "260px" }}>
          <div className="badge badge-approved" style={{ marginBottom: "0.4rem", display: "inline-flex", gap: "0.35rem", alignItems: "center" }}>
            <Zap size={13} /> Enterprise Fintech Intelligence
          </div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>Financial Dashboard</h1>
          <p className="page-subtitle" style={{ margin: "0.35rem 0 0 0", color: "#64748b" }}>
            Real-time net worth tracking, interactive cash flow, portfolio allocation, and automated budget analytics.
          </p>
        </div>

        {/* Header Controls & Export Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            flexWrap: "wrap",
            justifyContent: "flex-start",
          }}
        >
          {/* Export Buttons */}
          <button
            type="button"
            className="btn-secondary"
            onClick={handleExportCSV}
            style={{
              padding: "0.45rem 0.85rem",
              fontSize: "0.825rem",
              display: "inline-flex",
              gap: "0.35rem",
              alignItems: "center",
              height: "38px",
              width: "auto",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600,
              color: "#334155",
            }}
          >
            <Download size={15} color="#166534" /> Export CSV
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleExportPDF}
            style={{
              padding: "0.45rem 0.95rem",
              fontSize: "0.825rem",
              background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
              border: "none",
              display: "inline-flex",
              gap: "0.35rem",
              alignItems: "center",
              height: "38px",
              width: "auto",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600,
              color: "#ffffff",
            }}
          >
            <Download size={15} /> Download PDF
          </button>

          {/* Period Selector (Wide dropdown, no cut text) */}
          <div style={{ position: "relative" }}>
            <select
              className="form-input no-icon"
              style={{
                height: "38px",
                fontSize: "0.85rem",
                fontWeight: 700,
                background: "#ffffff",
                borderColor: "#cbd5e1",
                minWidth: "220px",
                width: "auto",
                padding: "0 2rem 0 0.85rem",
                cursor: "pointer",
                color: "#0f172a",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                borderRadius: "8px",
              }}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              <option value="2026-09">September 2026 (Current)</option>
              <option value="2026-08">August 2026</option>
              <option value="2026-07">July 2026</option>
              <option value="Q3 2026">Q3 2026 Summary (Jul – Sep)</option>
              <option value="Q2 2026">Q2 2026 Summary (Apr – Jun)</option>
              <option value="YTD 2026">Year to Date 2026 (Jan – Sep)</option>
            </select>
          </div>

          {/* User Profile Pill */}
          <div
            className="badge badge-neutral"
            style={{
              padding: "0.45rem 0.8rem",
              fontSize: "0.825rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              background: "rgba(255, 255, 255, 0.9)",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              height: "38px",
            }}
          >
            <User size={15} color="#2563eb" />
            <span><strong>{user?.full_name || "Finance Controller"}</strong></span>
          </div>
        </div>
      </div>

      {/* Active Filter Notice Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #eff6ff, #f8fafc)",
          border: "1px solid #bfdbfe",
          borderRadius: "10px",
          padding: "0.65rem 1rem",
          marginBottom: "1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.825rem", color: "#1e40af", flexWrap: "wrap" }}>
          <Calendar size={16} />
          <span>Active Period View: <strong>{activePeriod.label}</strong></span>
          <span className="badge badge-neutral" style={{ fontSize: "0.725rem", background: "#dbeafe", color: "#1e40af" }}>
            {activePeriod.months.length > 1 ? `${activePeriod.months.length} Months Aggregate` : "Single Month Analysis"}
          </span>
        </div>
        <div style={{ fontSize: "0.775rem", color: "#64748b" }}>
          All metrics, charts, budget caps, and ledger rows below reflect <strong>{activePeriod.shortLabel}</strong>.
        </div>
      </div>

      {/* ----------------------------------------------------
          SECTION 0: ENTERPRISE INVOICE & REVENUE RECOVERY METRICS (LIVE DATABASE)
         ---------------------------------------------------- */}
      <section className="admin-panel" style={{ marginBottom: "1.5rem", padding: "1.35rem 1.5rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.75rem",
            marginBottom: "1rem",
          }}
        >
          <div>
            <p className="eyebrow" style={{ margin: "0 0 0.2rem 0" }}>Enterprise Billing & Collections</p>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>Live Tax Invoices & Receivables</h2>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <span className="badge badge-approved" style={{ display: "inline-flex", gap: "0.3rem", alignItems: "center", padding: "0.35rem 0.65rem" }}>
              <ShieldCheck size={13} /> Live Database Synced
            </span>
            {onNavigate && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => onNavigate("/admin/invoices")}
                style={{ width: "auto", padding: "0.4rem 0.85rem", fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: "0.3rem", borderRadius: "8px", height: "34px" }}
              >
                <FileText size={14} /> Manage Invoices <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="metric-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.85rem", margin: 0 }}>
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1rem" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Total Invoiced</div>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a", marginTop: "0.2rem" }}>
              {currency(invoiceSummary?.total_invoiced || 0)}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.2rem" }}>
              {invoiceSummary?.total_invoices || 0} issued tax invoices
            </div>
          </div>

          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "12px", padding: "1rem" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#166534", textTransform: "uppercase" }}>Total Collected</div>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#166534", marginTop: "0.2rem" }}>
              {currency(invoiceSummary?.total_paid || 0)}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#16a34a", marginTop: "0.2rem" }}>
              ✓ {invoiceSummary?.paid_count || 0} fully settled
            </div>
          </div>

          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "12px", padding: "1rem" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#92400e", textTransform: "uppercase" }}>Outstanding Receivables</div>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#d97706", marginTop: "0.2rem" }}>
              {currency(invoiceSummary?.total_outstanding || 0)}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#b45309", marginTop: "0.2rem" }}>
              ⏳ {invoiceSummary?.pending_count || 0} pending payments
            </div>
          </div>

          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "12px", padding: "1rem" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#991b1b", textTransform: "uppercase" }}>Overdue Invoices</div>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#dc2626", marginTop: "0.2rem" }}>
              {currency(invoiceSummary?.overdue_amount || 0)}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: "0.2rem" }}>
              {invoiceSummary?.overdue_count || 0} past due date
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------
          SECTION 1: FINANCIAL OVERVIEW KPI CARDS (Dynamic by Period)
         ---------------------------------------------------- */}
      <section className="metric-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        {/* Card 1: Net Worth */}
        <div className="metric-card" style={{ borderLeft: "4px solid #2563eb" }}>
          <div>
            <div className="metric-label">Net Worth</div>
            <div className="metric-value">{activePeriod.kpi.netWorth}</div>
            <div style={{ fontSize: "0.775rem", color: "#166534", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.2rem", marginTop: "0.2rem" }}>
              <ArrowUpRight size={14} /> {activePeriod.kpi.netWorthDelta}
            </div>
          </div>
          <div style={{ width: "60px", height: "36px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activePeriod.kpi.sparklines.netWorth}>
                <Line type="monotone" dataKey="v" stroke="#2563eb" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 2: Income */}
        <div className="metric-card" style={{ borderLeft: "4px solid #10b981" }}>
          <div>
            <div className="metric-label">Total Inflow / Income</div>
            <div className="metric-value">{activePeriod.kpi.income}</div>
            <div style={{ fontSize: "0.775rem", color: "#166534", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.2rem", marginTop: "0.2rem" }}>
              <ArrowUpRight size={14} /> {activePeriod.kpi.incomeDelta}
            </div>
          </div>
          <div style={{ width: "60px", height: "36px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activePeriod.kpi.sparklines.income}>
                <Line type="monotone" dataKey="v" stroke="#10b981" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 3: Expenses */}
        <div className="metric-card" style={{ borderLeft: "4px solid #f43f5e" }}>
          <div>
            <div className="metric-label">Total Expenses</div>
            <div className="metric-value">{activePeriod.kpi.expenses}</div>
            <div style={{ fontSize: "0.775rem", color: "#166534", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.2rem", marginTop: "0.2rem" }}>
              <ArrowDownRight size={14} /> {activePeriod.kpi.expensesDelta}
            </div>
          </div>
          <div style={{ width: "60px", height: "36px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activePeriod.kpi.sparklines.expenses}>
                <Line type="monotone" dataKey="v" stroke="#f43f5e" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 4: Savings */}
        <div className="metric-card" style={{ borderLeft: "4px solid #06b6d4" }}>
          <div>
            <div className="metric-label">Retained Savings</div>
            <div className="metric-value">{activePeriod.kpi.savings}</div>
            <div style={{ fontSize: "0.775rem", color: "#0284c7", fontWeight: 700, marginTop: "0.2rem" }}>
              Savings Rate: <strong>{activePeriod.kpi.savingsRate}</strong>
            </div>
          </div>
          <div style={{ width: "60px", height: "36px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activePeriod.kpi.sparklines.savings}>
                <Line type="monotone" dataKey="v" stroke="#06b6d4" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 5: Investment Portfolio */}
        <div className="metric-card" style={{ borderLeft: "4px solid #8b5cf6" }}>
          <div>
            <div className="metric-label">Investments</div>
            <div className="metric-value">{activePeriod.kpi.investments}</div>
            <div style={{ fontSize: "0.775rem", color: "#6d28d9", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.2rem", marginTop: "0.2rem" }}>
              <ArrowUpRight size={14} /> {activePeriod.kpi.investmentsDelta}
            </div>
          </div>
          <div style={{ width: "60px", height: "36px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activePeriod.kpi.sparklines.investments}>
                <Line type="monotone" dataKey="v" stroke="#8b5cf6" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------
          SECTION 2: INCOME VS EXPENSES COMBINED CHART (Dynamic by Period)
         ---------------------------------------------------- */}
      <section className="admin-panel" style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
        <div className="panel-heading-spread" style={{ marginBottom: "1rem" }}>
          <div>
            <p className="eyebrow">Cash Dynamics</p>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800 }}>Income vs Expenses vs Net Savings — {activePeriod.label}</h2>
          </div>
          <div style={{ fontSize: "0.825rem", color: "#64748b" }}>
            Bars indicate monthly inflows & outflows; line traces net capital retained for {activePeriod.shortLabel}.
          </div>
        </div>

        <div style={{ width: "100%", height: "320px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trendChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#475569" }} />
              <YAxis tickFormatter={formatShortCurrency} tick={{ fontSize: 11, fill: "#475569" }} />
              <Tooltip formatter={(value) => currency(value)} contentStyle={{ borderRadius: "10px", borderColor: "#cbd5e1" }} />
              <Legend wrapperStyle={{ fontSize: "0.825rem", paddingTop: "0.5rem" }} />
              <Bar dataKey="income" name="Income (₹)" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={26} />
              <Bar dataKey="expenses" name="Expenses (₹)" fill="#f43f5e" radius={[6, 6, 0, 0]} barSize={26} />
              <Line type="monotone" dataKey="savings" name="Net Savings (₹)" stroke="#10b981" strokeWidth={3} dot={{ r: 5 }} />
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
            <span className="badge badge-neutral" style={{ fontSize: "0.75rem" }}>{activePeriod.shortLabel}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", alignItems: "center" }}>
            {/* Donut Chart with Center Total */}
            <div style={{ width: "100%", height: "220px", position: "relative" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={activePeriod.expenseCategories}
                    dataKey="amount"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    onClick={(data) => setSelectedCategoryFilter(data.name)}
                    style={{ cursor: "pointer" }}
                  >
                    {activePeriod.expenseCategories.map((cat, idx) => (
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
                <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0f172a" }}>{currency(activePeriod.totalSpent)}</div>
              </div>
            </div>

            {/* Ranked Category List */}
            <div style={{ display: "grid", gap: "0.45rem", overflowY: "auto", maxHeight: "220px", paddingRight: "0.25rem" }}>
              {activePeriod.expenseCategories.map((cat) => (
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
            💡 Click any category segment or pill above to instantly filter the recent transactions ledger below.
          </p>
        </section>

        {/* SECTION 4: BUDGET VS ACTUAL TRACKING */}
        <section className="admin-panel" style={{ padding: "1.5rem" }}>
          <div className="panel-heading-spread" style={{ marginBottom: "1rem" }}>
            <div>
              <p className="eyebrow">Monthly Controls</p>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 800 }}>Budget vs Actual Performance</h2>
            </div>
            <span style={{ fontSize: "0.8rem", fontWeight: 800, color: Number(budgetPercentUsed) > 100 ? "#ef4444" : "#2563eb" }}>
              {budgetPercentUsed}% Spent ({currency(currentActualExpenses)} / {currency(totalMonthlyBudget)})
            </span>
          </div>

          {/* Monthly Overall Progress Bar */}
          <div style={{ marginBottom: "1.25rem", background: "rgba(241, 245, 249, 0.8)", padding: "0.75rem", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: 700, marginBottom: "0.35rem" }}>
              <span>Period Budget Cap ({activePeriod.budgetMultiplier} {activePeriod.budgetMultiplier > 1 ? "Months" : "Month"})</span>
              <span>Remaining: {currency(Math.max(0, totalMonthlyBudget - currentActualExpenses))}</span>
            </div>
            <div style={{ height: "10px", width: "100%", background: "#cbd5e1", borderRadius: "5px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, Number(budgetPercentUsed))}%`, background: Number(budgetPercentUsed) > 100 ? "#ef4444" : "linear-gradient(90deg, #10b981, #2563eb)", borderRadius: "5px" }} />
            </div>
          </div>

          {/* Category Progress Bars */}
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {activePeriod.budgetItems.map((item) => {
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
              <h2 style={{ fontSize: "1.15rem", fontWeight: 800 }}>Cash Flow Waterfall — {activePeriod.shortLabel}</h2>
            </div>
            <span className="badge badge-approved">+{currency(activePeriod.waterfall.netRetained)} Retained</span>
          </div>

          <div style={{ display: "grid", gap: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", background: "rgba(240, 253, 244, 0.9)", border: "1px solid #bbf7d0", borderRadius: "10px" }}>
              <div>
                <div style={{ fontSize: "0.75rem", color: "#166534", fontWeight: 700, textTransform: "uppercase" }}>Gross Inflow / Income</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#15803d" }}>+{currency(activePeriod.waterfall.grossIncome)}</div>
              </div>
              <ArrowUpRight size={22} color="#166534" />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", background: "rgba(254, 242, 242, 0.9)", border: "1px solid #fecaca", borderRadius: "10px" }}>
              <div>
                <div style={{ fontSize: "0.75rem", color: "#991b1b", fontWeight: 700, textTransform: "uppercase" }}>Fixed Expenses (Rent & Utilities)</div>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "#b91c1c" }}>-{currency(activePeriod.waterfall.fixedExpenses)}</div>
              </div>
              <span style={{ fontSize: "0.75rem", color: "#991b1b", fontWeight: 700 }}>
                {((activePeriod.waterfall.fixedExpenses / activePeriod.waterfall.grossIncome) * 100).toFixed(1)}% of income
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", background: "rgba(254, 243, 199, 0.9)", border: "1px solid #fde68a", borderRadius: "10px" }}>
              <div>
                <div style={{ fontSize: "0.75rem", color: "#92400e", fontWeight: 700, textTransform: "uppercase" }}>Variable Expenses (Food & Transport & Shopping)</div>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "#b45309" }}>-{currency(activePeriod.waterfall.variableExpenses)}</div>
              </div>
              <span style={{ fontSize: "0.75rem", color: "#92400e", fontWeight: 700 }}>
                {((activePeriod.waterfall.variableExpenses / activePeriod.waterfall.grossIncome) * 100).toFixed(1)}% of income
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", background: "rgba(241, 245, 249, 0.9)", border: "1px solid #cbd5e1", borderRadius: "10px" }}>
              <div>
                <div style={{ fontSize: "0.75rem", color: "#475569", fontWeight: 700, textTransform: "uppercase" }}>SIP Investments & Wealth Fund</div>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "#2563eb" }}>-{currency(activePeriod.waterfall.sip)}</div>
              </div>
              <span style={{ fontSize: "0.75rem", color: "#2563eb", fontWeight: 700 }}>
                {((activePeriod.waterfall.sip / activePeriod.waterfall.grossIncome) * 100).toFixed(1)}% allocated
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.85rem 1.15rem", background: "linear-gradient(135deg, #1e40af, #2563eb)", color: "#ffffff", borderRadius: "12px", boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)" }}>
              <div>
                <div style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, opacity: 0.9 }}>Net Liquidity Cash Flow</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 800 }}>+{currency(activePeriod.waterfall.netRetained)}</div>
              </div>
              <span className="badge badge-approved" style={{ background: "#ffffff", color: "#166534", fontWeight: 800 }}>
                +{activePeriod.waterfall.retainedRate} Retained
              </span>
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

          {/* Portfolio Metrics Row (Dynamic by Portfolio Range) */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", background: "rgba(248, 250, 252, 0.8)", padding: "0.6rem 0.85rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <div>
              <span style={{ fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700, display: "block" }}>Portfolio Value</span>
              <strong style={{ fontSize: "1.1rem", color: "#0f172a" }}>{PORTFOLIO_STATS[portfolioRange]?.val || "₹32,40,000"}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700, display: "block" }}>Invested</span>
              <strong style={{ fontSize: "0.95rem", color: "#475569" }}>{PORTFOLIO_STATS[portfolioRange]?.invested || "₹26,50,000"}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.7rem", color: "#166534", textTransform: "uppercase", fontWeight: 700, display: "block" }}>Total Gain</span>
              <strong style={{ fontSize: "0.95rem", color: "#166534" }}>{PORTFOLIO_STATS[portfolioRange]?.gain || "+₹5,90,000"}</strong>
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
          SECTION 9: RECENT TRANSACTIONS TABLE (With Generous Dropdowns)
         ---------------------------------------------------- */}
      <section className="admin-panel" style={{ padding: 0, overflow: "hidden", marginBottom: "1.5rem" }}>
        <div className="panel-heading-spread" style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #e2e8f0", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <p className="eyebrow">Ledger Activity</p>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 800 }}>Recent Transactions — {activePeriod.label}</h2>
            <span style={{ fontSize: "0.775rem", color: "#64748b" }}>
              Showing {filteredTransactions.length} of {periodTransactions.length} recorded line items for this period.
            </span>
          </div>

          {/* Table Filters (Generously sized dropdowns, no clipped text) */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ position: "relative" }}>
              <Search size={14} color="#94a3b8" style={{ position: "absolute", left: "10px", top: "11px" }} />
              <input
                type="text"
                placeholder="Search description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
                style={{ paddingLeft: "30px", height: "36px", fontSize: "0.825rem", width: "190px" }}
              />
            </div>

            <div style={{ position: "relative" }}>
              <select
                className="form-input no-icon"
                style={{
                  height: "36px",
                  fontSize: "0.825rem",
                  fontWeight: 600,
                  minWidth: "175px",
                  width: "auto",
                  padding: "0 2rem 0 0.85rem",
                  background: "#ffffff",
                  borderColor: "#cbd5e1",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
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
            </div>

            <div style={{ position: "relative" }}>
              <select
                className="form-input no-icon"
                style={{
                  height: "36px",
                  fontSize: "0.825rem",
                  fontWeight: 600,
                  minWidth: "140px",
                  width: "auto",
                  padding: "0 2rem 0 0.85rem",
                  background: "#ffffff",
                  borderColor: "#cbd5e1",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
              >
                <option value="ALL">All Types</option>
                <option value="Credit">Credit (+)</option>
                <option value="Debit">Debit (-)</option>
              </select>
            </div>
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
                    No transactions match your search/filter parameters for {activePeriod.shortLabel}.
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
            <h2 style={{ fontSize: "1.15rem", fontWeight: 800 }}>Automated Financial Insights — {activePeriod.shortLabel}</h2>
          </div>
          <span className="badge badge-approved" style={{ display: "inline-flex", gap: "0.3rem", alignItems: "center" }}>
            <Sparkles size={13} /> AI Financial Advisor Active
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
          {activePeriod.insights.map((insight, idx) => {
            const isUp = insight.type === "up";
            const isAlert = insight.type === "alert";
            const isGoal = insight.type === "goal";
            const isStar = insight.type === "star";

            const bg = isAlert ? "rgba(254, 242, 242, 0.9)" : isUp ? "rgba(240, 253, 244, 0.9)" : isGoal ? "rgba(240, 249, 255, 0.9)" : "rgba(245, 243, 255, 0.9)";
            const border = isAlert ? "#fecaca" : isUp ? "#bbf7d0" : isGoal ? "#bae6fd" : "#ddd6fe";
            const iconBg = isAlert ? "#fee2e2" : isUp ? "#d1fae5" : isGoal ? "#e0f2fe" : "#ede9fe";
            const titleColor = isAlert ? "#7f1d1d" : isUp ? "#14532d" : isGoal ? "#0c4a6e" : "#4c1d95";
            const descColor = isAlert ? "#991b1b" : isUp ? "#166534" : isGoal ? "#0369a1" : "#6d28d9";

            const IconComponent = isAlert ? AlertTriangle : isUp ? TrendingUp : isGoal ? ShieldCheck : Sparkles;
            const iconColor = isAlert ? "#b91c1c" : isUp ? "#166534" : isGoal ? "#0369a1" : "#6d28d9";

            return (
              <div key={idx} style={{ background: bg, border: `1px solid ${border}`, padding: "1rem", borderRadius: "12px", display: "flex", gap: "0.75rem" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <IconComponent size={20} color={iconColor} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, color: titleColor, fontSize: "0.875rem" }}>{insight.title}</div>
                  <div style={{ color: descColor, fontSize: "0.825rem", marginTop: "0.2rem" }}>
                    {insight.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
