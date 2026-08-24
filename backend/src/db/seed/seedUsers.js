/**
 * Creates the demo accounts.
 *
 *   admin@aura.dev / admin123     -> admin dashboard
 *   demo@aura.dev  / demo123      -> customer with order history
 *
 * Safe to re-run: existing accounts are updated, not duplicated.
 *
 *   npm run seed:users
 */
const bcrypt = require('bcryptjs');
const supabase = require('../../config/supabase');
const { TABLES, COLUMNS } = require('../tables');
const { ROLES } = require('../../utils/constants');

const C = COLUMNS.customers;

const ACCOUNTS = [
  { name: 'Aura Admin', email: 'admin@aura.dev', password: 'admin123', role: ROLES.ADMIN },
  { name: 'Demo Customer', email: 'demo@aura.dev', password: 'demo123', role: ROLES.CUSTOMER },
];

async function run() {
  for (const account of ACCOUNTS) {
    const passwordHash = await bcrypt.hash(account.password, 10);

    const { data: existing } = await supabase
      .from(TABLES.customers)
      .select(C.id)
      .ilike(C.email, account.email)
      .maybeSingle();

    const row = {
      [C.name]: account.name,
      [C.email]: account.email,
      [C.passwordHash]: passwordHash,
      [C.role]: account.role,
    };

    const { error } = existing
      ? await supabase.from(TABLES.customers).update(row).eq(C.id, existing[C.id])
      : await supabase.from(TABLES.customers).insert(row);

    if (error) {
      console.error(`FAILED ${account.email}:`, error.message);
      continue;
    }
    console.log(`${existing ? 'updated' : 'created'} ${account.email} / ${account.password}`);
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
