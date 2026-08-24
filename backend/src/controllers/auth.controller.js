const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const { TABLES, COLUMNS, generateId, mapCustomer } = require('../db/tables');
const { ApiError, asyncHandler } = require('../middleware/errorHandler');
const { signToken } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');
const logger = require('../utils/logger');

const C = COLUMNS.customers;
const BCRYPT_ROUNDS = 10;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateCredentials({ email, password }) {
  if (!email || !EMAIL_RE.test(email)) throw ApiError.badRequest('A valid email is required');
  if (!password || password.length < 6) {
    throw ApiError.badRequest('Password must be at least 6 characters');
  }
}

async function findByEmail(email) {
  const { data, error } = await supabase
    .from(TABLES.customers)
    .select('*')
    .ilike(C.email, email)
    .maybeSingle();

  if (error) {
    logger.error('Customer lookup failed', error.message);
    throw new ApiError(502, 'Database error during login');
  }
  return data;
}

const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body || {};
  validateCredentials({ email, password });
  if (!name || !name.trim()) throw ApiError.badRequest('Name is required');

  if (await findByEmail(email)) {
    throw ApiError.conflict('An account with that email already exists');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const { data, error } = await supabase
    .from(TABLES.customers)
    .insert({
      // customer_id is a text primary key with no default.
      [C.id]: generateId('CUST'),
      [C.name]: name.trim(),
      [C.email]: email.toLowerCase().trim(),
      [C.passwordHash]: passwordHash,
      // Role is never taken from the request body - otherwise anyone could
      // register themselves as an admin.
      [C.role]: ROLES.CUSTOMER,
    })
    .select('*')
    .single();

  if (error) {
    logger.error('Customer create failed', error.message);
    throw new ApiError(502, 'Could not create the account');
  }

  const customer = mapCustomer(data);
  res.status(201).json({ token: signToken(customer), user: customer });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw ApiError.badRequest('Email and password are required');

  const row = await findByEmail(email);

  // Same message and roughly the same work whether the email is unknown or
  // the password is wrong, so this cannot be used to enumerate accounts.
  const hash = row?.[C.passwordHash] || '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva';
  const ok = await bcrypt.compare(password, hash);

  if (!row || !ok) throw ApiError.unauthorized('Incorrect email or password');

  const customer = mapCustomer(row);
  res.json({ token: signToken(customer), user: customer });
});

/** Who am I - lets the frontend restore a session from a stored token. */
const me = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from(TABLES.customers)
    .select('*')
    .eq(C.id, req.user.id)
    .maybeSingle();

  if (error) throw new ApiError(502, 'Database error');
  if (!data) throw ApiError.notFound('Account no longer exists');

  res.json({ user: mapCustomer(data) });
});

module.exports = { register, login, me };
