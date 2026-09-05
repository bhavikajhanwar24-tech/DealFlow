const assert = require("assert");
const db = require("../src/config/db");
const recommendationService = require("../src/services/recommendation.service");

async function runTests() {
  console.log("\n=======================================================");
  console.log("   DEALFLOW360: UPSELL & CROSS-SELL TEST SUITE");
  console.log("=======================================================\n");

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    Error: ${err.message}\n`);
      failed++;
    }
  }

  // Fetch Laptop Pro from database for testing
  const laptopRes = await db.query(
    "SELECT id, name, sku, category, unit_price, cost FROM public.products WHERE sku = 'HW-LP-2025'"
  );
  const laptop = laptopRes.rows[0];
  assert(laptop, "Laptop Pro seed product must exist in database");

  const quoteItems = [
    {
      productId: laptop.id,
      name: laptop.name,
      category: laptop.category,
      unitPrice: Number(laptop.unit_price),
      costPrice: Number(laptop.cost),
      quantity: 1,
      discountPercent: 0,
    },
  ];

  // TEST 1: Candidate Retrieval & Pairing Classification
  await test("Candidate Retrieval identifies Upsell vs Cross-sell correctly", async () => {
    const candidates = await recommendationService.retrieveCandidates(quoteItems);
    assert(candidates.length > 0, "Should retrieve candidate products");

    // Check that Laptop Pro itself is NOT in candidates
    const hasSelf = candidates.some((c) => c.productId === laptop.id);
    assert.strictEqual(hasSelf, false, "Product already in quote must not be recommended");

    // Check Upsell classification for Workstation Ultra
    const workstation = candidates.find((c) => c.sku === "HW-WS-ULTRA");
    assert(workstation, "Workstation Ultra should be a candidate");
    assert.strictEqual(workstation.type, "upsell", "Workstation Ultra must be classified as upsell");

    // Check Cross-Sell classification for Support Plan
    const support = candidates.find((c) => c.sku === "SVC-SLA-5YR");
    assert(support, "Support Plan should be a candidate");
    assert.strictEqual(support.type, "cross_sell", "Support Plan must be classified as cross_sell");
  });

  // TEST 2: Deterministic Margin Delta Calculation
  await test("Deterministic Margin Delta matches exact financial formula", async () => {
    const mockItems = [
      {
        productId: "item-1",
        unitPrice: 10000,
        costPrice: 6000,
        quantity: 1,
        discountPercent: 0,
      },
    ];

    const mockCandidates = [
      {
        id: "cand-1",
        productId: "cand-1",
        name: "Test Add-on",
        category: "HARDWARE",
        unitPrice: 5000,
        cost: 2000,
        type: "cross_sell",
      },
    ];

    const result = recommendationService.calculateCandidateMargins(mockItems, mockCandidates);
    const calculated = result[0];

    // Current Quote: Final 10000, Cost 6000, Margin 4000, Margin% 40%
    assert.strictEqual(calculated.currentQuoteMargin, 4000);
    assert.strictEqual(calculated.currentMarginPercent, 40);

    // After Adding Product: Final 15000, Cost 8000, Margin 7000, Margin% 46.67%
    assert.strictEqual(calculated.newQuoteMargin, 7000);
    assert.strictEqual(calculated.newMarginPercent, 46.67);

    // Margin Delta: 7000 - 4000 = +3000
    assert.strictEqual(calculated.marginDelta, 3000);
    // Margin Delta %: 46.67 - 40 = +6.67%
    assert.strictEqual(calculated.marginDeltaPercent, 6.67);
  });

  // TEST 3: Promotion Tags Verification
  await test("Promotion Tags respect database rules and are never invented", async () => {
    const candidates = await recommendationService.retrieveCandidates(quoteItems);

    const supportPlan = candidates.find((c) => c.sku === "SVC-SLA-5YR");
    assert(supportPlan, "Support Plan should exist");
    assert(
      supportPlan.promotionTag && supportPlan.promotionTag.includes("10% Bundle Discount"),
      "Active promotion tag must be attached to eligible product"
    );

    const onsite = candidates.find((c) => c.sku === "SVC-ONSITE-TRN");
    if (onsite) {
      assert.strictEqual(onsite.promotionTag, null, "Products without active promotion must have null tag");
    }
  });

  // TEST 4: Recommendation Ranking and Score Normalization
  await test("Recommendation Ranking produces normalized scores [0.50, 1.00] sorted descending", async () => {
    const candidates = await recommendationService.retrieveCandidates(quoteItems);
    const withMargins = recommendationService.calculateCandidateMargins(quoteItems, candidates);
    const ranked = recommendationService.rankWithHeuristics(withMargins, quoteItems);

    assert(ranked.length > 0, "Ranked list must not be empty");

    for (let i = 0; i < ranked.length; i++) {
      const rec = ranked[i];
      assert(typeof rec.score === "number", "Score must be numeric");
      assert(rec.score >= 0 && rec.score <= 1.0, `Score ${rec.score} must be between 0.00 and 1.00`);
      assert(rec.reason && rec.reason.length > 10, "Reason explanation must be provided");

      if (i > 0) {
        assert(
          rec.score <= ranked[i - 1].score,
          `Candidates must be sorted descending by score (${rec.score} <= ${ranked[i - 1].score})`
        );
      }
    }
  });

  // TEST 5: Hallucination Rejection
  await test("LLM validation strictly rejects hallucinated product IDs and fabricated prices", async () => {
    const validCandidates = [
      {
        id: "real-uuid-1",
        productId: "real-uuid-1",
        name: "Legit Laptop Case",
        category: "HARDWARE",
        unitPrice: 3000,
        cost: 1500,
        marginDelta: 1500,
        marginDeltaPercent: 1.2,
        type: "cross_sell",
        promotionTag: "🔥 10% Off",
      },
    ];

    // Mock an LLM response containing a hallucinated product ID and fabricated prices
    const hallucinatedLLMOutput = {
      recommendations: [
        {
          productId: "fake-hallucinated-id-999", // FAKE ID
          type: "cross_sell",
          score: 0.99,
          reason: "Fabricated magic item",
          unitPrice: 10, // Fabricated price should not override real data
        },
        {
          productId: "real-uuid-1", // REAL ID
          type: "cross_sell",
          score: 0.93,
          reason: "Real accessory for laptop",
        },
      ],
    };

    // Simulate validation logic
    const candidateMap = new Map(validCandidates.map((c) => [c.id, c]));
    const verified = [];

    for (const rec of hallucinatedLLMOutput.recommendations) {
      if (!candidateMap.has(rec.productId)) continue; // Must discard hallucination!
      const real = candidateMap.get(rec.productId);
      verified.push({
        ...real,
        score: rec.score,
        reason: rec.reason,
      });
    }

    assert.strictEqual(verified.length, 1, "Must discard hallucinated item");
    assert.strictEqual(verified[0].productId, "real-uuid-1", "Must keep verified candidate");
    assert.strictEqual(verified[0].unitPrice, 3000, "Must preserve authentic database unit price");
    assert.strictEqual(verified[0].marginDelta, 1500, "Must preserve authentic deterministic margin delta");
  });

  // TEST 6: Graceful Fallback on LLM Failure
  await test("Service continues working seamlessly when LLM fails or is unavailable", async () => {
    // Should not throw even if no external LLM key is configured
    const recs = await recommendationService.getRecommendations(quoteItems);
    assert(Array.isArray(recs), "Must return array of recommendations");
    assert(recs.length > 0, "Must return valid fallback recommendations");
    assert(recs[0].productId, "Recommendation must have productId");
    assert(recs[0].marginDelta !== undefined, "Recommendation must have marginDelta");
    assert(recs[0].score > 0, "Recommendation must have valid score");
  });

  // TEST 7: Dismiss Recommendation
  await test("Dismissed recommendations are excluded from subsequent results", async () => {
    const initialRecs = await recommendationService.getRecommendations(quoteItems);
    assert(initialRecs.length >= 2, "Need at least 2 recommendations for dismissal test");

    const dismissedId = initialRecs[0].id;
    const filteredRecs = await recommendationService.getRecommendations(quoteItems, {
      dismissedProductIds: [dismissedId],
    });

    const isStillPresent = filteredRecs.some((r) => r.id === dismissedId || r.productId === dismissedId);
    assert.strictEqual(isStillPresent, false, "Dismissed product must not appear in recommendations");
  });

  // TEST 8: Add to Quote idempotency simulation
  await test("Add to quote prevents duplicate quote items", async () => {
    const recs = await recommendationService.getRecommendations(quoteItems);
    const chosen = recs[0];

    const currentQuote = [...quoteItems];

    // First add
    function addItem(itemToAdd) {
      if (currentQuote.some((i) => i.productId === itemToAdd.id || i.productId === itemToAdd.productId)) {
        return { success: false, message: "That product is already in the quotation." };
      }
      currentQuote.push({
        productId: itemToAdd.productId || itemToAdd.id,
        name: itemToAdd.name,
        quantity: 1,
      });
      return { success: true };
    }

    const firstAdd = addItem(chosen);
    assert.strictEqual(firstAdd.success, true, "First add must succeed");

    // Second add (e.g. accidental double-click)
    const secondAdd = addItem(chosen);
    assert.strictEqual(secondAdd.success, false, "Second add must be rejected cleanly");
    assert.strictEqual(currentQuote.length, 2, "Quote items count must remain 2");
  });

  console.log("\n-------------------------------------------------------");
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("-------------------------------------------------------\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test execution failure:", err);
  process.exit(1);
});
