const productsService = require('./products.service');
const { ApiError } = require('../middleware/errorHandler');

/**
 * Cart pricing, deliberately stateless.
 *
 * There is no cart table in the database (the DB owner's schema is products /
 * customers / orders / order_items / inventory), so the cart lives in the
 * browser and is sent to the server whenever it needs to be priced or
 * checked out. The server still re-reads every price from the database, so a
 * tampered client cart cannot change what anything costs.
 */

function normaliseItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('cart items must be a non-empty array');
  }

  const merged = new Map();
  for (const raw of items) {
    const productId = raw?.productId ?? raw?.id;
    if (productId == null) {
      throw ApiError.badRequest('Every cart item needs a productId');
    }
    const quantity = Math.max(1, Math.floor(Number(raw.quantity) || 1));
    const key = String(productId);
    // Fold duplicate lines for the same product into one.
    merged.set(key, (merged.get(key) || 0) + quantity);
  }

  return [...merged.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

/**
 * Price a cart: resolves products, applies discounts, flags anything that is
 * out of stock, and returns the totals the checkout page displays.
 */
async function priceCart(items) {
  const normalised = normaliseItems(items);
  const ids = normalised.map((i) => i.productId);

  const products = await productsService.getProductsByIds(ids);
  const byId = new Map(products.map((p) => [String(p.id), p]));

  const missing = ids.filter((id) => !byId.has(String(id)));
  if (missing.length) {
    throw ApiError.badRequest(`Unknown product ids: ${missing.join(', ')}`);
  }

  const stockMap = await productsService.getStockMap(products.map((p) => p.id));

  let subtotal = 0;
  let savings = 0;

  const lines = normalised.map(({ productId, quantity }) => {
    const product = byId.get(String(productId));
    const lineTotal = round(product.finalPrice * quantity);
    const lineSavings = round((product.price - product.finalPrice) * quantity);

    subtotal += lineTotal;
    savings += lineSavings;

    // Unknown stock (no inventory row yet) is treated as available rather
    // than blocking checkout while that table is still being built.
    const stock = stockMap.has(product.id) ? stockMap.get(product.id) : null;
    const inStock = stock == null ? true : stock >= quantity;

    return {
      productId: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      unitPrice: product.finalPrice,
      listPrice: product.price,
      discountPercent: product.discountPercent,
      quantity,
      lineTotal,
      savings: lineSavings,
      stock,
      inStock,
    };
  });

  return {
    items: lines,
    subtotal: round(subtotal),
    savings: round(savings),
    total: round(subtotal),
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    hasUnavailableItems: lines.some((l) => !l.inStock),
  };
}

/**
 * Cart optimisation: for each line, look for a same-category product with a
 * bigger discount and suggest swapping to it.
 *
 * Greedy and per-item on purpose - one best swap per line, no bundle
 * stacking or multi-item combinatorics. The arithmetic is all done here; the
 * AI layer only has to put the result into words.
 */
async function suggestSwaps(items) {
  const priced = await priceCart(items);
  const suggestions = [];

  for (const line of priced.items) {
    const current = await productsService.getProductById(line.productId);
    if (!current.category) continue;

    const { items: candidates } = await productsService.listProducts({
      category: current.category,
      maxPrice: current.price,
      limit: 25,
      sort: 'discount',
    });

    const better = candidates
      .filter((c) => String(c.id) !== String(current.id))
      .filter((c) => c.discountPercent > current.discountPercent)
      .filter((c) => c.finalPrice < current.finalPrice)
      .sort((a, b) => a.finalPrice - b.finalPrice)[0];

    if (!better) continue;

    suggestions.push({
      from: {
        productId: current.id,
        name: current.name,
        finalPrice: current.finalPrice,
        discountPercent: current.discountPercent,
      },
      to: {
        productId: better.id,
        name: better.name,
        finalPrice: better.finalPrice,
        discountPercent: better.discountPercent,
      },
      quantity: line.quantity,
      saves: round((current.finalPrice - better.finalPrice) * line.quantity),
    });
  }

  const totalSavings = round(suggestions.reduce((sum, s) => sum + s.saves, 0));

  return {
    current: { total: priced.total, itemCount: priced.itemCount },
    suggestions,
    totalSavings,
    optimisedTotal: round(priced.total - totalSavings),
  };
}

function round(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { priceCart, suggestSwaps, normaliseItems };
