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
    <path d="m16.5 9.4-9-5.19" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <path d="M3.27 6.96 12 12.01l8.73-5.05" />
    <path d="M12 22.08V12" />
  </svg>
);

const PercentIcon = ({ size = 16 }) => (
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

const ChevronDownIcon = ({ size = 14, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const GridIcon = ({ size = 16 }) => (
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
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
  </svg>
);

const ShieldCheckIcon = ({ size = 16 }) => (
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
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

const SettingsGearIcon = ({ size = 16 }) => (
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
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const ActivityIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const PieChartIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
    <path d="M22 12A10 10 0 0 0 12 2v10z" />
  </svg>
);

const ClockIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const CreditCardIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

const UploadCloudIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
    <path d="M12 12v9" />
    <path d="m16 16-4-4-4 4" />
  </svg>
);

const ShieldAlertIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const MenuIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const CloseIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default function Navbar({ currentRoute, setCurrentRoute }) {
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(true);
  const dropdownRef = useRef(null);
  const moreDropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
      if (
        moreDropdownRef.current &&
        !moreDropdownRef.current.contains(event.target)
      ) {
        setIsMoreOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        setIsMoreOpen(false);
        setIsMobileDrawerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileDrawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileDrawerOpen]);

  if (!user) return null;

  const isAdmin = user.role === "ADMIN";
  const isSales = user.role === "SALES_REP" || user.role === "SALES_MANAGER";
  const isFinance = user.role === "FINANCE";
  const isOps = user.role === "OPERATIONS";
  const isCustomer = user.role === "CUSTOMER";

  const adminMoreRoutes = [
    "/admin/warehouses",
    "/admin/discount-policies",
    "/admin/audit-logs",
    "/admin/customer-tiers",
    "/admin/subscription-plans",
    "/admin/billing-configuration",
    "/admin/invoices",
    "/admin/reports",
    "/admin/deal-health",
    "/admin/activity-feed",
    "/admin/bulk-upload",
    "/admin/complaints",
    "/finance/dashboard",
    "/operations/dashboard",
    "/sales/fulfillment",
    "/sales/messages",
  ];
  const isMoreActive = adminMoreRoutes.some((route) =>
    currentRoute.startsWith(route),
  );

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
        <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
          <h1 className="topbar-title" style={{ margin: 0 }}>DealFlow360</h1>
          {isAdmin && (
            <span
              style={{
                fontSize: "0.6875rem",
                fontWeight: 800,
                padding: "0.15rem 0.5rem",
                borderRadius: "6px",
                background: "#eff6ff",
                color: "#2563eb",
                border: "1px solid #bfdbfe",
                letterSpacing: "0.04em",
              }}
            >
              ADMIN
            </span>
          )}
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
              className={`nav-link-btn ${currentRoute === "/admin/products" ? "active" : ""}`}
              onClick={() => setCurrentRoute("/admin/products")}
            >
              <PackageIcon size={16} /> Products
            </button>
            <button
              className={`nav-link-btn ${currentRoute.startsWith("/sales/quotations") ? "active" : ""}`}
              onClick={() => setCurrentRoute("/sales/quotations")}
            >
              <FileTextIcon size={16} /> Quotations
            </button>
            <button
              className={`nav-link-btn ${currentRoute === "/admin/complaints" ? "active" : ""}`}
              onClick={() => setCurrentRoute("/admin/complaints")}
            >
              <ShieldAlertIcon size={16} /> Complaints
            </button>

            {/* Systematic Dropdown Menu for Additional Admin Modules */}
            <div className="more-dropdown-container" ref={moreDropdownRef}>
              <button
                className={`nav-more-trigger ${isMoreActive ? "active" : ""} ${isMoreOpen ? "open" : ""}`}
                onClick={() => setIsMoreOpen((prev) => !prev)}
                title="Explore Platform Modules"
              >
                <div className="nav-more-icon-box">
                  <GridIcon size={16} />
                </div>
                <span className="nav-more-text">More Modules</span>
                <ChevronDownIcon
                  size={14}
                  style={{
                    transform: isMoreOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                  }}
                />
              </button>

              {isMoreOpen && (
                <div
                  className="more-mega-menu"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 0.65rem)",
                    right: 0,
                    left: "auto",
                    width: "760px",
                    maxWidth: "calc(100vw - 3rem)",
                    boxSizing: "border-box",
                    padding: "1.35rem 1.4rem",
                    overflow: "hidden",
                  }}
                >
                  <div className="mega-menu-top-bar">
                    <div className="mega-menu-title">
                      <GridIcon size={15} /> Platform Administration & Operations
                    </div>
                    <span className="mega-menu-badge">12 Modules</span>
                  </div>

                  <div className="mega-menu-grid">
                    {/* Column 1: Sales & Commercial (4 items) */}
                    <div className="mega-column">
                      <div className="mega-section-label">
                        💼 Sales & Commercial
                      </div>

                      <button
                        className={`mega-item-card ${currentRoute === "/admin/discount-policies" ? "active" : ""}`}
                        onClick={() => {
                          setCurrentRoute("/admin/discount-policies");
                          setIsMoreOpen(false);
                        }}
                      >
                        <div className="mega-item-icon emerald">
                          <PercentIcon size={18} />
                        </div>
                        <div className="mega-item-body">
                          <div className="mega-item-title">Discount Policies</div>
                          <div className="mega-item-desc">Margin & discount rule tiers</div>
                        </div>
                        {currentRoute === "/admin/discount-policies" && <span className="active-dot" />}
                      </button>

                      <button
                        className={`mega-item-card ${currentRoute === "/admin/customer-tiers" ? "active" : ""}`}
                        onClick={() => {
                          setCurrentRoute("/admin/customer-tiers");
                          setIsMoreOpen(false);
                        }}
                      >
                        <div className="mega-item-icon purple">
                          <UserCheckIcon size={18} />
                        </div>
                        <div className="mega-item-body">
                          <div className="mega-item-title">Customer Tiers</div>
                          <div className="mega-item-desc">Tier limits & credit policy rules</div>
                        </div>
                        {currentRoute === "/admin/customer-tiers" && <span className="active-dot" />}
                      </button>

                      <button
                        className={`mega-item-card ${currentRoute === "/admin/deal-health" ? "active" : ""}`}
                        onClick={() => {
                          setCurrentRoute("/admin/deal-health");
                          setIsMoreOpen(false);
                        }}
                      >
                        <div className="mega-item-icon blue">
                          <ActivityIcon size={18} />
                        </div>
                        <div className="mega-item-body">
                          <div className="mega-item-title">Deal Health & Risk</div>
                          <div className="mega-item-desc">Deal exposure & scorecards</div>
                        </div>
                        {currentRoute === "/admin/deal-health" && <span className="active-dot" />}
                      </button>

                      <button
                        className={`mega-item-card ${currentRoute.includes("messages") ? "active" : ""}`}
                        onClick={() => {
                          setCurrentRoute("/sales/messages");
                          setIsMoreOpen(false);
                        }}
                      >
                        <div className="mega-item-icon rose">
                          <MessageSquareIcon size={18} />
                        </div>
                        <div className="mega-item-body">
                          <div className="mega-item-title">Sales Chat & Messages</div>
                          <div className="mega-item-desc">Live quotation negotiation</div>
                        </div>
                        {currentRoute.includes("messages") && <span className="active-dot" />}
                      </button>
                    </div>

                    {/* Column 2: Supply Chain & Operations (4 items) */}
                    <div className="mega-column">
                      <div className="mega-section-label">
                        🚚 Supply Chain & Ops
                      </div>

                      <button
                        className={`mega-item-card ${currentRoute === "/admin/warehouses" ? "active" : ""}`}
                        onClick={() => {
                          setCurrentRoute("/admin/warehouses");
                          setIsMoreOpen(false);
                        }}
                      >
                        <div className="mega-item-icon blue">
                          <TruckIcon size={18} />
                        </div>
                        <div className="mega-item-body">
                          <div className="mega-item-title">Warehouses & Hubs</div>
                          <div className="mega-item-desc">Stock locations & hub inventory</div>
                        </div>
                        {currentRoute === "/admin/warehouses" && <span className="active-dot" />}
                      </button>

                      <button
                        className={`mega-item-card ${currentRoute === "/sales/fulfillment" ? "active" : ""}`}
                        onClick={() => {
                          setCurrentRoute("/sales/fulfillment");
                          setIsMoreOpen(false);
                        }}
                      >
                        <div className="mega-item-icon amber">
                          <TruckIcon size={18} />
                        </div>
                        <div className="mega-item-body">
                          <div className="mega-item-title">Order Fulfillment</div>
                          <div className="mega-item-desc">Shipment dispatch & tracking</div>
                        </div>
                        {currentRoute === "/sales/fulfillment" && <span className="active-dot" />}
                      </button>

                      <button
                        className={`mega-item-card ${currentRoute === "/operations/dashboard" ? "active" : ""}`}
                        onClick={() => {
                          setCurrentRoute("/operations/dashboard");
                          setIsMoreOpen(false);
                        }}
                      >
                        <div className="mega-item-icon orange">
                          <ActivityIcon size={18} />
                        </div>
                        <div className="mega-item-body">
                          <div className="mega-item-title">Operations Optimizer</div>
                          <div className="mega-item-desc">Warehouse routing & dispatch</div>
                        </div>
                        {currentRoute === "/operations/dashboard" && <span className="active-dot" />}
                      </button>

                      <button
                        className={`mega-item-card ${currentRoute === "/admin/bulk-upload" ? "active" : ""}`}
                        onClick={() => {
                          setCurrentRoute("/admin/bulk-upload");
                          setIsMoreOpen(false);
                        }}
                      >
                        <div className="mega-item-icon blue">
                          <UploadCloudIcon size={18} />
                        </div>
                        <div className="mega-item-body">
                          <div className="mega-item-title">Bulk Data Upload</div>
                          <div className="mega-item-desc">Excel & CSV database import</div>
                        </div>
                        {currentRoute === "/admin/bulk-upload" && <span className="active-dot" />}
                      </button>
                    </div>

                    {/* Column 3: Finance & Governance (4 items) */}
                    <div className="mega-column">
                      <div className="mega-section-label">
                        📊 Finance & Governance
                      </div>

                      <button
                        className={`mega-item-card ${currentRoute === "/finance/dashboard" ? "active" : ""}`}
                        onClick={() => {
                          setCurrentRoute("/finance/dashboard");
                          setIsMoreOpen(false);
                        }}
                      >
                        <div className="mega-item-icon green">
                          <DollarSignIcon size={18} />
                        </div>
                        <div className="mega-item-body">
                          <div className="mega-item-title">Finance Dashboard</div>
                          <div className="mega-item-desc">Invoicing & revenue recognition</div>
                        </div>
                        {currentRoute === "/finance/dashboard" && <span className="active-dot" />}
                      </button>

                      <button
                        className={`mega-item-card ${currentRoute === "/admin/billing-configuration" ? "active" : ""}`}
                        onClick={() => {
                          setCurrentRoute("/admin/billing-configuration");
                          setIsMoreOpen(false);
                        }}
                      >
                        <div className="mega-item-icon slate">
                          <SettingsGearIcon size={18} />
                        </div>
                        <div className="mega-item-body">
                          <div className="mega-item-title">Billing & Gateways</div>
                          <div className="mega-item-desc">Payment setup & tax rules</div>
                        </div>
                        {currentRoute === "/admin/billing-configuration" && <span className="active-dot" />}
                      </button>

                      <button
                        className={`mega-item-card ${currentRoute === "/admin/complaints" ? "active" : ""}`}
                        onClick={() => {
                          setCurrentRoute("/admin/complaints");
                          setIsMoreOpen(false);
                        }}
                      >
                        <div className="mega-item-icon rose">
                          <ShieldAlertIcon size={18} />
                        </div>
                        <div className="mega-item-body">
                          <div className="mega-item-title">Staff Complaints</div>
                          <div className="mega-item-desc">Customer disputes & oversight</div>
                        </div>
                        {currentRoute === "/admin/complaints" && <span className="active-dot" />}
                      </button>

                      <button
                        className={`mega-item-card ${currentRoute === "/admin/audit-logs" ? "active" : ""}`}
                        onClick={() => {
                          setCurrentRoute("/admin/audit-logs");
                          setIsMoreOpen(false);
                        }}
                      >
                        <div className="mega-item-icon indigo">
                          <ShieldCheckIcon size={18} />
                        </div>
                        <div className="mega-item-body">
                          <div className="mega-item-title">Audit & Activity Logs</div>
                          <div className="mega-item-desc">Security events & audit trails</div>
                        </div>
                        {currentRoute === "/admin/audit-logs" && <span className="active-dot" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {isSales && !isAdmin && (
          <>
            <button
              className={`nav-link-btn ${currentRoute === "/sales/dashboard" ? "active" : ""}`}
              onClick={() => setCurrentRoute("/sales/dashboard")}
            >
              <BriefcaseIcon size={16} /> Sales Dashboard
            </button>
            <button
              className={`nav-link-btn ${currentRoute === "/sales/fulfillment" ? "active" : ""}`}
              onClick={() => setCurrentRoute("/sales/fulfillment")}
            >
              <TruckIcon size={16} /> Fulfillment
            </button>
            <button
              className={`nav-link-btn ${currentRoute.includes("messages") ? "active" : ""}`}
              onClick={() => setCurrentRoute("/sales/messages")}
            >
              <MessageSquareIcon size={16} /> Messages
            </button>
          </>
        )}

        {isFinance && !isAdmin && (
          <button
            className={`nav-link-btn ${currentRoute === "/finance/dashboard" ? "active" : ""}`}
            onClick={() => setCurrentRoute("/finance/dashboard")}
          >
            <DollarSignIcon size={16} /> Finance Dashboard
          </button>
        )}

        {isOps && !isAdmin && (
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

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
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
                  {user.email && (
                    <div className="dropdown-email">{user.email}</div>
                  )}
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
                    <span className="info-value">
                      {user.employee_id || user.id}
                    </span>
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

        {/* Mobile Hamburger Toggle Button */}
        <button
          type="button"
          className="mobile-hamburger-btn"
          onClick={() => setIsMobileDrawerOpen(true)}
          aria-label="Open Navigation Menu"
          title="Open Navigation Menu"
        >
          <MenuIcon size={20} />
        </button>
      </div>

      {/* Slide-In Mobile Navigation Drawer */}
      {isMobileDrawerOpen && (
        <div className="mobile-nav-backdrop" onClick={() => setIsMobileDrawerOpen(false)}>
          <div
            className="mobile-nav-drawer"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation"
          >
            {/* Drawer Header */}
            <div className="mobile-drawer-header">
              <div className="topbar-brand">
                <div className="topbar-logo">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M5 4h7a8 8 0 0 1 8 8 8 8 0 0 1-8 8H5V4z" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M5 12h5a3 3 0 0 0 3-3 3 3 0 0 0-3-3H5" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                  <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "#0f172a" }}>DealFlow360</span>
                  <span className="badge badge-pending" style={{ fontSize: "0.6875rem", padding: "0.15rem 0.45rem" }}>{user.role}</span>
                </div>
              </div>
              <button
                type="button"
                className="mobile-drawer-close-btn"
                onClick={() => setIsMobileDrawerOpen(false)}
                aria-label="Close navigation"
              >
                <CloseIcon size={20} />
              </button>
            </div>

            {/* Drawer Links Body */}
            <div className="mobile-drawer-body">
              {isAdmin && (
                <div className="mobile-nav-section">
                  <div className="mobile-section-title">Core Management</div>
                  <button
                    className={`mobile-nav-item ${currentRoute === "/admin/dashboard" ? "active" : ""}`}
                    onClick={() => { setCurrentRoute("/admin/dashboard"); setIsMobileDrawerOpen(false); }}
                  >
                    <LayoutDashboardIcon size={18} /> <span>Dashboard</span>
                  </button>
                  <button
                    className={`mobile-nav-item ${currentRoute === "/admin/products" ? "active" : ""}`}
                    onClick={() => { setCurrentRoute("/admin/products"); setIsMobileDrawerOpen(false); }}
                  >
                    <PackageIcon size={18} /> <span>Products & Catalog</span>
                  </button>
                  <button
                    className={`mobile-nav-item ${currentRoute.startsWith("/sales/quotations") ? "active" : ""}`}
                    onClick={() => { setCurrentRoute("/sales/quotations"); setIsMobileDrawerOpen(false); }}
                  >
                    <FileTextIcon size={18} /> <span>Quotations & Pipeline</span>
                  </button>
                  <button
                    className={`mobile-nav-item ${currentRoute === "/admin/complaints" ? "active" : ""}`}
                    onClick={() => { setCurrentRoute("/admin/complaints"); setIsMobileDrawerOpen(false); }}
                  >
                    <ShieldAlertIcon size={18} /> <span>Staff Complaints</span>
                  </button>

                  {/* Expandable More Modules in Drawer */}
                  <div className="mobile-section-title" style={{ marginTop: "1rem" }}>
                    💼 Sales & Commercial
                  </div>
                  <button
                    className={`mobile-nav-item sub ${currentRoute === "/admin/discount-policies" ? "active" : ""}`}
                    onClick={() => { setCurrentRoute("/admin/discount-policies"); setIsMobileDrawerOpen(false); }}
                  >
                    <PercentIcon size={16} /> <span>Discount Policies</span>
                  </button>
                  <button
                    className={`mobile-nav-item sub ${currentRoute === "/admin/customer-tiers" ? "active" : ""}`}
                    onClick={() => { setCurrentRoute("/admin/customer-tiers"); setIsMobileDrawerOpen(false); }}
                  >
                    <UserCheckIcon size={16} /> <span>Customer Tiers</span>
                  </button>
                  <button
                    className={`mobile-nav-item sub ${currentRoute === "/admin/deal-health" ? "active" : ""}`}
                    onClick={() => { setCurrentRoute("/admin/deal-health"); setIsMobileDrawerOpen(false); }}
                  >
                    <ActivityIcon size={16} /> <span>Deal Health & Risk</span>
                  </button>
                  <button
                    className={`mobile-nav-item sub ${currentRoute.includes("messages") ? "active" : ""}`}
                    onClick={() => { setCurrentRoute("/sales/messages"); setIsMobileDrawerOpen(false); }}
                  >
                    <MessageSquareIcon size={16} /> <span>Sales Chat & Messages</span>
                  </button>

                  <div className="mobile-section-title" style={{ marginTop: "1rem" }}>
                    🚚 Supply Chain & Operations
                  </div>
                  <button
                    className={`mobile-nav-item sub ${currentRoute === "/admin/warehouses" ? "active" : ""}`}
                    onClick={() => { setCurrentRoute("/admin/warehouses"); setIsMobileDrawerOpen(false); }}
                  >
                    <TruckIcon size={16} /> <span>Warehouses & Hubs</span>
                  </button>
                  <button
                    className={`mobile-nav-item sub ${currentRoute === "/sales/fulfillment" ? "active" : ""}`}
                    onClick={() => { setCurrentRoute("/sales/fulfillment"); setIsMobileDrawerOpen(false); }}
                  >
                    <TruckIcon size={16} /> <span>Order Fulfillment</span>
                  </button>
                  <button
                    className={`mobile-nav-item sub ${currentRoute === "/operations/dashboard" ? "active" : ""}`}
                    onClick={() => { setCurrentRoute("/operations/dashboard"); setIsMobileDrawerOpen(false); }}
                  >
                    <ActivityIcon size={16} /> <span>Operations Optimizer</span>
                  </button>
                  <button
                    className={`mobile-nav-item sub ${currentRoute === "/admin/bulk-upload" ? "active" : ""}`}
                    onClick={() => { setCurrentRoute("/admin/bulk-upload"); setIsMobileDrawerOpen(false); }}
                  >
                    <UploadCloudIcon size={16} /> <span>Bulk Data Upload</span>
                  </button>

                  <div className="mobile-section-title" style={{ marginTop: "1rem" }}>
                    📊 Finance & Governance
                  </div>
                  <button
                    className={`mobile-nav-item sub ${currentRoute === "/finance/dashboard" ? "active" : ""}`}
                    onClick={() => { setCurrentRoute("/finance/dashboard"); setIsMobileDrawerOpen(false); }}
                  >
                    <DollarSignIcon size={16} /> <span>Finance Dashboard</span>
                  </button>
                  <button
                    className={`mobile-nav-item sub ${currentRoute === "/admin/billing-configuration" ? "active" : ""}`}
                    onClick={() => { setCurrentRoute("/admin/billing-configuration"); setIsMobileDrawerOpen(false); }}
                  >
                    <SettingsGearIcon size={16} /> <span>Billing & Gateways</span>
                  </button>
                  <button
                    className={`mobile-nav-item sub ${currentRoute === "/admin/audit-logs" ? "active" : ""}`}
                    onClick={() => { setCurrentRoute("/admin/audit-logs"); setIsMobileDrawerOpen(false); }}
                  >
                    <ShieldCheckIcon size={16} /> <span>Audit & Security Logs</span>
                  </button>
                  <button
                    className={`mobile-nav-item sub ${currentRoute === "/admin/reports" ? "active" : ""}`}
                    onClick={() => { setCurrentRoute("/admin/reports"); setIsMobileDrawerOpen(false); }}
                  >
                    <FileTextIcon size={16} /> <span>Executive Reports</span>
                  </button>
                </div>
              )}

              {isSales && !isAdmin && (
                <div className="mobile-nav-section">
                  <div className="mobile-section-title">Sales Workspace</div>
                  <button
                    className={`mobile-nav-item ${currentRoute === "/sales/dashboard" ? "active" : ""}`}
                    onClick={() => { setCurrentRoute("/sales/dashboard"); setIsMobileDrawerOpen(false); }}
                  >
                    <BriefcaseIcon size={18} /> <span>Sales Dashboard</span>
                  </button>
                  <button
                    className={`mobile-nav-item ${currentRoute === "/sales/fulfillment" ? "active" : ""}`}
                    onClick={() => { setCurrentRoute("/sales/fulfillment"); setIsMobileDrawerOpen(false); }}
                  >
                    <TruckIcon size={18} /> <span>Fulfillment</span>
                  </button>
                  <button
                    className={`mobile-nav-item ${currentRoute.includes("messages") ? "active" : ""}`}
                    onClick={() => { setCurrentRoute("/sales/messages"); setIsMobileDrawerOpen(false); }}
                  >
                    <MessageSquareIcon size={18} /> <span>Messages & Negotiation</span>
                  </button>
                </div>
              )}

              {isFinance && !isAdmin && (
                <div className="mobile-nav-section">
                  <div className="mobile-section-title">Financial Management</div>
                  <button
                    className={`mobile-nav-item ${currentRoute === "/finance/dashboard" ? "active" : ""}`}
                    onClick={() => { setCurrentRoute("/finance/dashboard"); setIsMobileDrawerOpen(false); }}
                  >
                    <DollarSignIcon size={18} /> <span>Finance Dashboard</span>
                  </button>
                </div>
              )}

              {isOps && !isAdmin && (
                <div className="mobile-nav-section">
                  <div className="mobile-section-title">Operations & Supply</div>
                  <button
                    className={`mobile-nav-item ${currentRoute === "/operations/dashboard" ? "active" : ""}`}
                    onClick={() => { setCurrentRoute("/operations/dashboard"); setIsMobileDrawerOpen(false); }}
                  >
                    <TruckIcon size={18} /> <span>Operations Dashboard</span>
                  </button>
                </div>
              )}

              {isCustomer && (
                <div className="mobile-nav-section">
                  <div className="mobile-section-title">Customer Portal</div>
                  <button
                    className={`mobile-nav-item ${currentRoute === "/customer/portal" ? "active" : ""}`}
                    onClick={() => { setCurrentRoute("/customer/portal"); setIsMobileDrawerOpen(false); }}
                  >
                    <FileTextIcon size={18} /> <span>My Quotations & Orders</span>
                  </button>
                  <button
                    className={`mobile-nav-item ${currentRoute.includes("messages") ? "active" : ""}`}
                    onClick={() => { setCurrentRoute("/customer/messages"); setIsMobileDrawerOpen(false); }}
                  >
                    <MessageSquareIcon size={18} /> <span>Live Negotiation Chat</span>
                  </button>
                </div>
              )}
            </div>

            {/* Drawer Footer User Info & Logout */}
            <div className="mobile-drawer-footer">
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div className="user-avatar" style={{ width: "36px", height: "36px", fontSize: "0.85rem" }}>
                  {user.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user.full_name}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user.email}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="dropdown-logout-btn"
                onClick={() => {
                  setIsMobileDrawerOpen(false);
                  logout();
                }}
                style={{ width: "100%", justifyContent: "center" }}
              >
                <LogOutIcon size={16} /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
