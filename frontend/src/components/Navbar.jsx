import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

// Inline SVG Icon components for React 19 stability
const LayoutDashboardIcon = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
);

const UserCheckIcon = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <polyline points="16 11 18 13 22 9" />
  </svg>
);

const BriefcaseIcon = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

const PackageIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m16.5 9.4-9-5.19" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <path d="M3.27 6.96 12 12.01l8.73-5.05" />
    <path d="M12 22.08V12" />
  </svg>
);

const PercentIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="5" x2="5" y2="19" />
    <circle cx="6.5" cy="6.5" r="2.5" />
    <circle cx="17.5" cy="17.5" r="2.5" />
  </svg>
);

const DollarSignIcon = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const TruckIcon = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="1" y="3" width="15" height="13" />
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);

const FileTextIcon = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const MessageSquareIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const LogOutIcon = ({ size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export default function Navbar({ currentRoute, setCurrentRoute }) {
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
              <LayoutDashboardIcon size={16} /> Dashboard
            </button>
            <button
              className={`nav-link-btn ${currentRoute === "/admin/employee-approvals" ? "active" : ""}`}
              onClick={() => setCurrentRoute("/admin/employee-approvals")}
            >
              <UserCheckIcon size={16} /> Approvals
            </button>
            <button
              className={`nav-link-btn ${currentRoute === "/admin/staff" ? "active" : ""}`}
              onClick={() => setCurrentRoute("/admin/staff")}
            >
              <BriefcaseIcon size={16} /> Staff
            </button>
            <button
              className={`nav-link-btn ${currentRoute === "/admin/products" ? "active" : ""}`}
              onClick={() => setCurrentRoute("/admin/products")}
            >
              <PackageIcon size={16} /> Products
            </button>
            <button
              className={`nav-link-btn ${currentRoute === "/admin/warehouses" ? "active" : ""}`}
              onClick={() => setCurrentRoute("/admin/warehouses")}
            >
              <TruckIcon size={16} /> Warehouses
            </button>
            <button
              className={`nav-link-btn ${currentRoute === "/admin/discount-policies" ? "active" : ""}`}
              onClick={() => setCurrentRoute("/admin/discount-policies")}
            >
              <PercentIcon size={16} /> Discount Policies
            </button>
          </>
        )}

        {(isSales || isAdmin) && (
          <>
            {isSales && (
              <button
                className={`nav-link-btn ${currentRoute === "/sales/dashboard" ? "active" : ""}`}
                onClick={() => setCurrentRoute("/sales/dashboard")}
              >
                <BriefcaseIcon size={16} /> Sales Dashboard
              </button>
            )}
            <button
              className={`nav-link-btn ${currentRoute.includes("messages") ? "active" : ""}`}
              onClick={() => setCurrentRoute("/sales/messages")}
            >
              <MessageSquareIcon size={16} /> Messages
            </button>
          </>
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
          <>
            <button
              className={`nav-link-btn ${currentRoute === "/customer/portal" ? "active" : ""}`}
              onClick={() => setCurrentRoute("/customer/portal")}
            >
              <FileTextIcon size={16} /> My Quotations
            </button>
            <button
              className={`nav-link-btn ${currentRoute.includes("messages") ? "active" : ""}`}
              onClick={() => setCurrentRoute("/customer/messages")}
            >
              <MessageSquareIcon size={16} /> Messages
            </button>
          </>
        )}
      </nav>

      <div className="topbar-user-container" ref={dropdownRef}>
        <button
          className="user-avatar-btn"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          aria-label="User Profile"
          title={user.full_name}
        >
          <div className="user-avatar">
            {user.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
          </div>
        </button>

        {isMenuOpen && (
          <div className="user-dropdown-menu">
            <div className="dropdown-header">
              <div className="dropdown-avatar">
                {user.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="dropdown-user-details">
                <div className="dropdown-name">{user.full_name}</div>
                {user.email && <div className="dropdown-email">{user.email}</div>}
              </div>
            </div>

            <div className="dropdown-divider" />

            <div className="dropdown-info-list">
              <div className="dropdown-info-item">
                <span className="info-label">Role</span>
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
              </div>

              {(user.employee_id || user.id) && (
                <div className="dropdown-info-item">
                  <span className="info-label">User ID</span>
                  <span className="info-value">{user.employee_id || user.id}</span>
                </div>
              )}

              {user.company_name && (
                <div className="dropdown-info-item">
                  <span className="info-label">Company</span>
                  <span className="info-value">{user.company_name}</span>
                </div>
              )}
            </div>

            <div className="dropdown-divider" />

            <button
              className="dropdown-logout-btn"
              onClick={() => {
                setIsMenuOpen(false);
                logout();
              }}
            >
              <LogOutIcon size={16} /> Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

