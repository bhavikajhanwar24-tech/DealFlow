import React, { useState, useEffect } from "react";
<<<<<<< HEAD
import {
  FileText,
  Building,
  CheckCircle,
  Download,
  Calendar,
  AlertCircle,
  Eye,
  ShieldCheck,
  Lock,
  LogOut,
} from "lucide-react";
=======
>>>>>>> ab37058657fe1d87e7cc871edaeeefda39e3b692
import { useAuth } from "../context/AuthContext";

const API_BASE = "http://localhost:5000/api";

const CheckCircleIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const LockIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const AlertCircleIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const ShieldCheckIcon = ({ size = 20, color = "currentColor", style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const DownloadIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

export default function CustomerPortal() {
  const { user, token, logout } = useAuth();
  const [portalData, setPortalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acceptedQuotes, setAcceptedQuotes] = useState([]);

  useEffect(() => {
    async function fetchPortal() {
      try {
        const res = await fetch(`${API_BASE}/customer/portal`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          setPortalData(data);
        } else {
          setError(data.message || "Failed to load customer quotations.");
        }
      } catch (err) {
        setError("Network error fetching quotation portal.");
      } finally {
        setLoading(false);
      }
    }
    fetchPortal();
  }, [token]);

  const handleAcceptQuote = (quoteId) => {
    setAcceptedQuotes((prev) => [...prev, quoteId]);
    alert(
      `Quotation ${quoteId} officially accepted! Your account executive has been notified.`,
    );
  };

  return (
    <div className="main-content">
      {/* Customer Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
          border: "1px solid var(--border-light)",
          borderRadius: "16px",
          padding: "1.75rem 2rem",
          marginBottom: "2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div>
<<<<<<< HEAD
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "#dcfce7",
              color: "#166534",
              padding: "0.25rem 0.625rem",
              borderRadius: "9999px",
              fontSize: "0.75rem",
              fontWeight: 700,
              marginBottom: "0.5rem",
            }}
          >
            <CheckCircle size={14} /> Verified Customer Account
=======
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#dcfce7", color: "#166534", padding: "0.25rem 0.625rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            <CheckCircleIcon size={14} /> Verified Customer Account
>>>>>>> ab37058657fe1d87e7cc871edaeeefda39e3b692
          </div>
          <h1
            style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a" }}
          >
            {user?.company_name || "Enterprise Customer"} Quotation Portal
          </h1>
          <p
            style={{ color: "#64748b", fontSize: "0.875rem", marginTop: "4px" }}
          >
            Authorized contact: <strong>{user?.full_name}</strong> (
            {user?.email})
          </p>
        </div>

        <div
          style={{
            textAlign: "right",
            display: "flex",
            alignItems: "flex-end",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <div
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "#94a3b8",
              textTransform: "uppercase",
            }}
          >
            Access Isolation Policy
          </div>
<<<<<<< HEAD
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: "#2563eb",
              fontSize: "0.875rem",
              fontWeight: 600,
              marginTop: "4px",
            }}
          >
            <Lock size={15} /> Strict Single-Tenant Portal
=======
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#2563eb", fontSize: "0.875rem", fontWeight: 600, marginTop: "4px" }}>
            <LockIcon size={15} /> Strict Single-Tenant Portal
>>>>>>> ab37058657fe1d87e7cc871edaeeefda39e3b692
          </div>
          <button
            className="btn-secondary"
            style={{ padding: "0.45rem 0.75rem", fontSize: "0.8125rem" }}
            onClick={logout}
          >
            <LogOut size={15} /> Logout
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">
          <AlertCircleIcon size={18} />
          <div>{error}</div>
        </div>
      )}

      {/* Security Assurance Banner */}
      <div
        style={{
          background: "#eff6ff",
          border: "1px solid #bfdbfe",
          borderRadius: "12px",
          padding: "1rem 1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          marginBottom: "1.5rem",
          fontSize: "0.875rem",
          color: "#1e40af",
        }}
      >
        <ShieldCheckIcon size={20} color="#2563eb" style={{ flexShrink: 0 }} />
        <div>
          <strong>Role Governance Active:</strong> As a verified customer, you
          are restricted to viewing only quotations authored for{" "}
          <strong>{user?.company_name || "your company"}</strong>. Internal
          sales margins, cost floors, and administrative tools are safeguarded.
        </div>
      </div>

      {/* Quotations List */}
      <div className="data-table-card">
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid var(--border-light)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 700 }}>
              Your Active Quotations
            </h2>
            <div style={{ fontSize: "0.8125rem", color: "#64748b" }}>
              Quotes generated by DealFlow360 commercial operations for your
              organization.
            </div>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Quote ID</th>
                <th>Package Description</th>
                <th>Valid Until</th>
                <th>Total Value</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="6"
                    style={{
                      textAlign: "center",
                      padding: "3rem",
                      color: "#64748b",
                    }}
                  >
                    Loading customer quotes...
                  </td>
                </tr>
              ) : (
                portalData?.quotations?.map((quote) => {
                  const isAccepted =
                    acceptedQuotes.includes(quote.id) ||
                    quote.status === "Accepted";

                  return (
                    <tr key={quote.id}>
                      <td style={{ fontWeight: 700, color: "#1e293b" }}>
                        <code>{quote.id}</code>
                      </td>
                      <td style={{ fontWeight: 600 }}>{quote.description}</td>
                      <td style={{ fontSize: "0.8125rem", color: "#64748b" }}>
                        {quote.validUntil}
                      </td>
                      <td
                        style={{
                          fontSize: "1rem",
                          fontWeight: 700,
                          color: "#0f172a",
                        }}
                      >
                        {quote.amount}
                      </td>
                      <td>
                        <span
                          className={`badge ${isAccepted ? "badge-active" : "badge-pending"}`}
                        >
<<<<<<< HEAD
                          {isAccepted ? "Accepted" : quote.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", gap: "0.5rem" }}>
=======
                          <DownloadIcon size={14} /> PDF
                        </button>
                        {!isAccepted && (
>>>>>>> ab37058657fe1d87e7cc871edaeeefda39e3b692
                          <button
                            className="btn-secondary"
                            style={{
                              padding: "0.4rem 0.75rem",
                              fontSize: "0.8125rem",
                            }}
                            onClick={() =>
                              alert(
                                `Downloading signed quotation PDF for ${quote.id}...`,
                              )
                            }
                          >
<<<<<<< HEAD
                            <Download size={14} /> PDF
=======
                            <CheckCircleIcon size={14} /> Accept Quote
>>>>>>> ab37058657fe1d87e7cc871edaeeefda39e3b692
                          </button>
                          {!isAccepted && (
                            <button
                              className="btn-primary"
                              style={{
                                width: "auto",
                                padding: "0.4rem 0.85rem",
                                fontSize: "0.8125rem",
                              }}
                              onClick={() => handleAcceptQuote(quote.id)}
                            >
                              <CheckCircle size={14} /> Accept Quote
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
