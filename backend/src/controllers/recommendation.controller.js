const recommendationService = require("../services/recommendation.service");

async function getRecommendations(req, res) {
  try {
    const { items, customerId, dismissedProductIds } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: "Items must be an array." });
    }

    const recommendations = await recommendationService.getRecommendations(items, {
      customerId,
      dismissedProductIds,
    });
    return res.json({
      success: true,
      data: recommendations,
    });
  } catch (error) {
    console.error("[Recommendation Controller]", error.message);
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || "Recommendation request failed." });
  }
}

module.exports = { getRecommendations };
