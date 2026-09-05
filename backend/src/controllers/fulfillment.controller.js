const fulfillmentService = require("../services/fulfillment.service");

function sendError(res, error) {
  return res.status(error.statusCode || 500).json({ success: false, message: error.message || "Fulfillment request failed." });
}

async function listOrders(req, res) {
  try {
    return res.json({ success: true, data: await fulfillmentService.listOrders(req.user) });
  } catch (error) {
    return sendError(res, error);
  }
}

async function listWarehouses(req, res) {
  try {
    return res.json({ success: true, data: await fulfillmentService.listWarehouses() });
  } catch (error) {
    return sendError(res, error);
  }
}

async function getOrder(req, res) {
  try {
    return res.json({ success: true, data: await fulfillmentService.getOrder(req.params.id) });
  } catch (error) {
    return sendError(res, error);
  }
}

async function manualSplit(req, res) {
  try {
    return res.json({ success: true, data: await fulfillmentService.manualSplit(req.params.id, req.user, req.body.allocations) });
  } catch (error) {
    return sendError(res, error);
  }
}

async function consolidate(req, res) {
  try {
    return res.json({ success: true, data: await fulfillmentService.consolidateBackorders(req.params.id, req.user) });
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = { listOrders, listWarehouses, getOrder, manualSplit, consolidate };
