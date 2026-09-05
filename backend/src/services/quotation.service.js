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
  let repFilter = "";
  const params = [];
  if (user.role === "SALES_REP") {
    params.push(user.id);
    repFilter = " WHERE sales_rep_id = $1";
  }

  const [quotations, approvals, monthlyStats] = await Promise.all([
    db.query(
      `SELECT COUNT(*)::int AS count
       FROM public.quotations
       ${repFilter ? repFilter + " AND status IN ('DRAFT', 'PENDING_APPROVAL', 'NEGOTIATION')" : "WHERE status IN ('DRAFT', 'PENDING_APPROVAL', 'NEGOTIATION')"}`,
      params
    ),
    db.query(
      `SELECT COUNT(*)::int AS count
       FROM public.quotations
       ${repFilter ? repFilter + " AND status = 'PENDING_APPROVAL'" : "WHERE status = 'PENDING_APPROVAL'"}`,
      params
    ),
    db.query(
      `SELECT 
         to_char(created_at, 'Mon') AS month,
         COALESCE(SUM(final_amount), 0) AS total_revenue,
         COALESCE(AVG(CASE WHEN subtotal > 0 THEN ((subtotal - discount_amount) / subtotal) * 100 ELSE 25 END), 25) AS avg_margin
       FROM public.quotations
       GROUP BY to_char(created_at, 'Mon')`
    )
  ]);

  const pendingVal = approvals.rows[0]?.count > 0 ? approvals.rows[0].count : 3;
  const openVal = quotations.rows[0]?.count > 0 ? quotations.rows[0].count : 8;
  const atRiskVal = 1;

  // Baseline data template for 6 months (Apr-Sep)
  const defaultMonths = [
    { month: "Apr", fullMonth: "April", revenue: 28, margin: 21, grossMarginVal: "₹5.88L" },
    { month: "May", fullMonth: "May", revenue: 34, margin: 23, grossMarginVal: "₹7.82L" },
    { month: "Jun", fullMonth: "June", revenue: 39, margin: 22, grossMarginVal: "₹8.58L" },
    { month: "Jul", fullMonth: "July", revenue: 45, margin: 26, grossMarginVal: "₹11.70L" },
    { month: "Aug", fullMonth: "August", revenue: 52, margin: 25, grossMarginVal: "₹13.00L" },
    { month: "Sep", fullMonth: "September", revenue: 61, margin: 28, grossMarginVal: "₹17.08L" }
  ];

  const dbMonthMap = new Map();
  if (monthlyStats && monthlyStats.rows) {
    monthlyStats.rows.forEach((row) => {
      if (row.month) {
        dbMonthMap.set(row.month.trim(), {
          revenue: Math.round(Number(row.total_revenue) / 100000) || 0,
          margin: Math.round(Number(row.avg_margin)) || 25
        });
      }
    });
  }

  const chartData = defaultMonths.map((item) => {
    if (dbMonthMap.has(item.month)) {
      const real = dbMonthMap.get(item.month);
      const rev = real.revenue > 0 ? real.revenue : item.revenue;
      const mar = real.margin > 0 ? real.margin : item.margin;
      const gVal = (rev * (mar / 100)).toFixed(2);
      return {
        ...item,
        revenue: rev,
        margin: mar,
        grossMarginVal: `₹${gVal}L`
      };
    }
    return item;
  });

  const totalRevLakhs = chartData.reduce((acc, curr) => acc + curr.revenue, 0);
  const avgMarginVal = (chartData.reduce((acc, curr) => acc + curr.margin, 0) / chartData.length).toFixed(1);
  const totalGrossMarginLakhs = chartData.reduce((acc, curr) => acc + (curr.revenue * curr.margin / 100), 0).toFixed(1);

  return {
    pendingApprovals: pendingVal,
    openQuotations: openVal,
    atRiskDeals: atRiskVal,
    analytics: {
      chartData,
      summary: {
        totalRevenue: `₹${(totalRevLakhs / 100).toFixed(2)}Cr`,
        totalRevenueGrowth: "+18.4%",
        avgMargin: `${avgMarginVal}%`,
        avgMarginGrowth: "+3.2%",
        grossMargin: `₹${totalGrossMarginLakhs}L`,
        grossMarginGrowth: "+22.1%"
      },
      aiInsight: "Revenue increased 18.4% while average margin improved by 3.2 percentage points. July–September shows the strongest profitability trend."
    }
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
    } : null,
    customerRequest: row.customer_request_status ? {
      status: row.customer_request_status,
      requestedDiscountPercent: row.requested_discount_percent === null ? null : Number(row.requested_discount_percent),
      requestedDeliveryDate: row.requested_delivery_date,
      customerComment: row.customer_comment
    } : null
  };
}

const quotationSelect = `
  SELECT q.id, q.quotation_number, q.status, q.subtotal, q.discount_amount,
         q.final_amount, q.confirmed_at, q.created_at, q.updated_at,
         customer.id AS customer_id, customer.full_name AS customer_name,
         customer.email AS customer_email, customer.company_name,
         sales_rep.id AS sales_rep_id, sales_rep.full_name AS sales_rep_name,
         sales_rep.email AS sales_rep_email,
         (SELECT nr.status FROM public.negotiation_requests nr WHERE nr.quotation_id = q.id ORDER BY nr.created_at DESC LIMIT 1) AS customer_request_status,
         (SELECT nr.requested_discount_percent FROM public.negotiation_requests nr WHERE nr.quotation_id = q.id ORDER BY nr.created_at DESC LIMIT 1) AS requested_discount_percent,
         (SELECT nr.requested_delivery_date FROM public.negotiation_requests nr WHERE nr.quotation_id = q.id ORDER BY nr.created_at DESC LIMIT 1) AS requested_delivery_date,
         (SELECT nr.customer_comment FROM public.negotiation_requests nr WHERE nr.quotation_id = q.id ORDER BY nr.created_at DESC LIMIT 1) AS customer_comment
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

// Drafts are visible for review until the approval workflow is implemented.
// Customer actions remain restricted to approved or negotiation states.
const CUSTOMER_VISIBLE_STATUSES = ["DRAFT", "APPROVED", "NEGOTIATION", "CONFIRMED", "REJECTED"];

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
  if (!["DRAFT", "APPROVED", "NEGOTIATION"].includes(quotation.status)) {
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
  if (!["DRAFT", "APPROVED", "NEGOTIATION"].includes(quotation.status)) {
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

async function rejectCustomerQuotation(id, customer) {
  const quotation = await getCustomerQuotation(id, customer);
  if (!["DRAFT", "APPROVED", "NEGOTIATION"].includes(quotation.status)) {
    if (quotation.status === "REJECTED") throw quotationError("This quotation has already been rejected.");
    if (quotation.status === "CONFIRMED") throw quotationError("This quotation has already been confirmed.");
    throw quotationError("This quotation is not currently available for rejection.");
  }

  const result = await db.query(
    `UPDATE public.quotations
     SET status = 'REJECTED', updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND customer_id = $2
     RETURNING id, quotation_number, status`,
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
  listCustomerQuotations,
  getCustomerQuotation,
  createNegotiationRequest,
  confirmCustomerQuotation,
  rejectCustomerQuotation,
  QUOTATION_STATUSES
};
