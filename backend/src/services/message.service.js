const { pool } = require("../config/db");

class MessageService {
  async getQuotationsForUser(user) {
    let query;
    let params;

    if (user.role === "CUSTOMER") {
      query = `
        SELECT 
          q.id,
          q.quotation_number,
          q.status,
          q.final_amount,
          q.created_at,
          q.updated_at,
          c.full_name as customer_name,
          c.company_name as customer_company,
          sr.full_name as sales_rep_name,
          (
            SELECT JSON_BUILD_OBJECT(
              'message', m.message,
              'sender_name', m.sender_name,
              'sender_role', m.sender_role,
              'created_at', m.created_at
            )
            FROM public.quotation_messages m
            WHERE m.quotation_id = q.id
            ORDER BY m.created_at DESC
            LIMIT 1
          ) as latest_message
        FROM public.quotations q
        JOIN public.users c ON q.customer_id = c.id
        JOIN public.users sr ON q.sales_rep_id = sr.id
        WHERE q.customer_id = $1
        ORDER BY q.updated_at DESC
      `;
      params = [user.id];
    } else {
      query = `
        SELECT 
          q.id,
          q.quotation_number,
          q.status,
          q.final_amount,
          q.created_at,
          q.updated_at,
          c.full_name as customer_name,
          c.company_name as customer_company,
          sr.full_name as sales_rep_name,
          (
            SELECT JSON_BUILD_OBJECT(
              'message', m.message,
              'sender_name', m.sender_name,
              'sender_role', m.sender_role,
              'created_at', m.created_at
            )
            FROM public.quotation_messages m
            WHERE m.quotation_id = q.id
            ORDER BY m.created_at DESC
            LIMIT 1
          ) as latest_message
        FROM public.quotations q
        JOIN public.users c ON q.customer_id = c.id
        JOIN public.users sr ON q.sales_rep_id = sr.id
        ORDER BY q.updated_at DESC
      `;
      params = [];
    }

    const { rows } = await pool.query(query, params);
    return rows;
  }

  async getMessagesByQuotationId(quotationId, user) {
    const checkQuery = `
      SELECT q.id, q.quotation_number, q.status, q.final_amount,
             c.full_name as customer_name, c.company_name as customer_company,
             sr.full_name as sales_rep_name
      FROM public.quotations q
      JOIN public.users c ON q.customer_id = c.id
      JOIN public.users sr ON q.sales_rep_id = sr.id
      WHERE q.id = $1
    `;
    const checkRes = await pool.query(checkQuery, [quotationId]);
    if (checkRes.rows.length === 0) {
      throw new Error("Quotation not found.");
    }
    const quotation = checkRes.rows[0];

    // Exclude internal AI_BOT messages for CUSTOMER users
    let messagesQuery;
    if (user.role === "CUSTOMER") {
      messagesQuery = `
        SELECT id, quotation_id, sender_id, sender_role, sender_name, message, created_at
        FROM public.quotation_messages
        WHERE quotation_id = $1 AND sender_role != 'AI_BOT'
        ORDER BY created_at ASC
      `;
    } else {
      messagesQuery = `
        SELECT id, quotation_id, sender_id, sender_role, sender_name, message, created_at
        FROM public.quotation_messages
        WHERE quotation_id = $1
        ORDER BY created_at ASC
      `;
    }
    const { rows: messages } = await pool.query(messagesQuery, [quotationId]);

    return { quotation, messages };
  }

  async sendMessage({ quotationId, senderId, senderRole, senderName, message }) {
    if (!message || !message.trim()) {
      throw new Error("Message text cannot be empty.");
    }

    const insertQuery = `
      INSERT INTO public.quotation_messages (quotation_id, sender_id, sender_role, sender_name, message)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, quotation_id, sender_id, sender_role, sender_name, message, created_at
    `;
    const { rows } = await pool.query(insertQuery, [
      quotationId,
      senderId,
      senderRole,
      senderName,
      message.trim(),
    ]);

    await pool.query(
      `UPDATE public.quotations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [quotationId]
    );

    return rows[0];
  }

  async analyzeQuotationDeal(quotationId) {
    const qQuery = `
      SELECT q.id, q.quotation_number, q.status, q.subtotal, q.discount_amount, q.final_amount,
             c.full_name as customer_name, c.company_name as customer_company
      FROM public.quotations q
      JOIN public.users c ON q.customer_id = c.id
      WHERE q.id = $1
    `;
    const qRes = await pool.query(qQuery, [quotationId]);
    if (qRes.rows.length === 0) throw new Error("Quotation not found.");
    const quotation = qRes.rows[0];

    const itemsQuery = `
      SELECT qi.quantity, qi.unit_price, qi.line_total, qi.discount_percent,
             p.name as product_name, p.cost as unit_cost, p.category
      FROM public.quotation_items qi
      JOIN public.products p ON qi.product_id = p.id
      WHERE qi.quotation_id = $1
    `;
    const itemsRes = await pool.query(itemsQuery, [quotationId]);
    const items = itemsRes.rows;

    const subtotal = Number(quotation.subtotal || 0);
    const currentDiscount = Number(quotation.discount_amount || 0);
    const finalAmount = Number(quotation.final_amount || 0);

    let totalCost = 0;
    for (const item of items) {
      totalCost += Number(item.unit_cost || 0) * Number(item.quantity || 1);
    }

    const currentProfit = finalAmount - totalCost;
    const currentMarginPercent = finalAmount > 0 ? (currentProfit / finalAmount) * 100 : 0;

    const negQuery = `
      SELECT requested_discount_percent, customer_comment
      FROM public.negotiation_requests
      WHERE quotation_id = $1 AND status = 'PENDING'
      ORDER BY created_at DESC LIMIT 1
    `;
    const negRes = await pool.query(negQuery, [quotationId]);
    const pendingNeg = negRes.rows[0];

    const requestedDiscountPct = pendingNeg ? Number(pendingNeg.requested_discount_percent || 0) : 0;

    const potentialDiscountAmt = subtotal * (requestedDiscountPct / 100);
    const potentialFinalAmt = subtotal - potentialDiscountAmt;
    const potentialProfit = potentialFinalAmt - totalCost;
    const potentialMarginPct = potentialFinalAmt > 0 ? (potentialProfit / potentialFinalAmt) * 100 : 0;

    const minSafeMarginPct = 18.0;
    let maxSafeDiscountPct = 0;
    if (subtotal > 0) {
      const maxCostFactor = totalCost / (1 - minSafeMarginPct / 100);
      maxSafeDiscountPct = Math.max(0, ((subtotal - maxCostFactor) / subtotal) * 100);
    }

    let dealHealth = "EXCELLENT";
    let recommendation = "Quotation terms are healthy and yield strong profit margin.";

    if (potentialMarginPct < minSafeMarginPct && requestedDiscountPct > 0) {
      dealHealth = "MARGIN_RISK";
      recommendation = `Requested ${requestedDiscountPct}% discount drops margin to ${potentialMarginPct.toFixed(1)}% (below 18% safe threshold). Counter with maximum safe discount of ${maxSafeDiscountPct.toFixed(1)}%.`;
    } else if (requestedDiscountPct > 0) {
      dealHealth = "HEALTHY_NEGOTIATION";
      recommendation = `Requested ${requestedDiscountPct}% discount maintains healthy margin of ${potentialMarginPct.toFixed(1)}%. Safe to accept or confirm.`;
    }

    return {
      quotationNumber: quotation.quotation_number,
      subtotal,
      currentDiscount,
      finalAmount,
      totalCost,
      currentProfit: Number(currentProfit.toFixed(2)),
      currentMarginPercent: Number(currentMarginPercent.toFixed(1)),
      requestedDiscountPct,
      potentialProfit: Number(potentialProfit.toFixed(2)),
      potentialMarginPct: Number(potentialMarginPct.toFixed(1)),
      maxSafeDiscountPct: Number(maxSafeDiscountPct.toFixed(1)),
      dealHealth,
      recommendation,
      pendingComment: pendingNeg?.customer_comment || null
    };
  }

  async generateAIAutoReply(quotationId, user) {
    const analysis = await this.analyzeQuotationDeal(quotationId);

    let aiMessage = "";
    if (analysis.dealHealth === "MARGIN_RISK") {
      const counterAmt = analysis.subtotal * (1 - analysis.maxSafeDiscountPct / 100);
      aiMessage = `🤖 DealFlow AI Negotiator Analysis:
We analyzed your requested counter-offer. Based on product cost structures (Est. Total Cost: ₹${analysis.totalCost.toLocaleString("en-IN")}), granting ${analysis.requestedDiscountPct}% discount would drop gross margin to ${analysis.potentialMarginPct}% (below 18% threshold).

💡 Counter Proposal: We can approve an optimized ${analysis.maxSafeDiscountPct}% discount (Final Price: ₹${counterAmt.toLocaleString("en-IN")}) with guaranteed delivery priority!`;
    } else if (analysis.requestedDiscountPct > 0) {
      const discountedAmt = analysis.subtotal * (1 - analysis.requestedDiscountPct / 100);
      aiMessage = `🤖 DealFlow AI Negotiator Analysis:
Great news! We analyzed your requested ${analysis.requestedDiscountPct}% discount. The terms maintain a healthy gross margin of ${analysis.potentialMarginPct}% (Est. Profit: ₹${analysis.potentialProfit.toLocaleString("en-IN")}).

✅ DealFlow AI recommends approving this ${analysis.requestedDiscountPct}% discount (Final Price: ₹${discountedAmt.toLocaleString("en-IN")})!`;
    } else {
      aiMessage = `🤖 DealFlow AI Negotiator Analysis:
Financial review complete for ${analysis.quotationNumber}:
- Revenue: ₹${analysis.finalAmount.toLocaleString("en-IN")}
- Est. Product Cost: ₹${analysis.totalCost.toLocaleString("en-IN")}
- Gross Profit: ₹${analysis.currentProfit.toLocaleString("en-IN")} (${analysis.currentMarginPercent}% Margin)
Deal is healthy and fully compliant with corporate discount policies!`;
    }

    const insertQuery = `
      INSERT INTO public.quotation_messages (quotation_id, sender_id, sender_role, sender_name, message)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, quotation_id, sender_id, sender_role, sender_name, message, created_at
    `;
    const { rows } = await pool.query(insertQuery, [
      quotationId,
      user.id || "00000000-0000-0000-0000-000000000000",
      "AI_BOT",
      "DealFlow AI Negotiator",
      aiMessage,
    ]);

    await pool.query(
      `UPDATE public.quotations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [quotationId]
    );

    return { message: rows[0], analysis };
  }
}

module.exports = new MessageService();
