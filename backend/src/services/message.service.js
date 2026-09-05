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

    const messagesQuery = `
      SELECT id, quotation_id, sender_id, sender_role, sender_name, message, created_at
      FROM public.quotation_messages
      WHERE quotation_id = $1
      ORDER BY created_at ASC
    `;
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
}

module.exports = new MessageService();
