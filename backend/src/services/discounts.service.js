const productsService = require('./products.service');

/**
 * Discounts.
 *
 * There is no discounts table in the schema - a discount is a percentage
 * carried on the product row (or derived from mrp vs price for the Kaggle
 * dataset; see mapProduct). This module is the one place that knows that, so
 * if the DB owner later adds a real discounts table only this file changes.
 */

/** Products currently on offer, biggest discount first. */
async function listDiscountedProducts({ category, limit = 20, offset = 0 } = {}) {
  return productsService.listProducts({
    category,
    onlyDiscounted: true,
    sort: 'discount',
    limit,
    offset,
  });
}

/** Set a product's discount percentage. Admin-only, validated by the caller. */
async function setDiscount(productId, discountPercent) {
  const { COLUMNS } = require('../db/tables');
  return productsService.updateProduct(productId, {
    [COLUMNS.products.discountPercent]: discountPercent,
  });
}

/** What a given percentage off a given price works out to. */
function applyDiscount(price, discountPercent) {
  const pct = Math.min(100, Math.max(0, Number(discountPercent) || 0));
  const finalPrice = Math.round(Number(price) * (1 - pct / 100) * 100) / 100;
  return {
    price: Number(price),
    discountPercent: pct,
    finalPrice,
    savings: Math.round((Number(price) - finalPrice) * 100) / 100,
  };
}

module.exports = { listDiscountedProducts, setDiscount, applyDiscount };
