const quotationService = require("../services/quotation.service");

function sendError(res, error) {
  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || "Customer quotation request failed."
  });
}

async function list(req, res) {
  try {
    return res.json({ success: true, data: await quotationService.listCustomerQuotations(req.user) });
  } catch (error) {
    return sendError(res, error);
  }
}

async function detail(req, res) {
  try {
    return res.json({ success: true, data: await quotationService.getCustomerQuotation(req.params.id, req.user) });
  } catch (error) {
    return sendError(res, error);
  }
}

async function negotiate(req, res) {
  try {
    const request = await quotationService.createNegotiationRequest(req.params.id, req.user, req.body || {});
    return res.status(201).json({
      success: true,
      message: "Your negotiation request has been submitted. The sales team will review your requested terms.",
      data: request
    });
  } catch (error) {
    return sendError(res, error);
  }
}

async function confirm(req, res) {
  try {
    const quotation = await quotationService.confirmCustomerQuotation(req.params.id, req.user);
    return res.json({ success: true, message: "Quotation confirmed successfully.", data: quotation });
  } catch (error) {
    return sendError(res, error);
  }
}

async function reject(req, res) {
  try {
    const quotation = await quotationService.rejectCustomerQuotation(req.params.id, req.user);
    return res.json({ success: true, message: "Quotation rejected successfully.", data: quotation });
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = { list, detail, negotiate, confirm, reject };
