const supabase = require('../config/supabase');
const {
  TABLES,
  COLUMNS,
  generateId,
  mapOrder,
  mapOrderItem,
  mapProduct,
} = require('../db/tables');
const { ApiError } = require('../middleware/errorHandler');
const { ORDER_STATUS, RECENT_PURCHASE_DAYS } = require('../utils/constants');
const logger = require('../utils/logger');

const O = COLUMNS.orders;
const OI = COLUMNS.orderItems;
const I = COLUMNS.inventory;

// orders.order_date is a DATE, not a timestamp, so comparisons use
// YYYY-MM-DD rather than a full ISO string.
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (days) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

function fail(error, context) {
  logger.error(`Supabase error during ${context}`, error.message);
  throw new ApiError(502, `Database error during ${context}`);
}

/**
 * Orders for one customer, newest first, with their line items and the
 * product each line refers to. Backs both the order-history page and the
 * chatbot's get_order_history tool.
 */
async function listOrdersForCustomer(customerId, { limit = 20, offset = 0 } = {}) {
  const { data, error, count } = await supabase
    .from(TABLES.orders)
    .select(`*, ${TABLES.orderItems}(*, ${TABLES.products}(*))`, { count: 'exact' })
    .eq(O.customerId, customerId)
    .order(O.createdAt, { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) fail(error, 'order history');

  return {
    items: (data || []).map((row) =>
      mapOrder(row, (row[TABLES.orderItems] || []).map(mapOrderItem))
    ),
    total: count ?? (data || []).length,
    limit,
    offset,
  };
}

async function getOrderById(orderId, { customerId } = {}) {
  let query = supabase
    .from(TABLES.orders)
    .select(`*, ${TABLES.orderItems}(*, ${TABLES.products}(*))`)
    .eq(O.id, orderId);

  // When a customerId is supplied, scope the lookup to that customer so one
  // user can never read another user's order by guessing an id.
  if (customerId) query = query.eq(O.customerId, customerId);

  const { data, error } = await query.maybeSingle();
  if (error) fail(error, 'order lookup');
  if (!data) throw ApiError.notFound(`No order with id ${orderId}`);

  return mapOrder(data, (data[TABLES.orderItems] || []).map(mapOrderItem));
}

/**
 * Create an order from a list of {productId, quantity}.
 *
 * Prices are re-read from the database rather than trusted from the request
 * body - otherwise a client could post its own price and buy a laptop for a
 * rupee. Stock is decremented per line after the order is written.
 */
async function createOrder(customerId, items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('An order needs at least one item');
  }

  const productIds = [...new Set(items.map((i) => i.productId))];
  const { data: productRows, error: productError } = await supabase
    .from(TABLES.products)
    .select('*')
    .in(COLUMNS.products.id, productIds);

  if (productError) fail(productError, 'order product lookup');

  const products = new Map((productRows || []).map((r) => [String(r[COLUMNS.products.id]), mapProduct(r)]));

  const missing = productIds.filter((id) => !products.has(String(id)));
  if (missing.length) {
    throw ApiError.badRequest(`Unknown product ids: ${missing.join(', ')}`);
  }

  const lines = items.map((item) => {
    const product = products.get(String(item.productId));
    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
    return { product, quantity, unitPrice: product.finalPrice };
  });

  const total =
    Math.round(lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0) * 100) / 100;

  const { data: orderRow, error: orderError } = await supabase
    .from(TABLES.orders)
    .insert({
      // order_id is a text primary key with no default, so it is minted here.
      [O.id]: generateId('ORD'),
      [O.customerId]: customerId,
      [O.total]: total,
      [O.status]: ORDER_STATUS.PAID,
      [O.createdAt]: today(),
    })
    .select()
    .single();

  if (orderError) fail(orderError, 'order create');

  const orderId = orderRow[O.id];

  const { data: itemRows, error: itemError } = await supabase
    .from(TABLES.orderItems)
    .insert(
      lines.map((l) => ({
        [OI.id]: generateId('OI'),
        [OI.orderId]: orderId,
        [OI.productId]: l.product.id,
        [OI.quantity]: l.quantity,
        [OI.unitPrice]: l.unitPrice,
      }))
    )
    .select();

  if (itemError) {
    // Supabase has no client-side transactions, so roll the header back by
    // hand rather than leaving an order with no lines behind.
    await supabase.from(TABLES.orders).delete().eq(O.id, orderId);
    fail(itemError, 'order item create');
  }

  await decrementStock(lines);

  return mapOrder(orderRow, (itemRows || []).map(mapOrderItem));
}

// Best-effort stock decrement. A failure here is logged, not fatal: the sale
// is already recorded, and inventory is still being built by the DB owner.
async function decrementStock(lines) {
  for (const line of lines) {
    const { data, error } = await supabase
      .from(TABLES.inventory)
      .select(I.stock)
      .eq(I.productId, line.product.id)
      .maybeSingle();

    if (error || !data) continue;

    const next = Math.max(0, Number(data[I.stock]) - line.quantity);
    const { error: updateError } = await supabase
      .from(TABLES.inventory)
      .update({ [I.stock]: next })
      .eq(I.productId, line.product.id);

    if (updateError) {
      logger.warn(`Could not decrement stock for product ${line.product.id}`, updateError.message);
    }
  }
}

/**
 * Powers the "don't buy" warning: did this customer already order something
 * in this category recently? Returns the most recent match, or null.
 */
async function findRecentPurchaseInCategory(customerId, category, days = RECENT_PURCHASE_DAYS) {
  if (!customerId || !category) return null;

  const since = daysAgo(days);

  const { data, error } = await supabase
    .from(TABLES.orders)
    .select(`*, ${TABLES.orderItems}(*, ${TABLES.products}(*))`)
    .eq(O.customerId, customerId)
    .gte(O.createdAt, since)
    .order(O.createdAt, { ascending: false });

  if (error) {
    logger.warn('Recent-purchase check failed', error.message);
    return null;
  }

  const wanted = String(category).toLowerCase();
  for (const order of data || []) {
    for (const item of order[TABLES.orderItems] || []) {
      const product = item[TABLES.products];
      if (!product) continue;
      if (String(product[COLUMNS.products.category] || '').toLowerCase() !== wanted) continue;

      const purchasedAt = order[O.createdAt];
      return {
        product: mapProduct(product),
        orderId: order[O.id],
        purchasedAt,
        daysAgo: Math.floor((Date.now() - new Date(purchasedAt).getTime()) / 86_400_000),
      };
    }
  }
  return null;
}

/** Product ids this customer has ever bought - used by the ranker. */
async function getPurchasedProductIds(customerId, days = RECENT_PURCHASE_DAYS) {
  if (!customerId) return new Set();

  const since = daysAgo(days);
  const { data, error } = await supabase
    .from(TABLES.orders)
    .select(`${O.id}, ${TABLES.orderItems}(${OI.productId})`)
    .eq(O.customerId, customerId)
    .gte(O.createdAt, since);

  if (error) {
    logger.warn('Purchased-product lookup failed', error.message);
    return new Set();
  }

  const ids = new Set();
  for (const order of data || []) {
    for (const item of order[TABLES.orderItems] || []) ids.add(item[OI.productId]);
  }
  return ids;
}

// --- admin ---------------------------------------------------------------

async function listAllOrders({ limit = 50, offset = 0, status } = {}) {
  let query = supabase
    .from(TABLES.orders)
    .select(`*, ${TABLES.orderItems}(*, ${TABLES.products}(*))`, { count: 'exact' })
    .order(O.createdAt, { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq(O.status, status);

  const { data, error, count } = await query;
  if (error) fail(error, 'admin order listing');

  return {
    items: (data || []).map((row) =>
      mapOrder(row, (row[TABLES.orderItems] || []).map(mapOrderItem))
    ),
    total: count ?? (data || []).length,
    limit,
    offset,
  };
}

async function updateOrderStatus(orderId, status) {
  if (!Object.values(ORDER_STATUS).includes(status)) {
    throw ApiError.badRequest(
      `Invalid status. Expected one of: ${Object.values(ORDER_STATUS).join(', ')}`
    );
  }

  const { data, error } = await supabase
    .from(TABLES.orders)
    .update({ [O.status]: status })
    .eq(O.id, orderId)
    .select()
    .maybeSingle();

  if (error) fail(error, 'order status update');
  if (!data) throw ApiError.notFound(`No order with id ${orderId}`);
  return mapOrder(data);
}

module.exports = {
  listOrdersForCustomer,
  getOrderById,
  createOrder,
  findRecentPurchaseInCategory,
  getPurchasedProductIds,
  listAllOrders,
  updateOrderStatus,
};
