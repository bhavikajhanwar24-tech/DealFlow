import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import ScrollVideoHero from "./components/ScrollVideoHero";
import AuthPage from "./pages/AuthPage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminApprovals from "./pages/AdminApprovals";
import AdminStaff from "./pages/AdminStaff";
import ProductManagement from "./pages/ProductManagement";
import AdminWarehouses from "./pages/AdminWarehouses";
import DiscountPolicies from "./pages/DiscountPolicies";
import AdminGovernance from "./pages/AdminGovernance";
import SalesDashboard from "./pages/SalesDashboard";
import Quotations from "./pages/Quotations";
import CreateQuotation from "./pages/CreateQuotation";
import QuotationDetail from "./pages/QuotationDetail";
import Fulfillment from "./pages/Fulfillment";
import FinanceDashboard from "./pages/FinanceDashboard";
import OperationsDashboard from "./pages/OperationsDashboard";
import CustomerPortal from "./pages/CustomerPortal";
import QuotationMessages from "./pages/QuotationMessages";
import AccessDenied from "./pages/AccessDenied";
import "./App.css";

function AppContent() {
  const { user, loading } = useAuth();
  const [currentRoute, setCurrentRoute] = useState(
    () => window.location.pathname || "/",
  );

  // Determine initial role destination
  const getRoleDestination = (currentUser) => {
    if (!currentUser) return "/login";
    switch (currentUser.role) {
      case "ADMIN":
        return "/admin/dashboard";
      case "SALES_REP":
      case "SALES_MANAGER":
        return "/sales/dashboard";
      case "FINANCE":
        return "/finance/dashboard";
      case "OPERATIONS":
        return "/operations/dashboard";
      case "CUSTOMER":
        return "/customer/portal";
      default:
        return "/login";
    }
  };

  // Keep route synced with browser address bar
  const navigate = (path) => {
    setCurrentRoute(path);
    if (window.location.pathname !== path) {
      window.history.pushState(null, "", path);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(window.location.pathname);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Sync route on login
  useEffect(() => {
    if (!loading) {
      if (user && (currentRoute === "/login" || currentRoute === "/signup")) {
        const dest = getRoleDestination(user);
        navigate(dest);
      } else if (
        !user &&
        currentRoute !== "/" &&
        currentRoute !== "/login" &&
        currentRoute !== "/signup"
      ) {
        navigate("/login");
      }
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div
        className="atmospheric-bg"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            className="brand-logo-container"
            style={{ width: "64px", height: "64px", margin: "0 auto 1.5rem" }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 4h7a8 8 0 0 1 8 8 8 8 0 0 1-8 8H5V4z"
                stroke="#ffffff"
                strokeWidth="2.75"
              />
              <path
                d="M5 12h5a3 3 0 0 0 3-3 3 3 0 0 0-3-3H5"
                stroke="#bfdbfe"
                strokeWidth="2.25"
              />
            </svg>
          </div>
          <div
            style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a" }}
          >
            Initializing DealFlow360...
          </div>
        </div>
      </div>
    );
  }

  // Keep the public cinematic landing page at the root route.
  if (!user || user.status !== "ACTIVE") {
    if (currentRoute === "/") {
      return <ScrollVideoHero onNavigate={navigate} />;
    }
    return (
      <div className="app-layout sales-bg-active">
        <AuthPage
          onLoginSuccess={(loggedInUser) => {
            const dest = getRoleDestination(loggedInUser);
            navigate(dest);
          }}
        />
      </div>
    );
  }

  // Role Gatekeeper and Router
  const renderCurrentView = () => {
    // 1. Admin Routes
    if (currentRoute === "/admin/dashboard") {
      if (user.role !== "ADMIN") {
        return <AccessDenied onNavigate={navigate} requiredRoles={["ADMIN"]} />;
      }
      return <AdminDashboard onNavigate={navigate} />;
    }

    if (currentRoute === "/admin/employee-approvals") {
      if (user.role !== "ADMIN") {
        return <AccessDenied onNavigate={navigate} requiredRoles={["ADMIN"]} />;
      }
      return <AdminApprovals />;
    }

    if (currentRoute === "/admin/staff") {
      if (user.role !== "ADMIN") {
        return <AccessDenied onNavigate={navigate} requiredRoles={["ADMIN"]} />;
      }
      return <AdminStaff />;
    }

    if (currentRoute === "/admin/products") {
      if (user.role !== "ADMIN") {
        return <AccessDenied onNavigate={navigate} requiredRoles={["ADMIN"]} />;
      }
      return <ProductManagement />;
    }

    if (currentRoute === "/admin/warehouses") {
      if (user.role !== "ADMIN") {
        return <AccessDenied onNavigate={navigate} requiredRoles={["ADMIN"]} />;
      }
      return <AdminWarehouses />;
    }

    if (currentRoute === "/admin/discount-policies") {
      if (user.role !== "ADMIN") {
        return <AccessDenied onNavigate={navigate} requiredRoles={["ADMIN"]} />;
      }
      return <DiscountPolicies />;
    }

    if (
      [
        "/admin/audit-logs",
        "/admin/billing-configuration",
        "/admin/subscription-plans",
        "/admin/customer-tiers",
      ].includes(currentRoute)
    ) {
      if (user.role !== "ADMIN")
        return <AccessDenied onNavigate={navigate} requiredRoles={["ADMIN"]} />;
      const modeByRoute = {
        "/admin/audit-logs": "audit",
        "/admin/billing-configuration": "billing",
        "/admin/subscription-plans": "plans",
        "/admin/customer-tiers": "tiers",
      };
      const mode = modeByRoute[currentRoute];
      return <AdminGovernance mode={mode} />;
    }

    // 2. Sales Routes
    if (currentRoute.startsWith("/sales/quotations/")) {
      const allowed = ["SALES_REP", "SALES_MANAGER", "ADMIN"];
      if (!allowed.includes(user.role)) {
        return <AccessDenied onNavigate={navigate} requiredRoles={allowed} />;
      }
      if (currentRoute === "/sales/quotations/new") {
        return <CreateQuotation onNavigate={navigate} />;
      }
      return (
        <QuotationDetail
          quotationId={currentRoute.split("/").pop()}
          onNavigate={navigate}
        />
      );
    }

    if (currentRoute === "/sales/quotations") {
      const allowed = ["SALES_REP", "SALES_MANAGER", "ADMIN"];
      if (!allowed.includes(user.role)) {
        return <AccessDenied onNavigate={navigate} requiredRoles={allowed} />;
      }
      return <Quotations onNavigate={navigate} />;
    }

    if (currentRoute === "/sales/fulfillment") {
      const allowed = ["SALES_REP", "SALES_MANAGER", "ADMIN", "OPERATIONS"];
      if (!allowed.includes(user.role)) {
        return <AccessDenied onNavigate={navigate} requiredRoles={allowed} />;
      }
      return <Fulfillment onNavigate={navigate} />;
    }

    if (currentRoute === "/sales/dashboard" || currentRoute === "/approvals") {
      const allowed = ["SALES_REP", "SALES_MANAGER", "ADMIN"];
      if (!allowed.includes(user.role)) {
        return <AccessDenied onNavigate={navigate} requiredRoles={allowed} />;
      }
      return <SalesDashboard onNavigate={navigate} />;
    }

    // 3. Finance Routes
    if (currentRoute === "/finance/dashboard") {
      const allowed = ["FINANCE", "ADMIN"];
      if (!allowed.includes(user.role)) {
        return <AccessDenied onNavigate={navigate} requiredRoles={allowed} />;
      }
      return <FinanceDashboard />;
    }

    // 4. Operations Routes
    if (currentRoute === "/operations/dashboard") {
      const allowed = ["OPERATIONS", "ADMIN"];
      if (!allowed.includes(user.role)) {
        return <AccessDenied onNavigate={navigate} requiredRoles={allowed} />;
      }
      return <OperationsDashboard onNavigate={navigate} />;
    }

    // 5. Customer Routes
    if (currentRoute === "/customer/portal") {
      const allowed = ["CUSTOMER"];
      if (!allowed.includes(user.role)) {
        return <AccessDenied onNavigate={navigate} requiredRoles={allowed} />;
      }
      return <CustomerPortal />;
    }

    // 6. Messages Routes (Shared Chat view for Sales & Customer)
    if (
      currentRoute === "/messages" ||
      currentRoute === "/sales/messages" ||
      currentRoute === "/customer/messages"
    ) {
      return <QuotationMessages onNavigate={navigate} />;
    }

    // Default Fallback
    return <AccessDenied onNavigate={navigate} />;
  };

  const showNavbar =
    currentRoute === "/admin/dashboard" ||
    currentRoute === "/admin/employee-approvals" ||
    currentRoute === "/admin/staff" ||
    currentRoute === "/admin/products" ||
    currentRoute === "/admin/warehouses" ||
    currentRoute === "/admin/discount-policies" ||
    currentRoute === "/admin/audit-logs" ||
    currentRoute === "/admin/billing-configuration" ||
    currentRoute === "/admin/subscription-plans" ||
    currentRoute === "/admin/customer-tiers" ||
    currentRoute === "/sales/fulfillment" ||
    currentRoute === "/operations/dashboard" ||
    currentRoute === "/sales/dashboard" ||
    currentRoute === "/approvals" ||
    currentRoute.startsWith("/sales/quotations") ||
    currentRoute.startsWith("/customer") ||
    currentRoute.includes("messages");

  const isSalesRoute =
    currentRoute.startsWith("/sales") ||
    currentRoute === "/approvals" ||
    currentRoute.startsWith("/customer") ||
    currentRoute.includes("messages");

  return (
    <div className="app-layout sales-bg-active">
      {showNavbar && (
        <Navbar currentRoute={currentRoute} setCurrentRoute={navigate} />
      )}
      {renderCurrentView()}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
