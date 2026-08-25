const supabase = require('../config/supabase');
const { TABLES, COLUMNS, RPC, mapProduct } = require('../db/tables');
const { ApiError } = require('../middleware/errorHandler');
const { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } = require('../utils/constants');
const logger = require('../utils/logger');

const P = COLUMNS.products;
const I = COLUMNS.inventory;

// Products are selected with '*' on purpose: the source schema is a Kaggle
// dataset still being shaped by the DB owner, and an explicit column list
// would break every time a column is renamed or added. mapProduct decides
// what actually reaches the client.
const PRODUCT_SELECT = '*';

// Words that carry no signal in a product search. Dropping them stops
// "show me a good laptop" from matching every product containing "a".
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'for', 'with', 'and', 'or', 'of', 'to', 'in', 'on', 'my',
  'me', 'i', 'is', 'are', 'it', 'that', 'this', 'some', 'any', 'best', 'good',
  'nice', 'show', 'find', 'want', 'need', 'buy', 'get', 'looking', 'please',
  'product', 'products', 'item', 'items', 'something', 'under', 'below',
  'above', 'over', 'less', 'than', 'upto', 'up', 'within', 'budget', 'price',
  'cheap', 'cheapest', 'rs', 'inr', 'rupees',
  // Request verbs. Without these, "recommend a mobile phone" requires the word
  // "recommend" to appear in the product itself, so strict matching finds
  // nothing and the search falls back to far worse results.
  'recommend', 'recommendation', 'suggest', 'suggestion', 'give', 'tell',
  'about', 'which', 'what', 'options', 'option', 'like', 'would', 'can',
  'you', 'have', 'there', 'new', 'latest', 'top',
  // Umbrella terms for the whole catalog, not a real category value -
  // every product here already IS electronics, so these carry no signal
  // and would otherwise ILIKE-match nothing and return zero results. Keep
  // in sync with UMBRELLA_CATEGORY_TERMS in services/ai/toolDispatcher.js,
  // which does the equivalent for the structured `category` argument.
  'electronics', 'electronic', 'tech', 'technology', 'gadgets', 'gadget',
  'devices', 'device',
]);

// The catalog names categories one way, customers say them another. Mapping
// synonyms onto the catalog's own words lets strict matching hit the category
// column - "phone" alone would otherwise never match the "mobiles" category.
const SYNONYMS = new Map([
  ['phone', 'mobile'],
  ['phones', 'mobile'],
  ['smartphone', 'mobile'],
  ['smartphones', 'mobile'],
  ['mobiles', 'mobile'],
  ['cellphone', 'mobile'],
  ['headphone', 'earphone'],
  ['headphones', 'earphone'],
  ['headset', 'earphone'],
  ['earphones', 'earphone'],
  ['earbud', 'earphone'],
  ['earbuds', 'earphone'],
  ['buds', 'earphone'],
  ['tws', 'earphone'],
  ['notebook', 'laptop'],
  ['laptops', 'laptop'],
  ['computer', 'laptop'],
]);

/**
 * Splits a natural-language query into the words worth matching on.
 * Drops stop words, punctuation, and anything that is purely a number or a
 * budget figure ("80k", "25000") - price filtering is a separate argument.
 */
function searchTokens(search) {
  const tokens = String(search)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3)
    .filter((token) => !STOP_WORDS.has(token))
    .filter((token) => !/^\d+k?$/.test(token))
    .map((token) => SYNONYMS.get(token) || token);

  // Synonyms collapse words together ("mobile phone" -> mobile, mobile), so
  // de-duplicate afterwards or the same term gets matched twice.
  return [...new Set(tokens)].slice(0, 6);
}

function clampLimit(limit) {
  const n = Number(limit);
  if (!Number.isFinite(n) || n <= 0) return PAGE_SIZE_DEFAULT;
  return Math.min(Math.floor(n), PAGE_SIZE_MAX);
}

function fail(error, context) {
  logger.error(`Supabase error during ${context}`, error.message);
  throw new ApiError(502, `Database error during ${context}`);
}

/**
 * Filtered product listing. Every argument is optional; this backs both the
 * catalog page and the chatbot's searchProducts tool.
 */
async function listProducts({
  category,
  search,
  minPrice,
  maxPrice,
  onlyDiscounted,
  limit,
  offset = 0,
  sort = 'relevance',
  searchMode = 'any',
} = {}) {
  const take = clampLimit(limit);

  // Ordering by review activity cannot be expressed in a single PostgREST
  // query - it needs an aggregate over another table - so it takes its own
  // path: rank in memory, then fetch just that page of products.
  if (sort === 'reviews') {
    return listByReviewRank({ category, minPrice, maxPrice, onlyDiscounted, limit: take, offset });
  }

  let query = supabase.from(TABLES.products).select(PRODUCT_SELECT, { count: 'exact' });

  if (category) query = query.ilike(P.category, category);
  if (minPrice != null) query = query.gte(P.price, Number(minPrice));
  if (maxPrice != null) query = query.lte(P.price, Number(maxPrice));
  if (onlyDiscounted) query = query.gt(P.discountPercent, 0);
  if (search) {
    // Keyword fallback, used whenever semantic search is unavailable.
    //
    // Matched word by word, not as a phrase: "gaming laptop" appears in no
    // product title verbatim, so a literal %gaming laptop% match returns
    // nothing at all - which is exactly how a natural-language query is
    // phrased.
    //
    // searchMode 'all' requires every word to appear somewhere in the product
    // (chained .or() groups are ANDed together), 'any' requires just one.
    // 'all' is tried first by the caller, because 'any' on "gaming laptop"
    // matches gaming earbuds just as happily as gaming laptops - and with a
    // capped candidate pool, the real laptops may never even be fetched.
    const tokens = searchTokens(search);

    // Strict matching deliberately ignores key_features. Earphone listings say
    // things like "compatible with laptop", so including the description makes
    // "gaming laptop" match gaming earbuds on both words - the exact failure
    // strict mode exists to prevent. Title and category are what identify a
    // product; the description is only good for widening a search that failed.
    const strictColumns = [P.name, P.category, P.searchableText];
    const looseColumns = [P.name, P.category, P.searchableText, P.description];

    if (tokens.length && searchMode === 'all') {
      for (const token of tokens) {
        query = query.or(strictColumns.map((c) => `${c}.ilike.%${token}%`).join(','));
      }
    } else if (tokens.length) {
      const columns = looseColumns;
      const clauses = [];
      for (const token of tokens) {
        for (const column of columns) clauses.push(`${column}.ilike.%${token}%`);
      }
      query = query.or(clauses.join(','));
    }
  }

  // nullsFirst: false on every descending sort. Postgres orders NULLs FIRST on
  // DESC by default, so without it "highest price" and "biggest discount" both
  // lead with the rows that have no price or no discount at all - which
  // mapProduct then renders as 0. Ascending already puts NULLs last.
  if (sort === 'price_asc') {
    query = query.order(P.price, { ascending: true, nullsFirst: false });
  } else if (sort === 'price_desc') {
    query = query.order(P.price, { ascending: false, nullsFirst: false });
  } else if (sort === 'discount') {
    query = query.order(P.discountPercent, { ascending: false, nullsFirst: false });
  } else if (sort === 'popular') {
    // Used for the search candidate pool. Postgres returns rows in
    // primary-key order otherwise, which on this catalog means 400-odd
    // no-name earphones before any product a customer has heard of. Rating
    // count is the best available proxy for "a real product people buy", so
    // the ranker gets a pool worth ranking.
    query = query.order(COLUMNS.productsOptional.ratingCount, {
      ascending: false,
      nullsFirst: false,
    });
  } else query = query.order(P.id, { ascending: true });

  query = query.range(offset, offset + take - 1);

  const { data, error, count } = await query;
  if (error) fail(error, 'product listing');

  return {
    items: (data || []).map(mapProduct),
    total: count ?? (data || []).length,
    limit: take,
    offset: Number(offset) || 0,
  };
}

/**
 * Products ordered by number of reviews, then average rating.
 *
 * Only products that HAVE reviews appear - that is the point of the sort. Any
 * price filters are applied to the fetched page, so a page can come back
 * shorter than the limit when they exclude something; the caller still gets
 * the correct ordering.
 */
async function listByReviewRank({ category, minPrice, maxPrice, onlyDiscounted, limit, offset }) {
  // Required lazily: reviews.service imports nothing from here, but keeping
  // the require inside the function avoids any chance of a cycle.
  const reviewsService = require('./reviews.service');
  const ranked = await reviewsService.rankingByReviews({ category });

  const pageIds = ranked.slice(offset, offset + limit).map((r) => r.productId);
  if (pageIds.length === 0) {
    return { items: [], total: ranked.length, limit, offset: Number(offset) || 0 };
  }

  let query = supabase.from(TABLES.products).select(PRODUCT_SELECT).in(P.id, pageIds);
  if (minPrice != null) query = query.gte(P.price, Number(minPrice));
  if (maxPrice != null) query = query.lte(P.price, Number(maxPrice));
  if (onlyDiscounted) query = query.gt(P.discountPercent, 0);

  const { data, error } = await query;
  if (error) fail(error, 'review-ranked listing');

  // The database returns them in its own order; restore the ranked order and
  // attach the review figures so the card can show them without another call.
  const byId = new Map((data || []).map((row) => [row[P.id], row]));
  const items = [];
  for (const entry of ranked.slice(offset, offset + limit)) {
    const row = byId.get(entry.productId);
    if (!row) continue; // filtered out by price
    // Named distinctly from `reviewCount`, which is Flipkart's figure from the
    // dataset. These two count different things and must not be conflated.
    items.push({
      ...mapProduct(row),
      storeReviewCount: entry.count,
      storeReviewAverage: entry.average,
    });
  }

  return { items, total: ranked.length, limit, offset: Number(offset) || 0 };
}

async function getProductById(id) {
  const { data, error } = await supabase
    .from(TABLES.products)
    .select(PRODUCT_SELECT)
    .eq(P.id, id)
    .maybeSingle();

  if (error) fail(error, 'product lookup');
  if (!data) throw ApiError.notFound(`No product with id ${id}`);

  const product = mapProduct(data);
  product.stock = await getStock(id);
  return product;
}

async function getProductsByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const { data, error } = await supabase
    .from(TABLES.products)
    .select(PRODUCT_SELECT)
    .in(P.id, ids);

  if (error) fail(error, 'product batch lookup');
  return (data || []).map(mapProduct);
}

/**
 * Distinct categories with a product count, for the catalog overview page.
 * Done in JS rather than SQL because a GROUP BY would need an RPC the DB
 * owner has not created, and the catalog is small enough that it does not
 * matter at this scale.
 */
async function listCategories() {
  const { data, error } = await supabase
    .from(TABLES.products)
    .select(P.category)
    .not(P.category, 'is', null);

  if (error) fail(error, 'category listing');

  const counts = new Map();
  for (const row of data || []) {
    const name = row[P.category];
    counts.set(name, (counts.get(name) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, itemCount]) => ({ id: slugify(name), name, itemCount }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Sellable stock for one product: on-hand minus whatever is reserved.
 * Null means inventory has no row for it, which is "unknown", not "sold out".
 */
async function getStock(productId) {
  const { data, error } = await supabase
    .from(TABLES.inventory)
    .select(`${I.stock},${I.reservedStock}`)
    .eq(I.productId, productId)
    .maybeSingle();

  // The inventory table is still being built. Treat a failure here as
  // "stock unknown" rather than failing the whole product request.
  if (error) {
    logger.warn('Inventory lookup failed, returning unknown stock', error.message);
    return null;
  }
  return data ? sellable(data) : null;
}

// reserved_stock is NOT NULL DEFAULT 0, so this is always safe.
function sellable(row) {
  return Math.max(0, Number(row[I.stock] ?? 0) - Number(row[I.reservedStock] ?? 0));
}

async function getStockMap(productIds) {
  if (!productIds || productIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from(TABLES.inventory)
    .select(`${I.productId},${I.stock},${I.reservedStock}`)
    .in(I.productId, productIds);

  if (error) {
    logger.warn('Bulk inventory lookup failed', error.message);
    return new Map();
  }
  return new Map((data || []).map((r) => [r[I.productId], sellable(r)]));
}

/**
 * Semantic search over products.embedding via the match_products RPC.
 *
 * Neither the embedding column nor the RPC exists yet, so this returns null
 * (rather than throwing) when unavailable - callers fall back to keyword
 * search. Once the DB owner ships both, this starts working with no other
 * code change.
 */
async function searchByEmbedding(queryEmbedding, { limit = 20, category, maxPrice } = {}) {
  if (!queryEmbedding) return null;

  const { data, error } = await supabase.rpc(RPC.matchProducts, {
    query_embedding: queryEmbedding,
    match_count: clampLimit(limit),
    filter_category: category || null,
    max_price: maxPrice ?? null,
  });

  if (error) {
    logger.warn(
      `Semantic search unavailable (${RPC.matchProducts}), falling back to keyword search`,
      error.message
    );
    return null;
  }

  // The RPC is expected to return product rows plus a similarity float.
  return (data || []).map((row) => ({
    ...mapProduct(row),
    similarity: row.similarity != null ? Number(row.similarity) : null,
  }));
}

// --- admin writes ---------------------------------------------------------

async function createProduct(payload) {
  const { data, error } = await supabase
    .from(TABLES.products)
    .insert(payload)
    .select(PRODUCT_SELECT)
    .single();

  if (error) fail(error, 'product create');
  return mapProduct(data);
}

async function updateProduct(id, payload) {
  const { data, error } = await supabase
    .from(TABLES.products)
    .update(payload)
    .eq(P.id, id)
    .select(PRODUCT_SELECT)
    .maybeSingle();

  if (error) fail(error, 'product update');
  if (!data) throw ApiError.notFound(`No product with id ${id}`);
  return mapProduct(data);
}

async function deleteProduct(id) {
  const { error } = await supabase.from(TABLES.products).delete().eq(P.id, id);
  if (error) fail(error, 'product delete');
  return { id, deleted: true };
}

async function setStock(productId, stock) {
  // Upsert so this works whether or not the product already has an inventory
  // row; onConflict targets the product_id unique constraint.
  const { data, error } = await supabase
    .from(TABLES.inventory)
    .upsert(
      { [I.productId]: productId, [I.stock]: stock },
      { onConflict: I.productId }
    )
    .select()
    .maybeSingle();

  if (error) fail(error, 'stock update');
  return { productId, stock: data ? Number(data[I.stock]) : stock };
}

async function resolveProductNameToId(name) {
  const strict = await listProducts({ search: name, limit: 1, searchMode: 'all' });
  if (strict.items.length > 0) return strict.items[0].id;

  const loose = await listProducts({ search: name, limit: 2, searchMode: 'any' });
  // Confidence guard: if loose search finds exactly one match, we can trust it.
  // If it finds multiple, it's ambiguous, so return null to let the model decide.
  if (loose.items.length === 1) return loose.items[0].id;

  return null;
}

module.exports = {
  listProducts,
  listByReviewRank,
  searchTokens,
  getProductById,
  getProductsByIds,
  listCategories,
  getStock,
  getStockMap,
  searchByEmbedding,
  createProduct,
  updateProduct,
  deleteProduct,
  setStock,
  resolveProductNameToId,
};
