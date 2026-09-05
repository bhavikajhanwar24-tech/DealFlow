import React, { useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  TrendingUp,
  Percent,
  Coins,
  Sparkles,
  Calendar,
  ArrowUpRight,
  ArrowRight,
  BarChart2,
} from "lucide-react";

// Chart Data Constant - Can be replaced with API or database data
export const REVENUE_MARGIN_DATA = [
  {
    month: "Apr",
    fullMonth: "April",
    revenue: 28, // In Lakhs (₹28L)
    margin: 21, // Percentage (21%)
    grossMarginVal: "₹5.88L",
  },
  {
    month: "May",
    fullMonth: "May",
    revenue: 34,
    margin: 23,
    grossMarginVal: "₹7.82L",
  },
  {
    month: "Jun",
    fullMonth: "June",
    revenue: 39,
    margin: 22,
    grossMarginVal: "₹8.58L",
  },
  {
    month: "Jul",
    fullMonth: "July",
    revenue: 45,
    margin: 26,
    grossMarginVal: "₹11.70L",
  },
  {
    month: "Aug",
    fullMonth: "August",
    revenue: 52,
    margin: 25,
    grossMarginVal: "₹13.00L",
  },
  {
    month: "Sep",
    fullMonth: "September",
    revenue: 61,
    margin: 28,
    grossMarginVal: "₹17.08L",
  },
];

// Custom Tooltip Component for Recharts
const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "0.85rem 1rem",
          boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.12)",
          minWidth: "180px",
        }}
      >
        <div
          style={{
            fontWeight: 800,
            fontSize: "0.9rem",
            color: "#0f172a",
            marginBottom: "0.5rem",
            borderBottom: "1px solid #f1f5f9",
            paddingBottom: "0.35rem",
          }}
        >
          {data.fullMonth}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            fontSize: "0.8125rem",
            margin: "0.25rem 0",
          }}
        >
          <span style={{ color: "#64748b", fontWeight: 500 }}>Revenue</span>
          <span style={{ color: "#2563eb", fontWeight: 700 }}>
            ₹{data.revenue}L
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            fontSize: "0.8125rem",
            margin: "0.25rem 0",
          }}
        >
          <span style={{ color: "#64748b", fontWeight: 500 }}>
            Gross Margin %
          </span>
          <span style={{ color: "#10b981", fontWeight: 700 }}>
            {data.margin}%
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            fontSize: "0.8125rem",
            margin: "0.25rem 0",
          }}
        >
          <span style={{ color: "#64748b", fontWeight: 500 }}>
            Gross Margin
          </span>
          <span style={{ color: "#0f172a", fontWeight: 800 }}>
            {data.grossMarginVal}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export default function RevenueMarginChart({ analytics, onNavigate }) {
  const [timeRange, setTimeRange] = useState("Last 6 Months");

  const chartData = analytics?.chartData || [];
  const summaryMetrics = analytics?.summary || {
    totalRevenue: "₹0",
    totalRevenueGrowth: "+0.0%",
    avgMargin: "0.0%",
    avgMarginGrowth: "+0.0%",
    grossMargin: "₹0",
    grossMarginGrowth: "+0.0%",
  };
  const aiInsightText =
    analytics?.aiInsight ||
    "Real-time revenue & margin analytics will display here as quotation deals are recorded.";

  return (
    <section
      style={{
        background: "#ffffff",
        border: "1px solid #E5EAF2",
        borderRadius: "20px",
        padding: "1.75rem",
        boxShadow: "0 10px 30px -5px rgba(15, 23, 42, 0.05)",
        marginBottom: "2rem",
      }}
    >
      {/* Top Header Row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "#eff6ff",
                color: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <BarChart2 size={18} />
            </div>
            <h2
              style={{
                fontSize: "1.35rem",
                fontWeight: 800,
                color: "#0f172a",
                margin: 0,
                letterSpacing: "-0.01em",
              }}
            >
              Revenue vs Margin
            </h2>
          </div>
          <p
            style={{
              color: "#64748b",
              fontSize: "0.875rem",
              marginTop: "0.35rem",
            }}
          >
            Track revenue growth and profitability across your sales pipeline.
          </p>
        </div>

        {/* Time Filter Pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            padding: "0.4rem 0.85rem",
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "#475569",
          }}
        >
          <Calendar size={15} color="#64748b" />
          <span>{timeRange}</span>
        </div>
      </div>

      {/* 3 Summary Metric Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1.25rem",
          marginBottom: "1.75rem",
        }}
      >
        {/* Metric 1: Revenue */}
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            padding: "1.1rem 1.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "#64748b",
                marginBottom: "0.25rem",
              }}
            >
              Revenue
            </div>
            <div
              style={{
                fontSize: "1.5rem",
                fontWeight: 800,
                color: "#0f172a",
                letterSpacing: "-0.02em",
              }}
            >
              {summaryMetrics.totalRevenue}
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                color: "#10b981",
                fontSize: "0.75rem",
                fontWeight: 700,
                marginTop: "0.35rem",
                background: "#ecfdf5",
                padding: "0.15rem 0.45rem",
                borderRadius: "6px",
              }}
            >
              <ArrowUpRight size={13} />
              {summaryMetrics.totalRevenueGrowth} vs previous period
            </div>
          </div>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "#eff6ff",
              color: "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Coins size={20} />
          </div>
        </div>

        {/* Metric 2: Average Margin */}
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            padding: "1.1rem 1.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "#64748b",
                marginBottom: "0.25rem",
              }}
            >
              Average Margin
            </div>
            <div
              style={{
                fontSize: "1.5rem",
                fontWeight: 800,
                color: "#0f172a",
                letterSpacing: "-0.02em",
              }}
            >
              {summaryMetrics.avgMargin}
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                color: "#10b981",
                fontSize: "0.75rem",
                fontWeight: 700,
                marginTop: "0.35rem",
                background: "#ecfdf5",
                padding: "0.15rem 0.45rem",
                borderRadius: "6px",
              }}
            >
              <ArrowUpRight size={13} />
              {summaryMetrics.avgMarginGrowth} vs previous period
            </div>
          </div>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "#ecfdf5",
              color: "#10b981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Percent size={20} />
          </div>
        </div>

        {/* Metric 3: Gross Margin */}
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            padding: "1.1rem 1.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "#64748b",
                marginBottom: "0.25rem",
              }}
            >
              Gross Margin
            </div>
            <div
              style={{
                fontSize: "1.5rem",
                fontWeight: 800,
                color: "#0f172a",
                letterSpacing: "-0.02em",
              }}
            >
              {summaryMetrics.grossMargin}
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                color: "#10b981",
                fontSize: "0.75rem",
                fontWeight: 700,
                marginTop: "0.35rem",
                background: "#ecfdf5",
                padding: "0.15rem 0.45rem",
                borderRadius: "6px",
              }}
            >
              <ArrowUpRight size={13} />
              {summaryMetrics.grossMarginGrowth} vs previous period
            </div>
          </div>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "#f3e8ff",
              color: "#9333ea",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TrendingUp size={20} />
          </div>
        </div>
      </div>

      {/* Main Combined Chart Section */}
      <div style={{ marginBottom: "1.75rem" }}>
        {/* Legend Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <div
            style={{
              fontSize: "0.9rem",
              fontWeight: 700,
              color: "#334155",
            }}
          >
            Revenue & Profitability Trend
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1.25rem",
              fontSize: "0.8125rem",
              fontWeight: 600,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "3px",
                  background: "#3b82f6",
                }}
              />
              <span style={{ color: "#475569" }}>Revenue (₹L)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span
                style={{
                  width: "12px",
                  height: "3px",
                  borderRadius: "2px",
                  background: "#10b981",
                }}
              />
              <span style={{ color: "#475569" }}>Gross Margin %</span>
            </div>
          </div>
        </div>

        {/* Recharts Container */}
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="revenueBarGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#93c5fd" stopOpacity={0.65} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                dy={8}
              />
              <YAxis
                yAxisId="left"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                domain={[0, 70]}
                tickFormatter={(value) => `₹${value}L`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                domain={[0, 35]}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                yAxisId="left"
                dataKey="revenue"
                fill="url(#revenueBarGradient)"
                radius={[6, 6, 0, 0]}
                barSize={36}
                animationDuration={1200}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="margin"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ r: 5, fill: "#10b981", stroke: "#ffffff", strokeWidth: 2 }}
                activeDot={{ r: 7, fill: "#059669", stroke: "#ffffff", strokeWidth: 2 }}
                animationDuration={1500}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AI Insight Footer Card & Action Button */}
      <div
        style={{
          background: "linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)",
          border: "1px solid #bfdbfe",
          borderRadius: "14px",
          padding: "1.25rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1.25rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: "260px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              fontSize: "0.75rem",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "#1d4ed8",
              marginBottom: "0.35rem",
            }}
          >
            <Sparkles size={14} color="#2563eb" />
            AI INSIGHT
          </div>
          <p
            style={{
              fontSize: "0.875rem",
              color: "#1e293b",
              fontWeight: 600,
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            {aiInsightText}
          </p>
        </div>

        <button
          className="btn-primary"
          style={{
            width: "auto",
            padding: "0.6rem 1.1rem",
            fontSize: "0.8125rem",
            borderRadius: "10px",
            whiteSpace: "nowrap",
          }}
          onClick={() => {
            if (onNavigate) {
              onNavigate("/sales/quotations");
            }
          }}
        >
          View Detailed Analytics <ArrowRight size={15} />
        </button>
      </div>
    </section>
  );
}
