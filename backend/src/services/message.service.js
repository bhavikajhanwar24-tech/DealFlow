const { pool } = require("../config/db");

function messageError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

class MessageService {
  async getQuotationsForUser(user) {
    let ownership = "";
    const params = [];
    if (user.role === "CUSTOMER") {
      ownership = "WHERE q.customer_id = $1";
      params.push(user.id);
    } else if (user.role === "SALES_REP") {
      ownership = "WHERE q.sales_rep_id = $1";
      params.push(user.id);
    }
    const { rows } = await pool.query(`
      SELECT q.id, q.quotation_number, q.status, q.final_amount, q.created_at, q.updated_at,
             c.full_name AS customer_name, c.company_name AS customer_company,
             sr.full_name AS sales_rep_name,
             (SELECT JSON_BUILD_OBJECT('message', m.message, 'sender_name', m.sender_name,
                     'sender_role', m.sender_role, 'created_at', m.created_at)
              FROM public.quotation_messages m
              WHERE m.quotation_id = q.id
                AND (${user.role === "CUSTOMER"
                  ? "m.sender_role != 'AI_BOT' AND (m.recipient_role = 'CUSTOMER' OR m.sender_role = 'CUSTOMER' OR m.recipient_role IS NULL)"
                  : "1=1"})
              ORDER BY m.created_at DESC LIMIT 1) AS latest_message
      FROM public.quotations q
      JOIN public.users c ON q.customer_id = c.id
      JOIN public.users sr ON q.sales_rep_id = sr.id
      ${ownership}
      ORDER BY q.updated_at DESC
    `, params);
    return rows;
  }

  async getQuotationParticipants(quotationId, user) {
    const quotation = await this.getQuotation(quotationId);
    const adminThread = await pool.query(
      `SELECT EXISTS (
         SELECT 1 FROM public.quotation_messages
         WHERE quotation_id = $1
           AND ((sender_role = 'ADMIN' AND recipient_role = 'CUSTOMER')
             OR (sender_role = 'CUSTOMER' AND recipient_role = 'ADMIN'))
       ) AS exists`,
      [quotationId],
    );

    const hasAdminThread = Boolean(adminThread.rows[0]?.exists);
    const options = [];

    if (user.role === "CUSTOMER") {
      options.push({
        role: "SALES_REP",
        label: "Sales Representative",
        sublabel: quotation.sales_rep_name,
        userId: quotation.sales_rep_id,
      });
      if (hasAdminThread) {
        options.push({
          role: "ADMIN",
          label: "Corporate Administrator",
          sublabel: "Admin Desk",
          userId: quotation.admin_id,
        });
      }
    } else if (user.role === "ADMIN") {
      options.push({
        role: "SALES_REP",
        label: "Sales Representative",
        sublabel: quotation.sales_rep_name,
        userId: quotation.sales_rep_id,
      });
      options.push({
        role: "CUSTOMER",
        label: "Customer",
        sublabel: quotation.customer_company || quotation.customer_name,
        userId: quotation.customer_id,
      });
    } else {
      // SALES_REP or SALES_MANAGER
      options.push({
        role: "CUSTOMER",
        label: "Customer",
        sublabel: quotation.customer_company || quotation.customer_name,
        userId: quotation.customer_id,
      });
      options.push({
        role: "ADMIN",
        label: "Administrator",
        sublabel: "Internal Approval & Review",
        userId: quotation.admin_id,
      });
    }

    return { options, adminThreadExists: hasAdminThread };
  }

  async getQuotation(quotationId) {
    const result = await pool.query(`
      SELECT q.id, q.quotation_number, q.status, q.final_amount,
             c.id AS customer_id, c.full_name AS customer_name, c.company_name AS customer_company,
             sr.id AS sales_rep_id, sr.full_name AS sales_rep_name,
             (SELECT id FROM public.users WHERE role = 'ADMIN' AND status = 'ACTIVE' ORDER BY created_at LIMIT 1) AS admin_id
      FROM public.quotations q
      JOIN public.users c ON q.customer_id = c.id
      JOIN public.users sr ON q.sales_rep_id = sr.id
      WHERE q.id = $1
    `, [quotationId]);
    if (!result.rows.length) throw messageError("Quotation not found.", 404);
    return result.rows[0];
  }

  async getMessagesByQuotationId(quotationId, user, recipientRole = "") {
    const quotation = await this.getQuotation(quotationId);
    const participants = await this.getQuotationParticipants(quotationId, user);
    
    // Find target recipient or fallback to first available
    let selected = participants.options.find((option) => option.role === recipientRole);
    if (!selected) {
      selected = participants.options[0];
    }
    if (!selected) {
      throw messageError("No permitted chat participant is available.", 403);
    }

    const targetRole = selected.role;
    let filterClause = "";
    const params = [quotationId];

    if (user.role === "CUSTOMER") {
      if (targetRole === "ADMIN") {
        // Customer chatting with Admin
        filterClause = `
          (
            (sender_role = 'ADMIN' AND recipient_role = 'CUSTOMER')
            OR
            (sender_role = 'CUSTOMER' AND recipient_role = 'ADMIN')
          )
        `;
      } else {
        // Customer chatting with Sales Rep (default)
        filterClause = `
          (
            (sender_role IN ('SALES_REP', 'SALES_MANAGER') AND (recipient_role = 'CUSTOMER' OR recipient_role IS NULL))
            OR
            (sender_role = 'CUSTOMER' AND (recipient_role IN ('SALES_REP', 'SALES_MANAGER') OR recipient_role IS NULL))
          )
        `;
      }
    } else if (user.role === "ADMIN") {
      if (targetRole === "CUSTOMER") {
        // Admin chatting with Customer
        filterClause = `
          (
            (sender_role = 'ADMIN' AND recipient_role = 'CUSTOMER')
            OR
            (sender_role = 'CUSTOMER' AND recipient_role = 'ADMIN')
          )
        `;
      } else {
        // Admin chatting with Sales Rep
        filterClause = `
          (
            sender_role = 'AI_BOT'
            OR
            (sender_role = 'ADMIN' AND recipient_role IN ('SALES_REP', 'SALES_MANAGER'))
            OR
            (sender_role IN ('SALES_REP', 'SALES_MANAGER') AND recipient_role = 'ADMIN')
          )
        `;
      }
    } else {
      // Sales Rep / Sales Manager
      if (targetRole === "ADMIN") {
        // Sales Rep chatting with Admin
        filterClause = `
          (
            sender_role = 'AI_BOT'
            OR
            (sender_role IN ('SALES_REP', 'SALES_MANAGER') AND recipient_role = 'ADMIN')
            OR
            (sender_role = 'ADMIN' AND recipient_role IN ('SALES_REP', 'SALES_MANAGER'))
          )
        `;
      } else {
        // Sales Rep chatting with Customer
        filterClause = `
          (
            (sender_role IN ('SALES_REP', 'SALES_MANAGER') AND (recipient_role = 'CUSTOMER' OR recipient_role IS NULL))
            OR
            (sender_role = 'CUSTOMER' AND (recipient_role IN ('SALES_REP', 'SALES_MANAGER') OR recipient_role IS NULL))
          )
        `;
      }
    }

    const messageResult = await pool.query(`
      SELECT id, quotation_id, sender_id, sender_role, sender_name, message,
             recipient_role, recipient_id, created_at
      FROM public.quotation_messages
      WHERE quotation_id = $1
        AND (${filterClause})
      ORDER BY created_at ASC
    `, params);

    return {
      quotation,
      messages: messageResult.rows,
      participants,
      selectedRecipient: selected,
    };
  }

  async sendMessage({ quotationId, senderId, senderRole, senderName, message, recipientRole }) {
    if (!message || !message.trim()) throw messageError("Message text cannot be empty.");
    const quotation = await this.getQuotation(quotationId);
    const allowed = await this.getQuotationParticipants(quotationId, { id: senderId, role: senderRole });
    const recipient = allowed.options.find((option) => option.role === recipientRole);
    if (!recipient) {
      throw messageError("You are not allowed to start this conversation channel.", 403);
    }
    if (senderRole === "CUSTOMER" && recipientRole === "ADMIN" && !allowed.adminThreadExists) {
      throw messageError("Customers can contact an administrator only after the administrator initiates the conversation.", 403);
    }

    const result = await pool.query(`
      INSERT INTO public.quotation_messages
        (quotation_id, sender_id, sender_role, sender_name, message, recipient_role, recipient_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, quotation_id, sender_id, sender_role, sender_name, message, recipient_role, recipient_id, created_at
    `, [quotationId, senderId, senderRole, senderName, message.trim(), recipient.role, recipient.userId]);

    await pool.query("UPDATE public.quotations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1", [quotationId]);
    return result.rows[0];
  }

  async analyzeQuotationDeal(quotationId) {
    const { rows } = await pool.query(`
      SELECT q.id, q.quotation_number, q.status, q.subtotal, q.discount_amount, q.final_amount,
             c.full_name AS customer_name, c.company_name AS customer_company
      FROM public.quotations q JOIN public.users c ON q.customer_id = c.id WHERE q.id = $1
    `, [quotationId]);
    if (!rows.length) throw messageError("Quotation not found.", 404);

    const items = await pool.query(`
      SELECT qi.quantity, qi.unit_price, qi.discount_percent, qi.total_price,
             p.cost, p.category, p.name
      FROM public.quotation_items qi
      JOIN public.products p ON qi.product_id = p.id
      WHERE qi.quotation_id = $1
    `, [quotationId]);

    const finalAmount = Number(rows[0].final_amount || 0);
    let totalCost = 0;
    items.rows.forEach((item) => {
      totalCost += Number(item.cost || 0) * Number(item.quantity || 1);
    });

    if (totalCost === 0 && finalAmount > 0) {
      totalCost = finalAmount * 0.72; // default 28% gross margin estimate
    }

    const currentProfit = Math.max(0, finalAmount - totalCost);
    const currentMarginPercent = finalAmount > 0 ? Math.round((currentProfit / finalAmount) * 100) : 0;
    const isMarginRisk = currentMarginPercent < 18;

    return {
      quotationNumber: rows[0].quotation_number,
      finalAmount,
      totalCost: Math.round(totalCost * 100) / 100,
      currentProfit: Math.round(currentProfit * 100) / 100,
      currentMarginPercent,
      requestedDiscountPct: rows[0].subtotal > 0 ? Math.round((rows[0].discount_amount / rows[0].subtotal) * 100) : 0,
      potentialProfit: currentProfit,
      potentialMarginPct: currentMarginPercent,
      maxSafeDiscountPct: Math.max(0, currentMarginPercent - 15),
      dealHealth: isMarginRisk ? "MARGIN_RISK" : "EXCELLENT",
      recommendation: isMarginRisk
        ? `Warning: Margin is at ${currentMarginPercent}%, below recommended 18% floor. Limit additional discounts to ${Math.max(0, currentMarginPercent - 15)}%.`
        : `Deal healthy with ${currentMarginPercent}% margin (₹${currentProfit.toLocaleString("en-IN")} gross profit). Counter-offer room available.`,
      pendingComment: null,
    };
  }

  async generateAIAutoReply(quotationId, user) {
    const analysis = await this.analyzeQuotationDeal(quotationId);
    const result = await pool.query(`
      INSERT INTO public.quotation_messages
        (quotation_id, sender_id, sender_role, sender_name, message, recipient_role)
      VALUES ($1, $2, 'AI_BOT', 'DealFlow AI Negotiator', $3, 'INTERNAL')
      RETURNING id, quotation_id, sender_id, sender_role, sender_name, message, created_at
    `, [quotationId, user.id, `DealFlow AI Profit Analysis: ${analysis.recommendation}`]);
    return { message: result.rows[0], analysis };
  }
}

module.exports = new MessageService();
