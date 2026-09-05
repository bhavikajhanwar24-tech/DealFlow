const db = require("../config/db");

// Configurable cost parameters (can be adjusted via environment or admin config)
const COST_PARAMETERS = {
  distanceCostPerKm: Number(process.env.DISTANCE_COST_PER_KM) || 10, // ₹10 per km
  fixedShipmentCost: Number(process.env.FIXED_SHIPMENT_COST) || 2000, // ₹2,000 fixed shipment fee
  warehouseHandlingCost: Number(process.env.WAREHOUSE_HANDLING_COST) || 500, // ₹500 handling fee
};

/**
 * Calculates straight-line distance in kilometers using the Haversine formula.
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
  const R = 6371; // Earth radius in km
  const dLat = ((Number(lat2) - Number(lat1)) * Math.PI) / 180;
  const dLon = ((Number(lon2) - Number(lon1)) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((Number(lat1) * Math.PI) / 180) *
      Math.cos((Number(lat2) * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Calculates total shipment cost for a warehouse to destination.
 */
function calculateWarehouseShipmentCost(distanceKm) {
  const distanceCost = Math.round(distanceKm * COST_PARAMETERS.distanceCostPerKm);
  const totalCost = distanceCost + COST_PARAMETERS.fixedShipmentCost + COST_PARAMETERS.warehouseHandlingCost;
  return {
    distanceCost,
    fixedShipmentCost: COST_PARAMETERS.fixedShipmentCost,
    handlingCost: COST_PARAMETERS.warehouseHandlingCost,
    totalCost,
  };
}

/**
 * Generates power set (all non-empty combinations) of array items.
 */
function getCombinations(array) {
  const result = [];
  const f = (prefix, array) => {
    for (let i = 0; i < array.length; i++) {
      const next = [...prefix, array[i]];
      result.push(next);
      f(next, array.slice(i + 1));
    }
  };
  f([], array);
  return result;
}

/**
 * Main Solver Engine for Smart Warehouse Route Optimizer
 */
async function getFulfillmentOptionsForOrder(orderId) {
  // 1. Fetch Order and Customer details
  const orderResult = await db.query(
    `SELECT o.id, o.order_number, o.status, o.fulfillment_status,
            o.delivery_address, o.delivery_city, o.delivery_state, o.delivery_zip, o.delivery_country,
            o.delivery_latitude, o.delivery_longitude, o.destination_submitted_at,
            q.quotation_number, c.id AS customer_id, c.company_name, c.full_name AS customer_name
     FROM public.orders o
     JOIN public.quotations q ON q.id = o.quotation_id
     JOIN public.users c ON c.id = o.customer_id
     WHERE o.id = $1`,
    [orderId]
  );

  if (!orderResult.rows.length) {
    const err = new Error("Order not found.");
    err.statusCode = 404;
    throw err;
  }

  const order = orderResult.rows[0];

  // 2. Fetch Order Items
  const itemsResult = await db.query(
    `SELECT oi.id AS order_item_id, oi.product_id, oi.quantity AS required_quantity,
            p.name AS product_name, p.sku, p.category
     FROM public.order_items oi
     JOIN public.products p ON p.id = oi.product_id
     WHERE oi.order_id = $1`,
    [orderId]
  );

  const orderItems = itemsResult.rows;

  // Check destination availability
  const hasDestination = Boolean(
    order.delivery_latitude != null &&
    order.delivery_longitude != null &&
    order.delivery_city
  );

  const destination = hasDestination
    ? {
        address: order.delivery_address || "",
        city: order.delivery_city || "",
        state: order.delivery_state || "",
        zip: order.delivery_zip || "",
        country: order.delivery_country || "",
        latitude: Number(order.delivery_latitude),
        longitude: Number(order.delivery_longitude),
      }
    : null;

  // 3. Fetch Active Warehouses and Inventory for Order Products
  const warehousesResult = await db.query(
    `SELECT w.id, w.name, w.address, w.city, w.state, w.latitude, w.longitude, w.is_active
     FROM public.warehouses w
     WHERE w.is_active = TRUE
     ORDER BY w.name ASC`
  );

  const warehouses = warehousesResult.rows;

  const inventoryResult = await db.query(
    `SELECT wi.warehouse_id, wi.product_id, wi.quantity
     FROM public.warehouse_inventory wi
     JOIN public.warehouses w ON w.id = wi.warehouse_id
     WHERE w.is_active = TRUE`
  );

  // Map inventory: warehouseId -> productId -> availableQuantity
  const inventoryMap = new Map();
  for (const row of inventoryResult.rows) {
    if (!inventoryMap.has(row.warehouse_id)) {
      inventoryMap.set(row.warehouse_id, new Map());
    }
    inventoryMap.get(row.warehouse_id).set(row.product_id, Number(row.quantity));
  }

  // 4. Calculate total inventory per product across all warehouses & check shortages
  const shortages = [];
  let isShortage = false;

  for (const item of orderItems) {
    let totalAvailable = 0;
    for (const w of warehouses) {
      const avail = inventoryMap.get(w.id)?.get(item.product_id) || 0;
      totalAvailable += avail;
    }
    const req = Number(item.required_quantity);
    if (totalAvailable < req) {
      isShortage = true;
      shortages.push({
        productId: item.product_id,
        productName: item.product_name,
        sku: item.sku,
        requiredQuantity: req,
        totalAvailableQuantity: totalAvailable,
        shortageQuantity: req - totalAvailable,
      });
    }
  }

  // Calculate distances from all warehouses to destination
  const warehouseDistances = new Map();
  for (const w of warehouses) {
    const dist = hasDestination
      ? calculateHaversineDistance(
          Number(w.latitude),
          Number(w.longitude),
          destination.latitude,
          destination.longitude
        )
      : 0;
    warehouseDistances.set(w.id, dist);
  }

  // Build warehouse inventory summary per warehouse
  const warehouseSummaries = warehouses.map((w) => {
    const dist = warehouseDistances.get(w.id);
    const costDetails = calculateWarehouseShipmentCost(dist);
    const itemStockList = orderItems.map((item) => ({
      productId: item.product_id,
      productName: item.product_name,
      availableQuantity: inventoryMap.get(w.id)?.get(item.product_id) || 0,
    }));
    return {
      id: w.id,
      name: w.name,
      address: w.address,
      city: w.city || w.name,
      state: w.state || "",
      latitude: Number(w.latitude),
      longitude: Number(w.longitude),
      distanceKm: dist,
      shipmentCost: costDetails.totalCost,
      inventory: itemStockList,
    };
  });

  // If shortage or no destination provided, return shortage state or prompt for destination
  if (isShortage) {
    return {
      orderId: order.id,
      orderNumber: order.order_number,
      customerName: order.company_name || order.customer_name,
      fulfillmentPossible: false,
      hasDestination,
      destination,
      shortages,
      costParameters: COST_PARAMETERS,
      warehouses: warehouseSummaries,
      options: [],
    };
  }

  if (!hasDestination) {
    return {
      orderId: order.id,
      orderNumber: order.order_number,
      customerName: order.company_name || order.customer_name,
      fulfillmentPossible: true,
      hasDestination: false,
      destination: null,
      message: "Customer delivery destination required to calculate optimal route.",
      costParameters: COST_PARAMETERS,
      warehouses: warehouseSummaries,
      options: [],
    };
  }

  // 5. Evaluate Combinations of Warehouses
  const allCombinations = getCombinations(warehouses);
  const validPlans = [];

  for (const combo of allCombinations) {
    // Sort warehouses in combo by distance to destination ascending
    const sortedCombo = [...combo].sort(
      (a, b) => warehouseDistances.get(a.id) - warehouseDistances.get(b.id)
    );

    // Track remaining required quantity for each order item
    const itemRemainingMap = new Map();
    for (const item of orderItems) {
      itemRemainingMap.set(item.product_id, Number(item.required_quantity));
    }

    const allocations = [];
    const usedWarehouseIds = new Set();

    for (const w of sortedCombo) {
      let warehouseUsedInPlan = false;
      const warehouseAllocations = [];

      for (const item of orderItems) {
        const remainingReq = itemRemainingMap.get(item.product_id);
        if (remainingReq <= 0) continue;

        const avail = inventoryMap.get(w.id)?.get(item.product_id) || 0;
        if (avail > 0) {
          const allocatedQty = Math.min(remainingReq, avail);
          itemRemainingMap.set(item.product_id, remainingReq - allocatedQty);
          warehouseAllocations.push({
            orderItemId: item.order_item_id,
            productId: item.product_id,
            productName: item.product_name,
            allocatedQuantity: allocatedQty,
          });
          warehouseUsedInPlan = true;
        }
      }

      if (warehouseUsedInPlan) {
        usedWarehouseIds.add(w.id);
        allocations.push({
          warehouseId: w.id,
          warehouseName: w.name,
          city: w.city || w.name,
          latitude: Number(w.latitude),
          longitude: Number(w.longitude),
          distanceKm: warehouseDistances.get(w.id),
          items: warehouseAllocations,
        });
      }
    }

    // Check if 100% of all required item quantities were allocated
    const isFullyAllocated = Array.from(itemRemainingMap.values()).every(
      (qty) => qty <= 0
    );

    if (isFullyAllocated) {
      // Calculate total fulfillment cost for this plan
      let planTotalCost = 0;
      const shipmentBreakdown = allocations.map((alloc) => {
        const dist = alloc.distanceKm;
        const costDetails = calculateWarehouseShipmentCost(dist);
        planTotalCost += costDetails.totalCost;
        return {
          warehouseId: alloc.warehouseId,
          warehouseName: alloc.warehouseName,
          city: alloc.city,
          distanceKm: dist,
          distanceCost: costDetails.distanceCost,
          fixedShipmentCost: costDetails.fixedShipmentCost,
          handlingCost: costDetails.handlingCost,
          totalShipmentCost: costDetails.totalCost,
          items: alloc.items,
        };
      });

      // Signature key to filter out redundant/duplicate allocation plans
      const planKey = shipmentBreakdown
        .map((s) => `${s.warehouseId}:${s.items.map((i) => `${i.productId}=${i.allocatedQuantity}`).join(",")}`)
        .sort()
        .join("|");

      validPlans.push({
        planKey,
        warehousesUsedCount: shipmentBreakdown.length,
        totalCost: planTotalCost,
        shipments: shipmentBreakdown,
      });
    }
  }

  // Deduplicate plans by planKey and sort by totalCost ascending
  const uniquePlansMap = new Map();
  for (const plan of validPlans) {
    if (
      !uniquePlansMap.has(plan.planKey) ||
      uniquePlansMap.get(plan.planKey).totalCost > plan.totalCost
    ) {
      uniquePlansMap.set(plan.planKey, plan);
    }
  }

  const sortedPlans = Array.from(uniquePlansMap.values()).sort(
    (a, b) => a.totalCost - b.totalCost
  );

  // Rank plans: 🥇 Option 1 (Optimal), 🥈 Option 2, 🥉 Option 3
  const rankedOptions = sortedPlans.map((plan, index) => {
    const isOptimal = index === 0;
    return {
      optionId: `OPTION-${index + 1}`,
      rank: index + 1,
      badge: index === 0 ? "🥇 Option 1" : index === 1 ? "🥈 Option 2" : `🥉 Option ${index + 1}`,
      isOptimal,
      totalCost: plan.totalCost,
      warehousesCount: plan.warehousesUsedCount,
      summary: plan.shipments
        .map((s) => `${s.city} (${s.items.map((i) => `${i.allocatedQuantity} ${i.productName}`).join(", ")})`)
        .join(" + "),
      fullInventoryFulfilled: true,
      shipments: plan.shipments,
    };
  });

  const optimalOption = rankedOptions[0] || null;
  const secondBestOption = rankedOptions[1] || null;

  const savings =
    optimalOption && secondBestOption
      ? Math.max(0, secondBestOption.totalCost - optimalOption.totalCost)
      : 0;

  // 6. Build Map Data Payload
  const mapData = {
    destinationMarker: {
      name: order.company_name || order.customer_name,
      city: destination.city,
      address: `${destination.address}, ${destination.city}, ${destination.state}`,
      latitude: destination.latitude,
      longitude: destination.longitude,
    },
    warehouseMarkers: warehouseSummaries.map((w) => {
      const isSelected = optimalOption?.shipments.some((s) => s.warehouseId === w.id);
      const allocatedItems = optimalOption?.shipments.find((s) => s.warehouseId === w.id)?.items || [];
      return {
        ...w,
        isSelectedInOptimalRoute: isSelected,
        allocatedItems,
      };
    }),
    routes: (optimalOption ? optimalOption.shipments : []).map((s) => ({
      fromWarehouseId: s.warehouseId,
      fromWarehouseName: s.warehouseName,
      fromCity: s.city,
      fromCoords: [
        warehouseSummaries.find((w) => w.id === s.warehouseId)?.latitude,
        warehouseSummaries.find((w) => w.id === s.warehouseId)?.longitude,
      ],
      toDestinationCoords: [destination.latitude, destination.longitude],
      distanceKm: s.distanceKm,
      cost: s.totalShipmentCost,
      items: s.items,
      isOptimal: true,
    })),
  };

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    customerName: order.company_name || order.customer_name,
    fulfillmentPossible: true,
    hasDestination: true,
    destination,
    costParameters: COST_PARAMETERS,
    optimalPlan: optimalOption,
    secondBestPlan: secondBestOption,
    savingsVsNextBest: savings,
    alternativeOptions: rankedOptions.slice(1),
    allOptions: rankedOptions,
    warehouses: warehouseSummaries,
    mapData,
  };
}

/**
 * Persists the selected fulfillment plan into PostgreSQL fulfillment_allocations
 */
async function approveFulfillmentPlan(orderId, user) {
  if (!["OPERATIONS", "ADMIN", "SALES_MANAGER"].includes(user.role)) {
    const err = new Error("Only Operations managers and administrators can approve fulfillment plans.");
    err.statusCode = 403;
    throw err;
  }

  const options = await getFulfillmentOptionsForOrder(orderId);
  if (!options.fulfillmentPossible || !options.optimalPlan) {
    const err = new Error("Cannot approve fulfillment plan. Complete inventory is not available across warehouses.");
    err.statusCode = 400;
    throw err;
  }

  const optimalPlan = options.optimalPlan;
  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");

    // Lock order
    const orderRes = await client.query("SELECT id FROM public.orders WHERE id = $1 FOR UPDATE", [orderId]);
    if (!orderRes.rows.length) {
      throw new Error("Order not found.");
    }

    // 1. Restore previous allocations if any
    const existing = await client.query(
      `SELECT fa.warehouse_id, fa.quantity, oi.product_id
       FROM public.fulfillment_allocations fa
       JOIN public.order_items oi ON oi.id = fa.order_item_id
       WHERE fa.order_id = $1 AND fa.status = 'RESERVED'`,
      [orderId]
    );

    for (const alloc of existing.rows) {
      await client.query(
        `UPDATE public.warehouse_inventory SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP
         WHERE warehouse_id = $2 AND product_id = $3`,
        [alloc.quantity, alloc.warehouse_id, alloc.product_id]
      );
    }

    // Clear existing allocations and backorders
    await client.query("DELETE FROM public.fulfillment_allocations WHERE order_id = $1", [orderId]);
    await client.query("DELETE FROM public.backorders WHERE order_id = $1 AND status = 'OPEN'", [orderId]);

    // 2. Apply new optimal allocations
    for (const shipment of optimalPlan.shipments) {
      for (const itemAlloc of shipment.items) {
        // Deduct inventory
        await client.query(
          `UPDATE public.warehouse_inventory SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP
           WHERE warehouse_id = $2 AND product_id = $3`,
          [itemAlloc.allocatedQuantity, shipment.warehouseId, itemAlloc.productId]
        );

        // Insert fulfillment allocation
        await client.query(
          `INSERT INTO public.fulfillment_allocations
           (order_id, order_item_id, warehouse_id, quantity, allocation_type, shipping_cost, status)
           VALUES ($1, $2, $3, $4, 'OPTIMAL_ROUTE', $5, 'RESERVED')`,
          [
            orderId,
            itemAlloc.orderItemId,
            shipment.warehouseId,
            itemAlloc.allocatedQuantity,
            shipment.totalShipmentCost,
          ]
        );
      }
    }

    // 3. Update Order fulfillment status to OPTIMAL_APPROVED
    await client.query(
      `UPDATE public.orders
       SET fulfillment_status = 'OPTIMAL_APPROVED', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [orderId]
    );

    await client.query("COMMIT");

    return {
      orderId,
      status: "OPTIMAL_APPROVED",
      message: `Optimal multi-warehouse fulfillment plan approved successfully for Order ${options.orderNumber}.`,
      approvedPlan: optimalPlan,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  calculateHaversineDistance,
  calculateWarehouseShipmentCost,
  getFulfillmentOptionsForOrder,
  approveFulfillmentPlan,
  COST_PARAMETERS,
};
