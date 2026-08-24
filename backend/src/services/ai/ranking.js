const { RANK_WEIGHTS } = require('../../utils/constants');

/**
 * Scores candidate products for the recommendation loop.
 *
 * Pure functions, no I/O and no LLM: the model should only ever be asked to
 * explain a ranking, never to compute one. That keeps the ordering
 * deterministic, debuggable and free.
 *
 * Final score is a weighted sum of four 0..1 signals:
 *   semantic            - how close the product is to what was asked for
 *   budgetFit           - how well the price sits inside the stated budget
 *   discount            - how good the offer is
 *   notRecentlyPurchased - penalty for something already owned
 */

/** How well a price fits a budget, 0..1. */
function budgetFitScore(price, maxPrice) {
  // With no budget given this signal carries no information, so score it
  // neutral rather than 0 - a 0 would unfairly drag every candidate down.
  if (maxPrice == null || !Number.isFinite(Number(maxPrice))) return 0.5;

  const budget = Number(maxPrice);
  if (budget <= 0) return 0.5;
  if (price > budget) return 0; // over budget - the user said no

  // Best score for spending 70-100% of the budget: something at 10% of the
  // stated budget is usually not what the user actually wants.
  const ratio = price / budget;
  if (ratio >= 0.7) return 1;
  return 0.4 + (ratio / 0.7) * 0.6;
}

/** Discount percentage mapped to 0..1, saturating at 50% off. */
function discountScore(discountPercent) {
  const pct = Number(discountPercent) || 0;
  return Math.min(1, Math.max(0, pct / 50));
}

/**
 * Semantic similarity mapped to 0..1.
 * pgvector cosine similarity already lands in 0..1 for normalised embeddings;
 * a missing value scores neutral so keyword-only results still rank sensibly
 * while the embedding column does not exist yet.
 */
function semanticScore(similarity) {
  if (similarity == null || !Number.isFinite(Number(similarity))) return 0.5;
  return Math.min(1, Math.max(0, Number(similarity)));
}

/**
 * Cheap stand-in for semantic similarity, used when embeddings are not
 * available (no API key, or products.embedding not populated yet).
 *
 * Scores what fraction of the query's words the product actually matches, so
 * "gaming laptop" prefers a laptop that mentions gaming over gaming earbuds
 * that merely match one word out of two. Without this, keyword OR-matching
 * treats every partial match as equally good and the discount weight decides
 * the ordering, which produces obviously wrong top results.
 */
function lexicalSimilarity(product, tokens) {
  if (!tokens || tokens.length === 0) return 0.5;

  // Title and category identify what a product IS; the description only says
  // what it works with. Weighting them apart stops "compatible with laptop"
  // in an earphone's spec list from beating an actual laptop.
  const primary = [product.name, product.category].filter(Boolean).join(' ').toLowerCase();
  const secondary = String(product.description || '').toLowerCase();

  let primaryHits = 0;
  let anyHits = 0;
  for (const token of tokens) {
    const inPrimary = primary.includes(token);
    if (inPrimary) primaryHits += 1;
    if (inPrimary || secondary.includes(token)) anyHits += 1;
  }

  const ratio =
    0.75 * (primaryHits / tokens.length) + 0.25 * (anyHits / tokens.length);

  // Matching every word is a strong signal; matching one word out of three is
  // weak but not worthless. Squaring widens the gap between the two.
  return Math.round(ratio * ratio * 1000) / 1000;
}

/** 1 when the customer has not bought this recently, 0 when they have. */
function noveltyScore(productId, purchasedIds) {
  if (!purchasedIds || purchasedIds.size === 0) return 1;
  return purchasedIds.has(productId) ? 0 : 1;
}

/**
 * Rank candidates and return the top N, each with its score breakdown.
 *
 * The breakdown is returned rather than just the total so the Gemini call can
 * say WHY something is first ("cheapest that clears your budget, 20% off")
 * instead of inventing a reason.
 */
function rankProducts(candidates, { maxPrice, purchasedIds, limit = 5 } = {}) {
  // A stated budget is a hard limit, not a preference. Scoring alone is not
  // enough: a big enough discount and similarity can outweigh a budgetFit of
  // 0 and float an over-budget product to the top, which is exactly what a
  // customer who named a budget does not want to see.
  const budget = Number(maxPrice);
  const affordable = Number.isFinite(budget)
    ? (candidates || []).filter((p) => (p.finalPrice ?? p.price ?? 0) <= budget)
    : candidates || [];

  // If nothing at all fits, fall back to the full set rather than answering
  // with an empty list - the model can then say everything is over budget.
  const pool = affordable.length > 0 ? affordable : candidates || [];

  const scored = pool.map((product) => {
    const breakdown = {
      semantic: semanticScore(product.similarity),
      budgetFit: budgetFitScore(product.finalPrice ?? product.price, maxPrice),
      discount: discountScore(product.discountPercent),
      notRecentlyPurchased: noveltyScore(product.id, purchasedIds),
    };

    const score =
      breakdown.semantic * RANK_WEIGHTS.semantic +
      breakdown.budgetFit * RANK_WEIGHTS.budgetFit +
      breakdown.discount * RANK_WEIGHTS.discount +
      breakdown.notRecentlyPurchased * RANK_WEIGHTS.notRecentlyPurchased;

    return { ...product, score: Math.round(score * 1000) / 1000, scoreBreakdown: breakdown };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Diffs two products for the "what if I raise my budget" feature: what does
 * the extra money actually buy?
 */
function diffProducts(before, after) {
  if (!before || !after) return null;

  const priceDelta = Math.round(((after.finalPrice ?? 0) - (before.finalPrice ?? 0)) * 100) / 100;

  return {
    before: { id: before.id, name: before.name, finalPrice: before.finalPrice },
    after: { id: after.id, name: after.name, finalPrice: after.finalPrice },
    priceDelta,
    sameProduct: String(before.id) === String(after.id),
    ratingDelta:
      before.rating != null && after.rating != null
        ? Math.round((after.rating - before.rating) * 10) / 10
        : null,
    brandChanged: before.brand !== after.brand,
  };
}

module.exports = {
  rankProducts,
  lexicalSimilarity,
  diffProducts,
  budgetFitScore,
  discountScore,
  semanticScore,
  noveltyScore,
};
