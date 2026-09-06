const { pool } = require("../config/db");
const { Groq } = require("groq-sdk");

const MODEL = "openai/gpt-oss-120b";

// ─── Groq Call (non-streaming, robust) ────────────────────────────────────────
async function callGroqChat(messages, temperature = 0.6) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn("[DealFlow AI] GROQ_API_KEY is not set.");
    return null;
  }

  const groq = new Groq({ apiKey });

  // Attempt with json_object response_format
  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      messages,
      temperature,
      max_tokens: 2048,
      response_format: { type: "json_object" },
    });
    const content = response.choices[0]?.message?.content || "";
    if (content.trim()) return content.trim();
  } catch (err) {
    console.warn(`[DealFlow AI] JSON format call failed, retrying standard mode:`, err?.error?.message || err?.message || err);
    try {
      const fallbackRes = await groq.chat.completions.create({
        model: MODEL,
        messages,
        temperature,
        max_tokens: 2048,
      });
      const content = fallbackRes.choices[0]?.message?.content || "";
      if (content.trim()) return content.trim();
    } catch (err2) {
      console.error(`[DealFlow AI] Primary model (${MODEL}) call failed:`, err2?.error?.message || err2?.message || err2);
    }
  }

  return null;
}

// ─── Strip thinking tags and markdown fences ───────────────────────────────────
function cleanContent(raw) {
  if (!raw) return "";
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
}

// ─── Extract first valid JSON object from text ────────────────────────────────
function extractJSON(text) {
  if (!text) return null;
  const cleaned = cleanContent(text);
  // Try direct parse first
  try { return JSON.parse(cleaned); } catch (_) {}
  // Try extracting first {...} block
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch (_) {}
  }
  return null;
}

class AiService {
  // ─── Fetch rich quotation context from DB ───────────────────────────────────
  async getQuotationContext(quotationId) {
    const quoteRes = await pool.query(
      `SELECT q.id, q.quotation_number, q.status, q.subtotal, q.discount_amount, q.final_amount,
              q.total_cost, q.gross_margin, q.margin_percentage, q.risk_score, q.risk_level,
              q.customer_id, q.sales_rep_id, q.created_at, q.updated_at,
              c.full_name AS customer_name, c.email AS customer_email,
              c.company_name, c.customer_tier,
              s.full_name AS sales_rep_name, s.email AS sales_rep_email
       FROM public.quotations q
       LEFT JOIN public.users c ON q.customer_id = c.id
       LEFT JOIN public.users s ON q.sales_rep_id = s.id
       WHERE q.id = $1`,
      [quotationId]
    );
    if (!quoteRes.rows.length) return null;
    const q = quoteRes.rows[0];

    // Line items with full cost data
    const itemsRes = await pool.query(
      `SELECT qi.id, qi.product_id, qi.quantity, qi.unit_price, qi.discount_percent,
              qi.discount_amount, qi.line_total,
              COALESCE(p.cost, 0) AS cost, p.name, p.sku, p.category
       FROM public.quotation_items qi
       LEFT JOIN public.products p ON qi.product_id = p.id
       WHERE qi.quotation_id = $1
       ORDER BY qi.id`,
      [quotationId]
    );

    // Active catalog for quote-update suggestions
    const catalogRes = await pool.query(
      `SELECT id AS product_id, name, category, unit_price, cost
       FROM public.products WHERE is_active = TRUE ORDER BY name LIMIT 200`
    );

    // Full chat thread – latest 100 messages in chronological order
    const msgRes = await pool.query(
      `SELECT * FROM (
         SELECT sender_role, sender_name, message, recipient_role,
                to_char(created_at, 'YYYY-MM-DD HH24:MI') AS ts,
                created_at
         FROM public.quotation_messages
         WHERE quotation_id = $1
         ORDER BY created_at DESC
         LIMIT 100
       ) sub
       ORDER BY sub.created_at ASC`,
      [quotationId]
    );

    // Formal negotiation portal tickets
    const negRes = await pool.query(
      `SELECT requested_discount_percent, requested_delivery_date,
              customer_comment, removed_item_ids, status,
              to_char(created_at, 'YYYY-MM-DD') AS date
       FROM public.negotiation_requests
       WHERE quotation_id = $1
       ORDER BY created_at DESC LIMIT 10`,
      [quotationId]
    );

    // Customer deal history
    const histRes = await pool.query(
      `SELECT q.quotation_number, q.status, q.final_amount, q.margin_percentage,
              to_char(q.created_at, 'YYYY-MM-DD') AS date
       FROM public.quotations q
       WHERE q.customer_id = $1 AND q.id != $2
       ORDER BY q.created_at DESC LIMIT 8`,
      [q.customer_id, quotationId]
    );

    return {
      quotation: q,
      items: itemsRes.rows,
      catalog: catalogRes.rows,
      chatHistory: msgRes.rows,
      negotiationRequests: negRes.rows,
      customerHistory: histRes.rows,
    };
  }

  // ─── Main RAG-Powered Negotiation Consultant ────────────────────────────────
  async consultNegotiator(quotationId, userPrompt, user, recipientRole = "CUSTOMER") {
    const ctx = await this.getQuotationContext(quotationId);
    if (!ctx) throw new Error("Quotation context not found.");

    const q = ctx.quotation;

    // ── Build context blocks ──────────────────────────────────────────────────
    // Internal context for analysis only (NEVER appears in customer-facing draft)
    const currentMarginPct = Number(q.margin_percentage || 0);
    const safeDiscountHeadroom = Math.max(0, currentMarginPct - 18).toFixed(1);

    // Items — no cost data shown (avoids leaking margin in AI output)
    const itemsSummary = ctx.items.length > 0
      ? ctx.items.map(i =>
          `• ${i.name} (SKU: ${i.sku}, Category: ${i.category}) — Qty: ${i.quantity}, Unit Price: ₹${i.unit_price}, Discount: ${i.discount_percent}%, Line Total: ₹${i.line_total}`
        ).join("\n")
      : "No line items on this quotation.";

    // Financial summary for INTERNAL analysis only — analyst context, not for draft
    const totalCost = Number(q.total_cost || (Number(q.final_amount) * 0.72));
    const currentProfit = Number(q.final_amount) - totalCost;
    const internalFinancials = `[INTERNAL DEAL METRICS — STRICTLY CONFIDENTIAL FOR STRATEGY ONLY]
Invoice Subtotal: ₹${Number(q.subtotal).toLocaleString("en-IN")} | Current Discount: ₹${Number(q.discount_amount).toLocaleString("en-IN")}
Final Selling Price: ₹${Number(q.final_amount).toLocaleString("en-IN")} | Total Product Cost: ₹${totalCost.toLocaleString("en-IN")}
Current Gross Profit: ₹${Math.round(currentProfit).toLocaleString("en-IN")} | Current Gross Margin: ${currentMarginPct}%
Minimum Commercial Margin Floor: 18.0% | Max Safe Additional Discount Headroom: ${safeDiscountHeadroom}% | Risk Level: ${q.risk_level || "N/A"}`;

    const chatTranscript = ctx.chatHistory.length > 0
      ? ctx.chatHistory.map(m =>
          `[${m.ts}] ${m.sender_role} (${m.sender_name}): ${m.message}`
        ).join("\n")
      : "(No prior conversation.)";

    const portalNegotiations = ctx.negotiationRequests.length > 0
      ? ctx.negotiationRequests.map(nr =>
          `• [${nr.date}] Status: ${nr.status} | Discount Requested: ${nr.requested_discount_percent || 0}% | Delivery: ${nr.requested_delivery_date || "N/A"} | Customer Note: "${nr.customer_comment || "—"}"${
            nr.removed_item_ids?.length ? ` | Removal Request: ${JSON.stringify(nr.removed_item_ids)}` : ""
          }`
        ).join("\n")
      : "(No formal negotiation requests on file.)";

    const customerHistory = ctx.customerHistory.length > 0
      ? ctx.customerHistory.map(h =>
          `• Quote #${h.quotation_number} — ${h.status}, Total ₹${h.final_amount} (${h.date})`
        ).join("\n")
      : "(No prior quotations for this customer.)";

    // Catalog for quote-update only — no cost data
    const catalogSummary = ctx.catalog
      .map(p => `${p.name} [ID: ${p.product_id}] | Category: ${p.category} | List Price: ₹${p.unit_price}`)
      .join("\n");

    // Identify the newest customer message and last message in thread
    const latestCustomerMsg = [...ctx.chatHistory]
      .reverse()
      .find(m => m.sender_role === "CUSTOMER");
    const lastAnyMsg = ctx.chatHistory.length > 0 ? ctx.chatHistory[ctx.chatHistory.length - 1] : null;

    const recentHighlight = [
      latestCustomerMsg ? `• LATEST CLIENT INQUIRY: [${latestCustomerMsg.ts}] ${latestCustomerMsg.sender_name}: "${latestCustomerMsg.message}"` : null,
      lastAnyMsg && (!latestCustomerMsg || lastAnyMsg !== latestCustomerMsg)
        ? `• LAST MESSAGE IN THREAD: [${lastAnyMsg.ts}] ${lastAnyMsg.sender_role} (${lastAnyMsg.sender_name}): "${lastAnyMsg.message}"`
        : null
    ].filter(Boolean).join("\n");

    // Target audience description
    const audienceRole = (recipientRole || "CUSTOMER").toUpperCase();
    const audienceDescription =
      audienceRole === "ADMIN"
        ? "INTERNAL ADMIN / MANAGEMENT (Internal escalation, requesting approval or reporting deal status with exact financials)"
        : audienceRole === "SALES_REP"
        ? `INTERNAL SALES REP (${q.sales_rep_name}) (Directive commercial coaching and deal negotiation instructions)`
        : `EXTERNAL CLIENT / CUSTOMER (${q.customer_name}) (Customer-facing formal executive message with ZERO internal financial leakage)`;

    // ── System Prompt ─────────────────────────────────────────────────────────
    const systemPrompt = `You are the Chief Commercial Officer & Principal AI Commercial Strategist for DealFlow360, an enterprise B2B quotation platform.
Your job is to protect company profit margins, identify requested discounts, evaluate whether a deal makes financial sense, and instruct the user whether to REJECT, COUNTER, or ACCEPT.

CURRENT RECIPIENT TARGET FOR DRAFT: ${audienceRole} -> ${audienceDescription}

=== COMPANY COMMERCIAL RULES & THRESHOLDS ===
1. ABSOLUTE MARGIN FLOOR: 18.0% Gross Profit Margin.
   - Total Cost for this quote is: ₹${totalCost.toLocaleString("en-IN")}
   - Current Price is: ₹${Number(q.final_amount).toLocaleString("en-IN")} (Margin: ${currentMarginPct}%, Gross Profit: ₹${Math.round(currentProfit).toLocaleString("en-IN")})
   - Any concession that causes gross margin to drop BELOW 18.0% is UNACCEPTABLE, UNFAIR, and MUST BE REJECTED.

2. DISCOUNT IDENTIFICATION & MARGIN SIMULATION:
   - Carefully scan the customer's chat messages (especially the latest inquiry).
   - Detect what discount percentage or price concession the customer is asking for (e.g. 10%, 15%, 25%, or specific amount).
   - Calculate the resulting Projected Revenue, Projected Gross Profit (= Projected Revenue - Total Cost), and Projected Gross Margin % (= Projected Gross Profit / Projected Revenue * 100).

3. COMMERCIAL VERDICT RULES ("decision"):
   - "REJECT":
     * If the customer's requested discount/price drops gross margin BELOW the 18.0% floor.
     * If the deal would generate insufficient gross profit or is commercially one-sided/unfair.
     * If the customer is demanding extreme concessions without increasing order volume.
   - "COUNTER":
     * If the customer's requested discount is slightly above what we can afford, but we can offer a smaller capped discount (safe headroom up to ${safeDiscountHeadroom}%) in exchange for upfront payment or multi-year commitment.
   - "ACCEPT":
     * If the requested terms leave our margin comfortably above 22.0% and represent a profitable, high-value deal.

4. STRATEGY INSTRUCTIONS ("strategy"):
   - If REJECTING: Instruct to stand 100% firm on the current price. Defend our enterprise build quality, dedicated warranty, SLA guarantees, and high ROI. Recommend offering non-price concessions (e.g., phased milestone delivery or 30-day payment terms) instead of reducing price.
   - If COUNTERING: Specify the maximum allowable discount percentage that preserves at least 20% margin.

5. ROLE-SPECIFIC DRAFTING RULES ("suggestedDraft"):
   - When Target is CUSTOMER:
     * Write an executive, consultative, polite, and firm message addressed to "Dear ${q.customer_name},".
     * If REJECTING: Diplomatically decline the requested discount, articulate superior product value and SLA, and propose alternative commercial terms (milestones, delivery schedule) without conceding on price.
     * STRICT CONFIDENTIALITY: NEVER reveal internal costs, margins, margin percentages, risk ratings, or the "18%" floor.
   - When Target is ADMIN:
     * Write a clear, professional internal briefing addressed to "Dear Admin / Commercial Approvals Team,".
     * Present the key internal metrics directly (Requested discount, Total Cost: ₹${totalCost.toLocaleString("en-IN")}, Margin: ${currentMarginPct}%, Projected Margin).
     * State whether this request is within policy or requires an explicit override, and recommend whether to reject or permit an exception.
   - When Target is SALES_REP:
     * Write a clear directive note addressed to "Hi ${q.sales_rep_name},".
     * Give specific step-by-step negotiation instructions on what to say to the client.

6. OUTPUT FORMAT: Respond ONLY with valid JSON matching this exact structure:
{
  "decision": "REJECT | COUNTER | ACCEPT",
  "requestedTerms": "Summary of discount or concessions requested by client (e.g., '15% additional discount on total order')",
  "projectedMargin": "Projected gross margin percentage under requested terms (e.g., '14.2%')",
  "projectedProfit": "Projected gross profit in ₹ under requested terms (e.g., '₹18,500')",
  "isCommerciallyViable": true | false,
  "summary": "Internal commercial analysis: State the financial breakdown, resulting margin, and why the deal makes or does not make commercial sense.",
  "dealHealth": "Margin health status (e.g., 'CRITICAL RISK: Projected margin of 14.2% is below the 18.0% mandatory floor' or 'HEALTHY MARGIN: 24.5%')",
  "strategy": "Tactical guidance explaining how to handle the customer's objection or concession request.",
  "suggestedDraft": "Polished, ready-to-send message tailored specifically for ${audienceRole}.",
  "quoteUpdate": {
    "shouldRecreate": false,
    "rationale": "Internal note on whether line items or quantities should be updated.",
    "items": []
  }
}`;

    // ── User Message (full grounded context) ──────────────────────────────────
    const userMessage = `=== ACTIVE QUOTATION DETAILS ===
Quote Number: #${q.quotation_number} | Status: ${q.status} | Created: ${new Date(q.created_at).toLocaleDateString("en-IN")}
Client: ${q.customer_name} | Company: ${q.company_name || "N/A"} | Account Tier: ${q.customer_tier || "STANDARD"}
Lead Sales Rep: ${q.sales_rep_name}
Commercial Total: ₹${Number(q.final_amount).toLocaleString("en-IN")} (Subtotal: ₹${Number(q.subtotal).toLocaleString("en-IN")}, Discount Applied: ₹${Number(q.discount_amount).toLocaleString("en-IN")})

${internalFinancials}

=== TARGET RECIPIENT ===
Sending message to: ${audienceRole} (${audienceDescription})

=== MOST RECENT MESSAGE REQUIRING IMMEDIATE RESPONSE ===
${recentHighlight || "(No client message yet. Client is reviewing the initial quotation.)"}

=== CURRENT QUOTATION LINE ITEMS ===
${itemsSummary}

=== FORMAL NEGOTIATION / ITEM REMOVAL TICKETS ===
${portalNegotiations}

=== CLIENT HISTORICAL CLOSED DEALS ===
${customerHistory}

=== FULL CONVERSATION TRANSCRIPT (${ctx.chatHistory.length} MESSAGES) ===
${chatTranscript}

=== AVAILABLE CATALOG PRODUCTS (for quoteUpdate only) ===
${catalogSummary}

=== SENDER INQUIRY / FOCUS ===
${user.full_name} (${user.role}): "${userPrompt}"

Identify customer concessions, compute profit/margin impact, determine whether to REJECT/COUNTER/ACCEPT, and generate an insightful strategy and ${audienceRole}-tailored draft.`;

    // ── Call LLM ──────────────────────────────────────────────────────────────
    const rawResponse = await callGroqChat([
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ], 0.6);

    const parsed = extractJSON(rawResponse);

    if (parsed && (parsed.suggestedDraft || parsed.summary)) {
      const decision = (parsed.decision || (currentMarginPct < 18 ? "REJECT" : "COUNTER")).toUpperCase();
      return {
        decision,
        requestedTerms: parsed.requestedTerms || "Customer reviewing quotation terms.",
        projectedMargin: parsed.projectedMargin || `${currentMarginPct}%`,
        projectedProfit: parsed.projectedProfit || `₹${Math.round(currentProfit).toLocaleString("en-IN")}`,
        isCommerciallyViable: parsed.isCommerciallyViable !== undefined ? parsed.isCommerciallyViable : (decision !== "REJECT"),
        summary: parsed.summary || `Reviewing deal context for ${q.customer_name} on Quote #${q.quotation_number}.`,
        dealHealth: parsed.dealHealth || (decision === "REJECT" ? "CRITICAL MARGIN RISK - Below 18% floor" : `Commercial viability assessed. Headroom: ${safeDiscountHeadroom}% available (internal).`),
        strategy: parsed.strategy || (decision === "REJECT" ? "Firmly decline additional discounts and defend pricing on product value." : "Offer value-added concessions rather than direct price adjustments."),
        reply: `📋 Verdict: ${decision}\n${parsed.summary}\n\n💡 Recommended Strategy:\n${parsed.strategy}\n\n🛡️ Margin Health:\n${parsed.dealHealth}`,
        suggestedDraft: (parsed.suggestedDraft || "").trim(),
        quoteUpdate: parsed.quoteUpdate?.items?.length
          ? parsed.quoteUpdate
          : { shouldRecreate: false, rationale: "No line changes needed.", items: [] },
        finalAmount: q.final_amount,
        targetRole: audienceRole,
        _context: {
          messagesAnalyzed: ctx.chatHistory.length,
          negotiationTickets: ctx.negotiationRequests.length,
          customerDeals: ctx.customerHistory.length,
        },
      };
    }

    // ── Deterministic fallback with explicit financial calculations ──
    const discountMatch = latestCustomerMsg?.message?.match(/(\d+(?:\.\d+)?)\s*%/);
    const requestedDiscountPct = discountMatch ? parseFloat(discountMatch[1]) : null;

    let projRevenue = Number(q.final_amount);
    if (requestedDiscountPct) {
      projRevenue = Number(q.subtotal) * (1 - (requestedDiscountPct / 100));
    }
    const projProfit = Math.round(projRevenue - totalCost);
    const projMarginPct = projRevenue > 0 ? Number(((projProfit / projRevenue) * 100).toFixed(1)) : 0;

    const isUnfair = projMarginPct < 18 || (latestCustomerMsg && /discount|reduce|cheap|cut|less|lower|off|heavy discount/i.test(latestCustomerMsg.message) && currentMarginPct <= 20);
    const fallbackDecision = isUnfair ? "REJECT" : currentMarginPct >= 25 ? "ACCEPT" : "COUNTER";

    let fallbackDraft = "";
    if (audienceRole === "ADMIN") {
      fallbackDraft = `Dear Admin,\n\nRegarding Quote #${q.quotation_number} for ${q.customer_name} (${q.company_name || "N/A"}):\n\nCustomer has requested additional pricing concessions${latestCustomerMsg ? `: "${latestCustomerMsg.message}"` : ""}.\n\n• Current Final Amount: ₹${Number(q.final_amount).toLocaleString("en-IN")}\n• Total Cost: ₹${totalCost.toLocaleString("en-IN")}\n• Projected Margin: ${projMarginPct}%\n• Recommendation: ${isUnfair ? "REJECT discount to protect our 18.0% margin floor" : "Counter-offer within safe limits"}.\n\nPlease let me know if an exception is permitted or if I should proceed with the standard value defense.\n\nRegards,\n${user.full_name || user.email}`;
    } else if (audienceRole === "SALES_REP") {
      fallbackDraft = `Hi ${q.sales_rep_name},\n\nRegarding Quote #${q.quotation_number} for ${q.customer_name}:\n\n${isUnfair ? "Please firmly decline any further discount. Defend our premium enterprise specifications, warranty coverage, and high SLA commitments." : "You have room for a modest counter-offer in exchange for upfront payment or quarterly commitment."}\n\nMaintain pricing integrity and offer milestone delivery if needed.\n\nBest regards,\nManagement`;
    } else {
      fallbackDraft = latestCustomerMsg
        ? isUnfair
          ? `Dear ${q.customer_name},\n\nThank you for sharing your feedback regarding Quote #${q.quotation_number}.\n\nWe have carefully evaluated your request regarding pricing adjustments. Given the premium enterprise specifications, dedicated warranty, and high SLA commitments included with our solution, we are unable to provide further discounts beyond our current proposed pricing of ₹${Number(q.final_amount).toLocaleString("en-IN")}.\n\nOur proposal represents our most competitive commercial offering for this scope of delivery. We would be delighted to discuss flexible milestone delivery schedules or customized payment structures to best align with your operational roadmap.\n\nPlease let us know if you would like to proceed on these agreed terms.\n\nWarm regards,\n${q.sales_rep_name}`
          : `Dear ${q.customer_name},\n\nThank you for your message regarding Quote #${q.quotation_number}. We appreciate you taking the time to share your thoughts.\n\nWe have reviewed your note — "${latestCustomerMsg.message.slice(0, 80)}${latestCustomerMsg.message.length > 80 ? "..." : ""}" — and are pleased to confirm that we can accommodate your requirements. To ensure we deliver the best outcome for your business, we would like to propose scheduling a brief call to align on final commercial terms, including delivery timelines and payment structure.\n\nWe look forward to finalising this partnership at the earliest.\n\nWarm regards,\n${q.sales_rep_name}`
        : `Dear ${q.customer_name},\n\nThank you for your continued engagement with us on Quote #${q.quotation_number}. We remain committed to delivering the most competitive and value-driven proposal for your organisation.\n\nKindly let us know your preferred timeline so that we may prioritise this for you and bring the engagement to a successful close.\n\nWarm regards,\n${q.sales_rep_name}`;
    }

    return {
      decision: fallbackDecision,
      requestedTerms: latestCustomerMsg ? latestCustomerMsg.message : "Client reviewing quotation.",
      projectedMargin: `${projMarginPct}%`,
      projectedProfit: `₹${projProfit.toLocaleString("en-IN")}`,
      isCommerciallyViable: !isUnfair,
      summary: isUnfair
        ? `Customer request requires concessions that would compress gross margins to ${projMarginPct}%, which breaches our mandatory 18.0% margin floor (Cost: ₹${totalCost.toLocaleString("en-IN")}, Profit: ₹${projProfit.toLocaleString("en-IN")}). Recommend rejecting the discount to protect deal profitability.`
        : `${ctx.chatHistory.length} message(s) reviewed. Client: ${q.customer_name} (${q.customer_tier || "STANDARD"} tier). Projected margin: ${projMarginPct}%. Safe discount headroom: ${safeDiscountHeadroom}% (internal).`,
      dealHealth: isUnfair ? `CRITICAL MARGIN RISK: Projected margin ${projMarginPct}% is below the 18.0% company floor.` : `COMMERCIALLY HEALTHY: Projected margin ${projMarginPct}% is above the 18.0% floor.`,
      strategy: isUnfair
        ? "Firmly reject price concessions. Defend solution value, warranty coverage, and ROI. Offer payment terms or milestone delivery flexibility instead."
        : "Offer flexibility through delivery terms and payment structure rather than direct price reductions.",
      reply: `📋 Verdict: ${fallbackDecision}\n${isUnfair ? "Unfair / Margin-risk deal terms detected." : "Deal terms viable."}`,
      suggestedDraft: fallbackDraft,
      quoteUpdate: { shouldRecreate: false, rationale: "No line changes recommended.", items: [] },
      margin: `${currentMarginPct}%`,
      finalAmount: q.final_amount,
      targetRole: audienceRole,
      _context: {
        messagesAnalyzed: ctx.chatHistory.length,
        negotiationTickets: ctx.negotiationRequests.length,
        customerDeals: ctx.customerHistory.length,
      },
    };
  }

  // AI Compliance Screener for Customer Complaints
  async evaluateComplaint({ customer, staff, category, subject, description, quotationNumber }) {
    const text = `${subject || ""} ${description || ""}`.trim();
    const cleanLetters = text.replace(/[^a-zA-Z0-9]/g, "");

    // Immediate heuristic screener for obvious gibberish or spam tests
    const isObviousGibberish =
      cleanLetters.length < 6 ||
      /^(asdf|qwerty|test|testing|hello|1234|abc|xyz|blah|lol|timepass|fake)+$/i.test(cleanLetters) ||
      /(.)\1{5,}/.test(text);

    if (isObviousGibberish) {
      return {
        is_relevant: false,
        confidence_score: 95.0,
        classification: "SPAM_OR_UNRELATED",
        reason: "Submission identified as random gibberish or test text with no genuine staff or business grievance.",
        suggested_priority: "LOW",
        suggested_action: "Auto-rejected by AI as non-actionable spam.",
      };
    }

    const systemPrompt = `You are the Lead AI Compliance & Grievance Auditor for DealFlow 360 CRM.
Your job is to screen customer complaints filed against company staff and distinguish between:
1. "GENUINE_COMPLAINT" (is_relevant: true) -> Real grievances related to staff behavior, communication delays, unresponsiveness, pricing disputes, quote errors, delivery failures, billing mismatches, unprofessional conduct, or service failures. These must go for manual review by the Human Administrator.
2. "SPAM_OR_UNRELATED" (is_relevant: false) -> "Timepass", memes, jokes, unrelated questions (e.g. weather, movies, sports, personal gossip), random phrases, greetings without complaint, testing messages, or nonsensical gibberish that has nothing to do with staff, orders, quotes, or services. These MUST be auto-rejected.

You MUST respond ONLY with valid JSON in this exact structure:
{
  "is_relevant": true,
  "confidence_score": 88.0,
  "classification": "GENUINE_COMPLAINT",
  "reason": "Clear concise 1-2 sentence explanation of your classification.",
  "suggested_priority": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "suggested_action": "Recommended next step for the human administrator."
}`;

    const userMessage = `COMPLAINT DETAILS TO AUDIT:
Customer Name: ${customer?.full_name || "Customer"} (${customer?.company_name || "N/A"})
Staff Accused: ${staff?.full_name || "Staff"} (${staff?.role || "Staff"} - ${staff?.department || "General"})
Quotation Ref: ${quotationNumber || "N/A"}
Category: ${category}
Subject: "${subject}"
Description:
"""
${description}
"""

Evaluate if this is a genuine relevant complaint or spam/timepass/unrelated. Return valid JSON only.`;

    const groqResponse = await callGroqChat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      0.1
    );

    if (groqResponse) {
      try {
        const jsonMatch = groqResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            is_relevant: Boolean(parsed.is_relevant),
            confidence_score: Number(parsed.confidence_score) || (parsed.is_relevant ? 88.0 : 92.0),
            classification: parsed.classification || (parsed.is_relevant ? "GENUINE_COMPLAINT" : "SPAM_OR_UNRELATED"),
            reason: parsed.reason || (parsed.is_relevant ? "Complaint contains actionable staff or service grievances." : "Complaint classified as unrelated or non-business submission."),
            suggested_priority: parsed.suggested_priority || "MEDIUM",
            suggested_action: parsed.suggested_action || (parsed.is_relevant ? "Investigate staff communication and transaction history." : "Auto-rejected by compliance engine."),
          };
        }
      } catch (e) {
        console.warn("[DealFlow AI] Failed to parse complaint evaluation JSON:", e?.message);
      }
    }

    // Heuristic fallback if AI model is unreachable:
    const grievanceKeywords = /(unresponsive|delay|rude|price|discount|quote|quotation|invoice|delivery|behavior|behave|money|scam|wrong|error|broken|refund|order|staff|manager|representative|promise|fake|fraud|call|email|reply|cheat|bad|worst|cancel|dispute|service|complaint)/i;
    const isGrievance = grievanceKeywords.test(text);

    return {
      is_relevant: isGrievance,
      confidence_score: isGrievance ? 78.0 : 85.0,
      classification: isGrievance ? "GENUINE_COMPLAINT" : "SPAM_OR_UNRELATED",
      reason: isGrievance
        ? "Contains business transaction / staff performance grievance indicators."
        : "Submission lacks specific business grievance or staff conduct details.",
      suggested_priority: isGrievance ? "MEDIUM" : "LOW",
      suggested_action: isGrievance
        ? "Manual review by administrator recommended."
        : "Auto-rejected as non-actionable submission.",
    };
  }
}

module.exports = new AiService();
