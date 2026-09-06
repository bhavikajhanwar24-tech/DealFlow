const crypto = require("crypto");
const db = require("../config/db");
const { Groq } = require("groq-sdk");

// LLM Configuration
const GROQ_API_KEY = process.env.GROQ_API_KEY || null;
const PRIMARY_MODEL = "openai/gpt-oss-120b";

// Fast In-Memory Cache (TTL: 2 minutes)
const recommendationCache = new Map();
const CACHE_TTL_MS = 2 * 60 * 1000;

function getCacheKey(items, customerId = "", dismissedIds = []) {
  const sortedItems = [...items]
    .map((i) => `${i.productId || i.id}:${i.quantity || 1}`)
    .sort()
    .join("|");
  const sortedDismissed = [...dismissedIds].sort().join(",");
  return crypto
    .createHash("sha256")
    .update(`${sortedItems}#cust:${customerId}#dism:${sortedDismissed}`)
    .digest("hex");
}

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

/**
 * 1. Candidate Product Retrieval & Pairing Rules
 */
async function retrieveCandidates(quotationItems, dismissedIds = []) {
  const existingProductIds = quotationItems
    .map((i) => i.productId || i.id)
    .filter(Boolean);

  if (existingProductIds.length === 0) {
    return [];
  }

  // 1. Fetch explicit pairings from product_pairings
  const explicitPairingsResult = await db.query(
    `SELECT pp.paired_product_id,
            COALESCE(pp.pairing_type, 'CROSS_SELL') AS pairing_type,
            MAX(pp.priority) AS pairing_priority,
            STRING_AGG(DISTINCT pp.promotion_tag, ', ') AS pairing_promotions
     FROM public.product_pairings pp
     WHERE pp.product_id = ANY($1::uuid[])
       AND pp.is_active = TRUE
       AND pp.paired_product_id <> ALL($1::uuid[])
     GROUP BY pp.paired_product_id, pp.pairing_type`,
    [existingProductIds]
  );

  const pairingMap = new Map();
  explicitPairingsResult.rows.forEach((row) => {
    pairingMap.set(row.paired_product_id, {
      type: row.pairing_type === "UPSELL" ? "upsell" : "cross_sell",
      priority: Number(row.pairing_priority || 50),
      promotionTag: row.pairing_promotions || null,
      explicit: true,
    });
  });

  // 2. Fetch catalog products (excluding products already in quotation and dismissed)
  const excludeIds = Array.from(new Set([...existingProductIds, ...dismissedIds]));
  const productsQuery = `
    SELECT p.id, p.name, p.sku, p.category, p.description,
           p.unit_price, p.cost, p.inventory_reference, p.is_active,
           COALESCE(SUM(wi.quantity), NULL) AS available_inventory,
           COALESCE(STRING_AGG(DISTINCT ppromo.tag, ', '), NULL) AS active_promotions,
           MAX(COALESCE(ppromo.priority, 0)) AS promo_priority
    FROM public.products p
    LEFT JOIN public.warehouse_inventory wi ON wi.product_id = p.id
    LEFT JOIN public.product_promotions ppromo
      ON ppromo.product_id = p.id
      AND ppromo.is_active = TRUE
      AND (ppromo.starts_at IS NULL OR ppromo.starts_at <= CURRENT_TIMESTAMP)
      AND (ppromo.ends_at IS NULL OR ppromo.ends_at >= CURRENT_TIMESTAMP)
    WHERE p.id <> ALL($1::uuid[])
      AND p.is_active = TRUE
    GROUP BY p.id
  `;

  const productsResult = await db.query(productsQuery, [excludeIds]);
  if (productsResult.rows.length === 0) {
    return [];
  }

  // 3. Identify relationship (Upsell vs Cross-sell) and apply business constraints
  const quoteCategories = new Set(quotationItems.map((i) => i.category).filter(Boolean));
  const maxQuoteUnitPrice = Math.max(
    ...quotationItems.map((i) => Number(i.unitPrice || 0)),
    0
  );

  const validCandidates = [];

  for (const product of productsResult.rows) {
    // Hard constraint: Inventory check
    // If inventory is tracked and quantity <= 0, do not recommend (out of stock constraint)
    if (product.available_inventory !== null && Number(product.available_inventory) <= 0) {
      continue;
    }

    const explicitData = pairingMap.get(product.id);
    let type = "cross_sell";
    let basePriority = 50;
    let pairingPromotion = null;

    if (explicitData) {
      type = explicitData.type;
      basePriority = explicitData.priority;
      pairingPromotion = explicitData.promotionTag;
    } else {
      // Inferred pairing rules:
      // Upsell rule: Same category and higher unit price (upgrade)
      if (quoteCategories.has(product.category) && Number(product.unit_price) > maxQuoteUnitPrice) {
        type = "upsell";
        basePriority = 65;
      } else if (
        // Cross-sell rule: Complementary service / subscription to hardware or vice versa
        (quoteCategories.has("HARDWARE") && ["SERVICE", "SUBSCRIPTION", "SERVICES"].includes(product.category)) ||
        (quoteCategories.has("SUBSCRIPTION") && ["SERVICE", "SOFTWARE"].includes(product.category))
      ) {
        type = "cross_sell";
        basePriority = 60;
      } else {
        type = "cross_sell";
        basePriority = 40;
      }
    }

    // Promotion resolution: active promotion from product_promotions takes precedence, then pairing tag
    const promotionTag = product.active_promotions || pairingPromotion || null;

    validCandidates.push({
      id: product.id,
      productId: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      description: product.description || "",
      unitPrice: Number(product.unit_price),
      cost: Number(product.cost),
      type,
      priority: basePriority,
      promotionTag,
      promotionPriority: Number(product.promo_priority || 0),
      inStock: true,
    });
  }

  return validCandidates;
}

/**
 * 2. Deterministic Margin Delta Calculation
 * Uses exact quotation margin formulas from quotation.service.js
 */
function calculateCandidateMargins(quotationItems, candidates) {
  // Current quote metrics
  const currentSubtotal = money(
    quotationItems.reduce(
      (sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 1),
      0
    )
  );

  const currentDiscount = money(
    quotationItems.reduce(
      (sum, item) =>
        sum +
        (Number(item.unitPrice || 0) *
          Number(item.quantity || 1) *
          Number(item.discountPercent || 0)) /
          100,
      0
    )
  );

  const currentFinalAmount = money(currentSubtotal - currentDiscount);
  const currentTotalCost = money(
    quotationItems.reduce(
      (sum, item) =>
        sum +
        Number(item.costPrice !== undefined ? item.costPrice : item.cost || 0) *
          Number(item.quantity || 1),
      0
    )
  );

  const currentGrossMargin = money(currentFinalAmount - currentTotalCost);
  const currentMarginPercent =
    currentFinalAmount > 0 ? money((currentGrossMargin / currentFinalAmount) * 100) : 0;

  return candidates.map((candidate) => {
    // Adding 1 unit of candidate at regular price
    const candidatePrice = candidate.unitPrice;
    const candidateCost = candidate.cost;
    const candidateDiscount = 0; // Default no discount unless explicit policy

    const newSubtotal = money(currentSubtotal + candidatePrice);
    const newDiscount = money(currentDiscount + candidateDiscount);
    const newFinalAmount = money(newSubtotal - newDiscount);
    const newTotalCost = money(currentTotalCost + candidateCost);
    const newGrossMargin = money(newFinalAmount - newTotalCost);
    const newMarginPercent =
      newFinalAmount > 0 ? money((newGrossMargin / newFinalAmount) * 100) : 0;

    const marginDelta = money(newGrossMargin - currentGrossMargin);
    const marginDeltaPercent = money(newMarginPercent - currentMarginPercent);

    return {
      ...candidate,
      currentQuoteMargin: currentGrossMargin,
      newQuoteMargin: newGrossMargin,
      currentMarginPercent,
      newMarginPercent,
      marginDelta,
      marginDeltaPercent,
    };
  });
}

/**
 * 3. Deterministic Heuristic Scoring & Ranking (Fallback / Baseline)
 */
function rankWithHeuristics(candidates, quotationItems) {
  const primaryItem = quotationItems[0] || { name: "current product", category: "" };

  const scoredCandidates = candidates.map((candidate) => {
    // Signal 1: Affinity & Priority (0 - 0.40)
    const priorityNorm = Math.min(candidate.priority / 100, 1.0) * 0.40;

    // Signal 2: Margin Impact (0 - 0.30)
    let marginSignal = 0.15;
    if (candidate.marginDelta > 0) {
      marginSignal = 0.20 + Math.min(candidate.marginDelta / 10000, 0.10);
    } else if (candidate.marginDeltaPercent < 0) {
      marginSignal = 0.10;
    }

    // Signal 3: Promotion tag presence (0 - 0.20)
    const promoSignal = candidate.promotionTag ? 0.20 : 0.05;

    // Signal 4: Availability & baseline compatibility (0 - 0.10)
    const baselineSignal = 0.10;

    const rawScore = priorityNorm + marginSignal + promoSignal + baselineSignal;
    const score = Number(Math.min(Math.max(rawScore, 0.50), 0.98).toFixed(2));

    let reason = "";
    if (candidate.type === "upsell") {
      reason = `Higher-tier ${candidate.category.toLowerCase()} upgrade providing enhanced enterprise capability with a margin delta of +₹${candidate.marginDelta.toLocaleString("en-IN")}.`;
    } else if (candidate.promotionTag) {
      reason = `Recommended companion to ${primaryItem.name} bundled with active offer: ${candidate.promotionTag}.`;
    } else {
      reason = `Complements ${primaryItem.name} (${candidate.category.toLowerCase()}) to provide a complete enterprise solution.`;
    }

    return {
      ...candidate,
      score,
      reason,
    };
  });

  scoredCandidates.sort((a, b) => b.score - a.score);
  return scoredCandidates.slice(0, 6);
}

/**
 * 4. LLM Recommendation & Ranking Engine
 */
async function rankWithLLM(candidates, quotationItems, customerContext = null) {
  if (!GROQ_API_KEY) {
    console.log("[Recommendation Service] GROQ_API_KEY is not set. Using rule-based heuristic engine.");
    return rankWithHeuristics(candidates, quotationItems);
  }

  const currentProductsSummary = quotationItems
    .map(
      (i) =>
        `- ${i.name} (${i.category}): Qty ${i.quantity || 1}, Unit Price ₹${i.unitPrice}`
    )
    .join("\n");

  const candidatesList = candidates
    .map(
      (c) =>
        `- ID: "${c.id}" | Name: "${c.name}" | Category: "${c.category}" | Unit Price: ₹${c.unitPrice} | Margin Delta: +₹${c.marginDelta} (${c.marginDeltaPercent}%) | Promotion: "${c.promotionTag || "None"}" | Type: ${c.type}`
    )
    .join("\n");

  const customerText = customerContext
    ? `Customer: ${customerContext.name || "Enterprise Client"} (${customerContext.tier || "Standard"} Tier)`
    : "Enterprise B2B Customer";

  const prompt = `You are an AI sales recommendation engine for DealFlow360 B2B platform.
Analyze the current quotation and rank the most relevant candidate products for upsell and cross-sell.

${customerText}

Current Quotation Products:
${currentProductsSummary}

Available Candidate Products:
${candidatesList}

CRITICAL RULES:
1. ONLY recommend products from the Candidate Products list above.
2. DO NOT hallucinate or invent new products, prices, discounts, or IDs.
3. Classify each recommendation as either "upsell" (higher tier / replacement upgrade in same category) or "cross_sell" (complementary add-on).
4. Assign a normalized recommendation score between 0.50 and 0.99 reflecting relevance, purchase affinity, and margin impact.
5. Provide a concise, professional 1-2 sentence sales explanation for why this product is recommended.
6. Return strictly valid JSON with NO markdown formatting, adhering to this exact schema:
{
  "recommendations": [
    {
      "productId": "string (must match candidate ID exactly)",
      "type": "cross_sell" | "upsell",
      "score": 0.94,
      "reason": "Complements the selected hardware with 24/7 SLA coverage."
    }
  ]
}`;

  const groq = new Groq({ apiKey: GROQ_API_KEY });
  let rawContent = "";

  try {
    const response = await groq.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 2048,
    });
    rawContent = response.choices[0]?.message?.content || "";

    // Clean any <think> tags or code blocks
    let cleanText = String(rawContent).replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    const jsonMatch = cleanText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      cleanText = jsonMatch[0];
    } else {
      cleanText = cleanText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/, "")
        .replace(/```$/, "")
        .trim();
    }

    const parsed = JSON.parse(cleanText);
    const recs = Array.isArray(parsed.recommendations)
      ? parsed.recommendations
      : Array.isArray(parsed)
      ? parsed
      : [];

    // Validation & Hallucination Guard
    const candidateMap = new Map(candidates.map((c) => [c.id, c]));
    const verifiedRecommendations = [];
    const usedIds = new Set();

    for (const rec of recs) {
      if (!rec.productId || !candidateMap.has(rec.productId)) {
        continue;
      }
      if (usedIds.has(rec.productId)) {
        continue;
      }
      usedIds.add(rec.productId);

      const realCandidate = candidateMap.get(rec.productId);
      const score = Number(Math.min(Math.max(Number(rec.score) || 0.88, 0.50), 0.99).toFixed(2));
      const type = rec.type === "upsell" ? "upsell" : "cross_sell";
      const reason =
        (rec.reason && String(rec.reason).trim()) ||
        `Strategically recommended companion for your deal.`;

      verifiedRecommendations.push({
        ...realCandidate,
        type,
        score,
        reason,
        llmExplanation: reason,
      });
    }

    // If LLM returned fewer than candidates, fill in remaining candidates with heuristic ranking
    if (verifiedRecommendations.length < Math.min(5, candidates.length)) {
      const fallbackList = rankWithHeuristics(
        candidates.filter((c) => !usedIds.has(c.id)),
        quotationItems
      );
      for (const item of fallbackList) {
        if (verifiedRecommendations.length >= 5) break;
        verifiedRecommendations.push(item);
      }
    }

    verifiedRecommendations.sort((a, b) => b.score - a.score);
    console.log(`[Recommendation Service] LLM successfully recommended ${verifiedRecommendations.length} candidates using Groq (${PRIMARY_MODEL})`);
    return verifiedRecommendations.slice(0, 6);
  } catch (error) {
    console.warn(
      `[Recommendation Service] LLM ranking encountered an issue (${error.message}). Falling back to deterministic rule engine.`
    );
    return rankWithHeuristics(candidates, quotationItems);
  }
}

/**
 * Main Entry Point: getRecommendations
 */
async function getRecommendations(quotationItems, options = {}) {
  if (!Array.isArray(quotationItems) || quotationItems.length === 0) {
    return [];
  }

  const customerId = options.customerId || "";
  const dismissedProductIds = Array.isArray(options.dismissedProductIds)
    ? options.dismissedProductIds
    : [];

  // Check in-memory cache
  const cacheKey = getCacheKey(quotationItems, customerId, dismissedProductIds);
  const cached = recommendationCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // 1. Retrieve valid candidates using Pairing Rules & Hard Constraints
  const rawCandidates = await retrieveCandidates(quotationItems, dismissedProductIds);
  if (rawCandidates.length === 0) {
    return [];
  }

  // 2. Deterministic Margin Delta Calculation
  const candidatesWithMargin = calculateCandidateMargins(quotationItems, rawCandidates);

  // 3. Customer context lookup if available
  let customerContext = null;
  if (customerId) {
    try {
      const custResult = await db.query(
        `SELECT full_name, company_name, customer_tier FROM public.users WHERE id = $1`,
        [customerId]
      );
      if (custResult.rows.length > 0) {
        customerContext = {
          name: custResult.rows[0].company_name || custResult.rows[0].full_name,
          tier: custResult.rows[0].customer_tier || "STANDARD",
        };
      }
    } catch (err) {
      // Non-blocking
    }
  }

  // 4. AI/LLM Recommendation & Ranking with fallback
  const finalRecommendations = await rankWithLLM(
    candidatesWithMargin,
    quotationItems,
    customerContext
  );

  // Cache final results
  recommendationCache.set(cacheKey, {
    data: finalRecommendations,
    timestamp: Date.now(),
  });

  return finalRecommendations;
}

module.exports = {
  getRecommendations,
  retrieveCandidates,
  calculateCandidateMargins,
  rankWithHeuristics,
  rankWithLLM,
};
