import React from "react";
import { DollarSign, FileCheck, AlertCircle, TrendingUp, CreditCard } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function FinanceDashboard() {
  const { user } = useAuth();

  return (
    <div className="main-content">
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a" }}>
          Finance & Billing Operations
        </h1>
        <p style={{ color: "#64748b", fontSize: "0.875rem", marginTop: "4px" }}>
          Revenue recognition, invoice settlement, and payment governance • Analyst: {user?.full_name} ({user?.employee_id})
        </p>
      </div>

      <div className="metric-grid">
        <div className="metric-card" style={{ borderLeft: "4px solid #10b981" }}>
          <div>
            <div className="metric-label">Recognized Revenue</div>
            <div className="metric-value">₹1,42,50,000</div>
          </div>
          <div className="metric-icon-wrap" style={{ background: "#d1fae5", color: "#059669" }}>
            <DollarSign size={22} />
          </div>
        </div>

        <div className="metric-card" style={{ borderLeft: "4px solid #2563eb" }}>
          <div>
            <div className="metric-label">Collected This Month</div>
            <div className="metric-value">₹38,20,000</div>
          </div>
          <div className="metric-icon-wrap" style={{ background: "#eff6ff", color: "#2563eb" }}>
            <TrendingUp size={22} />
          </div>
        </div>

        <div className="metric-card" style={{ borderLeft: "4px solid #f59e0b" }}>
          <div>
            <div className="metric-label">Pending Invoices</div>
            <div className="metric-value">8 Invoices</div>
          </div>
          <div className="metric-icon-wrap" style={{ background: "#fef3c7", color: "#d97706" }}>
            <FileCheck size={22} />
          </div>
        </div>
      </div>

      <div className="data-table-card">
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-light)" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700 }}>Active Invoices for Quotation Deals</h2>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Customer</th>
              <th>Quotation Ref</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>INV-2025-104</code></td>
              <td>Infosys Labs</td>
              <td>QTN-2025-001</td>
              <td><strong>₹24,80,000</strong></td>
              <td><span className="badge badge-active">PAID</span></td>
            </tr>
            <tr>
              <td><code>INV-2025-105</code></td>
              <td>Acme Corporation</td>
              <td>QTN-2025-003</td>
              <td><strong>₹8,50,000</strong></td>
              <td><span className="badge badge-pending">PENDING</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
