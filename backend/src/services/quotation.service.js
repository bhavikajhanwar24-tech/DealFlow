const db = require("../config/db");

const SALES_ROLES = ["SALES_REP", "SALES_MANAGER"];
const QUOTATION_STATUSES = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "NEGOTIATION", "CONFIRMED"];
const RISK_ENGINE_URL = process.env.RISK_ENGINE_URL || "http://127.0.0.1:8001";
const CATEGORY_CEILINGS = {
  HARDWARE: 0.10,
  SERVICE: 0.08,
  SERVICES: 0.08,
  SUBSCRIPTION: 0.12,
  SOFTWARE: 0.12,
};

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
    confirmedAt: row.confirmed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    risk: row.risk_score === null || row.risk_score === undefined ? null : {
      score: Number(row.risk_score),
      level: row.risk_level,
      approvalRoute: row.approval_route,
      factors: row.risk_factors || [],
      analysis: row.risk_analysis || null,
      analyzedAt: row.risk_analyzed_at,
    },
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
         q.final_amount, q.confirmed_at, q.created_at, q.updated_at,
         q.risk_score, q.risk_level, q.approval_route, q.risk_factors,
         q.risk_analysis, q.risk_analyzed_at,
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
        `SELECT qi.id, qi.product_id, p.name, p.sku, p.category, p.cost, qi.quantity,
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
      cost: Number(item.cost || 0),
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

async function submitQuotation(user, quotationId) {
  const quotation = await getQuotation(quotationId, user);
  if (quotation.status !== "DRAFT") {
    throw quotationError("Only draft quotations can be submitted for risk analysis.");
  }

  const grossValue = quotation.subtotal;
  const netValue = quotation.finalAmount;
  const totalCost = quotation.items.reduce((sum, item) => sum + item.cost * item.quantity, 0);
  const marginDeal = netValue > 0 ? Math.max(0, Math.min(1, (netValue - totalCost) / netValue)) : 0;
  const dealAverageDiscount = grossValue > 0 ? quotation.discountAmount / grossValue : 0;
  const request = {
    dealId: quotation.id,
    customerTier: "STANDARD",
    repAverageDiscount: 0,
    dealAverageDiscount,
    marginDeal,
    lines: quotation.items.map((item) => ({
      productId: item.sku || item.productId,
      category: item.category,
      discount: item.discountPercent / 100,
      grossValue: item.unitPrice * item.quantity,
      categoryCeiling: CATEGORY_CEILINGS[item.category] || 0.10,
      tierCeiling: 0.10,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
    })),
  };

  let response;
  try {
    response = await fetch(`${RISK_ENGINE_URL}/api/ai/risk/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch (error) {
    throw quotationError(
      "Risk engine unavailable. Start it with `npm run risk:dev` from the backend folder, then submit again.",
      503,
    );
  }

  const analysis = await response.json();
  if (!response.ok) {
    throw quotationError(analysis.detail || "Risk engine rejected the quotation data.", 422);
  }

  await db.query(`
    UPDATE public.quotations
    SET status = 'PENDING_APPROVAL',
        risk_score = $1,
        risk_level = $2,
        approval_route = $3,
        risk_factors = $4,
        risk_analysis = $5,
        risk_analyzed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $6
  `, [
    Number(analysis.riskScore),
    analysis.riskLevel,
    analysis.governanceRoute,
    JSON.stringify(analysis.factors || []),
    JSON.stringify({ request, response: analysis, marginDeal, totalCost }),
    quotationId,
  ]);

  return getQuotation(quotationId, user);
}

// Drafts are visible for review until the approval workflow is implemented.
// Customer actions remain restricted to approved or negotiation states.
const CUSTOMER_VISIBLE_STATUSES = ["DRAFT", "APPROVED", "NEGOTIATION", "CONFIRMED"];

async function listCustomerQuotations(customer) {
  const result = await db.query(
    `${quotationSelect}
     WHERE q.customer_id = $1 AND q.status = ANY($2::text[])
     ORDER BY q.created_at DESC`,
    [customer.id, CUSTOMER_VISIBLE_STATUSES],
  );
  return result.rows.map(mapQuotation);
}

async function getCustomerQuotation(id, customer) {
  const ownership = await db.query("SELECT customer_id FROM public.quotations WHERE id = $1", [id]);
  if (ownership.rows.length > 0 && ownership.rows[0].customer_id !== customer.id) {
    throw quotationError("You do not have permission to access this quotation.", 403);
  }
  const quotation = await getQuotation(id, { ...customer, role: "CUSTOMER" });
  if (!CUSTOMER_VISIBLE_STATUSES.includes(quotation.status)) {
    throw quotationError("Quotation not found.", 404);
  }

  const negotiationResult = await db.query(
    `SELECT id, requested_discount_percent, requested_delivery_date,
            customer_comment, status, created_at, updated_at
     FROM public.negotiation_requests
     WHERE quotation_id = $1 AND customer_id = $2
     ORDER BY created_at DESC`,
    [id, customer.id],
  );
  return {
    ...quotation,
    negotiations: negotiationResult.rows.map((request) => ({
      id: request.id,
      requestedDiscountPercent: request.requested_discount_percent === null ? null : Number(request.requested_discount_percent),
      requestedDeliveryDate: request.requested_delivery_date,
      customerComment: request.customer_comment,
      status: request.status,
      createdAt: request.created_at,
      updatedAt: request.updated_at,
    })),
  };
}

async function createNegotiationRequest(id, customer, input) {
  const quotation = await getCustomerQuotation(id, customer);
  if (!["APPROVED", "NEGOTIATION"].includes(quotation.status)) {
    throw quotationError("This quotation is not currently available for negotiation.");
  }
  if (quotation.negotiations.some((request) => request.status === "PENDING")) {
    throw quotationError("A negotiation request is already pending for this quotation.");
  }

  const hasDiscount = input.requestedDiscountPercent !== undefined && input.requestedDiscountPercent !== null && input.requestedDiscountPercent !== "";
  const requestedDiscountPercent = hasDiscount ? Number(input.requestedDiscountPercent) : null;
  if (hasDiscount && (!Number.isFinite(requestedDiscountPercent) || requestedDiscountPercent < 0 || requestedDiscountPercent > 100)) {
    throw quotationError("Counter discount must be between 0 and 100 percent.");
  }
  const deliveryDate = input.requestedDeliveryDate || null;
  if (deliveryDate && Number.isNaN(Date.parse(deliveryDate))) {
    throw quotationError("Requested delivery date is invalid.");
  }

  const result = await db.query(
    `INSERT INTO public.negotiation_requests
     (quotation_id, customer_id, requested_discount_percent, requested_delivery_date, customer_comment)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, requested_discount_percent, requested_delivery_date, customer_comment, status, created_at`,
    [id, customer.id, requestedDiscountPercent, deliveryDate, input.customerComment?.trim() || null],
  );
  await db.query(
    `UPDATE public.quotations SET status = 'NEGOTIATION', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND customer_id = $2`,
    [id, customer.id],
  );
  return result.rows[0];
}

async function confirmCustomerQuotation(id, customer) {
  const quotation = await getCustomerQuotation(id, customer);
  if (!["APPROVED", "NEGOTIATION"].includes(quotation.status)) {
    if (quotation.status === "CONFIRMED") throw quotationError("This quotation has already been confirmed.");
    throw quotationError("This quotation is not currently available for confirmation.");
  }

  const result = await db.query(
    `UPDATE public.quotations
     SET status = 'CONFIRMED', confirmed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND customer_id = $2
     RETURNING id, quotation_number, status, confirmed_at`,
    [id, customer.id],
  );
  return result.rows[0];
}

module.exports = {
  getCustomers,
  getProducts,
  getDashboardSummary,
  listQuotations,
  getQuotation,
  createDraft,
  submitQuotation,
  listCustomerQuotations,
  getCustomerQuotation,
  createNegotiationRequest,
  confirmCustomerQuotation,
  QUOTATION_STATUSES
};
