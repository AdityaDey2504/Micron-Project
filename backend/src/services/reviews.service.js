const supabase = require('../config/supabase');
const { TABLES, COLUMNS, generateId, mapReview } = require('../db/tables');
const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const R = COLUMNS.reviews;

/**
 * Product reviews: read, summarise, and post.
 *
 * The reviews table stores `customer_name` as free text with no foreign key to
 * customers, so a review is attributed by NAME, not by account. That has two
 * consequences worth knowing: there is no verified-purchase concept, and a
 * customer cannot be shown "my reviews" reliably. Writes are still supported -
 * they record the signed-in user's name and set source to 'customer', which is
 * what distinguishes a real review from the 5,015 seeded 'synthetic_demo' rows.
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

/** Marks reviews written through the API, versus the seeded dataset. */
const CUSTOMER_SOURCE = 'customer';

const MAX_TITLE = 120;
const MAX_TEXT = 2000;

/**
 * Post a review as the signed-in customer.
 *
 * The product is verified to exist first, because review_id is minted here and
 * the foreign key would otherwise fail with a database error rather than a
 * clear 404.
 *
 * Deliberately NOT enforced: that the customer bought the product. There is no
 * way to check it meaningfully - reviews carry a name, not a customer id - so
 * pretending to verify would be worse than not claiming to.
 */
async function createReview(productId, { customerId, rating, title, text }) {
  const score = Number(rating);
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw ApiError.badRequest('rating must be a whole number from 1 to 5');
  }
  if (!text || !String(text).trim()) {
    throw ApiError.badRequest('text is required');
  }

  // The JWT carries id, email and role - not the display name - so the name is
  // read from the customer row. Doing it here rather than trusting the request
  // body means a review cannot be posted under someone else's name.
  const { data: customer, error: customerError } = await supabase
    .from(TABLES.customers)
    .select(COLUMNS.customers.name)
    .eq(COLUMNS.customers.id, customerId)
    .maybeSingle();

  if (customerError) fail(customerError, 'review author lookup');
  if (!customer) throw ApiError.unauthorized('Account no longer exists');
  const customerName = customer[COLUMNS.customers.name];

  // Title and category come back too: reviews duplicates both as NOT NULL
  // columns, so an insert has to carry them over from the product.
  const P = COLUMNS.products;
  const { data: product, error: productError } = await supabase
    .from(TABLES.products)
    .select(`${P.id},${P.name},${P.category}`)
    .eq(P.id, productId)
    .maybeSingle();

  if (productError) fail(productError, 'review product lookup');
  if (!product) throw ApiError.notFound(`No product with id ${productId}`);

  const { data, error } = await supabase
    .from(TABLES.reviews)
    .insert({
      // review_id is a text primary key with no default.
      [R.id]: generateId('REV'),
      [R.productId]: productId,
      [R.productName]: product[P.name],
      [R.category]: product[P.category],
      [R.customerName]: customerName,
      [R.rating]: score,
      [R.title]: title ? String(title).trim().slice(0, MAX_TITLE) : null,
      [R.text]: String(text).trim().slice(0, MAX_TEXT),
      [R.date]: new Date().toISOString().slice(0, 10),
      [R.source]: CUSTOMER_SOURCE,
    })
    .select('*')
    .single();

  if (error) fail(error, 'review create');
  return mapReview(data);
}

module.exports = { listForProduct, summaryForProduct, forChat, createReview };
