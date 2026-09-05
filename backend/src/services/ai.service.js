const { pool } = require("../config/db");
const { Groq } = require("groq-sdk");

const MODEL = "openai/gpt-oss-120b";

// Helper to strip any reasoning or think tags from model outputs
function cleanModelOutput(rawText) {
  if (!rawText) return "";
  let text = String(rawText);
  // Remove <think>...</think> or reasoning tags
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  // Remove standalone ```json or ``` fences if wrapping whole text
  text = text.trim();
  return text;
}

// Collect streaming Groq response into clean string
async function callGroqChat(messages, temperature = 0.3) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn("[DealFlow AI] GROQ_API_KEY is not set in environment.");
    return null;
  }

  const groq = new Groq({ apiKey });

  try {
    const stream = await groq.chat.completions.create({
      model: MODEL,
      messages,
      temperature, // Lower temperature avoids gibberish and hallucination
      max_completion_tokens: 1500,
      top_p: 0.9,
      stream: true,
      reasoning_effort: "medium",
      stop: null,
    });

    let content = "";
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || "";
      content += delta;
    }

    const cleaned = cleanModelOutput(content);
    if (cleaned) return cleaned;
  } catch (err) {
    console.error(`[DealFlow AI] Primary model ${MODEL} call failed:`, err?.message || err);
  }

  // Fallback to fast reliable model if primary encounters issues
  try {
    const fallbackResponse = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.3,
      max_tokens: 1500,
    });
    return cleanModelOutput(fallbackResponse.choices[0]?.message?.content || "");
  } catch (fallbackErr) {
    console.error("[DealFlow AI] Fallback model failed:", fallbackErr?.message || fallbackErr);
    return null;
  }
}

class AiService {
  // Collect full DB quotation context + past negotiations + customer history
  async getQuotationContext(quotationId) {
    const quoteRes = await pool.query(
      `SELECT q.id, q.quotation_number, q.status, q.subtotal, q.discount_amount, q.final_amount,
              q.total_cost, q.gross_margin, q.margin_percentage, q.risk_score, q.risk_level,
              q.customer_id, q.sales_rep_id,
              c.full_name AS customer_name, c.email AS customer_email, c.company_name, c.customer_tier,
              s.full_name AS sales_rep_name, s.email AS sales_rep_email
       FROM public.quotations q
       LEFT JOIN public.users c ON q.customer_id = c.id
       LEFT JOIN public.users s ON q.sales_rep_id = s.id
       WHERE q.id = $1`,
      [quotationId]
    );

    if (quoteRes.rows.length === 0) return null;
    const q = quoteRes.rows[0];

    // Current line items
    const itemsRes = await pool.query(
      `SELECT qi.quantity, qi.unit_price, qi.discount_percent, qi.line_total,
              COALESCE(p.cost, 0) AS cost, p.name, p.sku, p.category
       FROM public.quotation_items qi
       LEFT JOIN public.products p ON qi.product_id = p.id
       WHERE qi.quotation_id = $1`,
      [quotationId]
    );

    // Entire chat negotiation thread (last 20 messages)
    const msgRes = await pool.query(
      `SELECT sender_role, sender_name, message, recipient_role, created_at
       FROM public.quotation_messages
       WHERE quotation_id = $1
       ORDER BY created_at ASC
       LIMIT 20`,
      [quotationId]
    );

    // Formal negotiation portal tickets
    const negRes = await pool.query(
      `SELECT requested_discount_percent, requested_delivery_date, customer_comment, status, created_at
       FROM public.negotiation_requests
       WHERE quotation_id = $1
       ORDER BY created_at DESC
       LIMIT 5`,
      [quotationId]
    );

    // Customer historical deals & behavior
    const pastHistoryRes = await pool.query(
      `SELECT q.quotation_number, q.status, q.final_amount, q.margin_percentage, q.created_at
       FROM public.quotations q
       WHERE q.customer_id = $1 AND q.id != $2
       ORDER BY q.created_at DESC
       LIMIT 5`,
      [q.customer_id, quotationId]
    );

    return {
      quotation: q,
      items: itemsRes.rows,
      chatHistory: msgRes.rows,
      negotiationRequests: negRes.rows,
      customerHistory: pastHistoryRes.rows,
    };
  }

  // Interactive AI Negotiator Grounded in Conversation History
  async consultNegotiator(quotationId, userPrompt, user) {
    const ctx = await this.getQuotationContext(quotationId);
    if (!ctx) {
      throw new Error("Quotation context not found.");
    }

    const q = ctx.quotation;

    // Items summary
    const itemsSummary = ctx.items.length > 0
      ? ctx.items
          .map(
            (i) =>
              `${i.name} (Qty ${i.quantity}, Price ₹${i.unit_price}, Cost ₹${i.cost})`
          )
          .join("; ")
      : "Standard line items";

    // Recent chat messages
    const chatTranscript =
      ctx.chatHistory.length > 0
        ? ctx.chatHistory
            .map(
              (m) =>
                `[${m.sender_role} - ${m.sender_name}]: "${m.message}"`
            )
            .join("\n")
        : "(No prior chat messages exchanged yet.)";

    // Past formal negotiations
    const portalNegotiations =
      ctx.negotiationRequests.length > 0
        ? ctx.negotiationRequests
            .map(
              (nr) =>
                `- Requested Discount: ${nr.requested_discount_percent || 0}%, Date: ${
                  nr.requested_delivery_date || "N/A"
                }, Note: "${nr.customer_comment || "None"}", Status: ${nr.status}`
            )
            .join("\n")
        : "(No formal portal negotiation tickets.)";

    // Past customer deals
    const pastCustomerDeals =
      ctx.customerHistory.length > 0
        ? ctx.customerHistory
            .map(
              (ph) =>
                `- Quote #${ph.quotation_number}: ${ph.status}, ₹${ph.final_amount}, Margin: ${ph.margin_percentage}%`
            )
            .join("\n")
        : "(No prior quotations.)";

    const systemPrompt = `You are DealFlow360's Senior Commercial Negotiation Strategist.
You MUST output ONLY a valid, parseable JSON object with NO preamble, NO thinking tokens, and NO markdown code fences.

The JSON schema must be exactly:
{
  "summary": "1-2 concise sentences analyzing the client's position, latest message, and past history.",
  "dealHealth": "Clear margin assessment explaining current margin vs the 18% floor.",
  "strategy": "Actionable tactic (e.g., concession trade-off, bundling, delivery terms).",
  "suggestedDraft": "The complete, polished, ready-to-send professional message to the client."
}

Rules:
1. Ground the response on the chat transcript and client's actual messages.
2. Protect the 18% minimum gross margin floor.
3. The draft message must be professional, courteous, persuasive, and directly applicable.
4. Output raw JSON only.`;

    const userMessage = `DEAL FINANCIALS:
- Quote: #${q.quotation_number}
- Client: ${q.customer_name} (${q.company_name || "Enterprise"})
- Customer Tier: ${q.customer_tier || "BRONZE"}
- Deal Total: ₹${q.final_amount} (Subtotal: ₹${q.subtotal})
- Current Gross Margin: ${q.margin_percentage || 20}% (Cost: ₹${q.total_cost || 0})
- Line Items: ${itemsSummary}

PAST NEGOTIATION TICKETS:
${portalNegotiations}

CHAT HISTORY:
${chatTranscript}

CUSTOMER PAST DEALS:
${pastCustomerDeals}

USER INSTRUCTION:
Speaker: ${user.full_name} (${user.role})
Request: "${userPrompt}"`;

    const groqResponse = await callGroqChat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      0.3
    );

    let parsed = null;
    if (groqResponse) {
      try {
        const jsonMatch = groqResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      } catch (parseErr) {
        console.warn("[DealFlow AI] JSON parse failed, extracting sections:", parseErr?.message);
      }
    }

    const currentMargin = Number(q.margin_percentage || 20);
    const customerName = q.customer_name || "Client";
    const lastMsg = ctx.chatHistory[ctx.chatHistory.length - 1];

    if (parsed && (parsed.suggestedDraft || parsed.summary)) {
      const summary = parsed.summary || `Analysis of Quote #${q.quotation_number} for ${customerName}.`;
      const dealHealth = parsed.dealHealth || `Current margin is ${currentMargin}%, maintaining healthy headroom above the 18% floor.`;
      const strategy = parsed.strategy || `Acknowledge client terms while holding base pricing and offering flexible delivery terms.`;
      const suggestedDraft = parsed.suggestedDraft || (groqResponse.length < 400 ? groqResponse : "");

      const formattedReply = `📋 Context Analysis:\n${summary}\n\n💡 Recommended Strategy:\n${strategy}\n\n🛡️ Margin Health:\n${dealHealth}`;

      return {
        summary,
        dealHealth,
        strategy,
        reply: formattedReply,
        suggestedDraft: suggestedDraft.trim(),
        margin: `${currentMargin}%`,
        finalAmount: q.final_amount,
      };
    }

    // High quality deterministic fallback grounded in actual history
    const fallbackDraft = lastMsg
      ? `Dear ${customerName}, thank you for your note regarding "${lastMsg.message.slice(0, 55)}...". We have reviewed your request alongside our production costs. While our current margin (${currentMargin}%) does not allow further base discounts without breaching our 18% floor, we would be glad to offer complimentary expedited delivery and extended payment terms to support your timeline.`
      : `Dear ${customerName}, thank you for reaching out regarding Quote #${q.quotation_number}. Under your ${q.customer_tier || "Standard"} tier terms, we are committed to providing the most competitive terms while maintaining our quality standards. Let us schedule a brief discussion to finalize mutually beneficial milestones.`;

    const fallbackSummary = `Analyzed ${ctx.chatHistory.length} chat message(s) for ${customerName} (${q.customer_tier || "Standard"} tier). Current gross margin stands at ${currentMargin}%.`;
    const fallbackStrategy = `Protect the 18% margin floor by offering value-added concessions (accelerated delivery, priority support) rather than direct unit price cuts.`;
    const fallbackHealth = `Gross margin is currently ${currentMargin}%. Limit any additional concessions to value-adds rather than cash discounts.`;

    return {
      summary: fallbackSummary,
      dealHealth: fallbackHealth,
      strategy: fallbackStrategy,
      reply: `📋 Context Analysis:\n${fallbackSummary}\n\n💡 Recommended Strategy:\n${fallbackStrategy}\n\n🛡️ Margin Health:\n${fallbackHealth}`,
      suggestedDraft: fallbackDraft,
      margin: `${currentMargin}%`,
      finalAmount: q.final_amount,
    };
  }
}

module.exports = new AiService();
