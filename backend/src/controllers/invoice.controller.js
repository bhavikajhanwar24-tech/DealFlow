const pool = require("../config/db");
const { generateInvoicePDF } = require("../services/pdf.service");

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
    const orderId = req.params.orderId || req.body.orderId;
    const userId = req.user?.id;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "Order ID is required to generate an invoice." });
    }

    // Check if order exists and if invoice already generated (Duplicate Protection)
    const checkInvoice = await client.query(`
      SELECT i.*, o.order_number, q.quotation_number, u.full_name as customer_name, u.company_name
      FROM public.invoices i
      JOIN public.orders o ON i.order_id = o.id
      LEFT JOIN public.quotations q ON i.quotation_id = q.id
      JOIN public.users u ON i.customer_id = u.id
      WHERE i.order_id = $1
    `, [orderId]);

    if (checkInvoice.rows.length > 0) {
      const existingInvoice = checkInvoice.rows[0];
      const itemsRes = await client.query(`SELECT * FROM public.invoice_items WHERE invoice_id = $1`, [existingInvoice.id]);
      return res.status(200).json({
        success: true,
        message: "Invoice already exists for this order.",
        data: {
          ...existingInvoice,
          items: itemsRes.rows,
        },
      });
    }

    // Retrieve order, quotation, billing configuration, customer details, and shipping allocations
    const orderRes = await client.query(`
      SELECT o.*, 
             q.id as quotation_id, q.quotation_number, q.subtotal as quote_subtotal, 
             q.discount_amount as quote_discount, q.final_amount as quote_final,
             q.sales_rep_id,
             u.id as cust_id, u.full_name as customer_name, u.email as customer_email, 
             u.company_name, u.customer_tier,
             b.currency, b.tax_enabled, b.default_tax_rate, b.invoice_prefix, b.invoice_due_period, b.payment_terms
      FROM public.orders o
      JOIN public.quotations q ON o.quotation_id = q.id
      JOIN public.users u ON o.customer_id = u.id
      CROSS JOIN public.billing_configuration b
      WHERE o.id = $1
    `, [orderId]);

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Order not found. Cannot generate invoice." });
    }

    const order = orderRes.rows[0];

    // Verify order fulfillment / confirmation state
    const validFulfillmentStates = ["READY", "OPTIMAL_APPROVED", "MANUAL_SPLIT", "COMPLETED", "PARTIAL_BACKORDER"];
    const isOrderConfirmed = ["CONFIRMED", "COMPLETED", "PROCESSING"].includes(order.status);

    if (!isOrderConfirmed && !validFulfillmentStates.includes(order.fulfillment_status)) {
      return res.status(400).json({
        success: false,
        message: "Invoice can only be generated after customer confirms quotation and order is in active fulfillment.",
      });
    }

    // Retrieve quotation items to capture exact confirmed prices and create snapshot
    const quoteItemsRes = await client.query(`
      SELECT qi.*, p.name as product_name, p.sku, p.description, p.category
      FROM public.quotation_items qi
      JOIN public.products p ON qi.product_id = p.id
      WHERE qi.quotation_id = $1
    `, [order.quotation_id]);

    if (quoteItemsRes.rows.length === 0) {
      return res.status(400).json({ success: false, message: "Order has no line items. Cannot generate invoice." });
    }

    // Calculate shipping from fulfillment allocations if any
    const shippingRes = await client.query(`
      SELECT COALESCE(SUM(shipping_cost), 0)::numeric as total_shipping
      FROM public.fulfillment_allocations
      WHERE order_id = $1
    `, [orderId]);
    const shippingAmount = Number(shippingRes.rows[0]?.total_shipping || 0);

    // Calculate itemized line totals and tax
    const taxRate = order.tax_enabled ? Number(order.default_tax_rate || 18) : 0;
    let subtotal = 0;
    let totalDiscount = 0;

    const preparedItems = quoteItemsRes.rows.map((item) => {
      const qty = Number(item.quantity);
      const unitPrice = Number(item.unit_price);
      const lineSubtotal = qty * unitPrice;
      const discPercent = Number(item.discount_percent || 0);
      const discAmount = Number(item.discount_amount || (lineSubtotal * discPercent) / 100);
      const lineTaxable = Math.max(0, lineSubtotal - discAmount);
      const lineTax = (lineTaxable * taxRate) / 100;
      const lineTotal = lineTaxable + lineTax;

      subtotal += lineSubtotal;
      totalDiscount += discAmount;

      return {
        product_id: item.product_id,
        product_name: item.product_name,
        sku: item.sku,
        description: item.description,
        quantity: qty,
        unit_price: unitPrice,
        discount_percent: discPercent,
        discount_amount: discAmount,
        tax_rate: taxRate,
        tax_amount: lineTax,
        line_total: lineTotal,
      };
    });

    const taxableAmount = Math.max(0, subtotal - totalDiscount);
    const taxAmount = (taxableAmount * taxRate) / 100;
    const grandTotal = taxableAmount + taxAmount + shippingAmount;
    const amountDue = grandTotal;

    // Generate safe sequential invoice number
    const year = new Date().getFullYear();
    const countRes = await client.query(`
      SELECT COUNT(*)::int as count FROM public.invoices
      WHERE EXTRACT(YEAR FROM created_at) = $1
    `, [year]);
    const nextSeq = Number(countRes.rows[0]?.count || 0) + 1;
    const prefix = order.invoice_prefix || "INV-";
    const invoiceNumber = `${prefix}${year}-${String(nextSeq).padStart(6, "0")}`;

    // Due date calculation
    const dueDays = Number(order.invoice_due_period || 30);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDays);

    // Prepare Address & Historical Snapshots
    const billingAddressSnapshot = {
      address: order.delivery_address || "Corporate Billing Address",
      city: order.delivery_city || "Bengaluru",
      state: order.delivery_state || "Karnataka",
      zip: order.delivery_zip || "560001",
      country: order.delivery_country || "India",
    };

    const shippingAddressSnapshot = {
      recipientName: order.customer_name,
      address: order.delivery_address || "Customer Delivery Address",
      city: order.delivery_city || "",
      state: order.delivery_state || "",
      zip: order.delivery_zip || "",
      country: order.delivery_country || "India",
      latitude: order.delivery_latitude,
      longitude: order.delivery_longitude,
    };

    const companySnapshot = {
      name: "DealFlow360 Enterprise Solutions Pvt. Ltd.",
      address: "Tower 4, Prime Tech Park, Outer Ring Road, Bangalore - 560103, India",
      email: "billing@dealflow360.com",
      phone: "+91 80 4900 1200",
      gstin: "29AABCD8901E1ZR",
      currency: order.currency || "INR",
    };

    const customerSnapshot = {
      id: order.cust_id,
      name: order.customer_name,
      company: order.company_name || order.customer_name,
      email: order.customer_email,
      tier: order.customer_tier,
    };

    await client.query("BEGIN");

    // Insert Invoice Master Record
    const insertInvoice = await client.query(`
      INSERT INTO public.invoices 
        (invoice_number, order_id, quotation_id, customer_id, 
         subtotal, discount, taxable_amount, tax, tax_amount, shipping_amount, 
         other_charges, total, grand_total, amount_paid, amount_due, 
         status, due_date, billing_address, shipping_address, company_snapshot, 
         customer_snapshot, payment_terms, notes)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING *
    `, [
      invoiceNumber,
      order.id,
      order.quotation_id,
      order.cust_id,
      subtotal,
      totalDiscount,
      taxableAmount,
      taxAmount,
      taxAmount,
      shippingAmount,
      0,
      grandTotal,
      grandTotal,
      0,
      amountDue,
      "ISSUED",
      dueDate,
      JSON.stringify(billingAddressSnapshot),
      JSON.stringify(shippingAddressSnapshot),
      JSON.stringify(companySnapshot),
      JSON.stringify(customerSnapshot),
      order.payment_terms || "NET_30",
      "Thank you for your business. Please remit payment by the due date.",
    ]);

    const createdInvoice = insertInvoice.rows[0];

    // Insert Invoice Line Items
    const insertedItems = [];
    for (const item of preparedItems) {
      const itemRes = await client.query(`
        INSERT INTO public.invoice_items
          (invoice_id, product_id, product_name, sku, description, quantity, 
           unit_price, discount_percent, discount_amount, tax_rate, tax_amount, line_total)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        createdInvoice.id,
        item.product_id,
        item.product_name,
        item.sku,
        item.description,
        item.quantity,
        item.unit_price,
        item.discount_percent,
        item.discount_amount,
        item.tax_rate,
        item.tax_amount,
        item.line_total,
      ]);
      insertedItems.push(itemRes.rows[0]);
    }

    await logAudit(client, userId, "INVOICE_GENERATED", {
      invoiceId: createdInvoice.id,
      invoiceNumber,
      orderId: order.id,
      customerName: order.customer_name,
      grandTotal,
    });

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: `Invoice ${invoiceNumber} generated successfully.`,
      data: {
        ...createdInvoice,
        order_number: order.order_number,
        quotation_number: order.quotation_number,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        items: insertedItems,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error generating invoice:", error);
    res.status(500).json({ success: false, message: "Error generating invoice", error: error.message });
  } finally {
    client.release();
  }
};

// 2. List all invoices with role-based filtering
exports.getInvoices = async (req, res) => {
  try {
    const user = req.user;
    const { status, search } = req.query;

    let query = `
      SELECT i.*, 
             o.order_number, 
             q.quotation_number,
             u.full_name as customer_name, 
             u.company_name, 
             u.email as customer_email
      FROM public.invoices i
      JOIN public.orders o ON i.order_id = o.id
      LEFT JOIN public.quotations q ON i.quotation_id = q.id
      JOIN public.users u ON i.customer_id = u.id
      WHERE 1=1
    `;
    const params = [];

    // Role-based security:
    // Customers only see their own invoices
    if (user.role === "CUSTOMER") {
      params.push(user.id);
      query += ` AND i.customer_id = $${params.length}`;
    } else if (user.role === "SALES_REP") {
      // Sales reps see invoices for their quotations or assigned customers
      params.push(user.id);
      query += ` AND (q.sales_rep_id = $${params.length} OR i.customer_id = $${params.length})`;
    }

    if (status && status !== "ALL") {
      params.push(status);
      query += ` AND i.status = $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      const pIdx = params.length;
      query += ` AND (LOWER(i.invoice_number) LIKE $${pIdx} OR LOWER(o.order_number) LIKE $${pIdx} OR LOWER(u.full_name) LIKE $${pIdx} OR LOWER(u.company_name) LIKE $${pIdx})`;
    }

    query += ` ORDER BY i.created_at DESC`;

    const invoices = await pool.query(query, params);
    res.json({ success: true, data: invoices.rows });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ success: false, message: "Error fetching invoices", error: error.message });
  }
};

// 3. Get invoice details with line items and payments
exports.getInvoiceDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const invoiceRes = await pool.query(`
      SELECT i.*, 
             o.order_number, 
             q.quotation_number,
             u.full_name as customer_name, 
             u.company_name, 
             u.email as customer_email
      FROM public.invoices i
      JOIN public.orders o ON i.order_id = o.id
      LEFT JOIN public.quotations q ON i.quotation_id = q.id
      JOIN public.users u ON i.customer_id = u.id
      WHERE i.id = $1
    `, [id]);

    if (invoiceRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Invoice not found." });
    }

    const invoice = invoiceRes.rows[0];

    // Security check for Customers
    if (user.role === "CUSTOMER" && invoice.customer_id !== user.id) {
      return res.status(403).json({ success: false, message: "Access denied. You can only view your own invoices." });
    }

    // Fetch line items
    const itemsRes = await pool.query(`
      SELECT * FROM public.invoice_items
      WHERE invoice_id = $1
      ORDER BY product_name ASC
    `, [id]);

    // Fetch payment records
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
        ...invoice,
        items: itemsRes.rows,
        payments: paymentsRes.rows,
      },
    });
  } catch (error) {
    console.error("Error fetching invoice details:", error);
    res.status(500).json({ success: false, message: "Error fetching invoice details", error: error.message });
  }
};

// 4. Download / Generate PDF
exports.downloadInvoicePDF = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const invoiceRes = await pool.query(`
      SELECT i.*, 
             o.order_number, 
             q.quotation_number,
             u.full_name as customer_name, 
             u.company_name, 
             u.email as customer_email
      FROM public.invoices i
      JOIN public.orders o ON i.order_id = o.id
      LEFT JOIN public.quotations q ON i.quotation_id = q.id
      JOIN public.users u ON i.customer_id = u.id
      WHERE i.id = $1
    `, [id]);

    if (invoiceRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Invoice not found." });
    }

    const invoice = invoiceRes.rows[0];

    // Customer security check
    if (user.role === "CUSTOMER" && invoice.customer_id !== user.id) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    const itemsRes = await pool.query(`
      SELECT * FROM public.invoice_items
      WHERE invoice_id = $1
      ORDER BY product_name ASC
    `, [id]);

    const paymentsRes = await pool.query(`
      SELECT p.*, u.full_name as recorded_by_name
      FROM public.payments p
      LEFT JOIN public.users u ON p.recorded_by = u.id
      WHERE p.invoice_id = $1
      ORDER BY p.payment_date DESC
    `, [id]);

    const completeInvoice = {
      ...invoice,
      items: itemsRes.rows,
      payments: paymentsRes.rows,
    };

    const pdfBuffer = await generateInvoicePDF(completeInvoice);

    // Audit log
    await pool.query(
      `INSERT INTO public.audit_logs (user_id, action, details) VALUES ($1, $2, $3)`,
      [user.id, "INVOICE_DOWNLOADED", JSON.stringify({ invoiceId: id, invoiceNumber: invoice.invoice_number })]
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoice_number}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating PDF invoice:", error);
    res.status(500).json({ success: false, message: "Error generating PDF invoice", error: error.message });
  }
};

// 5. Record Payment
exports.recordPayment = async (req, res) => {
  const client = await pool.pool.connect();
  try {
    const { id } = req.params;
    const { amount, paymentMethod, reference, paymentDate } = req.body;
    const userId = req.user?.id;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: "Payment amount must be greater than 0." });
    }

    await client.query("BEGIN");

    const invoiceRes = await client.query(`SELECT * FROM public.invoices WHERE id = $1 FOR UPDATE`, [id]);
    if (invoiceRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Invoice not found." });
    }

    const invoice = invoiceRes.rows[0];
    const totalAmount = Number(invoice.total || invoice.grand_total || 0);
    const currentPaid = Number(invoice.amount_paid || 0);
    const remaining = totalAmount - currentPaid;

    if (Number(amount) > remaining + 0.01) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Payment amount (INR ${amount}) cannot exceed remaining balance (INR ${remaining.toFixed(2)}).`,
      });
    }

    // Insert Payment Record
    const paymentDateVal = paymentDate ? new Date(paymentDate) : new Date();
    await client.query(`
      INSERT INTO public.payments (invoice_id, amount, payment_method, reference, payment_date, recorded_by)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [id, Number(amount), paymentMethod || "Bank Transfer", reference || null, paymentDateVal, userId]);

    // Compute updated balances and status
    const newAmountPaid = currentPaid + Number(amount);
    const newAmountDue = Math.max(0, totalAmount - newAmountPaid);
    let newStatus = invoice.status;

    if (newAmountPaid >= totalAmount - 0.01) {
      newStatus = "PAID";
    } else if (newAmountPaid > 0) {
      newStatus = "PARTIALLY_PAID";
    }

    // Check overdue condition
    if (newStatus !== "PAID" && new Date(invoice.due_date) < new Date()) {
      newStatus = "OVERDUE";
    }

    await client.query(`
      UPDATE public.invoices 
      SET amount_paid = $1, amount_due = $2, status = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [newAmountPaid, newAmountDue, newStatus, id]);

    await logAudit(client, userId, "PAYMENT_RECORDED", {
      invoiceId: id,
      invoiceNumber: invoice.invoice_number,
      paymentAmount: Number(amount),
      newAmountPaid,
      newStatus,
    });

    await client.query("COMMIT");

    res.json({
      success: true,
      message: `Payment of INR ${Number(amount).toFixed(2)} recorded successfully.`,
      data: {
        amountPaid: newAmountPaid,
        amountDue: newAmountDue,
        status: newStatus,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error recording payment:", error);
    res.status(500).json({ success: false, message: "Error recording payment", error: error.message });
  } finally {
    client.release();
  }
};

// 6. Get Dynamic Finance Summary / KPIs from database
exports.getFinanceSummary = async (req, res) => {
  try {
    const summaryRes = await pool.query(`
      SELECT 
        COALESCE(COUNT(*), 0)::int as total_invoices,
        COALESCE(SUM(total), 0)::numeric as total_invoiced,
        COALESCE(SUM(amount_paid), 0)::numeric as total_paid,
        COALESCE(SUM(CASE WHEN status != 'PAID' THEN (total - amount_paid) ELSE 0 END), 0)::numeric as total_outstanding,
        COALESCE(SUM(CASE WHEN status = 'OVERDUE' OR (status != 'PAID' AND due_date < CURRENT_DATE) THEN (total - amount_paid) ELSE 0 END), 0)::numeric as overdue_amount,
        COALESCE(COUNT(CASE WHEN status = 'PAID' THEN 1 END), 0)::int as paid_count,
        COALESCE(COUNT(CASE WHEN status = 'PARTIALLY_PAID' OR status = 'ISSUED' THEN 1 END), 0)::int as pending_count,
        COALESCE(COUNT(CASE WHEN status = 'OVERDUE' OR (status != 'PAID' AND due_date < CURRENT_DATE) THEN 1 END), 0)::int as overdue_count
      FROM public.invoices
    `);

    res.json({
      success: true,
      data: summaryRes.rows[0] || {
        total_invoices: 0,
        total_invoiced: 0,
        total_paid: 0,
        total_outstanding: 0,
        overdue_amount: 0,
        paid_count: 0,
        pending_count: 0,
        overdue_count: 0,
      },
    });
  } catch (error) {
    console.error("Error fetching finance summary:", error);
    res.status(500).json({ success: false, message: "Error fetching finance summary", error: error.message });
  }
};
