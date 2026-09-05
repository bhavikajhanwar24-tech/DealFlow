const db = require("../config/db");

const SALES_ROLES = ["SALES_REP", "SALES_MANAGER"];
const QUOTATION_STATUSES = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "NEGOTIATION", "CONFIRMED"];

function quotationError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function money(value) {
  return Number(Number(value).toFixed(2));
}

function formatCustomer(row) {
  return {
    id: row.id,
    customerCode: `CUST-${row.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`,
    fullName: row.full_name,
    email: row.email,
    companyName: row.company_name || ""
  };
}

async function getCustomers() {
  const result = await db.query(
    `SELECT id, full_name, email, company_name
     FROM public.users
     WHERE role = 'CUSTOMER' AND status = 'ACTIVE'
     ORDER BY company_name NULLS LAST, full_name`
  );
  return result.rows.map(formatCustomer);
}

async function getProducts() {
  const result = await db.query(
    `SELECT id, name, sku, category, description, unit_price, currency
     FROM public.products
     WHERE is_active = TRUE
     ORDER BY category, name`
  );
  return result.rows.map((product) => ({
    ...product,
    unitPrice: Number(product.unit_price)
  }));
}

async function getDashboardSummary(user) {
  const [quotations, approvals] = await Promise.all([
    db.query(
      `SELECT COUNT(*)::int AS count
       FROM public.quotations
       WHERE sales_rep_id = $1 AND status IN ('DRAFT', 'PENDING_APPROVAL', 'NEGOTIATION')`,
      [user.id]
    ),
    db.query(
      `SELECT COUNT(*)::int AS count
       FROM public.quotations
       WHERE sales_rep_id = $1 AND status = 'PENDING_APPROVAL'`,
      [user.id]
    )
  ]);

  return {
    pendingApprovals: approvals.rows[0].count,
    openQuotations: quotations.rows[0].count,
    atRiskDeals: 0
  };
}

function mapQuotation(row) {
  return {
    id: row.id,
    quotationNumber: row.quotation_number,
    status: row.status,
    subtotal: Number(row.subtotal),
    discountAmount: Number(row.discount_amount),
    finalAmount: Number(row.final_amount),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    customer: row.customer_id ? formatCustomer({
      id: row.customer_id,
      full_name: row.customer_name,
      email: row.customer_email,
      company_name: row.company_name
    }) : null,
    salesRep: row.sales_rep_id ? {
      id: row.sales_rep_id,
      fullName: row.sales_rep_name,
      email: row.sales_rep_email
    } : null
  };
}

const quotationSelect = `
  SELECT q.id, q.quotation_number, q.status, q.subtotal, q.discount_amount,
         q.final_amount, q.created_at, q.updated_at,
         customer.id AS customer_id, customer.full_name AS customer_name,
         customer.email AS customer_email, customer.company_name,
         sales_rep.id AS sales_rep_id, sales_rep.full_name AS sales_rep_name,
         sales_rep.email AS sales_rep_email
  FROM public.quotations q
  JOIN public.users customer ON customer.id = q.customer_id
  JOIN public.users sales_rep ON sales_rep.id = q.sales_rep_id
`;

async function listQuotations(user) {
  const params = [];
  let filter = "";
  if (SALES_ROLES.includes(user.role)) {
    params.push(user.id);
    filter = ` WHERE q.sales_rep_id = $${params.length}`;
  } else if (user.role === "CUSTOMER") {
    params.push(user.id);
    filter = ` WHERE q.customer_id = $${params.length}`;
  }

  const result = await db.query(`${quotationSelect}${filter} ORDER BY q.created_at DESC`, params);
  return result.rows.map(mapQuotation);
}

async function getQuotation(id, user) {
  const params = [id];
  let filter = "";
  if (SALES_ROLES.includes(user.role)) {
    params.push(user.id);
    filter = " AND q.sales_rep_id = $2";
  } else if (user.role === "CUSTOMER") {
    params.push(user.id);
    filter = " AND q.customer_id = $2";
  }

  const quotationResult = await db.query(`${quotationSelect} WHERE q.id = $1${filter}`, params);
  if (quotationResult.rows.length === 0) throw quotationError("Quotation not found.", 404);

  const itemResult = await db.query(
    `SELECT qi.id, qi.product_id, p.name, p.sku, p.category, qi.quantity,
            qi.unit_price, qi.discount_percent, qi.discount_amount, qi.line_total
     FROM public.quotation_items qi
     JOIN public.products p ON p.id = qi.product_id
     WHERE qi.quotation_id = $1
     ORDER BY qi.id`,
    [id]
  );

  return {
    ...mapQuotation(quotationResult.rows[0]),
    items: itemResult.rows.map((item) => ({
      id: item.id,
      productId: item.product_id,
      name: item.name,
      sku: item.sku,
      category: item.category,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      discountPercent: Number(item.discount_percent),
      discountAmount: Number(item.discount_amount),
      lineTotal: Number(item.line_total)
    }))
  };
}

async function createDraft(user, input) {
  if (!SALES_ROLES.includes(user.role)) {
    throw quotationError("Only Sales Representatives and Sales Managers can create quotations.", 403);
  }

  const customerId = input.customerId;
  const items = Array.isArray(input.items) ? input.items : [];
  if (!customerId) throw quotationError("Customer is required.");
  if (items.length === 0) throw quotationError("At least one product is required.");

  const seenProducts = new Set();
  const productIds = [];
  for (const item of items) {
    if (!item.productId || seenProducts.has(item.productId)) {
      throw quotationError("Each product can only appear once in a quotation.");
    }
    seenProducts.add(item.productId);
    const quantity = Number(item.quantity);
    const discountPercent = Number(item.discountPercent || 0);
    if (!Number.isInteger(quantity) || quantity <= 0) throw quotationError("Quantity must be a positive whole number.");
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      throw quotationError("Discount must be between 0 and 100 percent.");
    }
    productIds.push(item.productId);
  }

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    const customerResult = await client.query(
      "SELECT id FROM public.users WHERE id = $1 AND role = 'CUSTOMER' AND status = 'ACTIVE'",
      [customerId]
    );
    if (customerResult.rows.length === 0) throw quotationError("Selected customer is not available.", 404);

    const productsResult = await client.query(
      `SELECT id, name, sku, category, unit_price
       FROM public.products WHERE id = ANY($1::uuid[]) AND is_active = TRUE`,
      [productIds]
    );
    if (productsResult.rows.length !== productIds.length) throw quotationError("One or more selected products are unavailable.", 404);

    const productsById = new Map(productsResult.rows.map((product) => [product.id, product]));
    let subtotal = 0;
    let discountAmount = 0;
    const calculatedItems = items.map((item) => {
      const product = productsById.get(item.productId);
      const quantity = Number(item.quantity);
      const discountPercent = Number(item.discountPercent || 0);
      const unitPrice = Number(product.unit_price);
      const lineSubtotal = money(unitPrice * quantity);
      const lineDiscount = money(lineSubtotal * discountPercent / 100);
      const lineTotal = money(lineSubtotal - lineDiscount);
      subtotal += lineSubtotal;
      discountAmount += lineDiscount;
      return { product, quantity, unitPrice, discountPercent, lineDiscount, lineTotal };
    });
    subtotal = money(subtotal);
    discountAmount = money(discountAmount);
    const finalAmount = money(subtotal - discountAmount);

    const numberResult = await client.query(
      `SELECT COUNT(*)::int + 1 AS next_number
       FROM public.quotations WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`
    );
    const quotationNumber = `QT-${new Date().getFullYear()}-${String(numberResult.rows[0].next_number).padStart(4, "0")}`;

    const quotationResult = await client.query(
      `INSERT INTO public.quotations
       (quotation_number, customer_id, sales_rep_id, status, subtotal, discount_amount, final_amount)
       VALUES ($1, $2, $3, 'DRAFT', $4, $5, $6)
       RETURNING id`,
      [quotationNumber, customerId, user.id, subtotal, discountAmount, finalAmount]
    );
    const quotationId = quotationResult.rows[0].id;

    for (const item of calculatedItems) {
      await client.query(
        `INSERT INTO public.quotation_items
         (quotation_id, product_id, quantity, unit_price, discount_percent, discount_amount, line_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [quotationId, item.product.id, item.quantity, item.unitPrice, item.discountPercent, item.lineDiscount, item.lineTotal]
      );
    }

    await client.query("COMMIT");
    return getQuotation(quotationId, user);
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") throw quotationError("A quotation number conflict occurred. Please try again.", 409);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getCustomers,
  getProducts,
  getDashboardSummary,
  listQuotations,
  getQuotation,
  createDraft,
  QUOTATION_STATUSES
};
