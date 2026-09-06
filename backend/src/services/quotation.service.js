const db = require("../config/db");
const fulfillmentService = require("./fulfillment.service");
const emailService = require("./email.service");

const SALES_ROLES = ["SALES_REP", "SALES_MANAGER", "ADMIN"];
const QUOTATION_STATUSES = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "NEGOTIATION", "CONFIRMED", "FINALIZED"];
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
    `SELECT id, name, sku, category, description, unit_price, cost, currency
     FROM public.products
     WHERE is_active = TRUE
     ORDER BY category, name`
  );
  return result.rows.map((product) => ({
    ...product,
    unitPrice: Number(product.unit_price),
    costPrice: Number(product.cost)
  }));
}

async function createCustomerQuoteRequest(customer, input) {
  const items = Array.isArray(input.items) ? input.items : [];
  if (!items.length) throw quotationError("Add at least one product to your request.");
  if (new Set(items.map((item) => item.productId)).size !== items.length) {
    throw quotationError("Each product can only be requested once.");
  }

  const deliveryDate = input.requestedDeliveryDate || null;
  if (deliveryDate && Number.isNaN(Date.parse(deliveryDate))) {
    throw quotationError("Requested delivery date is invalid.");
  }

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const productIds = items.map((item) => item.productId);
    const productsRes = await client.query(
      "SELECT id, name, unit_price, cost, category, sku FROM public.products WHERE id = ANY($1::uuid[]) AND is_active = TRUE",
      [productIds],
    );
    if (productsRes.rows.length !== productIds.length) {
      throw quotationError("One or more selected products are unavailable.", 404);
    }

    let totalQuantity = 0;
    for (const item of items) {
      const q = Number(item.quantity);
      if (!Number.isInteger(q) || q <= 0) {
        throw quotationError("Each quantity must be a positive whole number.");
      }
      totalQuantity += q;
    }

    const comment = input.customerComment?.trim() || "";
    const lowerComment = comment.toLowerCase();

    // Auto-approval rule: Standard quantity (<= 10 items) and no custom discount requests
    const needsManualReview =
      totalQuantity > 10 ||
      lowerComment.includes("discount") ||
      lowerComment.includes("negotiat") ||
      lowerComment.includes("special") ||
      lowerComment.includes("concession") ||
      lowerComment.includes("bulk price");

    const initialStatus = needsManualReview ? "PENDING" : "AUTO_APPROVED";

    const requestResult = await client.query(
      `INSERT INTO public.customer_quote_requests
       (customer_id, requested_delivery_date, customer_comment, status)
       VALUES ($1, $2, $3, $4) RETURNING id, status, created_at`,
      [customer.id, deliveryDate, comment || null, initialStatus],
    );
    const requestId = requestResult.rows[0].id;

    for (const item of items) {
      await client.query(
        `INSERT INTO public.customer_quote_request_items (request_id, product_id, quantity)
         VALUES ($1, $2, $3)`,
        [requestId, item.productId, Number(item.quantity)],
      );
    }

    let createdQuotation = null;

    if (!needsManualReview) {
      // Find an active sales rep or admin to assign
      const repRes = await client.query(
        "SELECT id, role, full_name, email FROM public.users WHERE role IN ('SALES_REP', 'SALES_MANAGER', 'ADMIN') AND status = 'ACTIVE' ORDER BY role = 'SALES_REP' DESC, created_at ASC LIMIT 1"
      );
      const assignedRep = repRes.rows[0] || { id: customer.id, role: "SALES_REP" };

      await client.query("COMMIT");

      // Create the auto-approved quotation
      createdQuotation = await createDraft(assignedRep, {
        customerId: customer.id,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          discountPercent: 0
        }))
      });

      // Update quotation status to APPROVED so customer can confirm directly
      await db.query(
        `UPDATE public.quotations SET status = 'APPROVED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [createdQuotation.id]
      );
      createdQuotation.status = 'APPROVED';

      await db.query(
        `UPDATE public.customer_quote_requests SET quotation_id = $1, status = 'AUTO_APPROVED', updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [createdQuotation.id, requestId]
      );

      return {
        id: requestId,
        status: "AUTO_APPROVED",
        isAutoApproved: true,
        quotationId: createdQuotation.id,
        quotationNumber: createdQuotation.quotationNumber,
        createdAt: requestResult.rows[0].created_at
      };
    } else {
      await client.query("COMMIT");
      return {
        id: requestId,
        status: "PENDING",
        isAutoApproved: false,
        createdAt: requestResult.rows[0].created_at
      };
    }
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listCustomerQuoteRequests(customer) {
  const result = await db.query(
    `SELECT r.id, r.status, r.requested_delivery_date, r.customer_comment,
            r.quotation_id, r.created_at,
            q.quotation_number, q.status AS quotation_status,
            COALESCE(json_agg(json_build_object(
              'productId', p.id, 'name', p.name, 'sku', p.sku, 'category', p.category, 'unitPrice', p.unit_price, 'quantity', ri.quantity
            ) ORDER BY p.name) FILTER (WHERE p.id IS NOT NULL), '[]') AS items
     FROM public.customer_quote_requests r
     LEFT JOIN public.customer_quote_request_items ri ON ri.request_id = r.id
     LEFT JOIN public.products p ON p.id = ri.product_id
     LEFT JOIN public.quotations q ON q.id = r.quotation_id
     WHERE r.customer_id = $1
     GROUP BY r.id, q.quotation_number, q.status
     ORDER BY r.created_at DESC`,
    [customer.id],
  );
  return result.rows.map((row) => ({
    id: row.id,
    status: row.status,
    requestedDeliveryDate: row.requested_delivery_date,
    customerComment: row.customer_comment,
    quotationId: row.quotation_id,
    quotationNumber: row.quotation_number,
    quotationStatus: row.quotation_status,
    createdAt: row.created_at,
    items: row.items,
  }));
}

async function listPendingCustomerQuoteRequests(user) {
  if (!["SALES_REP", "SALES_MANAGER", "ADMIN"].includes(user.role)) {
    throw quotationError("Only internal sales users can review customer quotation requests.", 403);
  }
  const result = await db.query(
    `SELECT r.id, r.status, r.requested_delivery_date, r.customer_comment,
            r.quotation_id, r.created_at, c.id AS customer_id, c.full_name AS customer_name,
            c.company_name, c.email,
            q.quotation_number, q.status AS quotation_status,
            COALESCE(json_agg(json_build_object(
              'productId', p.id, 'name', p.name, 'sku', p.sku, 'category', p.category, 'unitPrice', p.unit_price, 'cost', p.cost, 'quantity', ri.quantity
            ) ORDER BY p.name) FILTER (WHERE p.id IS NOT NULL), '[]') AS items
     FROM public.customer_quote_requests r
     JOIN public.users c ON c.id = r.customer_id
     LEFT JOIN public.customer_quote_request_items ri ON ri.request_id = r.id
     LEFT JOIN public.products p ON p.id = ri.product_id
     LEFT JOIN public.quotations q ON q.id = r.quotation_id
     WHERE (q.status IS NULL OR q.status NOT IN ('CONFIRMED', 'FINALIZED', 'REJECTED'))
       AND r.status NOT IN ('CONFIRMED', 'REJECTED')
     GROUP BY r.id, c.id, q.quotation_number, q.status
     ORDER BY r.created_at DESC`,
  );
  return result.rows.map((row) => {
    const estTotal = (row.items || []).reduce(
      (acc, item) => acc + Number(item.unitPrice || 0) * Number(item.quantity || 1),
      0
    );
    return {
      ...row,
      estimatedTotal: estTotal,
    };
  });
}

async function convertCustomerQuoteRequest(requestId, user, additionalItems = []) {
  if (!["SALES_REP", "SALES_MANAGER", "ADMIN"].includes(user.role)) {
    throw quotationError("Only internal sales users can convert customer quotation requests.", 403);
  }
  const requestResult = await db.query(
    `SELECT r.id, r.customer_id, r.status, r.requested_delivery_date,
            COALESCE(json_agg(json_build_object('productId', ri.product_id, 'quantity', ri.quantity)) FILTER (WHERE ri.product_id IS NOT NULL), '[]') AS items
     FROM public.customer_quote_requests r
     LEFT JOIN public.customer_quote_request_items ri ON ri.request_id = r.id
     WHERE r.id = $1
     GROUP BY r.id`,
    [requestId],
  );
  if (!requestResult.rows.length) throw quotationError("Customer quotation request not found.", 404);
  const request = requestResult.rows[0];
  if (request.status !== "PENDING") throw quotationError("This customer request has already been processed.");

  const allItems = [
    ...request.items.map((item) => ({ productId: item.productId, quantity: item.quantity, discountPercent: 0 })),
    ...(Array.isArray(additionalItems) ? additionalItems.map((item) => ({
      productId: item.productId || item.id,
      quantity: Number(item.quantity || 1),
      discountPercent: Number(item.discountPercent || 0)
    })) : [])
  ];

  // Deduplicate products
  const uniqueItemsMap = new Map();
  for (const item of allItems) {
    if (uniqueItemsMap.has(item.productId)) {
      uniqueItemsMap.get(item.productId).quantity += Number(item.quantity || 1);
    } else {
      uniqueItemsMap.set(item.productId, { ...item });
    }
  }

  const quotation = await createDraft(user, {
    customerId: request.customer_id,
    items: Array.from(uniqueItemsMap.values()),
  });
  await db.query(
    `UPDATE public.customer_quote_requests
     SET status = 'CONVERTED', quotation_id = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [requestId, quotation.id],
  );
  return quotation;
}

async function getDashboardSummary(user) {
  let repFilter = "";
  const params = [];
  if (user.role === "SALES_REP") {
    params.push(user.id);
    repFilter = " WHERE sales_rep_id = $1";
  }

  const [openQuotationsResult, pendingApprovalsResult, atRiskDealsResult, pendingCustomerRequestsResult, monthlyStatsResult, overallSummaryResult] = await Promise.all([
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
      `SELECT COUNT(*)::int AS count
       FROM public.quotations
       ${repFilter ? repFilter + " AND risk_level IN ('HIGH', 'CRITICAL')" : "WHERE risk_level IN ('HIGH', 'CRITICAL')"}`,
      params
    ),
    db.query(
      `SELECT COUNT(*)::int AS count
       FROM public.customer_quote_requests
       WHERE status = 'PENDING'`
    ),
    db.query(
      `SELECT 
         to_char(created_at, 'Mon') AS month,
         to_char(created_at, 'Month') AS full_month,
         EXTRACT(MONTH FROM created_at) AS month_num,
         COALESCE(SUM(final_amount), 0) AS total_revenue,
         COALESCE(SUM(gross_margin), 0) AS total_gross_margin,
         COALESCE(AVG(margin_percentage), 0) AS avg_margin
       FROM public.quotations
       ${repFilter}
       GROUP BY to_char(created_at, 'Mon'), to_char(created_at, 'Month'), EXTRACT(MONTH FROM created_at)
       ORDER BY EXTRACT(MONTH FROM created_at) ASC`,
      params
    ),
    db.query(
      `SELECT 
         COALESCE(SUM(final_amount), 0) AS total_revenue,
         COALESCE(SUM(gross_margin), 0) AS total_gross_margin,
         COALESCE(AVG(margin_percentage), 0) AS avg_margin
       FROM public.quotations
       ${repFilter}`,
      params
    )
  ]);

  const openVal = Number(openQuotationsResult.rows[0]?.count || 0);
  const pendingVal = Number(pendingApprovalsResult.rows[0]?.count || 0);
  const atRiskVal = Number(atRiskDealsResult.rows[0]?.count || 0);
  const pendingRequestsVal = Number(pendingCustomerRequestsResult.rows[0]?.count || 0);

  const overall = overallSummaryResult.rows[0] || {};
  const totalRevenueNum = Number(overall.total_revenue || 0);
  const totalGrossMarginNum = Number(overall.total_gross_margin || 0);
  const avgMarginNum = Number(overall.avg_margin || 0);

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fullMonthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const currentMonthIdx = new Date().getMonth();
  const recent6Months = [];
  for (let i = 5; i >= 0; i--) {
    const idx = (currentMonthIdx - i + 12) % 12;
    recent6Months.push({
      month: monthNames[idx],
      fullMonth: fullMonthNames[idx],
    });
  }

  const dbMonthMap = new Map();
  if (monthlyStatsResult.rows && monthlyStatsResult.rows.length > 0) {
    monthlyStatsResult.rows.forEach((row) => {
      if (row.month) {
        const revAmount = Number(row.total_revenue || 0);
        const marginPct = Number(row.avg_margin || 0);
        const grossMargin = Number(row.total_gross_margin || 0);
        dbMonthMap.set(row.month.trim(), {
          rawRevenue: revAmount,
          revenueLakhs: Number((revAmount / 100000).toFixed(2)),
          marginPct: Number(marginPct.toFixed(1)),
          grossMarginRaw: grossMargin,
          grossMarginVal: revAmount >= 100000
            ? `₹${(grossMargin / 100000).toFixed(2)}L`
            : `₹${Number(grossMargin.toFixed(0)).toLocaleString("en-IN")}`
        });
      }
    });
  }

  const chartData = recent6Months.map((item) => {
    if (dbMonthMap.has(item.month)) {
      const real = dbMonthMap.get(item.month);
      return {
        month: item.month,
        fullMonth: item.fullMonth,
        revenue: real.revenueLakhs,
        margin: real.marginPct,
        grossMarginVal: real.grossMarginVal,
      };
    }
    return {
      month: item.month,
      fullMonth: item.fullMonth,
      revenue: 0,
      margin: 0,
      grossMarginVal: "₹0",
    };
  });

  const formattedTotalRevenue = totalRevenueNum >= 10000000
    ? `₹${(totalRevenueNum / 10000000).toFixed(2)}Cr`
    : totalRevenueNum >= 100000
      ? `₹${(totalRevenueNum / 100000).toFixed(2)}L`
      : `₹${Number(totalRevenueNum.toFixed(0)).toLocaleString("en-IN")}`;

  const formattedGrossMargin = totalGrossMarginNum >= 10000000
    ? `₹${(totalGrossMarginNum / 10000000).toFixed(2)}Cr`
    : totalGrossMarginNum >= 100000
      ? `₹${(totalGrossMarginNum / 100000).toFixed(2)}L`
      : `₹${Number(totalGrossMarginNum.toFixed(0)).toLocaleString("en-IN")}`;

  const formattedAvgMargin = `${avgMarginNum.toFixed(1)}%`;

  return {
    pendingCustomerRequests: pendingRequestsVal,
    pendingApprovals: pendingVal,
    openQuotations: openVal,
    atRiskDeals: atRiskVal,
    analytics: {
      chartData,
      summary: {
        totalRevenue: formattedTotalRevenue,
        totalRevenueGrowth: "+0.0%",
        avgMargin: formattedAvgMargin,
        avgMarginGrowth: "+0.0%",
        grossMargin: formattedGrossMargin,
        grossMarginGrowth: "+0.0%"
      },
      aiInsight: totalRevenueNum > 0
        ? `Real-time database analytics show total revenue of ${formattedTotalRevenue} with an average margin of ${formattedAvgMargin} across active sales deals.`
        : "No quotation deals recorded yet for this period. Create new quotations to track real-time revenue and margin analytics."
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
    totalCost: Number(row.total_cost),
    grossMargin: Number(row.gross_margin),
    marginPercentage: Number(row.margin_percentage),
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
         q.final_amount, q.total_cost, q.gross_margin, q.margin_percentage,
         q.confirmed_at, q.created_at, q.updated_at,
         q.risk_score, q.risk_level, q.approval_route, q.risk_factors,
         q.risk_analysis, q.risk_analyzed_at,
         customer.id AS customer_id, customer.full_name AS customer_name,
         customer.email AS customer_email, customer.company_name,
         sales_rep.id AS sales_rep_id, sales_rep.full_name AS sales_rep_name,
         sales_rep.email AS sales_rep_email,
         (SELECT nr.status FROM public.negotiation_requests nr WHERE nr.quotation_id = q.id ORDER BY nr.created_at DESC LIMIT 1) AS customer_request_status,
         (SELECT nr.requested_discount_percent FROM public.negotiation_requests nr WHERE nr.quotation_id = q.id ORDER BY nr.created_at DESC LIMIT 1) AS requested_discount_percent,
         (SELECT nr.requested_delivery_date FROM public.negotiation_requests nr WHERE nr.quotation_id = q.id ORDER BY nr.created_at DESC LIMIT 1) AS requested_delivery_date,
         (SELECT nr.customer_comment FROM public.negotiation_requests nr WHERE nr.quotation_id = q.id ORDER BY nr.created_at DESC LIMIT 1) AS customer_comment
  FROM public.quotations q
  LEFT JOIN public.users customer ON customer.id = q.customer_id
  LEFT JOIN public.users sales_rep ON sales_rep.id = q.sales_rep_id
`;

async function listQuotations(user) {
  const params = [];
  let filter = "";
  if (user.role === "ADMIN" || user.role === "SALES_MANAGER") {
    // Admin & Sales Manager see all quotations system-wide
  } else if (SALES_ROLES.includes(user.role)) {
    params.push(user.id);
    filter = ` WHERE (q.sales_rep_id = $${params.length} OR q.sales_rep_id IS NULL)`;
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
  if (user.role !== "ADMIN" && SALES_ROLES.includes(user.role)) {
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

  const negotiationResult = await db.query(
    `SELECT id, customer_id, requested_discount_percent, requested_delivery_date,
            customer_comment, removed_item_ids, requested_items, sales_rep_response,
            status, created_at, updated_at
     FROM public.negotiation_requests
     WHERE quotation_id = $1
     ORDER BY created_at DESC`,
    [id],
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
      costPrice: Number(item.cost),
      totalCost: money(Number(item.cost) * Number(item.quantity)),
      discountPercent: Number(item.discount_percent),
      discountAmount: Number(item.discount_amount),
      lineTotal: Number(item.line_total)
    })),
    negotiations: negotiationResult.rows.map((request) => ({
      id: request.id,
      customerId: request.customer_id,
      requestedDiscountPercent: request.requested_discount_percent === null ? null : Number(request.requested_discount_percent),
      requestedDeliveryDate: request.requested_delivery_date,
      customerComment: request.customer_comment,
      removedItemIds: Array.isArray(request.removed_item_ids) ? request.removed_item_ids : [],
      requestedItems: Array.isArray(request.requested_items) ? request.requested_items : [],
      salesRepResponse: request.sales_rep_response,
      status: request.status,
      createdAt: request.created_at,
      updatedAt: request.updated_at,
    })),
  };
}

async function createDraft(user, input) {
  if (!SALES_ROLES.includes(user.role)) {
    throw quotationError("Only Sales Representatives, Sales Managers, and Administrators can create quotations.", 403);
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
    const unitPrice = item.unitPrice === undefined ? null : Number(item.unitPrice);
    const discountPercent = Number(item.discountPercent || 0);
    if (!Number.isInteger(quantity) || quantity <= 0) throw quotationError("Quantity must be a positive whole number.");
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      throw quotationError("Discount must be between 0 and 100 percent.");
    }
    if (unitPrice !== null && (!Number.isFinite(unitPrice) || unitPrice < 0)) throw quotationError("Selling price cannot be negative.");
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
      `SELECT id, name, sku, category, unit_price, cost
       FROM public.products WHERE id = ANY($1::uuid[]) AND is_active = TRUE`,
      [productIds]
    );
    if (productsResult.rows.length !== productIds.length) throw quotationError("One or more selected products are unavailable.", 404);

    const productsById = new Map(productsResult.rows.map((product) => [product.id, product]));
    let subtotal = 0;
    let discountAmount = 0;
    const calculatedItems = items.map((item) => {
      const product = productsById.get(item.productId);
      const costPrice = Number(product.cost);
      if (!Number.isFinite(costPrice) || costPrice < 0) {
        throw quotationError(`Product ${product.name} has an invalid cost price.`);
      }
      const quantity = Number(item.quantity);
      const discountPercent = Number(item.discountPercent || 0);
      const unitPrice = item.unitPrice === undefined ? Number(product.unit_price) : Number(item.unitPrice);
      const lineSubtotal = money(unitPrice * quantity);
      const lineDiscount = money(lineSubtotal * discountPercent / 100);
      const lineTotal = money(lineSubtotal - lineDiscount);
      subtotal += lineSubtotal;
      discountAmount += lineDiscount;
      return { product, quantity, unitPrice, costPrice, discountPercent, lineDiscount, lineTotal };
    });
    subtotal = money(subtotal);
    discountAmount = money(discountAmount);
    const finalAmount = money(subtotal - discountAmount);
    const totalCost = money(calculatedItems.reduce((sum, item) => sum + item.costPrice * item.quantity, 0));
    const grossMargin = money(finalAmount - totalCost);
    const marginPercentage = finalAmount === 0 ? 0 : money((grossMargin / finalAmount) * 100);

    const numberResult = await client.query(
      `SELECT COUNT(*)::int + 1 AS next_number
       FROM public.quotations WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`
    );
    const quotationNumber = `QT-${new Date().getFullYear()}-${String(numberResult.rows[0].next_number).padStart(4, "0")}`;

    const quotationResult = await client.query(
      `INSERT INTO public.quotations
      (quotation_number, customer_id, sales_rep_id, status, subtotal, discount_amount, final_amount, total_cost, gross_margin, margin_percentage)
      VALUES ($1, $2, $3, 'DRAFT', $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [quotationNumber, customerId, user.id, subtotal, discountAmount, finalAmount, totalCost, grossMargin, marginPercentage]
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
      await calculateAndPersistRisk(quotationId);
      return getQuotation(quotationId, user);
    } catch (error) {
      await client.query("ROLLBACK");
      if (error.code === "23505") throw quotationError("A quotation number conflict occurred. Please try again.", 409);
      throw error;
  } finally {
    client.release();
  }
}

async function updateQuotation(user, quotationId, input) {
  if (!SALES_ROLES.includes(user.role) && user.role !== "ADMIN") {
    throw quotationError("Only Sales Representatives and Sales Managers can edit quotations.", 403);
  }

  // Fetch existing quotation to verify ownership
  const existing = await getQuotation(quotationId, user);
  if (!existing) throw quotationError("Quotation not found.", 404);

  // Only allow editing active quotations (not finalized/confirmed/cancelled)
  const editableStatuses = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "NEGOTIATION"];
  if (!editableStatuses.includes(existing.status)) {
    throw quotationError(
      `Only active quotations (DRAFT, PENDING_APPROVAL, APPROVED, or NEGOTIATION) can be edited. Current status: ${existing.status}.`
    );
  }

  const items = Array.isArray(input.items) ? input.items : [];
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
    const unitPrice = item.unitPrice === undefined ? null : Number(item.unitPrice);
    if (!Number.isInteger(quantity) || quantity <= 0) throw quotationError("Quantity must be a positive whole number.");
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      throw quotationError("Discount must be between 0 and 100 percent.");
    }
    if (unitPrice !== null && (!Number.isFinite(unitPrice) || unitPrice < 0)) throw quotationError("Selling price cannot be negative.");
    productIds.push(item.productId);
  }

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    const productsResult = await client.query(
      `SELECT id, name, sku, category, unit_price, cost
       FROM public.products WHERE id = ANY($1::uuid[]) AND is_active = TRUE`,
      [productIds]
    );
    if (productsResult.rows.length !== productIds.length) throw quotationError("One or more selected products are unavailable.", 404);

    const productsById = new Map(productsResult.rows.map((product) => [product.id, product]));
    let subtotal = 0;
    let discountAmount = 0;
    const calculatedItems = items.map((item) => {
      const product = productsById.get(item.productId);
      const costPrice = Number(product.cost);
      const quantity = Number(item.quantity);
      const discountPercent = Number(item.discountPercent || 0);
      const unitPrice = item.unitPrice === undefined ? Number(product.unit_price) : Number(item.unitPrice);
      const lineSubtotal = money(unitPrice * quantity);
      const lineDiscount = money(lineSubtotal * discountPercent / 100);
      const lineTotal = money(lineSubtotal - lineDiscount);
      subtotal += lineSubtotal;
      discountAmount += lineDiscount;
      return { product, quantity, unitPrice, costPrice, discountPercent, lineDiscount, lineTotal };
    });
    subtotal = money(subtotal);
    discountAmount = money(discountAmount);
    const finalAmount = money(subtotal - discountAmount);
    const totalCost = money(calculatedItems.reduce((sum, item) => sum + item.costPrice * item.quantity, 0));
    const grossMargin = money(finalAmount - totalCost);
    const marginPercentage = finalAmount === 0 ? 0 : money((grossMargin / finalAmount) * 100);

    const targetStatus = (input.keepStatus && existing.status === 'APPROVED') ? 'APPROVED' : (existing.status === 'NEGOTIATION' ? 'NEGOTIATION' : 'DRAFT');
    // Update the quotation header
    await client.query(
      `UPDATE public.quotations
       SET status = $1,
           subtotal = $2,
           discount_amount = $3,
           final_amount = $4,
           total_cost = $5,
           gross_margin = $6,
           margin_percentage = $7,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8`,
      [targetStatus, subtotal, discountAmount, finalAmount, totalCost, grossMargin, marginPercentage, quotationId]
    );

    // Delete all old items and re-insert new ones
    await client.query("DELETE FROM public.quotation_items WHERE quotation_id = $1", [quotationId]);

    for (const item of calculatedItems) {
      await client.query(
        `INSERT INTO public.quotation_items
         (quotation_id, product_id, quantity, unit_price, discount_percent, discount_amount, line_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [quotationId, item.product.id, item.quantity, item.unitPrice, item.discountPercent, item.lineDiscount, item.lineTotal]
      );
    }

    await client.query("COMMIT");
    await calculateAndPersistRisk(quotationId);
    return getQuotation(quotationId, user);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function addItemToQuotation(user, quotationId, itemInput) {
  if (!SALES_ROLES.includes(user.role) && user.role !== "ADMIN") {
    throw quotationError("Only Sales Representatives and Sales Managers can edit quotations.", 403);
  }

  const existing = await getQuotation(quotationId, user);
  if (!existing) throw quotationError("Quotation not found.", 404);

  const editableStatuses = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "NEGOTIATION", "AUTO_APPROVED"];
  if (!editableStatuses.includes(existing.status)) {
    throw quotationError(
      `Cannot add items to quotation with status ${existing.status}.`
    );
  }

  const targetProductId = itemInput.productId || itemInput.id;
  if (!targetProductId) throw quotationError("Product ID is required.");

  const existingItems = (existing.items || []).map((i) => ({
    productId: i.productId,
    quantity: Number(i.quantity || 1),
    discountPercent: Number(i.discountPercent || 0),
    unitPrice: Number(i.unitPrice),
  }));

  const existingIdx = existingItems.findIndex((i) => i.productId === targetProductId);
  const qtyToAdd = Math.max(1, Math.floor(Number(itemInput.quantity) || 1));
  const discountToAdd = Math.min(100, Math.max(0, Number(itemInput.discountPercent || 0)));

  if (existingIdx >= 0) {
    existingItems[existingIdx].quantity += qtyToAdd;
  } else {
    existingItems.push({
      productId: targetProductId,
      quantity: qtyToAdd,
      discountPercent: discountToAdd,
      unitPrice: itemInput.unitPrice !== undefined ? Number(itemInput.unitPrice) : undefined,
    });
  }

  return updateQuotation(user, quotationId, {
    items: existingItems,
    keepStatus: ["APPROVED", "AUTO_APPROVED"].includes(existing.status),
  });
}

async function calculateAndPersistRisk(quotationId) {
  try {
    const quoteRes = await db.query(
      `SELECT id, subtotal, discount_amount, final_amount, margin_percentage FROM public.quotations WHERE id = $1`,
      [quotationId]
    );
    if (quoteRes.rows.length === 0) return null;
    const q = quoteRes.rows[0];

    const itemsRes = await db.query(
      `SELECT qi.*, p.sku, p.category, p.unit_price, p.cost
       FROM public.quotation_items qi
       JOIN public.products p ON p.id = qi.product_id
       WHERE qi.quotation_id = $1`,
      [quotationId]
    );

    const grossValue = Number(q.subtotal) || 0;
    const netValue = Number(q.final_amount) || 0;
    const totalCost = itemsRes.rows.reduce((sum, item) => sum + Number(item.cost || 0) * Number(item.quantity || 1), 0);
    const marginDeal = netValue > 0 ? Math.max(0, Math.min(1, (netValue - totalCost) / netValue)) : 0;
    const dealAverageDiscount = grossValue > 0 ? Number(q.discount_amount || 0) / grossValue : 0;

    const payload = {
      dealId: q.id,
      customerTier: "STANDARD",
      repAverageDiscount: 0,
      dealAverageDiscount,
      marginDeal,
      lines: itemsRes.rows.map((item) => ({
        productId: item.sku || item.product_id,
        category: item.category || "HARDWARE",
        discount: Number(item.discount_percent || 0) / 100,
        grossValue: Number(item.unit_price || 0) * Number(item.quantity || 1),
        categoryCeiling: CATEGORY_CEILINGS[item.category] || 0.10,
        tierCeiling: 0.10,
        unitPrice: Number(item.unit_price || 0),
        quantity: Number(item.quantity || 1),
      })),
    };

    const resp = await fetch(`${RISK_ENGINE_URL}/api/ai/risk/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (resp.ok) {
      const data = await resp.json();
      await db.query(
        `UPDATE public.quotations
         SET risk_score = $1, risk_level = $2, approval_route = $3, risk_factors = $4, risk_analyzed_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [Number(data.riskScore), data.riskLevel, data.governanceRoute, JSON.stringify(data.factors || []), quotationId]
      );
      return data;
    }
  } catch (err) {
    console.warn("Risk evaluation background notice:", err.message);
  }
  return null;
}

async function previewQuotationRisk(user, input) {
  if (!SALES_ROLES.includes(user.role)) throw quotationError("Only sales users can preview quotation risk.", 403);
  const items = Array.isArray(input.items) ? input.items : [];
  if (!items.length) throw quotationError("Add at least one product before previewing risk.");
  const subtotal = items.reduce((sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 0), 0);
  const discountAmount = items.reduce((sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 0) * Number(item.discountPercent || 0) / 100, 0);
  const finalPrice = subtotal - discountAmount;
  const totalCost = items.reduce((sum, item) => sum + Number(item.costPrice || 0) * Number(item.quantity || 0), 0);
  const marginDeal = finalPrice > 0 ? Math.max(0, Math.min(1, (finalPrice - totalCost) / finalPrice)) : 0;
  const request = { dealId: `preview-${user.id}`, customerTier: "STANDARD", repAverageDiscount: 0, dealAverageDiscount: subtotal > 0 ? discountAmount / subtotal : 0, marginDeal, lines: items.map((item, index) => ({ productId: item.productId || `line-${index}`, category: item.category || "OTHER", discount: Number(item.discountPercent || 0) / 100, grossValue: Number(item.unitPrice || 0) * Number(item.quantity || 0), categoryCeiling: CATEGORY_CEILINGS[item.category] || 0.10, tierCeiling: 0.10, unitPrice: Number(item.unitPrice || 0), quantity: Number(item.quantity || 0) })) };
  let response;
  try { response = await fetch(`${RISK_ENGINE_URL}/api/ai/risk/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) }); }
  catch (error) { throw quotationError("Risk engine unavailable. Start it with `npm run risk:dev` from the backend folder.", 503); }
  const risk = await response.json();
  if (!response.ok) throw quotationError(risk.detail || "Risk preview failed.", 422);
  const safeDiscount = subtotal > 0 ? Math.max(0, Math.min(20, ((subtotal - totalCost / 0.82) / subtotal) * 100)) : 0;
  return { risk, pricing: { subtotal: money(subtotal), currentDiscount: money(discountAmount), finalPrice: money(finalPrice), totalCost: money(totalCost), marginPercentage: Number((marginDeal * 100).toFixed(1)), suggestedDiscountPercent: Number(safeDiscount.toFixed(1)), suggestedFinalPrice: money(subtotal * (1 - safeDiscount / 100)) } };
}

async function applyNegotiationSuggestion(user, quotationId, input) {
  if (!SALES_ROLES.includes(user.role) && user.role !== "ADMIN") {
    throw quotationError("Only sales users and administrators can apply negotiation suggestions.", 403);
  }
  const quotation = await getQuotation(quotationId, user);
  const discountPercent = Number(input.discountPercent);
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
    throw quotationError("A valid suggested discount percentage is required.");
  }
  const items = quotation.items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discountPercent,
  }));
  await updateQuotation(user, quotationId, { items });
  return submitQuotation(user, quotationId);
}

async function applyAiQuoteUpdate(user, quotationId, input) {
  if (!SALES_ROLES.includes(user.role) && user.role !== "ADMIN") {
    throw quotationError("Only sales users and administrators can recreate quotations.", 403);
  }
  const items = Array.isArray(input.items) ? input.items : [];
  if (!items.length) throw quotationError("The AI proposal contains no quotation items.");
  const updated = await updateQuotation(user, quotationId, { items });
  return { quotation: updated, message: "AI proposal applied. Review the recreated draft and submit it when ready." };
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
const CUSTOMER_VISIBLE_STATUSES = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "NEGOTIATION", "CONFIRMED", "FINALIZED", "REJECTED"];

async function listCustomerQuotations(customer) {
  const isCustomer = customer.role === "CUSTOMER";
  const params = isCustomer ? [customer.id, CUSTOMER_VISIBLE_STATUSES] : [CUSTOMER_VISIBLE_STATUSES];
  const filter = isCustomer
    ? "WHERE q.customer_id = $1 AND q.status = ANY($2::text[])"
    : "WHERE q.status = ANY($1::text[])";

  const result = await db.query(
    `${quotationSelect}
     ${filter}
     ORDER BY q.created_at DESC`,
    params,
  );
  return result.rows.map(mapQuotation);
}

async function getCustomerQuotation(id, customer) {
  const ownership = await db.query("SELECT customer_id FROM public.quotations WHERE id = $1", [id]);
  if (customer.role === "CUSTOMER" && ownership.rows.length > 0 && ownership.rows[0].customer_id !== customer.id) {
    throw quotationError("You do not have permission to access this quotation.", 403);
  }
  const targetCustomerId = ownership.rows[0]?.customer_id || customer.id;
  const quotation = await getQuotation(id, { id: targetCustomerId, role: "CUSTOMER" });
  if (!CUSTOMER_VISIBLE_STATUSES.includes(quotation.status)) {
    throw quotationError("Quotation not found.", 404);
  }

  const negotiationResult = await db.query(
    `SELECT id, customer_id, requested_discount_percent, requested_delivery_date,
            customer_comment, removed_item_ids, requested_items, sales_rep_response,
            status, created_at, updated_at
     FROM public.negotiation_requests
     WHERE quotation_id = $1
     ORDER BY created_at DESC`,
    [id],
  );
  return {
    ...quotation,
    negotiations: negotiationResult.rows.map((request) => ({
      id: request.id,
      customerId: request.customer_id,
      requestedDiscountPercent: request.requested_discount_percent === null ? null : Number(request.requested_discount_percent),
      requestedDeliveryDate: request.requested_delivery_date,
      customerComment: request.customer_comment,
      removedItemIds: Array.isArray(request.removed_item_ids) ? request.removed_item_ids : [],
      requestedItems: Array.isArray(request.requested_items) ? request.requested_items : [],
      salesRepResponse: request.sales_rep_response,
      status: request.status,
      createdAt: request.created_at,
      updatedAt: request.updated_at,
    })),
  };
}

async function createNegotiationRequest(id, customer, input) {
  const quotation = await getCustomerQuotation(id, customer);
  if (!["DRAFT", "PENDING_APPROVAL", "APPROVED", "NEGOTIATION"].includes(quotation.status)) {
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

  const removedItemIds = Array.isArray(input.removedItemIds) ? input.removedItemIds : [];
  if (removedItemIds.length > 0) {
    if (removedItemIds.length >= quotation.items.length) {
      throw quotationError("Cannot remove all items from quotation. If you wish to reject the entire quote, please use Reject Quotation.");
    }
    const currentItemIds = new Set(quotation.items.map((it) => it.id));
    for (const rid of removedItemIds) {
      if (!currentItemIds.has(rid)) {
        throw quotationError("One or more selected items to remove do not belong to this quotation.");
      }
    }
  }

  if (!hasDiscount && !deliveryDate && removedItemIds.length === 0 && !input.customerComment?.trim()) {
    throw quotationError("Please provide at least one negotiation change (discount, delivery date, item removal, or comment).");
  }

  const removedItemsSnapshot = quotation.items
    .filter((it) => removedItemIds.includes(it.id))
    .map((it) => ({
      id: it.id,
      productId: it.productId,
      name: it.name,
      sku: it.sku,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      lineTotal: it.lineTotal,
    }));

  const result = await db.query(
    `INSERT INTO public.negotiation_requests
     (quotation_id, customer_id, requested_discount_percent, requested_delivery_date, customer_comment, removed_item_ids, requested_items)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
     RETURNING id, requested_discount_percent, requested_delivery_date, customer_comment, removed_item_ids, requested_items, status, created_at`,
    [
      id,
      customer.id,
      requestedDiscountPercent,
      deliveryDate,
      input.customerComment?.trim() || null,
      JSON.stringify(removedItemIds),
      JSON.stringify(removedItemsSnapshot),
    ],
  );

  const removedNames = removedItemsSnapshot.map((i) => `${i.name} (Qty: ${i.quantity}, ₹${Number(i.lineTotal).toLocaleString("en-IN")})`).join(", ");

  const negotiationMessage = [
    "📋 Customer Negotiation Request",
    removedItemsSnapshot.length > 0 ? `• Requested Removal of Items: ${removedNames}` : null,
    hasDiscount ? `• Requested Discount: ${requestedDiscountPercent}%` : null,
    deliveryDate ? `• Requested Delivery Date: ${deliveryDate}` : null,
    input.customerComment?.trim() ? `• Customer Note: "${input.customerComment.trim()}"` : null,
  ].filter(Boolean).join("\n");

  await db.query(
    `INSERT INTO public.quotation_messages
      (quotation_id, sender_id, sender_role, sender_name, message, recipient_role, recipient_id)
     VALUES ($1, $2, 'CUSTOMER', $3, $4, 'SALES_REP', $5)`,
    [id, customer.id, customer.full_name || customer.email, negotiationMessage, quotation.salesRep?.id || null],
  );

  await db.query(
    `UPDATE public.quotations SET status = 'NEGOTIATION', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND customer_id = $2`,
    [id, customer.id],
  );

  return result.rows[0];
}

async function respondToNegotiationRequest(user, quotationId, negotiationId, input) {
  if (!SALES_ROLES.includes(user.role) && user.role !== "ADMIN") {
    throw quotationError("Only Sales Representatives, Managers, or Admins can respond to negotiations.", 403);
  }

  const action = (input.action || "").toUpperCase().trim();
  if (!["ACCEPT", "REJECT"].includes(action)) {
    throw quotationError("Action must be either ACCEPT or REJECT.", 400);
  }

  const responseNote = (input.responseNote || "").trim();

  // Fetch quotation
  const quotation = await getQuotation(quotationId, user);
  if (!quotation) throw quotationError("Quotation not found.", 404);

  // Fetch negotiation request
  const negResult = await db.query(
    `SELECT * FROM public.negotiation_requests WHERE id = $1 AND quotation_id = $2`,
    [negotiationId, quotationId],
  );
  if (!negResult.rows.length) throw quotationError("Negotiation request not found.", 404);

  const negotiation = negResult.rows[0];
  if (negotiation.status !== "PENDING") {
    throw quotationError(`This negotiation request has already been ${negotiation.status.toLowerCase()}.`);
  }

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    if (action === "ACCEPT") {
      let removedItemIds = [];
      try {
        removedItemIds = Array.isArray(negotiation.removed_item_ids)
          ? negotiation.removed_item_ids
          : JSON.parse(negotiation.removed_item_ids || "[]");
      } catch (e) {
        removedItemIds = [];
      }

      if (removedItemIds && removedItemIds.length > 0) {
        await client.query(
          `DELETE FROM public.quotation_items WHERE quotation_id = $1 AND id = ANY($2::uuid[])`,
          [quotationId, removedItemIds],
        );
      }

      // Fetch remaining items
      const remainingItemsResult = await client.query(
        `SELECT qi.id, qi.product_id, qi.quantity, qi.unit_price, qi.discount_percent,
                p.cost, p.name
         FROM public.quotation_items qi
         JOIN public.products p ON p.id = qi.product_id
         WHERE qi.quotation_id = $1`,
        [quotationId],
      );

      if (remainingItemsResult.rows.length === 0) {
        throw quotationError("Cannot remove all items from quotation. At least one item must remain.");
      }

      // Check if counter discount was also accepted
      const requestedDiscount = negotiation.requested_discount_percent !== null ? Number(negotiation.requested_discount_percent) : null;

      let subtotal = 0;
      let discountAmount = 0;
      let totalCost = 0;

      for (const item of remainingItemsResult.rows) {
        const qty = Number(item.quantity);
        const unitPrice = Number(item.unit_price);
        const costPrice = Number(item.cost || 0);
        const discountPercent = requestedDiscount !== null ? requestedDiscount : Number(item.discount_percent || 0);

        const lineSubtotal = money(unitPrice * qty);
        const lineDiscount = money((lineSubtotal * discountPercent) / 100);
        const lineTotal = money(lineSubtotal - lineDiscount);

        subtotal += lineSubtotal;
        discountAmount += lineDiscount;
        totalCost += costPrice * qty;

        if (requestedDiscount !== null) {
          await client.query(
            `UPDATE public.quotation_items
             SET discount_percent = $1, discount_amount = $2, line_total = $3
             WHERE id = $4`,
            [discountPercent, lineDiscount, lineTotal, item.id],
          );
        }
      }

      subtotal = money(subtotal);
      discountAmount = money(discountAmount);
      totalCost = money(totalCost);
      const finalAmount = money(subtotal - discountAmount);
      const grossMargin = money(finalAmount - totalCost);
      const marginPercentage = finalAmount === 0 ? 0 : money((grossMargin / finalAmount) * 100);

      // Update quotation header to APPROVED with recalculated figures
      await client.query(
        `UPDATE public.quotations
         SET status = 'APPROVED',
             subtotal = $1,
             discount_amount = $2,
             final_amount = $3,
             total_cost = $4,
             gross_margin = $5,
             margin_percentage = $6,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $7`,
        [subtotal, discountAmount, finalAmount, totalCost, grossMargin, marginPercentage, quotationId],
      );

      // Update negotiation request status
      await client.query(
        `UPDATE public.negotiation_requests
         SET status = 'ACCEPTED',
             sales_rep_response = $1,
             resolved_by = $2,
             resolved_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [responseNote || null, user.id, negotiationId],
      );

      // Post update message in conversation thread
      const updateMsg = [
        `✅ Negotiation Accepted by ${user.full_name || "Sales Representative"}.`,
        removedItemIds.length > 0 ? `• Removed ${removedItemIds.length} item(s) per customer request.` : null,
        requestedDiscount !== null ? `• Applied requested discount: ${requestedDiscount}%.` : null,
        `• Updated Quotation Total: ₹${finalAmount.toLocaleString("en-IN")}.`,
        responseNote ? `• Note from Sales: "${responseNote}"` : null,
      ].filter(Boolean).join("\n");

      await client.query(
        `INSERT INTO public.quotation_messages
         (quotation_id, sender_id, sender_role, sender_name, message, recipient_role, recipient_id)
         VALUES ($1, $2, 'SALES_REP', $3, $4, 'CUSTOMER', $5)`,
        [quotationId, user.id, user.full_name || "Sales Representative", updateMsg, quotation.customerId],
      );
    } else {
      // REJECT
      await client.query(
        `UPDATE public.negotiation_requests
         SET status = 'REJECTED',
             sales_rep_response = $1,
             resolved_by = $2,
             resolved_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [responseNote || null, user.id, negotiationId],
      );

      await client.query(
        `UPDATE public.quotations
         SET status = 'APPROVED',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [quotationId],
      );

      const rejectMsg = [
        `❌ Negotiation Request Declined by ${user.full_name || "Sales Representative"}.`,
        "The quotation remains at the previously agreed terms.",
        responseNote ? `• Reason / Note: "${responseNote}"` : null,
      ].filter(Boolean).join("\n");

      await client.query(
        `INSERT INTO public.quotation_messages
         (quotation_id, sender_id, sender_role, sender_name, message, recipient_role, recipient_id)
         VALUES ($1, $2, 'SALES_REP', $3, $4, 'CUSTOMER', $5)`,
        [quotationId, user.id, user.full_name || "Sales Representative", rejectMsg, quotation.customerId],
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return await getQuotation(quotationId, user);
}

async function confirmCustomerQuotation(id, customer) {
  const quotation = await getCustomerQuotation(id, customer);
  if (!["DRAFT", "PENDING_APPROVAL", "APPROVED", "NEGOTIATION", "CONFIRMED"].includes(quotation.status)) {
    if (quotation.status === "FINALIZED") throw quotationError("This quotation has already been finalized.");
    throw quotationError("This quotation is not currently available for confirmation.");
  }

  const result = await db.query(
    `UPDATE public.quotations
     SET status = 'FINALIZED', confirmed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND (customer_id = $2 OR $3 = 'ADMIN')
     RETURNING id, quotation_number, status, confirmed_at`,
    [id, customer.id, customer.role],
  );

  // Sync any associated inbound customer request to FINALIZED
  await db.query(
    `UPDATE public.customer_quote_requests
     SET status = 'FINALIZED', updated_at = CURRENT_TIMESTAMP
     WHERE quotation_id = $1`,
    [id]
  );

  const order = await fulfillmentService.createOrderForQuotation(id);
  return { ...result.rows[0], orderId: order.id, orderNumber: order.order_number };
}

async function rejectCustomerQuotation(id, customer) {
  const quotation = await getCustomerQuotation(id, customer);
  if (!["DRAFT", "PENDING_APPROVAL", "APPROVED", "NEGOTIATION"].includes(quotation.status)) {
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

  // Sync any associated inbound customer request to REJECTED
  await db.query(
    `UPDATE public.customer_quote_requests
     SET status = 'REJECTED', updated_at = CURRENT_TIMESTAMP
     WHERE quotation_id = $1`,
    [id]
  );

  return result.rows[0];
}

async function finalizeQuotation(quotationId, user) {
  if (!["SALES_REP", "SALES_MANAGER", "ADMIN"].includes(user.role)) {
    throw quotationError("Only sales representatives and administrators can finalize quotations.", 403);
  }

  const existingQuotation = await getQuotation(quotationId, user);
  if (existingQuotation.status === "FINALIZED") {
    throw quotationError("This quotation is already finalized.", 400);
  }

  const updateResult = await db.query(
    `UPDATE public.quotations
     SET status = 'FINALIZED',
         confirmed_at = COALESCE(confirmed_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING id, quotation_number, status, confirmed_at`,
    [quotationId]
  );

  // Sync any associated inbound customer request to CONFIRMED
  await db.query(
    `UPDATE public.customer_quote_requests
     SET status = 'CONFIRMED', updated_at = CURRENT_TIMESTAMP
     WHERE quotation_id = $1`,
    [quotationId]
  );

  if (updateResult.rows.length === 0) {
    throw quotationError("Quotation not found or unable to finalize.", 404);
  }

  const updatedQuotation = await getQuotation(quotationId, user);

  const salespersonName = updatedQuotation.salesRep?.fullName || user.full_name || "Sales Representative";
  const salespersonEmail = updatedQuotation.salesRep?.email || user.email;
  const customerName = updatedQuotation.customer?.companyName || updatedQuotation.customer?.fullName || "Customer";
  const customerEmail = updatedQuotation.customer?.email;

  const targetEmail = customerEmail || salespersonEmail;

  let emailResult = { success: false, error: "Email execution bypassed" };
  try {
    emailResult = await emailService.sendQuotationFinalizedEmail({
      customerName,
      customerEmail: targetEmail,
      salespersonName,
      salespersonEmail,
      quotationNumber: updatedQuotation.quotationNumber,
      totalAmount: updatedQuotation.finalAmount,
      marginPercentage: updatedQuotation.marginPercentage,
      grossMargin: updatedQuotation.grossMargin,
    });
  } catch (emailErr) {
    console.error(`[Quotation Service] Non-fatal email error for ${updatedQuotation.quotationNumber}:`, emailErr.message);
    emailResult = { success: false, error: emailErr.message };
  }

  let order = null;
  try {
    order = await fulfillmentService.createOrderForQuotation(quotationId);
  } catch (orderErr) {
    console.error(`[Quotation Service] Order creation error for ${quotationId}:`, orderErr.message);
  }

  return {
    success: true,
    message: `Quotation ${updatedQuotation.quotationNumber} finalized successfully.`,
    data: { ...updatedQuotation, orderId: order?.id, orderNumber: order?.order_number },
    notification: {
      emailSent: Boolean(emailResult.success),
      email: targetEmail,
      error: emailResult.success ? null : emailResult.error
    }
  };
}

async function updateCustomerOrderDestination(quotationOrOrderId, customer, destinationData) {
  const { address, city, state, zip, country, latitude, longitude } = destinationData || {};

  if (!address || !city || !state || !zip || !country) {
    throw quotationError("Full delivery address, City, State, PIN/ZIP, and Country are required.", 400);
  }

  // Geocode defaults for major cities if lat/lng not provided
  let lat = Number(latitude);
  let lng = Number(longitude);

  if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
    const lowerCity = String(city).toLowerCase().trim();
    if (lowerCity.includes("delhi")) { lat = 28.6139; lng = 77.2090; }
    else if (lowerCity.includes("mumbai")) { lat = 19.0760; lng = 72.8777; }
    else if (lowerCity.includes("pune")) { lat = 18.5204; lng = 73.8567; }
    else if (lowerCity.includes("bangalore") || lowerCity.includes("bengaluru")) { lat = 12.9716; lng = 77.5946; }
    else if (lowerCity.includes("chennai")) { lat = 13.0827; lng = 80.2707; }
    else if (lowerCity.includes("kolkata")) { lat = 22.5726; lng = 88.3639; }
    else if (lowerCity.includes("hyderabad")) { lat = 17.3850; lng = 78.4867; }
    else if (lowerCity.includes("ahmedabad")) { lat = 23.0225; lng = 72.5714; }
    else { lat = 28.6139; lng = 77.2090; } // Default to Delhi coordinates
  }

  const orderRes = await db.query(
    `SELECT o.id, o.order_number, o.quotation_id
     FROM public.orders o
     WHERE (o.id = $1 OR o.quotation_id = $1)
       AND (o.customer_id = $2 OR $3 = 'ADMIN')`,
    [quotationOrOrderId, customer.id, customer.role]
  );

  if (!orderRes.rows.length) {
    throw quotationError("Confirmed order not found for this customer.", 404);
  }

  const orderId = orderRes.rows[0].id;

  const result = await db.query(
    `UPDATE public.orders
     SET delivery_address = $1,
         delivery_city = $2,
         delivery_state = $3,
         delivery_zip = $4,
         delivery_country = $5,
         delivery_latitude = $6,
         delivery_longitude = $7,
         destination_submitted_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $8
     RETURNING id, order_number, delivery_address, delivery_city, delivery_state, delivery_zip, delivery_country, delivery_latitude, delivery_longitude, destination_submitted_at`,
    [address, city, state, zip, country, lat, lng, orderId]
  );

  return result.rows[0];
}

module.exports = {
  getCustomers,
  getProducts,
  createCustomerQuoteRequest,
  listCustomerQuoteRequests,
  listPendingCustomerQuoteRequests,
  convertCustomerQuoteRequest,
  getDashboardSummary,
  listQuotations,
  getQuotation,
  createDraft,
  updateQuotation,
  addItemToQuotation,
  submitQuotation,
    previewQuotationRisk,
    applyNegotiationSuggestion,
    applyAiQuoteUpdate,
  listCustomerQuotations,
  getCustomerQuotation,
  createNegotiationRequest,
  respondToNegotiationRequest,
  confirmCustomerQuotation,
  rejectCustomerQuotation,
  finalizeQuotation,
  updateCustomerOrderDestination,
  QUOTATION_STATUSES
};
