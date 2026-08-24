const supabase = require('../config/supabase');
const { TABLES, COLUMNS, mapReview } = require('../db/tables');
const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const R = COLUMNS.reviews;

/**
 * Product reviews. Read-only.
 *
 * The reviews table stores `customer_name` as free text with no foreign key to
 * customers, so a review cannot be attributed to a signed-in user and there is
 * no verified-purchase concept. Writing reviews is therefore not supported
 * here - it would produce rows indistinguishable from the seeded ones.
 *
 * Coverage is uneven: laptops and mobiles have 5 reviews each, earphones have
 * none at all. Callers must handle an empty list as a normal case, not an error.
 */

function fail(error, context) {
  logger.error(`Supabase error during ${context}`, error.message);
  throw new ApiError(502, `Database error during ${context}`);
}

/** Reviews for one product, newest first. */
async function listForProduct(productId, { limit = 20, offset = 0 } = {}) {
  const { data, error, count } = await supabase
    .from(TABLES.reviews)
    .select('*', { count: 'exact' })
    .eq(R.productId, productId)
    .order(R.date, { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) fail(error, 'review listing');

  return {
    items: (data || []).map(mapReview),
    total: count ?? (data || []).length,
    limit,
    offset,
  };
}

/**
 * Average rating and a star breakdown for one product.
 *
 * Computed from the rows rather than stored, so it cannot go stale. The
 * catalogue is small enough that this is cheaper than maintaining a counter.
 */
async function summaryForProduct(productId) {
  const { data, error } = await supabase
    .from(TABLES.reviews)
    .select(R.rating)
    .eq(R.productId, productId);

  if (error) fail(error, 'review summary');

  const ratings = (data || []).map((row) => Number(row[R.rating]));
  if (ratings.length === 0) {
    return { productId, count: 0, average: null, breakdown: null };
  }

  const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const rating of ratings) {
    if (breakdown[rating] !== undefined) breakdown[rating] += 1;
  }

  const average = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;

  return {
    productId,
    count: ratings.length,
    average: Math.round(average * 10) / 10,
    breakdown,
  };
}

/**
 * Reviews shaped for the chatbot: a summary plus the most useful few.
 *
 * Deliberately returns the best AND worst review rather than the newest, so
 * the model can give a balanced answer instead of quoting whichever review
 * happened to be most recent.
 */
async function forChat(productId, { limit = 4 } = {}) {
  const { data, error } = await supabase
    .from(TABLES.reviews)
    .select('*')
    .eq(R.productId, productId);

  if (error) fail(error, 'review lookup');

  const reviews = (data || []).map(mapReview);
  if (reviews.length === 0) {
    return { count: 0, average: null, reviews: [], message: 'No reviews for this product yet.' };
  }

  const sorted = [...reviews].sort((a, b) => b.rating - a.rating);
  const picked = [];

  // Highest first, then the lowest, then fill from the top.
  picked.push(sorted[0]);
  if (sorted.length > 1) picked.push(sorted[sorted.length - 1]);
  for (const review of sorted.slice(1, -1)) {
    if (picked.length >= limit) break;
    picked.push(review);
  }

  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  return {
    count: reviews.length,
    average: Math.round(average * 10) / 10,
    reviews: picked.map((r) => ({
      rating: r.rating,
      title: r.title,
      text: r.text,
      author: r.author,
      date: r.date,
    })),
  };
}

module.exports = { listForProduct, summaryForProduct, forChat };
