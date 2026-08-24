const cartService = require('../services/cart.service');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * The cart is held by the browser (there is no cart table), so both of these
 * take the whole cart in the request body and return a freshly priced view
 * of it. Nothing is stored server-side.
 */

const price = asyncHandler(async (req, res) => {
  res.json(await cartService.priceCart(req.body?.items));
});

const optimize = asyncHandler(async (req, res) => {
  res.json(await cartService.suggestSwaps(req.body?.items));
});

module.exports = { price, optimize };
