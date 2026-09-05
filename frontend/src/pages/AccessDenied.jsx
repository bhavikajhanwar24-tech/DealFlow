import React from "react";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function AccessDenied({ onNavigate, requiredRoles }) {
  const { user } = useAuth();

  const getDefaultRoute = () => {
    if (!user) return "/login";
    switch (user.role) {
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

  return (
    <div className="main-content" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #fecaca",
          borderRadius: "20px",
          padding: "3rem 2.5rem",
          maxWidth: "520px",
          width: "100%",
          textAlign: "center",
          boxShadow: "0 10px 25px -4px rgba(239, 68, 68, 0.1)"
        }}
      >
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: "#fee2e2",
            color: "#dc2626",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "1.5rem"
          }}
        >
          <ShieldAlert size={32} />
        </div>

        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a", marginBottom: "0.5rem" }}>
          403 Access Denied
        </h1>
        <p style={{ color: "#64748b", fontSize: "0.9375rem", lineHeight: 1.5, marginBottom: "1.5rem" }}>
          You do not have administrative or role clearance to access this resource. Internal and customer portals are strictly segregated according to enterprise DealFlow360 security governance.
        </p>

        <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "10px", fontSize: "0.8125rem", color: "#475569", marginBottom: "1.75rem", textAlign: "left" }}>
          <div>• <strong>Your Active Role:</strong> <span className="badge badge-suspended" style={{ marginLeft: "4px" }}>{user?.role || "UNAUTHENTICATED"}</span></div>
          {requiredRoles && (
            <div style={{ marginTop: "6px" }}>• <strong>Required Clearance:</strong> <code>{requiredRoles.join(" or ")}</code></div>
          )}
        </div>

        <button
          className="btn-primary"
          style={{ width: "auto", margin: "0 auto", padding: "0.625rem 1.5rem" }}
          onClick={() => onNavigate(getDefaultRoute())}
        >
          <ArrowLeft size={16} /> Return to Authorized Workspace
        </button>
      </div>
    </div>
  );
}
