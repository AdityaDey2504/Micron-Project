const supabase = require('../config/supabase');
const productsService = require('./products.service');
const { TABLES, COLUMNS } = require('../db/tables');
const { ApiError } = require('../middleware/errorHandler');

const P = COLUMNS.products;
const O = COLUMNS.productsOptional;

/**
 * Discounts.
 *
 * There is no discounts table - a discount lives on the product row as
 * `discount_percent`, measured against `original_price` (the MRP), with
 * `price` holding what the customer actually pays.
 *
 * That means a discount is TWO columns, not one: changing the percentage
 * without changing the price would only relabel the product while charging
 * the same amount. setDiscount below writes both.
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

/**
 * Set a product's discount, and reprice it accordingly.
 *
 * The new selling price is derived from the MRP, not from the current price -
 * otherwise applying 10% twice would compound instead of replacing the
 * previous discount. A product with no recorded MRP uses its current price as
 * the baseline, which is the best available reference.
 */
async function setDiscount(productId, discountPercent) {
  const pct = Number(discountPercent);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    throw ApiError.badRequest('discountPercent must be between 0 and 100');
  }

  const { data: row, error } = await supabase
    .from(TABLES.products)
    .select(`${P.id},${P.price},${O.mrp}`)
    .eq(P.id, productId)
    .maybeSingle();

  if (error) throw new ApiError(502, 'Database error reading the product');
  if (!row) throw ApiError.notFound(`No product with id ${productId}`);

  const currentPrice = Number(row[P.price] ?? 0);
  const mrp = row[O.mrp] == null ? null : Number(row[O.mrp]);
  const baseline = mrp != null && mrp > currentPrice ? mrp : currentPrice;

  const newPrice = Math.round(baseline * (1 - pct / 100) * 100) / 100;

  const payload = {
    [P.discountPercent]: pct,
    [P.price]: newPrice,
  };
  // If the product had no MRP recorded, keep the pre-discount figure so the
  // struck-through price still means something.
  if (mrp == null && pct > 0) payload[O.mrp] = baseline;

  return productsService.updateProduct(productId, payload);
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
