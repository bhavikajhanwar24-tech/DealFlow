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
  RefreshCw,
  AlertTriangle,
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
  const [agentApplying, setAgentApplying] = useState(false);
  const [copilotResult, setCopilotResult] = useState(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [recreatingQuote, setRecreatingQuote] = useState(false);
  const [aiError, setAiError] = useState("");
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

  // Periodic polling for quotations list to keep sidebar synchronized across users
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      loadQuotations(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [token]);

  // Track message count to smoothly scroll when new incoming messages arrive
  const prevMsgCountRef = useRef(0);
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      setTimeout(scrollToBottom, 50);
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length]);

  useEffect(() => {
    if (selectedQuotationId) {
      setRecipientRole("");
      setAiResponse(null);
      setCopilotResult(null);
      setAiPrompt("");
      setAiError("");
      loadMessages(selectedQuotationId, "").then(() => {
        setTimeout(scrollToBottom, 100);
      });
    }
  }, [selectedQuotationId, loadMessages]);

  useEffect(() => {
    if (!selectedQuotationId) return;
    const interval = setInterval(() => {
      loadMessages(selectedQuotationId, recipientRoleRef.current, true);
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedQuotationId, loadMessages]);

  const handleRecipientChange = (newRole) => {
    setRecipientRole(newRole);
    loadMessages(selectedQuotationId, newRole, false).then(() => {
      setTimeout(scrollToBottom, 100);
    });
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
      setTimeout(scrollToBottom, 50);
      await loadQuotations(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleConsultAi = async (customPrompt = "") => {
    const activeTarget = recipientRoleRef.current || recipientRole || "CUSTOMER";
    const lastCust = [...messages].reverse().find((m) => m.sender_role === "CUSTOMER");
    const lastAdmin = [...messages].reverse().find((m) => m.sender_role === "ADMIN");

    let defaultPrompt = "";
    if (activeTarget === "ADMIN") {
      defaultPrompt = lastAdmin
        ? `The Admin stated: "${lastAdmin.message}". Provide an internal financial summary of this quotation, analyze margin viability, and draft a concise internal response to Admin.`
        : "Analyze the commercial metrics and margin viability of this quotation, and draft a structured internal escalation/briefing for the Admin.";
    } else if (activeTarget === "SALES_REP") {
      defaultPrompt = "Analyze the quotation and provide tactical negotiation instructions for the Sales Rep.";
    } else {
      defaultPrompt = lastCust
        ? `The customer (${lastCust.sender_name}) just stated: "${lastCust.message}". Analyze their latest message, identify any discount requests, check margin headroom, and recommend the best tactical negotiation strategy and draft reply.`
        : "Analyze this quotation, review recent conversation history, check margin headroom, and recommend the best negotiation strategy and reply draft.";
    }

    const query =
      (customPrompt && customPrompt.trim()) ||
      (aiPrompt && aiPrompt.trim()) ||
      defaultPrompt;

    setAiLoading(true);
    setAiError("");
    setError("");
    try {
      const res = await safeFetchJson(`${API_BASE}/messages/quotations/${selectedQuotationId}/ai-consult`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt: query, recipientRole: activeTarget }),
      });
      if (res && res.data) {
        setAiResponse(res.data);
      } else {
        setAiError("Received empty response from AI engine.");
      }
    } catch (err) {
      console.error("AI consult error:", err);
      setAiError(err.message || "Failed to consult AI negotiator");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSendAiOnBehalf = async (messageText) => {
    const textToSend = messageText || aiResponse?.suggestedDraft;
    if (!textToSend || !selectedQuotationId) return;

    setSending(true);
    try {
      await safeFetchJson(`${API_BASE}/messages/quotations/${selectedQuotationId}/ai-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: textToSend,
          recipientRole: recipientRoleRef.current,
        }),
      });

      setAiModalOpen(false);
      setAiResponse(null);
      setAiPrompt("");
      await loadMessages(selectedQuotationId, recipientRoleRef.current, false);
      setTimeout(scrollToBottom, 50);
      await loadQuotations(true);
    } catch (err) {
      setError(err.message || "Failed to send message on behalf");
    } finally {
      setSending(false);
    }
  };

  const handleRecreateFromAi = async () => {
    const proposal = aiResponse?.quoteUpdate;
    if (!proposal?.shouldRecreate || !proposal.items?.length || !selectedQuotationId || recreatingQuote) return;
    setRecreatingQuote(true);
    try {
      await safeFetchJson(`${API_BASE}/quotations/${selectedQuotationId}/recreate-from-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items: proposal.items }),
      });
      setSuccess("AI proposal applied. Review the recreated draft before submitting it for risk analysis.");
      setAiModalOpen(false);
      if (onNavigate) onNavigate(`/sales/quotations/${selectedQuotationId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setRecreatingQuote(false);
    }
  };

  const handleRunCopilot = async () => {
    if (!selectedQuotationId || copilotLoading || !activeQuotation) return;
    setCopilotLoading(true);
    setError("");
    try {
      // Build a context-aware prompt from the latest messages in view
      const lastCustomerMsg = [...messages].reverse().find(m => m.sender_role === "CUSTOMER");
      const prompt = lastCustomerMsg
        ? `The customer just said: "${lastCustomerMsg.message}". Based on the full conversation history, current deal financials, and their past deals, what is the best negotiation response I should send? Draft a professional reply.`
        : "Analyze the current state of this quotation deal. Review all conversation history, the financials, and suggest a proactive message to move the deal forward.";

      const res = await safeFetchJson(`${API_BASE}/messages/quotations/${selectedQuotationId}/ai-consult`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt }),
      });
      if (res?.data) {
        // Map ai-consult response to copilotResult shape
        setCopilotResult({
          detectedRequest: res.data.summary || "",
          requestedValue: "",
          riskLevel: res.data.dealHealth?.toLowerCase().includes("risk") ? "High" : "Low",
          estimatedMargin: res.data.margin || "",
          suggestedAction: res.data.strategy || "",
          suggestedReply: res.data.suggestedDraft || res.data.reply || "",
          _context: res.data._context,
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCopilotLoading(false);
    }
  };


  const handleApplyNegotiationSuggestion = async () => {
    if (!selectedQuotationId || !copilotResult || agentApplying) return;
    const text = `${copilotResult.requestedValue || ""} ${copilotResult.suggestedAction || ""}`;
    const match = text.match(/(\d+(?:\.\d+)?)\s*%/);
    if (!match) {
      setError("The agent suggestion does not contain a discount percentage to apply.");
      return;
    }
    setAgentApplying(true);
    setError("");
    try {
      await safeFetchJson(`${API_BASE}/quotations/${selectedQuotationId}/apply-negotiation-suggestion`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ discountPercent: Number(match[1]) }),
      });
      setSuccess("Agent suggestion applied. Quotation recalculated and sent back for approval.");
      await loadMessages(selectedQuotationId, recipientRoleRef.current, false);
      await loadQuotations(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setAgentApplying(false);
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
          
          <h1 style={{ fontSize: "1.45rem", margin: "0.15rem 0", fontWeight: 800 }}>Messages & Quotation Chat</h1>
         
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
          height: "calc(100vh - 135px)",
          maxHeight: "calc(100vh - 135px)",
          minHeight: "550px",
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
            height: "100%",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "0.85rem 1.15rem", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
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

          <div className="chat-custom-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0.5rem" }}>
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
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        {Number(q.unread_count) > 0 && (
                          <span
                            style={{
                              background: "#ef4444",
                              color: "#ffffff",
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              borderRadius: "9999px",
                              padding: "0.08rem 0.42rem",
                              lineHeight: 1.2,
                              boxShadow: "0 1px 3px rgba(239, 68, 68, 0.3)",
                            }}
                          >
                            {q.unread_count} new
                          </span>
                        )}
                        <span className={`badge ${statusBadgeClass(q.status)}`} style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }}>
                          {q.status}
                        </span>
                      </div>
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
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            background: "#ffffff",
            height: "100%",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
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
                  flexShrink: 0,
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

                {/* Single AI Negotiation Button & Channel Controls */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
                  {!isCustomer && <button
                    type="button"
                    onClick={() => {
                      setAiModalOpen(true);
                      handleConsultAi();
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.45rem",
                      padding: "0.5rem 1rem",
                      borderRadius: "10px",
                      background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                      color: "#ffffff",
                      border: "none",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      boxShadow: "0 4px 12px rgba(124, 58, 237, 0.3)",
                      transition: "all 0.2s ease"
                    }}
                  >
                    <Sparkles size={16} /> AI Assistant
                  </button>}

                  <strong style={{ fontSize: "1.05rem", color: "#1e40af" }}>
                    {currency(activeQuotation.final_amount)}
                  </strong>
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
                  flexShrink: 0,
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
                    flexShrink: 0,
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
                  flexShrink: 0,
                  maxHeight: '220px',
                  overflowY: 'auto',
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
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                        <button
                          onClick={handleApplyNegotiationSuggestion}
                          className="btn-primary"
                          disabled={agentApplying}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.76rem', background: '#16a34a' }}
                        >
                          {agentApplying ? "Recalculating..." : "Accept suggestion & re-submit"}
                        </button>
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

              {/* Chat Scroll Window (Scrollable for any volume of messages) */}
              <div
                className="chat-custom-scroll"
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                  padding: "1.25rem 1.75rem",
                  background: "#f8fafc",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                  scrollBehavior: "smooth",
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
                  flexShrink: 0,
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

      {/* Interactive AI Negotiator Modal */}
      {!isCustomer && aiModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(6px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem"
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "750px",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              overflow: "hidden"
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "1.1rem 1.5rem",
                background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <Sparkles size={22} color="#fde047" />
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800 }}>
                    DealFlow AI Assistant
                  </h3>
                  <div style={{ fontSize: "0.8rem", opacity: 0.9 }}>
                    Active Quote: {activeQuotation?.quotation_number} · Client: {activeQuotation?.customer_name}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setAiModalOpen(false)}
                style={{
                  background: "rgba(255, 255, 255, 0.2)",
                  border: "none",
                  borderRadius: "50%",
                  width: "30px",
                  height: "30px",
                  color: "#ffffff",
                  fontSize: "1.1rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "1.25rem 1.5rem", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {/* Context Summary Banner */}
              {(() => {
                const lastCust = [...messages].reverse().find((m) => m.sender_role === "CUSTOMER");
                const totalMsgs = messages.length;
                return (
                  <div
                    style={{
                      background: "#eff6ff",
                      border: "1px solid #bfdbfe",
                      borderRadius: "10px",
                      padding: "0.6rem 0.85rem",
                      fontSize: "0.8rem",
                      color: "#1e40af",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "0.5rem"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <Bot size={15} color="#2563eb" />
                      <span>
                        <strong>Latest Active Context:</strong>{" "}
                        {lastCust
                          ? `Client (${lastCust.sender_name}): "${lastCust.message.length > 75 ? lastCust.message.slice(0, 75) + "..." : lastCust.message}"`
                          : "No client messages yet in this channel."}
                      </span>
                    </div>
                    <span style={{ fontSize: "0.74rem", background: "#dbeafe", padding: "0.15rem 0.5rem", borderRadius: "9999px", fontWeight: 700 }}>
                      {totalMsgs} msg{totalMsgs === 1 ? "" : "s"} analyzed
                    </span>
                  </div>
                );
              })()}

              {/* Quick AI Action Buttons - Dynamic based on Recipient Role */}
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {recipientRole === "ADMIN" ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        handleConsultAi(
                          "The customer requested a discount. Brief the Admin with exact margin metrics and request commercial approval or guidance."
                        )
                      }
                      disabled={aiLoading}
                      style={{
                        padding: "0.4rem 0.8rem",
                        borderRadius: "8px",
                        background: "#f1f5f9",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: "#334155",
                        cursor: "pointer"
                      }}
                    >
                      👑 Request Admin Approval / Guidance
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleConsultAi(
                          "Explain why we recommend rejecting the customer discount request to preserve our 18% floor and request Admin concurrence."
                        )
                      }
                      disabled={aiLoading}
                      style={{
                        padding: "0.4rem 0.8rem",
                        borderRadius: "8px",
                        background: "#f1f5f9",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: "#334155",
                        cursor: "pointer"
                      }}
                    >
                      🛡️ Brief Admin on Rejection & Floor Protection
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleConsultAi(
                          "Provide a comprehensive internal deal update to the Admin regarding this quotation."
                        )
                      }
                      disabled={aiLoading}
                      style={{
                        padding: "0.4rem 0.8rem",
                        borderRadius: "8px",
                        background: "#f1f5f9",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: "#334155",
                        cursor: "pointer"
                      }}
                    >
                      📊 Send Financial Briefing to Admin
                    </button>
                  </>
                ) : recipientRole === "SALES_REP" ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        handleConsultAi(
                          "Provide directive instructions to the Sales Rep on how to negotiate this quote and protect our margin floor."
                        )
                      }
                      disabled={aiLoading}
                      style={{
                        padding: "0.4rem 0.8rem",
                        borderRadius: "8px",
                        background: "#f1f5f9",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: "#334155",
                        cursor: "pointer"
                      }}
                    >
                      💼 Instruct Sales Rep on Negotiation
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        handleConsultAi(
                          "Check current gross margin and tell me maximum safe discount I can offer based on our latest chat."
                        )
                      }
                      disabled={aiLoading}
                      style={{
                        padding: "0.4rem 0.8rem",
                        borderRadius: "8px",
                        background: "#f1f5f9",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: "#334155",
                        cursor: "pointer"
                      }}
                    >
                      📊 Check Margin Headroom
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const lastCust = [...messages]
                          .reverse()
                          .find((m) => m.sender_role === "CUSTOMER");
                        handleConsultAi(
                          lastCust
                            ? `The customer stated: "${lastCust.message}". Draft a polite, high-converting commercial reply directly answering their note.`
                            : "Draft a friendly, professional negotiation follow-up message."
                        );
                      }}
                      disabled={aiLoading}
                      style={{
                        padding: "0.4rem 0.8rem",
                        borderRadius: "8px",
                        background: "#f1f5f9",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: "#334155",
                        cursor: "pointer"
                      }}
                    >
                      ✍️ Respond to Latest Client Note
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleConsultAi(
                          "The customer requested terms modification or discount. Analyze financial feasibility and draft a smart compromise preserving our price."
                        )
                      }
                      disabled={aiLoading}
                      style={{
                        padding: "0.4rem 0.8rem",
                        borderRadius: "8px",
                        background: "#f1f5f9",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: "#334155",
                        cursor: "pointer"
                      }}
                    >
                      💡 Counter Discount Request
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleConsultAi(
                          "The customer demanded an unfair discount. Formulate a polite, firm refusal defending our premium value, warranty, and ROI without lowering price."
                        )
                      }
                      disabled={aiLoading}
                      style={{
                        padding: "0.4rem 0.8rem",
                        borderRadius: "8px",
                        background: "#f1f5f9",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: "#334155",
                        cursor: "pointer"
                      }}
                    >
                      🚫 Stand Firm / Reject Discount
                    </button>
                  </>
                )}
              </div>

              {/* AI Response Card */}
              {aiLoading ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "#6366f1" }}>
                  <RefreshCw size={24} className="spin-animation" style={{ margin: "0 auto 0.75rem" }} />
                  <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>Consulting DealFlow AI with database context...</div>
                  <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.35rem" }}>
                    Analyzing quotation metrics, margin thresholds, and negotiation history...
                  </div>
                </div>
              ) : aiError ? (
                <div
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fca5a5",
                    borderRadius: "12px",
                    padding: "1.25rem",
                    color: "#991b1b"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                    <AlertTriangle size={18} color="#dc2626" />
                    <span>AI Assistant Notice</span>
                  </div>
                  <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.875rem", lineHeight: "1.4" }}>
                    {aiError}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleConsultAi()}
                    style={{
                      padding: "0.4rem 0.9rem",
                      borderRadius: "8px",
                      background: "#dc2626",
                      color: "#ffffff",
                      border: "none",
                      fontSize: "0.825rem",
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    Retry Negotiation Analysis
                  </button>
                </div>
              ) : aiResponse ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                  {/* Commercial Decision Verdict Banner */}
                  {aiResponse.decision && (
                    <div
                      style={{
                        padding: "0.75rem 1rem",
                        borderRadius: "12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "0.5rem",
                        background:
                          aiResponse.decision === "REJECT"
                            ? "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)"
                            : aiResponse.decision === "COUNTER"
                            ? "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)"
                            : "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
                        border:
                          aiResponse.decision === "REJECT"
                            ? "1.5px solid #f87171"
                            : aiResponse.decision === "COUNTER"
                            ? "1.5px solid #fcd34d"
                            : "1.5px solid #86efac",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span
                          style={{
                            padding: "0.25rem 0.65rem",
                            borderRadius: "6px",
                            fontWeight: 800,
                            fontSize: "0.78rem",
                            letterSpacing: "0.04em",
                            background:
                              aiResponse.decision === "REJECT"
                                ? "#dc2626"
                                : aiResponse.decision === "COUNTER"
                                ? "#d97706"
                                : "#16a34a",
                            color: "#ffffff",
                          }}
                        >
                          VERDICT: {aiResponse.decision}
                        </span>
                        <span style={{ fontSize: "0.84rem", fontWeight: 700, color: "#0f172a" }}>
                          {aiResponse.decision === "REJECT"
                            ? "Reject Unfair Terms / Discount (Below Margin Floor)"
                            : aiResponse.decision === "COUNTER"
                            ? "Counter-Offer Recommended (Protect Profit Margin)"
                            : "Commercially Viable Deal Terms"}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#475569" }}>
                        <strong>Projected Margin:</strong>{" "}
                        <span
                          style={{
                            fontWeight: 700,
                            color:
                              aiResponse.decision === "REJECT"
                                ? "#dc2626"
                                : aiResponse.decision === "COUNTER"
                                ? "#b45309"
                                : "#15803d",
                          }}
                        >
                          {aiResponse.projectedMargin || "N/A"}
                        </span>
                        {aiResponse.projectedProfit ? ` · Est. Profit: ${aiResponse.projectedProfit}` : ""}
                      </div>
                    </div>
                  )}

                  {/* Financial & Context Analysis Grid */}
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "1rem 1.15rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.65rem",
                    }}
                  >
                    {aiResponse.requestedTerms && (
                      <div style={{ fontSize: "0.825rem", color: "#334155" }}>
                        <strong style={{ color: "#0f172a" }}>🔍 Client Request Detected:</strong> {aiResponse.requestedTerms}
                      </div>
                    )}

                    <div>
                      <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.2rem" }}>
                        📋 Negotiation Context Analysis
                      </div>
                      <p style={{ margin: 0, fontSize: "0.875rem", color: "#1e293b", lineHeight: "1.4" }}>
                        {aiResponse.summary}
                      </p>
                    </div>

                    {aiResponse.strategy && (
                      <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "0.5rem" }}>
                        <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#4f46e5", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.2rem" }}>
                          💡 Recommended Tactical Strategy
                        </div>
                        <p style={{ margin: 0, fontSize: "0.875rem", color: "#1e293b", lineHeight: "1.4" }}>
                          {aiResponse.strategy}
                        </p>
                      </div>
                    )}

                    {aiResponse.dealHealth && (
                      <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "0.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                        <div style={{ fontSize: "0.825rem", color: "#334155" }}>
                          <strong style={{ color: "#0f172a" }}>🛡️ Commercial Assessment:</strong> {aiResponse.dealHealth}
                        </div>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: "6px", background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1" }}>
                          Floor: 18.0%
                        </span>
                      </div>
                    )}
                  </div>

                  {aiResponse.suggestedDraft && (
                    <div
                      style={{
                        background: aiResponse.decision === "REJECT" ? "#fff7ed" : "#f0fdf4",
                        border: aiResponse.decision === "REJECT" ? "1.5px solid #fdba74" : "1.5px solid #86efac",
                        borderRadius: "12px",
                        padding: "1rem 1.25rem",
                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.35rem" }}>
                        <strong style={{ fontSize: "0.85rem", color: aiResponse.decision === "REJECT" ? "#9a3412" : "#166534" }}>
                          {recipientRole === "ADMIN"
                            ? "Suggested Internal Briefing for Admin (Financial Breakdown):"
                            : recipientRole === "SALES_REP"
                            ? "Suggested Directive for Sales Rep:"
                            : `Suggested Client Reply (${aiResponse.decision === "REJECT" ? "Diplomatic Rejection of Discount" : "Ready to Send"} · Margins Protected):`}
                        </strong>
                        <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>
                          Target: {currentRecipient?.label || recipientRole}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: "0.9rem", color: "#0f172a", fontStyle: "italic", lineHeight: "1.45" }}>
                        "{aiResponse.suggestedDraft}"
                      </p>

                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setNewMessage(aiResponse.suggestedDraft);
                            setAiModalOpen(false);
                          }}
                          style={{
                            padding: "0.45rem 1rem",
                            borderRadius: "8px",
                            background: "#ffffff",
                            border: "1px solid #cbd5e1",
                            fontSize: "0.825rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            color: "#334155"
                          }}
                        >
                          Insert into Chat Box
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendAiOnBehalf(aiResponse.suggestedDraft)}
                          disabled={sending}
                          style={{
                            padding: "0.45rem 1.25rem",
                            borderRadius: "8px",
                            background: aiResponse.decision === "REJECT" ? "#ea580c" : "#16a34a",
                            border: "none",
                            color: "#ffffff",
                            fontSize: "0.825rem",
                            fontWeight: 700,
                            cursor: sending ? "not-allowed" : "pointer",
                            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)"
                          }}
                        >
                          🚀 Send on My Behalf Now
                        </button>
                      </div>
                    </div>
                  )}
                  {aiResponse.quoteUpdate?.shouldRecreate && aiResponse.quoteUpdate.items?.length > 0 && (
                    <div style={{ marginTop: "0.9rem", padding: "1rem 1.25rem", borderRadius: "12px", background: "#fff7ed", border: "1.5px solid #fdba74" }}>
                      <strong style={{ color: "#9a3412", fontSize: "0.85rem" }}>Agentic quotation proposal</strong>
                      <p style={{ margin: "0.45rem 0", color: "#7c2d12", fontSize: "0.82rem" }}>{aiResponse.quoteUpdate.rationale || "The agent recommends changing the quotation terms."}</p>
                      <p style={{ margin: "0 0 0.75rem", color: "#7c2d12", fontSize: "0.78rem" }}>{aiResponse.quoteUpdate.items.length} line item(s) will be recreated. Existing omitted lines may be removed.</p>
                      <button type="button" className="btn-primary" onClick={handleRecreateFromAi} disabled={recreatingQuote} style={{ width: "auto", background: "#ea580c" }}>
                        {recreatingQuote ? "Recreating draft..." : "Accept proposal & recreate quote"}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: "1.5rem", textAlign: "center", color: "#64748b", background: "#f8fafc", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
                  <Sparkles size={24} color="#6366f1" style={{ margin: "0 auto 0.5rem" }} />
                  <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#334155" }}>Ready to assist your negotiation</div>
                  <div style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
                    Select a quick strategy button above or type your prompt below to generate data-grounded guidance and reply drafts.
                  </div>
                </div>
              )}

              {/* Chat with AI Input */}
              <div style={{ marginTop: "auto", borderTop: "1px solid #e2e8f0", paddingTop: "1rem" }}>
                <div style={{ fontSize: "0.825rem", fontWeight: 700, color: "#475569", marginBottom: "0.4rem" }}>
                  Ask AI anything about this deal or tell it what to negotiate:
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    type="text"
                    className="form-input no-icon"
                    style={{ flex: 1, borderRadius: "10px", fontSize: "0.875rem", padding: "0.6rem 0.9rem" }}
                    placeholder="e.g. Tell the client we can offer 7% if they sign a 2-year contract..."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleConsultAi();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleConsultAi()}
                    disabled={aiLoading || !aiPrompt.trim()}
                    style={{
                      padding: "0.6rem 1.25rem",
                      borderRadius: "10px",
                      background: "#4f46e5",
                      border: "none",
                      color: "#ffffff",
                      fontWeight: 700,
                      fontSize: "0.875rem",
                      cursor: aiLoading || !aiPrompt.trim() ? "not-allowed" : "pointer"
                    }}
                  >
                    Ask AI
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
