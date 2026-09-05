const quotationService = require("../services/quotation.service");

async function getCustomers(req, res) {
  try {
    return res.json({ success: true, data: await quotationService.getCustomers() });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

async function getProducts(req, res) {
  try {
    return res.json({ success: true, data: await quotationService.getProducts() });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

async function getDashboardSummary(req, res) {
  try {
    return res.json({ success: true, data: await quotationService.getDashboardSummary(req.user) });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

async function listQuotations(req, res) {
  try {
    return res.json({ success: true, data: await quotationService.listQuotations(req.user) });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

async function getQuotation(req, res) {
  try {
    return res.json({ success: true, data: await quotationService.getQuotation(req.params.id, req.user) });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

async function createQuotation(req, res) {
  try {
    const quotation = await quotationService.createDraft(req.user, req.body);
    return res.status(201).json({
      success: true,
      message: `Quotation ${quotation.quotationNumber} created successfully.`,
      data: quotation,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

async function submitQuotation(req, res) {
  try {
    const quotation = await quotationService.submitQuotation(req.user, req.params.id);
    return res.status(200).json({
      success: true,
      message: `Quotation ${quotation.quotationNumber} submitted for approval.`,
      data: quotation,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

async function listCustomerRequests(req, res) {
  try {
    return res.json({
      success: true,
      data: await quotationService.listPendingCustomerQuoteRequests(req.user),
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

async function convertCustomerRequest(req, res) {
  try {
    const quotation = await quotationService.convertCustomerQuoteRequest(
      req.params.requestId,
      req.user,
    );
    return res.status(201).json({
      success: true,
      message: `Quotation ${quotation.quotationNumber} created from the customer request.`,
      data: quotation,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getCustomers,
  getProducts,
  getDashboardSummary,
  listQuotations,
  getQuotation,
  createQuotation,
  submitQuotation,
  listCustomerRequests,
  convertCustomerRequest,
};
