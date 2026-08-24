const express = require('express');
const controller = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const rateLimiter = require('../middleware/rateLimiter');

const router = express.Router();

// Tighter limit on the credential endpoints than on the rest of the API.
const authLimiter = rateLimiter({ windowMs: 60_000, max: 10 });

router.post('/register', authLimiter, controller.register);
router.post('/login', authLimiter, controller.login);
router.get('/me', requireAuth, controller.me);

module.exports = router;
