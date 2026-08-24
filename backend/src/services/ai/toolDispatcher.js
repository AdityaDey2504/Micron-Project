const productsService = require('../products.service');
const ordersService = require('../orders.service');
const cartService = require('../cart.service');
const discountsService = require('../discounts.service');
const reviewsService = require('../reviews.service');
const embeddings = require('./embeddings');
const { rankProducts, diffProducts, lexicalSimilarity } = require('./ranking');
const { RECENT_PURCHASE_DAYS } = require('../../utils/constants');
const logger = require('../../utils/logger');

/**
 * Executes the tools declared in toolSchemas.js.
 *
 * This is the boundary between the AI layer and the backend: the orchestrator
 * decides WHICH tool to call and turns the result into prose, this file does
 * the actual data work. Every handler returns a plain JSON-serialisable
 * object suitable for feeding straight back to Gemini as a functionResponse.
 *
 * Handlers never throw at the caller: a failure comes back as
 * { error: "..." } so the model can apologise gracefully instead of the whole
 * chat request 500ing mid-demo.
 */

// --- session state --------------------------------------------------------
// The "what if my budget were X" feature needs the previous search to diff
// against. In-process Map, TTL'd - a hackathon demo does not need Redis, and
// losing it on restart costs nothing.

const SESSION_TTL_MS = 30 * 60 * 1000;
const sessions = new Map();

function getSession(sessionId) {
  if (!sessionId) return {};
  const entry = sessions.get(sessionId);
  if (!entry) return {};
  if (entry.expiresAt <= Date.now()) {
    sessions.delete(sessionId);
    return {};
  }
  return entry.data;
}

function setSession(sessionId, data) {
  if (!sessionId) return;
  sessions.set(sessionId, {
    data: { ...getSession(sessionId), ...data },
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
}

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of sessions) if (entry.expiresAt <= now) sessions.delete(id);
}, SESSION_TTL_MS).unref();

// --- tools ----------------------------------------------------------------

/**
 * The core search: semantic when embeddings are available, keyword when they
 * are not, then ranked in JS and checked against recent purchases.
 */
async function searchProducts(args, context) {
  const {
    query,
    category,
    max_price: maxPrice,
    min_price: minPrice,
    only_discounted: onlyDiscounted,
    limit = 5,
  } = args || {};

  const queryEmbedding = await embeddings.embedText(query);

  // Pull a wide candidate set, then let the ranker narrow it - ranking over
  // 5 rows the database happened to return first would be pointless.
  //
  // Set to the maximum page size on purpose. The database returns matches in
  // primary-key order, not relevance order, so a small pool is an arbitrary
  // slice: searching "mobile phone under 20000" with a pool of 30 surfaced
  // only sub-500-rupee feature phones, because the better ones never got
  // fetched for the ranker to consider.
  const CANDIDATE_POOL = 100;

  let candidates = await productsService.searchByEmbedding(queryEmbedding, {
    limit: CANDIDATE_POOL,
    category,
    maxPrice,
  });

  if (!candidates || candidates.length === 0) {
    const filters = {
      search: query,
      category,
      minPrice,
      maxPrice,
      onlyDiscounted,
      sort: 'popular',
    };

    // Narrowest first: products matching EVERY word in the query. That is what
    // makes "gaming laptop" return laptops rather than gaming earbuds.
    const strict = await productsService.listProducts({
      ...filters,
      searchMode: 'all',
      limit: CANDIDATE_POOL,
    });
    candidates = strict.items;

    // Then loosen to any-word matching, which nearly always returns something.
    if (candidates.length === 0) {
      const loose = await productsService.listProducts({
        ...filters,
        searchMode: 'any',
        limit: CANDIDATE_POOL,
      });
      candidates = loose.items;
    }

    // Last resort: show the category rather than claiming we have no products.
    if (candidates.length === 0 && category) {
      const fallback = await productsService.listProducts({ category, limit: CANDIDATE_POOL });
      candidates = fallback.items;
    }
  }

  if (candidates.length === 0) {
    return { products: [], message: 'No products matched that search.' };
  }

  // Semantic search fills in `similarity` itself. When it was unavailable the
  // candidates came from keyword OR-matching, where every partial match looks
  // equally good - so score word overlap instead, or the ranker has nothing
  // but discount to sort on.
  if (!queryEmbedding) {
    const tokens = productsService.searchTokens(query);
    for (const candidate of candidates) {
      candidate.similarity = lexicalSimilarity(candidate, tokens);
    }
  }

  const purchasedIds = await ordersService.getPurchasedProductIds(context.customerId);
  const ranked = rankProducts(candidates, { maxPrice, purchasedIds, limit });

  const stockMap = await productsService.getStockMap(ranked.map((p) => p.id));
  for (const product of ranked) {
    product.stock = stockMap.has(product.id) ? stockMap.get(product.id) : null;
  }

  // Cached so whatIfBudget can re-run this search without a second embedding call.
  setSession(context.sessionId, {
    lastSearch: { query, category, maxPrice, minPrice, embedding: queryEmbedding },
    lastTopResult: ranked[0] || null,
  });

  const result = {
    products: ranked.map(toToolProduct),
    appliedFilters: { category: category ?? null, maxPrice: maxPrice ?? null },
    semantic: Boolean(queryEmbedding),
  };

  // The "don't buy" check - one extra query, folded into this same response
  // so it costs no additional model call.
  const searchCategory = category || ranked[0]?.category;
  const recent = await ordersService.findRecentPurchaseInCategory(
    context.customerId,
    searchCategory
  );
  if (recent) {
    result.recentPurchase = {
      productName: recent.product.name,
      daysAgo: recent.daysAgo,
      note: `The customer bought ${recent.product.name} ${recent.daysAgo} days ago, within the last ${RECENT_PURCHASE_DAYS} days. Mention this before recommending another one.`,
    };
  }

  return result;
}

async function getOrderHistory(args, context) {
  if (!context.customerId) {
    return { error: 'Not signed in. Ask the customer to log in to see their order history.' };
  }

  const { items } = await ordersService.listOrdersForCustomer(context.customerId, {
    limit: Math.min(Number(args?.limit) || 5, 20),
  });

  return {
    orders: items.map((order) => ({
      orderId: order.id,
      placedOn: order.createdAt,
      status: order.status,
      total: order.total,
      items: (order.items || []).map((item) => ({
        name: item.product?.name ?? `Product ${item.productId}`,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    })),
  };
}

async function checkInventory(args) {
  const product = await productsService.getProductById(args.product_id);
  return {
    productId: product.id,
    name: product.name,
    price: product.finalPrice,
    listPrice: product.price,
    discountPercent: product.discountPercent,
    stock: product.stock,
    // A null stock means inventory has no row yet, not that it is sold out.
    available: product.stock == null ? true : product.stock > 0,
    stockKnown: product.stock != null,
  };
}

async function compareProducts(args) {
  const [a, b] = await Promise.all([
    productsService.getProductById(args.product_id_a),
    productsService.getProductById(args.product_id_b),
  ]);

  return {
    a: toToolProduct(a),
    b: toToolProduct(b),
    priceDifference: Math.round((a.finalPrice - b.finalPrice) * 100) / 100,
    cheaper: a.finalPrice === b.finalPrice ? null : a.finalPrice < b.finalPrice ? a.name : b.name,
    betterDiscount:
      a.discountPercent === b.discountPercent
        ? null
        : a.discountPercent > b.discountPercent
          ? a.name
          : b.name,
  };
}

/**
 * Re-runs the last search at a new budget and diffs the top result.
 * Reuses the cached embedding, so this costs no embedding call.
 */
async function whatIfBudget(args, context) {
  const session = getSession(context.sessionId);
  if (!session.lastSearch) {
    return { error: 'There is no previous search to re-run. Ask what they are shopping for first.' };
  }

  const { query, category, embedding } = session.lastSearch;
  const newMaxPrice = Number(args.new_max_price);

  let candidates = await productsService.searchByEmbedding(embedding, {
    limit: 30,
    category,
    maxPrice: newMaxPrice,
  });

  if (!candidates || candidates.length === 0) {
    const { items } = await productsService.listProducts({
      search: query,
      category,
      maxPrice: newMaxPrice,
      limit: 30,
    });
    candidates = items;
  }

  const purchasedIds = await ordersService.getPurchasedProductIds(context.customerId);
  const ranked = rankProducts(candidates, { maxPrice: newMaxPrice, purchasedIds, limit: 3 });

  const previousTop = session.lastTopResult;
  const newTop = ranked[0] || null;

  setSession(context.sessionId, {
    lastSearch: { ...session.lastSearch, maxPrice: newMaxPrice },
    lastTopResult: newTop,
  });

  return {
    newBudget: newMaxPrice,
    previousBudget: session.lastSearch.maxPrice ?? null,
    products: ranked.map(toToolProduct),
    change: diffProducts(previousTop, newTop),
  };
}

async function optimizeCart(args, context) {
  if (!context.cart || context.cart.length === 0) {
    return { error: 'The cart is empty, so there is nothing to optimise.' };
  }
  return cartService.suggestSwaps(context.cart);
}

/**
 * What customers wrote about a product. Returns the best and worst review
 * rather than the newest, so the model can answer honestly instead of
 * quoting whichever one happened to be most recent.
 */
async function getProductReviews(args) {
  const product = await productsService.getProductById(args.product_id);
  const reviews = await reviewsService.forChat(args.product_id);
  return { product: { id: product.id, name: product.name }, ...reviews };
}

async function listDiscounts(args) {
  const { items } = await discountsService.listDiscountedProducts({
    category: args?.category,
    limit: Math.min(Number(args?.limit) || 5, 20),
  });
  return { products: items.map(toToolProduct) };
}

// --- registry -------------------------------------------------------------

const HANDLERS = {
  searchProducts,
  getOrderHistory,
  checkInventory,
  compareProducts,
  whatIfBudget,
  optimizeCart,
  listDiscounts,
  getProductReviews,
};

/**
 * Run one tool call.
 *
 * @param {string} name  tool name from toolSchemas.js
 * @param {object} args  arguments Gemini produced
 * @param {object} context { customerId, sessionId, cart }
 * @returns {Promise<object>} JSON-safe result, or { error } on failure
 */
async function dispatch(name, args = {}, context = {}) {
  const handler = HANDLERS[name];
  if (!handler) {
    logger.warn(`Model called unknown tool "${name}"`);
    return { error: `Unknown tool: ${name}` };
  }

  const startedAt = Date.now();
  try {
    const result = await handler(args, context);
    logger.info(`tool ${name} ok in ${Date.now() - startedAt}ms`);
    return result;
  } catch (err) {
    logger.error(`tool ${name} failed`, err.message);
    // Deliberately not rethrown: the model should get a usable error string
    // and apologise, rather than the whole chat turn collapsing.
    return { error: err.message || 'That lookup failed.' };
  }
}

/** Trim a product to the fields worth spending tokens on. */
function toToolProduct(product) {
  const out = {
    id: product.id,
    name: product.name,
    category: product.category,
    price: product.finalPrice,
    listPrice: product.price,
    discountPercent: product.discountPercent,
  };
  if (product.brand) out.brand = product.brand;
  if (product.rating != null) out.rating = product.rating;
  if (product.stock !== undefined) out.stock = product.stock;
  if (product.score != null) out.rankScore = product.score;
  return out;
}

module.exports = {
  dispatch,
  toolNames: Object.keys(HANDLERS),
  getSession,
  setSession,
  // Exported for direct use by REST endpoints that need the same logic
  // without going through the model.
  searchProducts,
  optimizeCart,
};
