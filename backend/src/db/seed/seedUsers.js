/**
 * Makes the demo accounts able to log in.
 *
 *   npm run seed:users
 *
 * The customers table came from the dataset: 150 people with orders, budgets
 * and archetypes, but no email or password. Rather than creating a fresh
 * account, this gives credentials to a customer who ALREADY HAS ORDERS.
 *
 * That distinction matters. A brand-new account has no purchase history, so
 * "what did I buy last time" returns nothing and the don't-buy warning can
 * never fire - the two features that make the chatbot look intelligent. The
 * demo customer is picked automatically as whoever has the most orders inside
 * the recent-purchase window, across the most categories.
 *
 * The admin is a separate new row, since an admin needs no purchase history.
 *
 * Safe to re-run: accounts are updated in place, never duplicated.
 */
const bcrypt = require('bcryptjs');
const supabase = require('../../config/supabase');
const { TABLES, COLUMNS, generateId } = require('../tables');
const { ROLES, RECENT_PURCHASE_DAYS } = require('../../utils/constants');

const C = COLUMNS.customers;
const O = COLUMNS.orders;

const DEMO = { email: 'demo@aura.dev', password: 'demo123' };
const ADMIN = { name: 'Aura Admin', email: 'admin@aura.dev', password: 'admin123' };

const daysSince = (date) => Math.floor((Date.now() - new Date(date)) / 86_400_000);

/**
 * Picks the customer who best demonstrates the history-aware features: most
 * orders inside the window, then most recent, then most categories.
 */
async function pickDemoCustomer() {
  const { data, error } = await supabase
    .from(TABLES.orders)
    .select(`${O.id},${O.customerId},${O.createdAt}, ${TABLES.orderItems}(${TABLES.products}(category))`)
    .order(O.createdAt, { ascending: false })
    .limit(500);

  if (error) throw new Error(`Could not read orders: ${error.message}`);

  const stats = new Map();
  for (const order of data || []) {
    const id = order[O.customerId];
    if (!stats.has(id)) stats.set(id, { recent: 0, newest: Infinity, categories: new Set() });

    const entry = stats.get(id);
    const age = daysSince(order[O.createdAt]);
    if (age <= RECENT_PURCHASE_DAYS) entry.recent += 1;
    entry.newest = Math.min(entry.newest, age);

    for (const item of order[TABLES.orderItems] || []) {
      if (item.products?.category) entry.categories.add(item.products.category);
    }
  }

  const best = [...stats.entries()]
    .filter(([, s]) => s.recent > 0)
    .sort(
      (a, b) =>
        b[1].recent - a[1].recent ||
        a[1].newest - b[1].newest ||
        b[1].categories.size - a[1].categories.size
    )[0];

  if (!best) throw new Error('No customer has a recent order - cannot pick a demo account.');
  return { id: best[0], ...best[1] };
}

async function setCredentials(customerId, { email, password, role }) {
  const { data, error } = await supabase
    .from(TABLES.customers)
    .update({
      [C.email]: email,
      [C.passwordHash]: await bcrypt.hash(password, 10),
      [C.role]: role,
    })
    .eq(C.id, customerId)
    .select(`${C.id},${C.name}`)
    .maybeSingle();

  if (error) throw new Error(`Could not update ${customerId}: ${error.message}`);
  return data;
}

async function run() {
  // --- demo customer: an existing person, with real orders behind them ---
  const pick = await pickDemoCustomer();
  const customer = await setCredentials(pick.id, { ...DEMO, role: ROLES.CUSTOMER });

  console.log(`demo customer : ${DEMO.email} / ${DEMO.password}`);
  console.log(
    `                -> ${customer[C.name]} (${pick.id}), ` +
      `${pick.recent} orders in the last ${RECENT_PURCHASE_DAYS} days, ` +
      `newest ${pick.newest} days ago`
  );
  console.log(`                -> categories bought: ${[...pick.categories].join(', ')}`);
  console.log(
    `                -> ask the chatbot for a ${[...pick.categories][0] || 'product'} ` +
      `to trigger the don't-buy warning`
  );

  // --- admin: a new row, since no purchase history is needed ---
  const { data: existingAdmin } = await supabase
    .from(TABLES.customers)
    .select(C.id)
    .ilike(C.email, ADMIN.email)
    .maybeSingle();

  if (existingAdmin) {
    await setCredentials(existingAdmin[C.id], { ...ADMIN, role: ROLES.ADMIN });
    console.log(`\nadmin         : ${ADMIN.email} / ${ADMIN.password} (updated)`);
  } else {
    const { error } = await supabase.from(TABLES.customers).insert({
      [C.id]: generateId('ADMIN'),
      [C.name]: ADMIN.name,
      [C.email]: ADMIN.email,
      [C.passwordHash]: await bcrypt.hash(ADMIN.password, 10),
      [C.role]: ROLES.ADMIN,
    });
    if (error) throw new Error(`Could not create the admin: ${error.message}`);
    console.log(`\nadmin         : ${ADMIN.email} / ${ADMIN.password} (created)`);
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
