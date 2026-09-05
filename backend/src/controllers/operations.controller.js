const routeOptimizerService = require("../services/routeOptimizer.service");
const db = require("../config/db");

function sendError(res, error) {
  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || "Operations request failed.",
  });
}

async function listWarehouses(req, res) {
  try {
    const result = await db.query(
      `SELECT w.id, w.name, w.address, w.city, w.state, w.latitude, w.longitude, w.is_active,
              COALESCE(json_agg(json_build_object(
                'productId', p.id,
                'productName', p.name,
                'sku', p.sku,
                'quantity', wi.quantity
              )) FILTER (WHERE wi.id IS NOT NULL), '[]') AS inventory
       FROM public.warehouses w
       LEFT JOIN public.warehouse_inventory wi ON wi.warehouse_id = w.id
       LEFT JOIN public.products p ON p.id = wi.product_id
       WHERE w.is_active = TRUE
       GROUP BY w.id
       ORDER BY w.name ASC`
    );
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    return sendError(res, error);
  }
}

async function getFulfillmentOptions(req, res) {
  try {
    const { orderId } = req.params;
    const data = await routeOptimizerService.getFulfillmentOptionsForOrder(orderId);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
}

async function getOptimalRoute(req, res) {
  try {
    const { orderId } = req.params;
    const data = await routeOptimizerService.getFulfillmentOptionsForOrder(orderId);
    return res.json({
      success: true,
      data: {
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        customerName: data.customerName,
        destination: data.destination,
        optimalPlan: data.optimalPlan,
        savingsVsNextBest: data.savingsVsNextBest,
        mapData: data.mapData,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
}

async function approveFulfillment(req, res) {
  try {
    const { orderId } = req.params;
    const result = await routeOptimizerService.approveFulfillmentPlan(orderId, req.user);
    return res.json({ success: true, data: result });
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = {
  listWarehouses,
  getFulfillmentOptions,
  getOptimalRoute,
  approveFulfillment,
};
