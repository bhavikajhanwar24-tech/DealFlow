import React from "react";
import {
  Shield,
  Briefcase,
  Layers,
  FileText,
  LogOut,
  UserCheck,
  CheckCircle,
  LayoutDashboard,
  Truck,
  DollarSign
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Navbar({ currentRoute, setCurrentRoute }) {
  const { user, logout } = useAuth();

  if (!user) return null;

  const isAdmin = user.role === "ADMIN";
  const isSales = user.role === "SALES_REP" || user.role === "SALES_MANAGER";
  const isFinance = user.role === "FINANCE";
  const isOps = user.role === "OPERATIONS";
  const isCustomer = user.role === "CUSTOMER";

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <div className="topbar-logo">
          {/* Stylized 'D' Icon */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 4h7a8 8 0 0 1 8 8 8 8 0 0 1-8 8H5V4z"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M5 12h5a3 3 0 0 0 3-3 3 3 0 0 0-3-3H5"
              stroke="#93c5fd"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div>
          <h1 className="topbar-title">DealFlow360</h1>
        </div>
      </div>

      <nav className="topbar-nav">
        {isAdmin && (
          <>
            <button
              className={`nav-link-btn ${currentRoute === "/admin/dashboard" ? "active" : ""}`}
              onClick={() => setCurrentRoute("/admin/dashboard")}
            >
              <LayoutDashboard size={16} /> Admin Dashboard
            </button>
            <button
              className={`nav-link-btn ${currentRoute === "/admin/employee-approvals" ? "active" : ""}`}
              onClick={() => setCurrentRoute("/admin/employee-approvals")}
            >
              <UserCheck size={16} /> Employee Approvals
            </button>
            <button
              className={`nav-link-btn ${currentRoute === "/sales/dashboard" ? "active" : ""}`}
              onClick={() => setCurrentRoute("/sales/dashboard")}
            >
              <Briefcase size={16} /> Sales Workspace
            </button>
          </>
        )}

        {isSales && (
          <button
            className={`nav-link-btn ${currentRoute === "/sales/dashboard" ? "active" : ""}`}
            onClick={() => setCurrentRoute("/sales/dashboard")}
          >
            <Briefcase size={16} /> Sales Dashboard
          </button>
        )}

        {isFinance && (
          <button
            className={`nav-link-btn ${currentRoute === "/finance/dashboard" ? "active" : ""}`}
            onClick={() => setCurrentRoute("/finance/dashboard")}
          >
            <DollarSign size={16} /> Finance Dashboard
          </button>
        )}

        {isOps && (
          <button
            className={`nav-link-btn ${currentRoute === "/operations/dashboard" ? "active" : ""}`}
            onClick={() => setCurrentRoute("/operations/dashboard")}
          >
            <Truck size={16} /> Operations Dashboard
          </button>
        )}

        {isCustomer && (
          <button
            className={`nav-link-btn ${currentRoute === "/customer/portal" ? "active" : ""}`}
            onClick={() => setCurrentRoute("/customer/portal")}
          >
            <FileText size={16} /> Quotation Portal
          </button>
        )}
      </nav>

      <div className="topbar-user">
        <div className="user-meta">
          <div className="user-name">{user.full_name}</div>
          <div className="user-sub">
            <span
              className={`badge ${
                user.role === "ADMIN"
                  ? "badge-pending"
                  : user.role === "CUSTOMER"
                  ? "badge-active"
                  : "badge-suspended"
              }`}
              style={{ fontSize: "0.6875rem", padding: "0.15rem 0.5rem" }}
            >
              {user.role}
            </span>
            {user.employee_id && (
              <span style={{ marginLeft: "6px", color: "#64748b" }}>
                {user.employee_id}
              </span>
            )}
            {user.company_name && (
              <span style={{ marginLeft: "6px", color: "#64748b" }}>
                {user.company_name}
              </span>
            )}
          </div>
        </div>

        <div className="user-avatar" title={user.full_name}>
          {user.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
        </div>

        <button
          className="btn-secondary"
          style={{ padding: "0.45rem 0.75rem", fontSize: "0.8125rem" }}
          onClick={logout}
          title="Sign Out"
        >
          <LogOut size={15} /> Logout
        </button>
      </div>
    </header>
  );
}
