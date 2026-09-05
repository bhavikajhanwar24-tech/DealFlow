const db = require("../config/db");

function fulfillmentError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function shippingCost(warehouse) {
  const distance = Math.sqrt(Number(warehouse.latitude) ** 2 + Number(warehouse.longitude) ** 2);
  return Number((25 + distance * 0.05).toFixed(2));
}

function fulfillmentStatus(required, allocated) {
  return allocated >= required ? "READY" : allocated > 0 ? "PARTIAL_BACKORDER" : "BACKORDER";
}

async function createOrderForQuotation(quotationId) {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query(
      "SELECT id, order_number FROM public.orders WHERE quotation_id = $1",
      [quotationId],
    );
    if (existing.rows.length) {
      await client.query("COMMIT");
      return getOrder(existing.rows[0].id);
    }

    const quotation = await client.query(
      `SELECT q.id, q.customer_id
       FROM public.quotations q
       WHERE q.id = $1 AND q.status = 'CONFIRMED'
       FOR UPDATE`,
      [quotationId],
    );
    if (!quotation.rows.length) throw fulfillmentError("Confirmed quotation not found.", 404);

    const itemResult = await client.query(
      `SELECT qi.id, qi.product_id, qi.quantity
       FROM public.quotation_items qi WHERE qi.quotation_id = $1`,
      [quotationId],
    );
    if (!itemResult.rows.length) throw fulfillmentError("The quotation has no items.");

    const orderNumberResult = await client.query(
      `SELECT COUNT(*)::int + 1 AS next_number FROM public.orders
       WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`,
    );
    const orderNumber = `ORD-${new Date().getFullYear()}-${String(orderNumberResult.rows[0].next_number).padStart(4, "0")}`;
    const orderResult = await client.query(
      `INSERT INTO public.orders (order_number, quotation_id, customer_id)
       VALUES ($1, $2, $3) RETURNING id`,
      [orderNumber, quotationId, quotation.rows[0].customer_id],
    );
    const orderId = orderResult.rows[0].id;

    for (const item of itemResult.rows) {
      const orderItem = await client.query(
        `INSERT INTO public.order_items (order_id, product_id, quantity)
         VALUES ($1, $2, $3) RETURNING id`,
        [orderId, item.product_id, item.quantity],
      );
      await allocateItem(client, orderId, orderItem.rows[0].id, item.product_id, item.quantity, "RECOMMENDED");
    }

    await client.query(
      `UPDATE public.orders SET fulfillment_status = CASE
         WHEN EXISTS (SELECT 1 FROM public.backorders WHERE order_id = $1 AND status = 'OPEN')
           AND EXISTS (SELECT 1 FROM public.fulfillment_allocations WHERE order_id = $1 AND status = 'RESERVED') THEN 'PARTIAL_BACKORDER'
         WHEN EXISTS (SELECT 1 FROM public.backorders WHERE order_id = $1 AND status = 'OPEN') THEN 'BACKORDER'
         ELSE 'READY' END,
         updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [orderId],
    );

    await client.query("COMMIT");
    return getOrder(orderId);
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      const existing = await db.query("SELECT id FROM public.orders WHERE quotation_id = $1", [quotationId]);
      if (existing.rows.length) return getOrder(existing.rows[0].id);
    }
    throw error;
  } finally {
    client.release();
  }
}

async function allocateItem(
  client,
  orderId,
  orderItemId,
  productId,
  requiredQuantity,
  allocationType,
  createBackorder = true,
) {
  const inventory = await client.query(
    `SELECT wi.id, wi.warehouse_id, wi.quantity, w.name, w.latitude, w.longitude
     FROM public.warehouse_inventory wi
     JOIN public.warehouses w ON w.id = wi.warehouse_id
     WHERE wi.product_id = $1 AND wi.quantity > 0 AND w.is_active = TRUE
     ORDER BY wi.quantity DESC, w.name ASC
     FOR UPDATE OF wi`,
    [productId],
  );

  let remaining = Number(requiredQuantity);
  for (const warehouse of inventory.rows) {
    if (remaining <= 0) break;
    const quantity = Math.min(remaining, Number(warehouse.quantity));
    await client.query(
      `UPDATE public.warehouse_inventory SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [quantity, warehouse.id],
    );
    await client.query(
      `INSERT INTO public.fulfillment_allocations
       (order_id, order_item_id, warehouse_id, quantity, allocation_type, shipping_cost)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [orderId, orderItemId, warehouse.warehouse_id, quantity, allocationType, shippingCost(warehouse)],
    );
    remaining -= quantity;
  }

  if (remaining > 0 && createBackorder) {
    await client.query(
      `INSERT INTO public.backorders (order_id, order_item_id, quantity) VALUES ($1, $2, $3)`,
      [orderId, orderItemId, remaining],
    );
  }
  return remaining;
}

async function listOrders(user) {
  const confirmed = await db.query(
    `SELECT q.id FROM public.quotations q
     LEFT JOIN public.orders o ON o.quotation_id = q.id
     WHERE q.status = 'CONFIRMED' AND o.id IS NULL
     ${user.role === "SALES_REP" ? "AND q.sales_rep_id = $1" : ""}`,
    user.role === "SALES_REP" ? [user.id] : [],
  );
  for (const quotation of confirmed.rows) {
    await createOrderForQuotation(quotation.id);
  }

  const params = [];
  let filter = "";
  if (user.role === "SALES_REP") {
    params.push(user.id);
    filter = "WHERE q.sales_rep_id = $1";
  }
  const result = await db.query(
    `SELECT o.id, o.order_number, o.status, o.fulfillment_status, o.created_at,
            q.quotation_number, c.company_name, c.full_name AS customer_name,
            COALESCE(SUM(fa.quantity), 0)::int AS allocated_quantity,
            COALESCE(SUM(bo.quantity), 0)::int AS backorder_quantity,
            COUNT(DISTINCT fa.warehouse_id)::int AS warehouse_count,
            COALESCE(SUM(fa.shipping_cost), 0)::numeric AS shipping_cost
     FROM public.orders o
     JOIN public.quotations q ON q.id = o.quotation_id
     JOIN public.users c ON c.id = o.customer_id
     LEFT JOIN public.fulfillment_allocations fa ON fa.order_id = o.id AND fa.status = 'RESERVED'
     LEFT JOIN public.backorders bo ON bo.order_id = o.id AND bo.status = 'OPEN'
     ${filter}
     GROUP BY o.id, q.quotation_number, c.company_name, c.full_name
     ORDER BY o.created_at DESC`,
    params,
  );
  return result.rows;
}

async function listWarehouses() {
  const result = await db.query(
    "SELECT id, name FROM public.warehouses WHERE is_active = TRUE ORDER BY name",
  );
  return result.rows;
}

async function getOrder(orderId) {
  const orderResult = await db.query(
    `SELECT o.id, o.order_number, o.status, o.fulfillment_status, o.created_at,
            q.quotation_number, q.customer_id, c.company_name, c.full_name AS customer_name
     FROM public.orders o
     JOIN public.quotations q ON q.id = o.quotation_id
     JOIN public.users c ON c.id = o.customer_id WHERE o.id = $1`,
    [orderId],
  );
  if (!orderResult.rows.length) throw fulfillmentError("Order not found.", 404);
  const items = await db.query(
    `SELECT oi.id, oi.product_id, p.name, oi.quantity,
            COALESCE(json_agg(json_build_object(
              'warehouseId', w.id, 'warehouseName', w.name, 'quantity', fa.quantity,
              'shippingCost', fa.shipping_cost, 'allocationType', fa.allocation_type
            ) ORDER BY w.name) FILTER (WHERE fa.id IS NOT NULL), '[]') AS allocations,
            COALESCE((SELECT SUM(quantity) FROM public.backorders WHERE order_item_id = oi.id AND status = 'OPEN'), 0)::int AS backorder_quantity
     FROM public.order_items oi
     JOIN public.products p ON p.id = oi.product_id
     LEFT JOIN public.fulfillment_allocations fa ON fa.order_item_id = oi.id AND fa.status = 'RESERVED'
     LEFT JOIN public.warehouses w ON w.id = fa.warehouse_id
     WHERE oi.order_id = $1 GROUP BY oi.id, p.name ORDER BY p.name`,
    [orderId],
  );
  const totals = await db.query(
    `SELECT COALESCE(SUM(fa.quantity), 0)::int AS reserved_quantity,
            COALESCE(SUM(fa.shipping_cost), 0)::numeric AS shipping_cost,
            COALESCE(SUM(bo.quantity), 0)::int AS backorder_quantity
     FROM public.orders o
     LEFT JOIN public.fulfillment_allocations fa ON fa.order_id = o.id AND fa.status = 'RESERVED'
     LEFT JOIN public.backorders bo ON bo.order_id = o.id AND bo.status = 'OPEN'
     WHERE o.id = $1`,
    [orderId],
  );
  return {
    ...orderResult.rows[0],
    items: items.rows,
    totals: {
      reservedQuantity: totals.rows[0].reserved_quantity,
      backorderQuantity: totals.rows[0].backorder_quantity,
      shippingCost: Number(totals.rows[0].shipping_cost),
    },
  };
}

async function manualSplit(orderId, user, allocations) {
  if (!["SALES_REP", "SALES_MANAGER", "ADMIN", "OPERATIONS"].includes(user.role)) {
    throw fulfillmentError("You are not allowed to change fulfillment.", 403);
  }
  if (!Array.isArray(allocations) || !allocations.length) throw fulfillmentError("At least one allocation is required.");
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const order = await client.query("SELECT id FROM public.orders WHERE id = $1 FOR UPDATE", [orderId]);
    if (!order.rows.length) throw fulfillmentError("Order not found.", 404);

    const existing = await client.query(
      `SELECT fa.warehouse_id, fa.quantity, oi.product_id
       FROM public.fulfillment_allocations fa
       JOIN public.order_items oi ON oi.id = fa.order_item_id
       WHERE fa.order_id = $1 AND fa.status = 'RESERVED'`,
      [orderId],
    );
    for (const allocation of existing.rows) {
      await client.query(
        `UPDATE public.warehouse_inventory SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP
         WHERE warehouse_id = $2 AND product_id = $3`,
        [allocation.quantity, allocation.warehouse_id, allocation.product_id],
      );
    }
    await client.query("DELETE FROM public.fulfillment_allocations WHERE order_id = $1", [orderId]);
    await client.query("DELETE FROM public.backorders WHERE order_id = $1 AND status = 'OPEN'", [orderId]);

    const requestedByItem = new Map();
    for (const allocation of allocations) {
      const item = await client.query("SELECT id, product_id, quantity FROM public.order_items WHERE id = $1 AND order_id = $2", [allocation.orderItemId, orderId]);
      if (!item.rows.length) throw fulfillmentError("Order item not found.", 404);
      const quantity = Number(allocation.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) throw fulfillmentError("Allocation quantity must be positive.");
      requestedByItem.set(allocation.orderItemId, (requestedByItem.get(allocation.orderItemId) || 0) + quantity);
      const warehouse = await client.query(
        `SELECT wi.id, wi.quantity, w.name, w.latitude, w.longitude FROM public.warehouse_inventory wi
         JOIN public.warehouses w ON w.id = wi.warehouse_id WHERE wi.warehouse_id = $1 AND wi.product_id = $2 FOR UPDATE OF wi`,
        [allocation.warehouseId, item.rows[0].product_id],
      );
      if (!warehouse.rows.length || Number(warehouse.rows[0].quantity) < quantity) throw fulfillmentError(`Insufficient stock at ${warehouse.rows[0]?.name || "selected warehouse"}.`);
      await client.query("UPDATE public.warehouse_inventory SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [quantity, warehouse.rows[0].id]);
      await client.query(`INSERT INTO public.fulfillment_allocations (order_id, order_item_id, warehouse_id, quantity, allocation_type, shipping_cost) VALUES ($1, $2, $3, $4, 'MANUAL', $5)`, [orderId, allocation.orderItemId, allocation.warehouseId, Number(allocation.quantity), shippingCost(warehouse.rows[0])]);
    }
    for (const item of (await client.query("SELECT id, product_id, quantity FROM public.order_items WHERE order_id = $1", [orderId])).rows) {
      const allocated = requestedByItem.get(item.id) || 0;
      if (allocated > item.quantity) throw fulfillmentError("Manual allocation exceeds required quantity.");
      if (allocated < item.quantity) await client.query("INSERT INTO public.backorders (order_id, order_item_id, quantity) VALUES ($1, $2, $3)", [orderId, item.id, item.quantity - allocated]);
    }
    await client.query("UPDATE public.orders SET fulfillment_status = 'MANUAL_SPLIT', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [orderId]);
    await client.query("COMMIT");
    return getOrder(orderId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function consolidateBackorders(orderId, user) {
  if (!["SALES_REP", "SALES_MANAGER", "ADMIN", "OPERATIONS"].includes(user.role)) throw fulfillmentError("You are not allowed to consolidate backorders.", 403);
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const backorders = await client.query(
            `WITH locked_backorders AS (
          SELECT b.id, b.order_item_id, b.quantity
          FROM public.backorders b
          WHERE b.order_id = $1 AND b.status = 'OPEN'
          FOR UPDATE
        )
        SELECT (ARRAY_AGG(lb.id ORDER BY lb.id))[1] AS id,
          ARRAY_AGG(lb.id) AS ids,
          lb.order_item_id,
          SUM(lb.quantity)::int AS quantity,
              oi.product_id
        FROM locked_backorders lb
        JOIN public.order_items oi ON oi.id = lb.order_item_id
        GROUP BY lb.order_item_id, oi.product_id`,
      [orderId],
    );
    for (const backorder of backorders.rows) {
      const remaining = await allocateItem(
        client,
        orderId,
        backorder.order_item_id,
        backorder.product_id,
        backorder.quantity,
        "CONSOLIDATED",
        false,
      );
      if (remaining === 0) {
        await client.query(
          "UPDATE public.backorders SET status = 'FULFILLED', updated_at = CURRENT_TIMESTAMP WHERE id = ANY($1::uuid[])",
          [backorder.ids],
        );
      } else {
        await client.query(
          "UPDATE public.backorders SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
          [remaining, backorder.id],
        );
        await client.query(
          "UPDATE public.backorders SET status = 'FULFILLED', updated_at = CURRENT_TIMESTAMP WHERE id = ANY($1::uuid[]) AND id <> $2",
          [backorder.ids, backorder.id],
        );
      }
    }
    await client.query("UPDATE public.orders SET fulfillment_status = CASE WHEN EXISTS (SELECT 1 FROM public.backorders WHERE order_id = $1 AND status = 'OPEN') THEN 'PARTIAL_BACKORDER' ELSE 'READY' END, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [orderId]);
    await client.query("COMMIT");
    return getOrder(orderId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { createOrderForQuotation, listOrders, listWarehouses, getOrder, manualSplit, consolidateBackorders, fulfillmentStatus };
