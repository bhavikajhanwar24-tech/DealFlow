import React from "react";
import { useAuth } from "../context/AuthContext";

// Inline SVG Icon components for React 19 stability
const LayoutDashboardIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
);

const UserCheckIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <polyline points="16 11 18 13 22 9" />
  </svg>
);

const BriefcaseIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

const DollarSignIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const TruckIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="3" width="15" height="13" />
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);

const FileTextIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const LogOutIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

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
              <LayoutDashboardIcon size={16} /> Admin Dashboard
            </button>
            <button
              className={`nav-link-btn ${currentRoute === "/admin/employee-approvals" ? "active" : ""}`}
              onClick={() => setCurrentRoute("/admin/employee-approvals")}
            >
              <UserCheckIcon size={16} /> Employee Approvals
            </button>
            <button
              className={`nav-link-btn ${currentRoute === "/sales/dashboard" ? "active" : ""}`}
              onClick={() => setCurrentRoute("/sales/dashboard")}
            >
              <BriefcaseIcon size={16} /> Sales Workspace
            </button>
          </>
        )}

        {isSales && (
          <button
            className={`nav-link-btn ${currentRoute === "/sales/dashboard" ? "active" : ""}`}
            onClick={() => setCurrentRoute("/sales/dashboard")}
          >
            <BriefcaseIcon size={16} /> Sales Dashboard
          </button>
        )}

        {isFinance && (
          <button
            className={`nav-link-btn ${currentRoute === "/finance/dashboard" ? "active" : ""}`}
            onClick={() => setCurrentRoute("/finance/dashboard")}
          >
            <DollarSignIcon size={16} /> Finance Dashboard
          </button>
        )}

        {isOps && (
          <button
            className={`nav-link-btn ${currentRoute === "/operations/dashboard" ? "active" : ""}`}
            onClick={() => setCurrentRoute("/operations/dashboard")}
          >
            <TruckIcon size={16} /> Operations Dashboard
          </button>
        )}

        {isCustomer && (
          <button
            className={`nav-link-btn ${currentRoute === "/customer/portal" ? "active" : ""}`}
            onClick={() => setCurrentRoute("/customer/portal")}
          >
            <FileTextIcon size={16} /> Quotation Portal
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
          <LogOutIcon size={15} /> Logout
        </button>
      </div>
    </header>
  );
}
