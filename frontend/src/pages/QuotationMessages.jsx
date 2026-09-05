import { useEffect, useState, useRef } from "react";
import {
  MessageSquare,
  Search,
  Send,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  User,
  ArrowRight,
  FileText,
  RefreshCw,
  Sparkles,
  Bot,
  TrendingUp,
  DollarSign,
  ShieldAlert,
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

export default function QuotationMessages({ onNavigate }) {
  const { user, token } = useAuth();
  const [quotations, setQuotations] = useState([]);
  const [selectedQuotationId, setSelectedQuotationId] = useState(null);
  const [activeQuotation, setActiveQuotation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [error, setError] = useState("");

  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadQuotations = async (keepSelected = true) => {
    try {
      const response = await fetch(`${API_BASE}/messages/quotations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to load quotations.");
      
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

  const loadMessages = async (quotationId) => {
    if (!quotationId) return;
    setMessagesLoading(true);
    try {
      const isCust = user?.role === "CUSTOMER";
      const promises = [
        fetch(`${API_BASE}/messages/quotations/${quotationId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ];
      if (!isCust) {
        promises.push(
          fetch(`${API_BASE}/messages/quotations/${quotationId}/ai-analysis`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        );
      }
      const results = await Promise.all(promises);
      const msgResponse = results[0];
      const msgData = await msgResponse.json();

      if (!msgResponse.ok) throw new Error(msgData.message || "Failed to load chat history.");
      
      setActiveQuotation(msgData.data.quotation);
      setMessages(msgData.data.messages || []);

      if (!isCust && results[1]) {
        const aiData = await results[1].json();
        if (results[1].ok) {
          setAiAnalysis(aiData.data);
        }
      } else {
        setAiAnalysis(null);
      }
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      setError(err.message);
    } finally {
      setMessagesLoading(false);
    }
  };

  useEffect(() => {
    loadQuotations(false);
  }, [token]);

  useEffect(() => {
    if (selectedQuotationId) {
      loadMessages(selectedQuotationId);
    }
  }, [selectedQuotationId]);

  useEffect(() => {
    if (!selectedQuotationId) return;
    const interval = setInterval(() => {
      loadMessages(selectedQuotationId);
    }, 4000);
    return () => clearInterval(interval);
  }, [selectedQuotationId]);

  const handleSendMessage = async (e, textToSend = null) => {
    if (e) e.preventDefault();
    const msgText = textToSend || newMessage;
    if (!msgText.trim() || !selectedQuotationId || sending) return;

    setSending(true);
    try {
      const response = await fetch(`${API_BASE}/messages/quotations/${selectedQuotationId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: msgText }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to send message.");

      setNewMessage("");
      await loadMessages(selectedQuotationId);
      await loadQuotations(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleRunAIAutoReply = async () => {
    if (!selectedQuotationId || aiRunning) return;
    setAiRunning(true);
    try {
      const response = await fetch(`${API_BASE}/messages/quotations/${selectedQuotationId}/auto-reply`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "AI auto-reply failed.");
      await loadMessages(selectedQuotationId);
    } catch (err) {
      setError(err.message);
    } finally {
      setAiRunning(false);
    }
  };

  const filteredQuotations = quotations.filter((q) => {
    const qNum = q.quotation_number.toLowerCase();
    const cName = (q.customer_name || "").toLowerCase();
    const comp = (q.customer_company || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    return qNum.includes(query) || cName.includes(query) || comp.includes(query);
  });

  const isCustomer = user?.role === "CUSTOMER";

  return (
    <main className="main-content sales-dashboard-container" style={{ paddingBottom: "1.5rem" }}>
      {/* Top Banner */}
      <div className="page-heading-row" style={{ marginBottom: "1rem" }}>
        <div>
          <div className="badge badge-approved" style={{ marginBottom: "0.4rem", display: "inline-flex", gap: "0.35rem", alignItems: "center" }}>
            <Sparkles size={13} /> Quotation Messaging & AI Auto-Negotiator Hub
          </div>
          <h1>Messages & AI Deal Analysis</h1>
          <p className="page-subtitle">Real-time chat channel integrated with automated AI profit analysis and counter-negotiation engine.</p>
        </div>
        <button className="btn-secondary" onClick={() => loadQuotations(true)}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ borderRadius: "10px", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* Split Pane Chat Container */}
      <div
        style={{
          display: "flex",
          height: "calc(100vh - 210px)",
          minHeight: "580px",
          background: "rgba(255, 255, 255, 0.88)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(226, 232, 240, 0.8)",
          borderRadius: "18px",
          boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.05)",
          overflow: "hidden",
        }}
      >
        {/* LEFT PANEL: Quotation List */}
        <div
          style={{
            width: "350px",
            minWidth: "320px",
            borderRight: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            background: "rgba(248, 250, 252, 0.6)",
          }}
        >
          <div style={{ padding: "1rem 1.15rem", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#0f172a", marginBottom: "0.6rem" }}>
              Quotation Conversations
            </div>
            <div style={{ position: "relative" }}>
              <Search size={15} color="#94a3b8" style={{ position: "absolute", left: "10px", top: "10px" }} />
              <input
                type="text"
                placeholder="Search ref or client..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
                style={{ paddingLeft: "32px", fontSize: "0.85rem", height: "36px" }}
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
                      marginBottom: "0.4rem",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      background: isSelected ? "rgba(37, 99, 235, 0.08)" : "transparent",
                      border: isSelected ? "1px solid rgba(37, 99, 235, 0.25)" : "1px solid transparent",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                      <span style={{ fontWeight: 800, fontSize: "0.925rem", color: isSelected ? "#1d4ed8" : "#0f172a" }}>
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
                      <span style={{ fontSize: "0.8rem", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "200px" }}>
                        {hasMessage ? `${q.latest_message.sender_name.split(" ")[0]}: ${q.latest_message.message}` : "No messages yet"}
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
                  padding: "0.9rem 1.5rem",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "rgba(248, 250, 252, 0.9)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                  <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "#eff6ff", border: "1px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <FileText size={20} color="#2563eb" />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>{activeQuotation.quotation_number}</h2>
                      <span className={`badge ${statusBadgeClass(activeQuotation.status)}`}>{activeQuotation.status}</span>
                    </div>
                    <p style={{ color: "#64748b", fontSize: "0.825rem", margin: 0 }}>
                      Client: <strong>{activeQuotation.customer_company || activeQuotation.customer_name}</strong> · Sales Rep: {activeQuotation.sales_rep_name}
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  {!isCustomer && (
                    <button
                      className="btn-primary"
                      style={{ padding: "0.45rem 0.9rem", fontSize: "0.8rem", background: "linear-gradient(135deg, #0284c7, #2563eb)", border: "none" }}
                      onClick={handleRunAIAutoReply}
                      disabled={aiRunning}
                    >
                      <Bot size={15} /> {aiRunning ? "Analyzing..." : "⚡ AI Auto-Respond"}
                    </button>
                  )}

                  <strong style={{ fontSize: "1.1rem", color: "#1e40af" }}>{currency(activeQuotation.final_amount)}</strong>
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

              {/* AI Deal Financial Health & Profit Bar */}
              {!isCustomer && aiAnalysis && (
                <div
                  style={{
                    padding: "0.65rem 1.5rem",
                    background: aiAnalysis.dealHealth === "MARGIN_RISK" ? "rgba(254, 242, 242, 0.9)" : "rgba(240, 253, 244, 0.9)",
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
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: aiAnalysis.currentMarginPercent >= 18 ? "#166534" : "#b91c1c" }}>
                      <span>Gross Profit: <strong>{currency(aiAnalysis.currentProfit)} ({aiAnalysis.currentMarginPercent}%)</strong></span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {aiAnalysis.dealHealth === "MARGIN_RISK" ? (
                      <span className="badge badge-rejected" style={{ fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                        <ShieldAlert size={13} /> MARGIN RISK (Max Safe Discount: {aiAnalysis.maxSafeDiscountPct}%)
                      </span>
                    ) : (
                      <span className="badge badge-approved" style={{ fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                        <Sparkles size={13} /> HEALTHY DEAL MARGIN
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Chat Scroll Window */}
              <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.5rem", background: "#f8fafc" }}>
                {messagesLoading && messages.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "4rem 2rem", color: "#64748b" }}>
                    <MessageSquare size={36} color="#94a3b8" style={{ marginBottom: "0.75rem" }} />
                    <p style={{ fontWeight: 700, color: "#334155" }}>No messages on {activeQuotation.quotation_number} yet.</p>
                    <p style={{ fontSize: "0.85rem" }}>Send a message below or click "⚡ AI Auto-Respond" to run profit analysis.</p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMyMessage = m.sender_id === user?.id;
                    const isAiBot = m.sender_role === "AI_BOT";

                    return (
                      <div
                        key={m.id}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: isAiBot ? "center" : isMyMessage ? "flex-end" : "flex-start",
                          marginBottom: "1.1rem",
                        }}
                      >
                        <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          {isAiBot ? <Bot size={14} color="#2563eb" /> : null}
                          <strong>{m.sender_name}</strong> ({m.sender_role}) · {new Date(m.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <div
                          style={{
                            maxWidth: isAiBot ? "85%" : "72%",
                            padding: "0.85rem 1.15rem",
                            borderRadius: isAiBot ? "14px" : isMyMessage ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                            background: isAiBot
                              ? "linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)"
                              : isMyMessage
                              ? "#2563eb"
                              : "#ffffff",
                            color: isAiBot ? "#1e3a8a" : isMyMessage ? "#ffffff" : "#0f172a",
                            border: isAiBot ? "1px solid #93c5fd" : isMyMessage ? "none" : "1px solid #e2e8f0",
                            boxShadow: isAiBot ? "0 4px 12px rgba(37, 99, 235, 0.08)" : "0 2px 5px rgba(0,0,0,0.03)",
                            fontSize: "0.9rem",
                            lineHeight: "1.5",
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
              <div style={{ padding: "0.5rem 1.25rem", borderTop: "1px solid #f1f5f9", background: "#ffffff", display: "flex", gap: "0.5rem", overflowX: "auto" }}>
                {isCustomer ? (
                  <>
                    <button
                      type="button"
                      className="badge badge-neutral"
                      style={{ cursor: "pointer", border: "1px solid #cbd5e1", fontSize: "0.775rem" }}
                      onClick={() => handleSendMessage(null, "Hi team, can we discuss a discount adjustment on this quote?")}
                    >
                      💡 Request Discount Adjustment
                    </button>
                    <button
                      type="button"
                      className="badge badge-neutral"
                      style={{ cursor: "pointer", border: "1px solid #cbd5e1", fontSize: "0.775rem" }}
                      onClick={() => handleSendMessage(null, "Could you please confirm the estimated delivery timeline?")}
                    >
                      🚚 Delivery Date Inquiry
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
                      onClick={() => handleSendMessage(null, "Hello, we have updated the quotation pricing as requested. Please review.")}
                    >
                      ✅ Pricing Updated Notice
                    </button>
                  </>
                )}
              </div>

              {/* Input Area */}
              <form onSubmit={handleSendMessage} style={{ padding: "0.85rem 1.25rem 1.25rem", borderTop: "1px solid #e2e8f0", background: "#ffffff", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <textarea
                  className="form-input no-icon"
                  rows="2"
                  style={{ width: "100%", borderRadius: "12px", padding: "0.75rem 1rem", resize: "none" }}
                  placeholder={`Type your message regarding ${activeQuotation.quotation_number}... (Press Enter to send)`}
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
                  <button className="btn-primary" type="submit" disabled={sending || !newMessage.trim()} style={{ padding: "0.6rem 1.5rem", borderRadius: "10px" }}>
                    <Send size={16} /> {sending ? "Sending..." : "Send Message"}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
              Select a quotation on the left to view messages and AI financial analysis.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
