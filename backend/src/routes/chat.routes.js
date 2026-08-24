const express = require('express');
const controller = require('../controllers/chat.controller');
const { optionalAuth } = require('../middleware/auth.middleware');
const rateLimiter = require('../middleware/rateLimiter');

const router = express.Router();

// The only route that costs money per call. Limited per user, falling back to
// IP for anonymous visitors, so a judge holding down enter cannot exhaust the
// Gemini free tier mid-demo.
const chatLimiter = rateLimiter({
  windowMs: 60_000,
  max: 20,
  key: (req) => req.user?.id || req.ip,
});

router.post('/', optionalAuth, chatLimiter, controller.chat);

module.exports = router;
