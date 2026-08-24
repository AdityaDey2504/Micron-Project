const productsService = require('../services/products.service');
const ordersService = require('../services/orders.service');
const discountsService = require('../services/discounts.service');
const { COLUMNS, generateId } = require('../db/tables');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

const P = COLUMNS.products;

/**
 * Admin writes. Everything here sits behind requireAuth + requireAdmin in
 * admin.routes.js, so these handlers assume the caller is already an admin.
 */

// Builds the DB row from the request body, ignoring anything unrecognised so
// a client cannot write to columns it should not touch (id, embedding...).
function productPayload(body, { partial = false } = {}) {
  const payload = {};
  const assign = (column, value, transform = (v) => v) => {
    if (value !== undefined) payload[column] = transform(value);
  };

  assign(P.name, body.name, (v) => String(v).trim());
  assign(P.description, body.description);
  assign(P.category, body.category);
  assign(P.price, body.price, Number);
  assign(P.discountPercent, body.discountPercent, Number);
  assign(P.imageUrl, body.imageUrl);

  if (!partial) {
    if (!payload[P.name]) throw ApiError.badRequest('name is required');
    if (payload[P.price] == null || Number.isNaN(payload[P.price])) {
      throw ApiError.badRequest('price is required and must be a number');
    }
  }
  if (payload[P.price] != null && payload[P.price] < 0) {
    throw ApiError.badRequest('price cannot be negative');
  }
  if (
    payload[P.discountPercent] != null &&
    (payload[P.discountPercent] < 0 || payload[P.discountPercent] > 100)
  ) {
    throw ApiError.badRequest('discountPercent must be between 0 and 100');
  }
  if (partial && Object.keys(payload).length === 0) {
    throw ApiError.badRequest('Nothing to update');
  }

  return payload;
}

const createProduct = asyncHandler(async (req, res) => {
  const payload = productPayload(req.body || {});
  payload[P.id] = generateId('PROD'); // text primary key, no default
  const product = await productsService.createProduct(payload);

  // Stock lives in the inventory table, not on the product row, so it is set
  // as a second step when the request included it.
  if (req.body?.stock != null) {
    product.stock = (await productsService.setStock(product.id, Number(req.body.stock))).stock;
  }
  res.status(201).json(product);
});

const updateProduct = asyncHandler(async (req, res) => {
  const product = await productsService.updateProduct(
    req.params.id,
    productPayload(req.body || {}, { partial: true })
  );
  if (req.body?.stock != null) {
    product.stock = (await productsService.setStock(product.id, Number(req.body.stock))).stock;
  }
  res.json(product);
});

const deleteProduct = asyncHandler(async (req, res) => {
  res.json(await productsService.deleteProduct(req.params.id));
});

const setStock = asyncHandler(async (req, res) => {
  const stock = Number(req.body?.stock);
  if (!Number.isFinite(stock) || stock < 0) {
    throw ApiError.badRequest('stock must be a number of zero or more');
  }
  res.json(await productsService.setStock(req.params.id, Math.floor(stock)));
});

const setDiscount = asyncHandler(async (req, res) => {
  const discountPercent = Number(req.body?.discountPercent);
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
    throw ApiError.badRequest('discountPercent must be between 0 and 100');
  }
  res.json(await discountsService.setDiscount(req.params.id, discountPercent));
});

const listOrders = asyncHandler(async (req, res) => {
  res.json(
    await ordersService.listAllOrders({
      limit: Number(req.query.limit) || 50,
      offset: Number(req.query.offset) || 0,
      status: req.query.status,
    })
  );
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  res.json(await ordersService.updateOrderStatus(req.params.id, req.body?.status));
});

/**
 * Inventory view for the admin dashboard: every product with its stock, low
 * stock first so the thing needing attention is at the top.
 */
const inventory = asyncHandler(async (req, res) => {
  const { items, total } = await productsService.listProducts({ limit: 100 });
  const stockMap = await productsService.getStockMap(items.map((p) => p.id));

  const rows = items
    .map((product) => ({
      productId: product.id,
      name: product.name,
      category: product.category,
      price: product.finalPrice,
      stock: stockMap.has(product.id) ? stockMap.get(product.id) : null,
    }))
    .sort((a, b) => (a.stock ?? Infinity) - (b.stock ?? Infinity));

  res.json({ items: rows, total });
});

module.exports = {
  createProduct,
  updateProduct,
  deleteProduct,
  setStock,
  setDiscount,
  listOrders,
  updateOrderStatus,
  inventory,
};
