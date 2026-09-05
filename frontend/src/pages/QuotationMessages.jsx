import { useEffect, useState, useRef, useCallback } from "react";
import {
  MessageSquare,
  Search,
  Send,
  Building2,
  ArrowRight,
  FileText,
  Sparkles,
  Bot,
  TrendingUp,
  ShieldAlert,
  Users,
  ShieldCheck,
  UserCheck,
  User,
  Info,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const API_BASE = "http://localhost:5000/api";

const currency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const statusBadgeClass = (status) => {
  switch (status) {
    case "APPROVED":
    case "CONFIRMED":
      return "badge-approved";
    case "NEGOTIATION":
    case "PENDING":
      return "badge-pending";
    case "REJECTED":
      return "badge-rejected";
    default:
      return "badge-draft";
  }
};

const getRoleBadge = (role) => {
  switch (role) {
    case "ADMIN":
      return { label: "Admin", bg: "#f5f3ff", color: "#7c3aed", border: "#ddd6fe" };
    case "SALES_REP":
    case "SALES_MANAGER":
      return { label: "Sales Rep", bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" };
    case "CUSTOMER":
      return { label: "Customer", bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" };
    case "AI_BOT":
      return { label: "AI Negotiator", bg: "#f0f9ff", color: "#0284c7", border: "#bae6fd" };
    default:
      return { label: role, bg: "#f8fafc", color: "#475569", border: "#e2e8f0" };
  }
};

async function safeFetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      res.ok
        ? "Received non-JSON response from server."
        : `Server Error (${res.status}): Please check backend server logs.`
    );
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || `Request failed with status ${res.status}`);
  }
  return data;
}

export default function QuotationMessages({ onNavigate }) {
  const { user, token } = useAuth();
  const [quotations, setQuotations] = useState([]);
  const [selectedQuotationId, setSelectedQuotationId] = useState(null);
  const [activeQuotation, setActiveQuotation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [recipientRole, setRecipientRole] = useState("");
  const [hasAdminThread, setHasAdminThread] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotResult, setCopilotResult] = useState(null);
  const [error, setError] = useState("");

  const chatEndRef = useRef(null);
  const recipientRoleRef = useRef(recipientRole);

  useEffect(() => {
    recipientRoleRef.current = recipientRole;
  }, [recipientRole]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadQuotations = async (keepSelected = true) => {
    if (!token) return;
    try {
      const data = await safeFetchJson(`${API_BASE}/messages/quotations`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const list = data.data || [];
      setQuotations(list);

      if (list.length > 0 && (!selectedQuotationId || !keepSelected)) {
        setSelectedQuotationId(list[0].id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = useCallback(
    async (quotationId, targetRecipient = null, isPolling = false) => {
      if (!quotationId || !token) return;
      if (!isPolling) setMessagesLoading(true);

      const activeRecipient = targetRecipient !== null ? targetRecipient : recipientRoleRef.current;

      try {
        const isCust = user?.role === "CUSTOMER";
        const queryParam = activeRecipient ? `?recipientRole=${encodeURIComponent(activeRecipient)}` : "";

        const promises = [
          safeFetchJson(`${API_BASE}/messages/quotations/${quotationId}${queryParam}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ];

        if (!isCust) {
          promises.push(
            safeFetchJson(`${API_BASE}/messages/quotations/${quotationId}/ai-analysis`, {
              headers: { Authorization: `Bearer ${token}` },
            }).catch(() => null)
          );
        }

        const results = await Promise.all(promises);
        const msgData = results[0];

        setActiveQuotation(msgData.data.quotation);
        setMessages(msgData.data.messages || []);

        const availableParticipants = msgData.data.participants?.options || [];
        setParticipants(availableParticipants);
        setHasAdminThread(Boolean(msgData.data.participants?.adminThreadExists));

        const selected = msgData.data.selectedRecipient?.role || availableParticipants[0]?.role || "";
        if (selected && selected !== recipientRoleRef.current && targetRecipient === null && !isPolling) {
          setRecipientRole(selected);
        }

        if (!isCust && results[1]) {
          setAiAnalysis(results[1].data);
        } else {
          setAiAnalysis(null);
        }

        if (!isPolling) {
          setTimeout(scrollToBottom, 100);
        }
      } catch (err) {
        if (!isPolling) setError(err.message);
      } finally {
        if (!isPolling) setMessagesLoading(false);
      }
    },
    [token, user?.role]
  );

  useEffect(() => {
    loadQuotations(false);
  }, [token]);

  useEffect(() => {
    if (selectedQuotationId) {
      setRecipientRole("");
      loadMessages(selectedQuotationId, "");
    }
  }, [selectedQuotationId, loadMessages]);

  useEffect(() => {
    if (!selectedQuotationId) return;
    const interval = setInterval(() => {
      loadMessages(selectedQuotationId, recipientRoleRef.current, true);
    }, 3500);
    return () => clearInterval(interval);
  }, [selectedQuotationId, loadMessages]);

  const handleRecipientChange = (newRole) => {
    setRecipientRole(newRole);
    loadMessages(selectedQuotationId, newRole, false);
  };

  const handleSendMessage = async (e, textToSend = null) => {
    if (e) e.preventDefault();
    const msgText = textToSend || newMessage;
    if (!msgText.trim() || !selectedQuotationId || sending) return;

    setSending(true);
    try {
      await safeFetchJson(`${API_BASE}/messages/quotations/${selectedQuotationId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: msgText, recipientRole: recipientRoleRef.current }),
      });

      setNewMessage("");
      await loadMessages(selectedQuotationId, recipientRoleRef.current, false);
      await loadQuotations(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleRunCopilot = async () => {
    if (!selectedQuotationId || copilotLoading || !activeQuotation) return;
    setCopilotLoading(true);
    setError("");
    try {
      const discAmt = Number(activeQuotation.discount_amount || 0);
      const subTot = Number(activeQuotation.subtotal || activeQuotation.final_amount || 1);
      const discountPct = subTot > 0 ? Math.round((discAmt / subTot) * 100) : 0;
      const marginPct = Number(activeQuotation.margin_percentage || 20);

      const response = await fetch(`${API_BASE}/ai/negotiation-copilot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentDiscount: discountPct,
          allowedDiscount: 15,
          currentMargin: marginPct,
          messages: messages || []
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to run Copilot");
      setCopilotResult(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCopilotLoading(false);
    }
  };

  const filteredQuotations = quotations.filter((q) => {
    const qNum = (q.quotation_number || "").toLowerCase();
    const cName = (q.customer_name || "").toLowerCase();
    const comp = (q.customer_company || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    return qNum.includes(query) || cName.includes(query) || comp.includes(query);
  });

  const isCustomer = user?.role === "CUSTOMER";
  const isSalesRep = user?.role === "SALES_REP" || user?.role === "SALES_MANAGER";

  const currentRecipient = participants.find((p) => p.role === recipientRole) || participants[0];

  return (
    <main
      className="main-content sales-dashboard-container"
      style={{ padding: "0.85rem 1.5rem 1rem", maxWidth: "1600px", margin: "0 auto" }}
    >
      {/* Top Banner */}
      <div
        className="page-heading-row"
        style={{
          marginBottom: "0.75rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div
            className="badge badge-approved"
            style={{ marginBottom: "0.25rem", display: "inline-flex", gap: "0.35rem", alignItems: "center", fontSize: "0.75rem" }}
          >
            <Sparkles size={12} /> Quotation Messaging & AI Negotiation Hub
          </div>
          <h1 style={{ fontSize: "1.45rem", margin: "0.15rem 0", fontWeight: 800 }}>Messages & Quotation Chat</h1>
          <p className="page-subtitle" style={{ fontSize: "0.825rem", margin: 0 }}>
            Dedicated channel messaging between Sales Rep, Admin, and Customer with real-time AI negotiation intelligence.
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ borderRadius: "10px", marginBottom: "0.75rem", padding: "0.6rem 1rem" }}>
          {error}
        </div>
      )}

      {/* Expanded Split Pane Chat Container */}
      <div
        style={{
          display: "flex",
          height: "calc(100vh - 150px)",
          minHeight: "750px",
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          border: "1px solid rgba(226, 232, 240, 0.9)",
          borderRadius: "18px",
          boxShadow: "0 14px 35px -8px rgba(15, 23, 42, 0.08)",
          overflow: "hidden",
        }}
      >
        {/* LEFT PANEL: Quotation List */}
        <div
          style={{
            width: "370px",
            minWidth: "330px",
            borderRight: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            background: "rgba(248, 250, 252, 0.75)",
          }}
        >
          <div style={{ padding: "0.85rem 1.15rem", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ fontWeight: 800, fontSize: "0.98rem", color: "#0f172a", marginBottom: "0.5rem" }}>
              Quotation Conversations
            </div>
            <div style={{ position: "relative" }}>
              <Search size={15} color="#94a3b8" style={{ position: "absolute", left: "11px", top: "10px" }} />
              <input
                type="text"
                placeholder="Search quotation ref or client..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
                style={{ paddingLeft: "34px", fontSize: "0.84rem", height: "35px" }}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem" }}>
            {loading ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#64748b", fontSize: "0.875rem" }}>
                Loading conversations...
              </div>
            ) : filteredQuotations.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#64748b", fontSize: "0.875rem" }}>
                No quotations found.
              </div>
            ) : (
              filteredQuotations.map((q) => {
                const isSelected = q.id === selectedQuotationId;
                const hasMessage = Boolean(q.latest_message?.message);

                return (
                  <div
                    key={q.id}
                    onClick={() => setSelectedQuotationId(q.id)}
                    style={{
                      padding: "0.85rem 1rem",
                      borderRadius: "12px",
                      marginBottom: "0.45rem",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      background: isSelected ? "rgba(37, 99, 235, 0.09)" : "transparent",
                      border: isSelected ? "1.5px solid rgba(37, 99, 235, 0.35)" : "1px solid transparent",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                      <span style={{ fontWeight: 800, fontSize: "0.93rem", color: isSelected ? "#1d4ed8" : "#0f172a" }}>
                        {q.quotation_number}
                      </span>
                      <span className={`badge ${statusBadgeClass(q.status)}`} style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }}>
                        {q.status}
                      </span>
                    </div>

                    <div style={{ fontSize: "0.825rem", fontWeight: 600, color: "#334155", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                      <Building2 size={13} color="#64748b" />
                      {q.customer_company || q.customer_name}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.35rem" }}>
                      <span
                        style={{
                          fontSize: "0.79rem",
                          color: "#64748b",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "200px",
                        }}
                      >
                        {hasMessage
                          ? `${(q.latest_message.sender_name || "").split(" ")[0]}: ${q.latest_message.message}`
                          : "No messages yet"}
                      </span>
                      <strong style={{ fontSize: "0.85rem", color: "#0f172a" }}>{currency(q.final_amount)}</strong>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Chat Interface */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#ffffff" }}>
          {activeQuotation ? (
            <>
              {/* Chat Header */}
              <div
                style={{
                  padding: "0.85rem 1.5rem",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "rgba(248, 250, 252, 0.95)",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      borderRadius: "12px",
                      background: "#eff6ff",
                      border: "1px solid #bfdbfe",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <FileText size={20} color="#2563eb" />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                        {activeQuotation.quotation_number}
                      </h2>
                      <span className={`badge ${statusBadgeClass(activeQuotation.status)}`}>
                        {activeQuotation.status}
                      </span>
                    </div>
                    <p style={{ color: "#64748b", fontSize: "0.825rem", margin: 0 }}>
                      Client: <strong>{activeQuotation.customer_company || activeQuotation.customer_name}</strong> · Sales Rep: {activeQuotation.sales_rep_name}
                    </p>
                  </div>
                </div>

                {/* Header Actions & Dropdown Channel Selector */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                  {/* Channel Dropdown */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.45rem",
                      background: "#ffffff",
                      border: "1.5px solid #cbd5e1",
                      borderRadius: "10px",
                      padding: "0.3rem 0.65rem",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                  >
                    <label
                      htmlFor="header-recipient-select"
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: 800,
                        color: "#475569",
                        textTransform: "uppercase",
                        letterSpacing: "0.03em",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                      }}
                    >
                      <Users size={14} color="#2563eb" /> Chat with:
                    </label>
                    <select
                      id="header-recipient-select"
                      value={recipientRole}
                      onChange={(e) => handleRecipientChange(e.target.value)}
                      disabled={participants.length <= 1}
                      style={{
                        border: "none",
                        background: "transparent",
                        fontWeight: 700,
                        fontSize: "0.835rem",
                        color: "#0f172a",
                        cursor: participants.length <= 1 ? "default" : "pointer",
                        outline: "none",
                        paddingRight: "0.5rem",
                      }}
                    >
                      {participants.map((p) => (
                        <option key={p.role} value={p.role}>
                          {p.role === "ADMIN" && "👑 Admin"}
                          {p.role === "CUSTOMER" && "👤 Customer"}
                          {p.role === "SALES_REP" && "💼 Sales Rep"}
                          {" — "}
                          {p.sublabel || p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!isCustomer && (
                    <button
                      className="btn-primary"
                      style={{
                        padding: "0.45rem 0.85rem",
                        fontSize: "0.8rem",
                        background: "linear-gradient(135deg, #0284c7, #2563eb)",
                        border: "none",
                      }}
                      onClick={handleRunCopilot}
                      disabled={copilotLoading}
                    >
                      <Sparkles size={15} /> {copilotLoading ? "Analyzing..." : "Analyze with Copilot"}
                    </button>
                  )}

                  <strong style={{ fontSize: "1.1rem", color: "#1e40af" }}>
                    {currency(activeQuotation.final_amount)}
                  </strong>

                  {onNavigate && (
                    <button
                      className="btn-secondary"
                      style={{ padding: "0.4rem 0.85rem", fontSize: "0.8rem" }}
                      onClick={() =>
                        onNavigate(
                          isCustomer
                            ? "/customer/portal"
                            : `/sales/quotations/${activeQuotation.id}`
                        )
                      }
                    >
                      View Details <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Recipient Channel Banner Indicator */}
              <div
                style={{
                  padding: "0.45rem 1.5rem",
                  background:
                    recipientRole === "ADMIN"
                      ? "linear-gradient(90deg, #f5f3ff, #faf5ff)"
                      : recipientRole === "CUSTOMER"
                        ? "linear-gradient(90deg, #f0fdf4, #f0fdfa)"
                        : "linear-gradient(90deg, #eff6ff, #f8fafc)",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.8rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {recipientRole === "ADMIN" && <ShieldCheck size={15} color="#7c3aed" />}
                  {recipientRole === "CUSTOMER" && <UserCheck size={15} color="#166534" />}
                  {recipientRole === "SALES_REP" && <User size={15} color="#2563eb" />}

                  <span style={{ color: "#475569" }}>
                    Active Channel:{" "}
                    <strong style={{ color: "#0f172a" }}>
                      {currentRecipient?.label || recipientRole} ({currentRecipient?.sublabel || ""})
                    </strong>
                  </span>
                </div>

                {isCustomer && !hasAdminThread && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "#64748b",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.3rem",
                    }}
                  >
                    <Info size={13} /> Admin escalation channel unlocks when initiated by Admin.
                  </span>
                )}
              </div>

              {/* AI Deal Financial Health & Profit Bar (Sales Rep & Admin only) */}
              {!isCustomer && aiAnalysis && (
                <div
                  style={{
                    padding: "0.65rem 1.5rem",
                    background:
                      aiAnalysis.dealHealth === "MARGIN_RISK"
                        ? "rgba(254, 242, 242, 0.9)"
                        : "rgba(240, 253, 244, 0.9)",
                    borderBottom: "1px solid #e2e8f0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "0.825rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontWeight: 700, color: "#0f172a" }}>
                      <TrendingUp size={15} color="#2563eb" />
                      <span>Revenue: <strong>{currency(aiAnalysis.finalAmount)}</strong></span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "#64748b" }}>
                      <span>Est. Cost: <strong>{currency(aiAnalysis.totalCost)}</strong></span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        color: aiAnalysis.currentMarginPercent >= 18 ? "#166534" : "#b91c1c",
                      }}
                    >
                      <span>
                        Gross Profit:{" "}
                        <strong>
                          {currency(aiAnalysis.currentProfit)} ({aiAnalysis.currentMarginPercent}%)
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {aiAnalysis.dealHealth === "MARGIN_RISK" ? (
                      <span
                        className="badge badge-rejected"
                        style={{ fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
                      >
                        <ShieldAlert size={13} /> MARGIN RISK (Max Safe Discount: {aiAnalysis.maxSafeDiscountPct}%)
                      </span>
                    ) : (
                      <span
                        className="badge badge-approved"
                        style={{ fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
                      >
                        <Sparkles size={13} /> HEALTHY DEAL MARGIN
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Copilot Result Pinned Banner */}
              {copilotResult && !isCustomer && (
                <div style={{
                  margin: '0.75rem 1.5rem 0.25rem',
                  padding: '1rem 1.25rem',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                  border: '1.5px solid #7dd3fc',
                  boxShadow: '0 6px 16px -4px rgba(14, 165, 233, 0.15)',
                  position: 'relative',
                  zIndex: 2,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                    <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0369a1', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Sparkles size={16} color="#0284c7" /> AI Negotiation Copilot Recommendation
                    </h3>
                    <button 
                      onClick={() => setCopilotResult(null)}
                      style={{ background: '#e0f2fe', border: 'none', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', color: '#0369a1', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Close Insight"
                    >
                      ✕
                    </button>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.82rem', color: '#0c4a6e', marginBottom: '0.75rem' }}>
                    <div style={{ background: 'rgba(255,255,255,0.7)', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                      <span style={{ color: '#64748b', fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700 }}>Request Context</span>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{copilotResult.detectedRequest || "Standard Negotiation"}</div>
                      <div style={{ fontSize: '0.78rem', color: '#0369a1' }}>Target: {copilotResult.requestedValue || "Policy terms"}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.7)', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                      <span style={{ color: '#64748b', fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700 }}>Financial Impact</span>
                      <div>
                        Risk: <span className={`badge ${copilotResult.riskLevel === 'High' ? 'badge-rejected' : 'badge-pending'}`} style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>{copilotResult.riskLevel}</span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 600 }}>Est. Margin: {copilotResult.estimatedMargin}</div>
                    </div>
                  </div>
                  
                  <div style={{ background: 'rgba(255,255,255,0.85)', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.83rem', border: '1px solid #bae6fd' }}>
                    <div style={{ marginBottom: '0.4rem' }}>
                      <strong style={{ color: '#0369a1' }}>Strategy:</strong> <span style={{ color: '#334155' }}>{copilotResult.suggestedAction}</span>
                    </div>
                    <div style={{ paddingTop: '0.4rem', borderTop: '1px dashed #bae6fd', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <strong style={{ color: '#0369a1' }}>Suggested Reply:</strong> 
                      <p style={{ margin: 0, fontStyle: 'italic', color: '#1e293b', background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '6px', borderLeft: '3px solid #0284c7' }}>
                        "{copilotResult.suggestedReply}"
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                        <button 
                          onClick={() => setNewMessage(copilotResult.suggestedReply)}
                          className="btn-primary" 
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.76rem', background: '#0284c7' }}
                        >
                          Insert into chat compose
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Chat Scroll Window (Maximised Height & Spacing) */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "1.5rem 1.75rem",
                  background: "#f8fafc",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem",
                }}
              >
                {messagesLoading && messages.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "4rem", color: "#64748b" }}>
                    Loading messages...
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "6rem 2rem", color: "#64748b" }}>
                    <MessageSquare size={44} color="#94a3b8" style={{ marginBottom: "0.85rem" }} />
                    <p style={{ fontWeight: 700, color: "#334155", fontSize: "1rem" }}>
                      No messages in this channel for {activeQuotation.quotation_number} yet.
                    </p>
                    <p style={{ fontSize: "0.88rem" }}>
                      Send a message below to start the conversation with{" "}
                      <strong>{currentRecipient?.label || "the participant"}</strong>.
                    </p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMyMessage = m.sender_id === user?.id;
                    const isAiBot = m.sender_role === "AI_BOT";
                    const badge = getRoleBadge(m.sender_role);

                    return (
                      <div
                        key={m.id}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: isAiBot ? "center" : isMyMessage ? "flex-end" : "flex-start",
                          marginBottom: "1.2rem",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "#64748b",
                            marginBottom: "0.3rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.4rem",
                          }}
                        >
                          {isAiBot ? <Bot size={14} color="#0284c7" /> : null}
                          <strong>{isMyMessage ? "You" : m.sender_name}</strong>
                          <span
                            style={{
                              background: badge.bg,
                              color: badge.color,
                              border: `1px solid ${badge.border}`,
                              borderRadius: "4px",
                              padding: "0.1rem 0.35rem",
                              fontSize: "0.68rem",
                              fontWeight: 700,
                            }}
                          >
                            {badge.label}
                          </span>
                          · {new Date(m.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <div
                          style={{
                            maxWidth: isAiBot ? "85%" : "72%",
                            padding: "0.95rem 1.25rem",
                            borderRadius: isAiBot
                              ? "14px"
                              : isMyMessage
                                ? "16px 16px 4px 16px"
                                : "16px 16px 16px 4px",
                            background: isAiBot
                              ? "linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)"
                              : isMyMessage
                                ? "#2563eb"
                                : "#ffffff",
                            color: isAiBot ? "#1e3a8a" : isMyMessage ? "#ffffff" : "#0f172a",
                            border: isAiBot
                              ? "1px solid #93c5fd"
                              : isMyMessage
                                ? "none"
                                : "1px solid #e2e8f0",
                            boxShadow: isAiBot
                              ? "0 4px 14px rgba(37, 99, 235, 0.09)"
                              : "0 2px 6px rgba(0,0,0,0.04)",
                            fontSize: "0.925rem",
                            lineHeight: "1.55",
                            whiteSpace: "pre-line",
                            wordBreak: "break-word",
                          }}
                        >
                          {m.message}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Quick Preset Action Chips */}
              <div
                style={{
                  padding: "0.55rem 1.25rem",
                  borderTop: "1px solid #f1f5f9",
                  background: "#ffffff",
                  display: "flex",
                  gap: "0.5rem",
                  overflowX: "auto",
                }}
              >
                {isCustomer ? (
                  recipientRole === "ADMIN" ? (
                    <>
                      <button
                        type="button"
                        className="badge badge-neutral"
                        style={{ cursor: "pointer", border: "1px solid #cbd5e1", fontSize: "0.775rem" }}
                        onClick={() =>
                          handleSendMessage(null, "Thank you for reaching out. We have a question regarding quotation terms.")
                        }
                      >
                        💬 Inquire with Admin Desk
                      </button>
                      <button
                        type="button"
                        className="badge badge-neutral"
                        style={{ cursor: "pointer", border: "1px solid #cbd5e1", fontSize: "0.775rem" }}
                        onClick={() =>
                          handleSendMessage(null, "Could you please confirm the payment milestones on this quotation?")
                        }
                      >
                        💳 Confirm Payment Milestones
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="badge badge-neutral"
                        style={{ cursor: "pointer", border: "1px solid #cbd5e1", fontSize: "0.775rem" }}
                        onClick={() =>
                          handleSendMessage(null, "Hi team, can we discuss a discount adjustment on this quote?")
                        }
                      >
                        💡 Request Discount Adjustment
                      </button>
                      <button
                        type="button"
                        className="badge badge-neutral"
                        style={{ cursor: "pointer", border: "1px solid #cbd5e1", fontSize: "0.775rem" }}
                        onClick={() =>
                          handleSendMessage(null, "Could you please confirm the estimated delivery timeline?")
                        }
                      >
                        🚚 Delivery Date Inquiry
                      </button>
                    </>
                  )
                ) : isSalesRep ? (
                  recipientRole === "ADMIN" ? (
                    <>
                      <button
                        type="button"
                        className="badge badge-neutral"
                        style={{ cursor: "pointer", border: "1px solid #cbd5e1", fontSize: "0.775rem" }}
                        onClick={() =>
                          handleSendMessage(
                            null,
                            "Requesting Admin approval for special discount terms on this quotation."
                          )
                        }
                      >
                        📊 Request Admin Discount Approval
                      </button>
                      <button
                        type="button"
                        className="badge badge-neutral"
                        style={{ cursor: "pointer", border: "1px solid #cbd5e1", fontSize: "0.775rem" }}
                        onClick={() =>
                          handleSendMessage(null, "Could you verify credit limit and margin clearance for this client?")
                        }
                      >
                        🛡️ Margin & Credit Clearance
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="badge badge-neutral"
                        style={{ cursor: "pointer", border: "1px solid #cbd5e1", fontSize: "0.775rem" }}
                        onClick={handleRunAIAutoReply}
                      >
                        🤖 Run AI Profit Analysis
                      </button>
                      <button
                        type="button"
                        className="badge badge-neutral"
                        style={{ cursor: "pointer", border: "1px solid #cbd5e1", fontSize: "0.775rem" }}
                        onClick={() =>
                          handleSendMessage(
                            null,
                            "Hello, we have updated the quotation pricing as requested. Please review."
                          )
                        }
                      >
                        ✅ Pricing Updated Notice
                      </button>
                      <button
                        type="button"
                        className="badge badge-neutral"
                        style={{ cursor: "pointer", border: "1px solid #cbd5e1", fontSize: "0.775rem" }}
                        onClick={() =>
                          handleSendMessage(
                            null,
                            "We are pleased to offer you special volume pricing on this quotation."
                          )
                        }
                      >
                        🎁 Special Volume Pricing
                      </button>
                    </>
                  )
                ) : (
                  // ADMIN View
                  recipientRole === "CUSTOMER" ? (
                    <>
                      <button
                        type="button"
                        className="badge badge-neutral"
                        style={{ cursor: "pointer", border: "1px solid #cbd5e1", fontSize: "0.775rem" }}
                        onClick={() =>
                          handleSendMessage(
                            null,
                            "Greetings from Corporate Admin. We are reviewing your quotation terms to provide the best possible offer."
                          )
                        }
                      >
                        👋 Welcome Customer from Admin Desk
                      </button>
                      <button
                        type="button"
                        className="badge badge-neutral"
                        style={{ cursor: "pointer", border: "1px solid #cbd5e1", fontSize: "0.775rem" }}
                        onClick={() =>
                          handleSendMessage(
                            null,
                            "We have authorized enterprise concessions for your order. Please review the updated terms."
                          )
                        }
                      >
                        ✨ Enterprise Terms Authorized
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="badge badge-neutral"
                        style={{ cursor: "pointer", border: "1px solid #cbd5e1", fontSize: "0.775rem" }}
                        onClick={() =>
                          handleSendMessage(
                            null,
                            "Discount terms are approved. You may proceed to confirm this quotation."
                          )
                        }
                      >
                        ✅ Approved - Proceed with Quotation
                      </button>
                      <button
                        type="button"
                        className="badge badge-neutral"
                        style={{ cursor: "pointer", border: "1px solid #cbd5e1", fontSize: "0.775rem" }}
                        onClick={() =>
                          handleSendMessage(
                            null,
                            "Please ensure gross margin stays above 18% before issuing final agreement."
                          )
                        }
                      >
                        ⚠️ Margin Compliance Instruction
                      </button>
                    </>
                  )
                )}
              </div>

              {/* Input Area */}
              <form
                onSubmit={handleSendMessage}
                style={{
                  padding: "0.85rem 1.25rem 1.15rem",
                  borderTop: "1px solid #e2e8f0",
                  background: "#ffffff",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.65rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                    <label
                      htmlFor="chat-recipient"
                      style={{ fontSize: "0.8rem", fontWeight: 800, color: "#475569" }}
                    >
                      Chat with
                    </label>
                    <select
                      id="chat-recipient"
                      className="form-input no-icon"
                      style={{
                        width: "auto",
                        minWidth: "260px",
                        padding: "0.45rem 0.7rem",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                      }}
                      value={recipientRole}
                      onChange={(event) => handleRecipientChange(event.target.value)}
                      disabled={participants.length <= 1}
                    >
                      {participants.map((participant) => (
                        <option key={participant.role} value={participant.role}>
                          {participant.role === "ADMIN" && "👑 Admin: "}
                          {participant.role === "CUSTOMER" && "👤 Customer: "}
                          {participant.role === "SALES_REP" && "💼 Sales Rep: "}
                          {participant.sublabel || participant.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                    Press <strong>Enter</strong> to send, <strong>Shift+Enter</strong> for new line
                  </span>
                </div>

                <textarea
                  className="form-input no-icon"
                  rows="2"
                  style={{
                    width: "100%",
                    borderRadius: "12px",
                    padding: "0.75rem 1rem",
                    resize: "none",
                    minHeight: "52px",
                  }}
                  placeholder={`Type your message to ${currentRecipient?.label || "recipient"} regarding ${activeQuotation.quotation_number}...`}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    className="btn-primary"
                    type="submit"
                    disabled={sending || !newMessage.trim()}
                    style={{ padding: "0.55rem 1.5rem", borderRadius: "10px" }}
                  >
                    <Send size={16} /> {sending ? "Sending..." : "Send Message"}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#64748b",
              }}
            >
              Select a quotation on the left to view messages and AI financial analysis.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
