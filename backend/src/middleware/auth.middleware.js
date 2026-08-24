const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { ROLES } = require('../utils/constants');
const { ApiError } = require('./errorHandler');

function readToken(req) {
  const header = req.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

function verify(token) {
  try {
    return jwt.verify(token, env.jwtSecret);
  } catch (err) {
    throw err.name === 'TokenExpiredError'
      ? ApiError.unauthorized('Session expired, please log in again')
      : ApiError.unauthorized('Invalid token');
  }
}

// Hard gate: 401 if there is no valid token.
function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return next(ApiError.unauthorized());
  try {
    const payload = verify(token);
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch (err) {
    next(err);
  }
}

// Soft gate: attaches req.user when a token is present, but never rejects.
// The chatbot uses this so anonymous visitors can still ask product questions
// while logged-in users additionally get history-aware answers.
function optionalAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return next();
  try {
    const payload = verify(token);
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
  } catch {
    // Ignore a bad token here - treat the caller as anonymous.
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.role !== ROLES.ADMIN) {
    return next(ApiError.forbidden('Admin access required'));
  }
  next();
}

function signToken(customer) {
  return jwt.sign(
    { sub: customer.id, email: customer.email, role: customer.role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

module.exports = { requireAuth, optionalAuth, requireAdmin, signToken };
