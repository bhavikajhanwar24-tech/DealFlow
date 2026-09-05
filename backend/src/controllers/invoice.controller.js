const pool = require("../config/db");

// Helper to log audit events
async function logAudit(client, userId, action, details) {
  try {
    await client.query(
      `INSERT INTO public.audit_logs (user_id, action, details) VALUES ($1, $2, $3)`,
      [userId, action, JSON.stringify(details)]
    );
  } catch (error) {
    console.error("Audit log failed:", error);
  }
}

// 1. Generate Invoice from an Order
exports.generateInvoice = async (req, res) => {
  const client = await pool.pool.connect();
  try {
    const { orderId } = req.body;
    const userId = req.user.id;

    if (!orderId) return res.status(400).json({ success: false, message: "orderId is required" });

    // Check if order exists and if invoice already generated
    const checkInvoice = await client.query(`SELECT id FROM public.invoices WHERE order_id = $1`, [orderId]);
    if (checkInvoice.rows.length > 0) {
      return res.status(400).json({ success: false, message: "Invoice already exists for this order" });
    }

    const orderRes = await client.query(`
      SELECT o.*, q.subtotal, q.discount_amount, q.final_amount, b.tax_enabled, b.default_tax_rate, b.invoice_prefix, b.invoice_due_period
      FROM public.orders o
      JOIN public.quotations q ON o.quotation_id = q.id
      CROSS JOIN public.billing_configuration b
      WHERE o.id = $1
    `, [orderId]);

    if (orderRes.rows.length === 0) return res.status(404).json({ success: false, message: "Order not found" });

    const order = orderRes.rows[0];

    // Basic calculation for this MVP
    const subtotal = Number(order.subtotal);
    const discount = Number(order.discount_amount);
    const taxableAmount = subtotal - discount;
    let tax = 0;

    if (order.tax_enabled) {
      tax = (taxableAmount * Number(order.default_tax_rate)) / 100;
    }

    const total = taxableAmount + tax;

    // Generate Invoice Number
    const countRes = await client.query(`SELECT COUNT(*) FROM public.invoices`);
    const count = parseInt(countRes.rows[0].count) + 1;
    const prefix = order.invoice_prefix || "INV-";
    const invoiceNumber = `${prefix}${1000 + count}`;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (order.invoice_due_period || 30));

    await client.query("BEGIN");

    const insertInvoice = await client.query(`
      INSERT INTO public.invoices 
        (invoice_number, order_id, customer_id, subtotal, tax, discount, total, status, due_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [invoiceNumber, order.id, order.customer_id, subtotal, tax, discount, total, 'ISSUED', dueDate]);

    await logAudit(client, userId, "INVOICE_GENERATED", { invoiceId: insertInvoice.rows[0].id, invoiceNumber, orderId });

    await client.query("COMMIT");

    res.status(201).json({ success: true, data: insertInvoice.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ success: false, message: "Error generating invoice", error: error.message });
  } finally {
    client.release();
  }
};

// 2. List all invoices
exports.getInvoices = async (req, res) => {
  try {
    const invoices = await pool.query(`
      SELECT i.*, o.order_number, u.full_name as customer_name, u.company_name
      FROM public.invoices i
      JOIN public.orders o ON i.order_id = o.id
      JOIN public.users u ON i.customer_id = u.id
      ORDER BY i.created_at DESC
    `);
    res.json({ success: true, data: invoices.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error fetching invoices", error: error.message });
  }
};

// 3. Get invoice details
exports.getInvoiceDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const invoiceRes = await pool.query(`
      SELECT i.*, o.order_number, u.full_name as customer_name, u.company_name, u.email as customer_email
      FROM public.invoices i
      JOIN public.orders o ON i.order_id = o.id
      JOIN public.users u ON i.customer_id = u.id
      WHERE i.id = $1
    `, [id]);

    if (invoiceRes.rows.length === 0) return res.status(404).json({ success: false, message: "Invoice not found" });

    const paymentsRes = await pool.query(`
      SELECT p.*, u.full_name as recorded_by_name
      FROM public.payments p
      LEFT JOIN public.users u ON p.recorded_by = u.id
      WHERE p.invoice_id = $1
      ORDER BY p.payment_date DESC
    `, [id]);

    res.json({
      success: true,
      data: {
        ...invoiceRes.rows[0],
        payments: paymentsRes.rows
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error fetching invoice details", error: error.message });
  }
};

// 4. Record Payment
exports.recordPayment = async (req, res) => {
  const client = await pool.pool.connect();
  try {
    const { id } = req.params;
    const { amount, paymentMethod, reference, paymentDate } = req.body;
    const userId = req.user.id;

    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: "Amount must be greater than 0" });

    await client.query("BEGIN");

    const invoiceRes = await client.query(`SELECT * FROM public.invoices WHERE id = $1 FOR UPDATE`, [id]);
    if (invoiceRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    const invoice = invoiceRes.rows[0];
    const remaining = Number(invoice.total) - Number(invoice.amount_paid);

    if (amount > remaining) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Payment amount cannot exceed the remaining invoice balance." });
    }

    // Insert Payment
    const paymentDateVal = paymentDate ? new Date(paymentDate) : new Date();
    await client.query(`
      INSERT INTO public.payments (invoice_id, amount, payment_method, reference, payment_date, recorded_by)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [id, amount, paymentMethod || "Bank Transfer", reference || null, paymentDateVal, userId]);

    // Update Invoice Status
    const newAmountPaid = Number(invoice.amount_paid) + Number(amount);
    let newStatus = invoice.status;

    if (newAmountPaid >= Number(invoice.total)) {
      newStatus = 'PAID';
    } else if (newAmountPaid > 0) {
      newStatus = 'PARTIALLY_PAID';
    }

    // Checking overdue
    if (newStatus !== 'PAID' && new Date(invoice.due_date) < new Date()) {
      newStatus = 'OVERDUE';
    }

    await client.query(`
      UPDATE public.invoices 
      SET amount_paid = $1, status = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [newAmountPaid, newStatus, id]);

    await logAudit(client, userId, "PAYMENT_RECORDED", { invoiceId: id, amount, newStatus });

    await client.query("COMMIT");
    res.json({ success: true, message: "Payment recorded successfully", data: { newAmountPaid, newStatus } });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ success: false, message: "Error recording payment", error: error.message });
  } finally {
    client.release();
  }
};
