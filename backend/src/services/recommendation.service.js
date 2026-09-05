const crypto = require("crypto");
const db = require("../config/db");

// Configuration from environment variables
const LLM_API_KEY =
  process.env.LLM_API_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_AI_KEY ||
  process.env.OPENAI_API_KEY ||
  process.env.ANTHROPIC_API_KEY ||
  process.env.GROQ_API_KEY ||
  null;

const LLM_PROVIDER = (
  process.env.LLM_PROVIDER ||
  (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY ? "gemini" : null) ||
  (process.env.OPENAI_API_KEY ? "openai" : null) ||
  (process.env.ANTHROPIC_API_KEY ? "anthropic" : null) ||
  (process.env.GROQ_API_KEY ? "groq" : null) ||
  "fallback"
).toLowerCase();

const LLM_MODEL =
  process.env.LLM_MODEL ||
  (LLM_PROVIDER === "gemini" ? "gemini-1.5-flash" :
   LLM_PROVIDER === "openai" ? "gpt-4o-mini" :
   LLM_PROVIDER === "anthropic" ? "claude-3-5-haiku-20241022" :
   LLM_PROVIDER === "groq" ? "llama-3.3-70b-versatile" : "default");

const LLM_BASE_URL = process.env.LLM_BASE_URL || null;
const LLM_TEMPERATURE = Number(process.env.LLM_TEMPERATURE || 0.3);

// Fast In-Memory Cache (TTL: 5 minutes)
const recommendationCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

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
  if (!LLM_API_KEY || LLM_PROVIDER === "fallback") {
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    let rawContent = "";

    if (LLM_PROVIDER === "gemini") {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${LLM_MODEL}:generateContent?key=${LLM_API_KEY}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: LLM_TEMPERATURE,
            responseMimeType: "application/json",
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else if (LLM_PROVIDER === "openai" || LLM_PROVIDER === "groq") {
      const baseUrl =
        LLM_BASE_URL ||
        (LLM_PROVIDER === "groq"
          ? "https://api.groq.com/openai/v1"
          : "https://api.openai.com/v1");

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LLM_API_KEY}`,
        },
        body: JSON.stringify({
          model: LLM_MODEL,
          messages: [{ role: "user", content: prompt }],
          temperature: LLM_TEMPERATURE,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`${LLM_PROVIDER} API error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      rawContent = data.choices?.[0]?.message?.content || "";
    } else if (LLM_PROVIDER === "anthropic") {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": LLM_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: LLM_MODEL,
          max_tokens: 800,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      rawContent = data.content?.[0]?.text || "";
    } else {
      return rankWithHeuristics(candidates, quotationItems);
    }

    clearTimeout(timeoutId);

    // Parse JSON
    const cleanJson = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanJson);
    const recs = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];

    // 5. Validation & Hallucination Guard
    const candidateMap = new Map(candidates.map((c) => [c.id, c]));
    const verifiedRecommendations = [];
    const usedIds = new Set();

    for (const rec of recs) {
      if (!rec.productId || !candidateMap.has(rec.productId)) {
        // Discard any hallucinated product IDs
        continue;
      }
      if (usedIds.has(rec.productId)) {
        continue;
      }
      usedIds.add(rec.productId);

      const realCandidate = candidateMap.get(rec.productId);
      const score = Number(Math.min(Math.max(Number(rec.score) || 0.85, 0.50), 0.99).toFixed(2));
      const type = rec.type === "upsell" ? "upsell" : "cross_sell";
      const reason = (rec.reason && String(rec.reason).trim()) ||
        `Strategically paired with your quotation items.`;

      // Always overlay authentic, calculated business data
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
    return verifiedRecommendations.slice(0, 6);
  } catch (error) {
    clearTimeout(timeoutId);
    console.warn(
      `[Recommendation Service] LLM ranking encountered an issue (${error.message}). Falling back gracefully to deterministic rule engine.`
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
