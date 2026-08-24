const ordersService = require('../services/orders.service');
const cartService = require('../services/cart.service');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

const listMine = asyncHandler(async (req, res) => {
  res.json(
    await ordersService.listOrdersForCustomer(req.user.id, {
      limit: Number(req.query.limit) || 20,
      offset: Number(req.query.offset) || 0,
    })
  );
});

const getOne = asyncHandler(async (req, res) => {
  // Scoped to the signed-in customer so order ids cannot be walked.
  res.json(await ordersService.getOrderById(req.params.id, { customerId: req.user.id }));
});

/**
 * Checkout. The client posts the cart it is holding; the server re-prices it
 * from the database and writes the order at those prices.
 */
const checkout = asyncHandler(async (req, res) => {
  const { items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('Checkout needs a non-empty items array');
  }

  // Price first: this validates the product ids and surfaces anything out of
  // stock before an order row is written.
  const priced = await cartService.priceCart(items);
  if (priced.hasUnavailableItems) {
    throw ApiError.conflict('Some items are out of stock', {
      unavailable: priced.items.filter((i) => !i.inStock).map((i) => i.productId),
    });
  }

  const order = await ordersService.createOrder(
    req.user.id,
    priced.items.map((i) => ({ productId: i.productId, quantity: i.quantity }))
  );

  res.status(201).json({ order, savings: priced.savings });
});

module.exports = { listMine, getOne, checkout };
