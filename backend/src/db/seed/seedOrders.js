/**
 * Gives the demo customer an order history, so the chatbot has something to
 * answer "what did I buy last time" with.
 *
 * One of the orders is deliberately placed ~40 days ago in the same category
 * as a well-stocked product, which is what triggers the don't-buy warning
 * during the demo. Without that, the feature has nothing to fire on.
 *
 *   npm run seed:orders                 (uses demo@aura.dev)
 *   node src/db/seed/seedOrders.js CUST-abc123
 */
const supabase = require('../../config/supabase');
const { TABLES, COLUMNS, generateId } = require('../tables');
const { ORDER_STATUS } = require('../../utils/constants');

const P = COLUMNS.products;
const C = COLUMNS.customers;
const O = COLUMNS.orders;
const OI = COLUMNS.orderItems;

const dateDaysAgo = (days) =>
  new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

// [days ago, how many products in that order]
const ORDER_PLAN = [
  [41, 1], // inside the 60-day window - this is the one that triggers the warning
  [95, 2],
  [180, 1],
];

async function resolveCustomerId(argId) {
  if (argId) return argId;

  const { data, error } = await supabase
    .from(TABLES.customers)
    .select(C.id)
    .ilike(C.email, 'demo@aura.dev')
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      'Could not find demo@aura.dev. Run "npm run seed:users" first, or pass a customer id as an argument.'
    );
  }
  return data[C.id];
}

async function run() {
  const customerId = await resolveCustomerId(process.argv[2]);

  const { data: products, error } = await supabase
    .from(TABLES.products)
    .select('*')
    .limit(20);

  if (error) throw new Error(`Could not read products: ${error.message}`);
  if (!products?.length) throw new Error('No products in the database. Seed products first.');

  let cursor = 0;

  for (const [daysAgo, itemCount] of ORDER_PLAN) {
    const picked = [];
    for (let i = 0; i < itemCount; i += 1) {
      picked.push(products[cursor % products.length]);
      cursor += 1;
    }

    const lines = picked.map((product) => {
      const quantity = 1;
      const price = Number(product[P.price] ?? 0);
      const discount = Number(product[P.discountPercent] ?? 0);
      const unitPrice = Math.round(price * (1 - discount / 100) * 100) / 100;
      return { product, quantity, unitPrice };
    });

    const total = Math.round(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0) * 100) / 100;
    const orderId = generateId('ORD');

    const { error: orderError } = await supabase.from(TABLES.orders).insert({
      [O.id]: orderId,
      [O.customerId]: customerId,
      [O.total]: total,
      [O.status]: ORDER_STATUS.DELIVERED,
      [O.createdAt]: dateDaysAgo(daysAgo),
    });

    if (orderError) {
      console.error(`order ${daysAgo} days ago failed:`, orderError.message);
      continue;
    }

    const { error: itemError } = await supabase.from(TABLES.orderItems).insert(
      lines.map((l) => ({
        [OI.id]: generateId('OI'),
        [OI.orderId]: orderId,
        [OI.productId]: l.product[P.id],
        [OI.quantity]: l.quantity,
        [OI.unitPrice]: l.unitPrice,
      }))
    );

    if (itemError) {
      console.error(`items for ${orderId} failed:`, itemError.message);
      continue;
    }

    console.log(
      `${orderId}: ${daysAgo} days ago, ${lines.length} item(s), total ${total} ` +
        `[${lines.map((l) => l.product[P.category]).join(', ')}]`
    );
  }

  console.log(`\nDone. Ask the chatbot about ${products[0][P.category]} to see the don't-buy warning.`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
