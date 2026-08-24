const express = require('express');
const controller = require('../controllers/cart.controller');
const { optionalAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// Pricing a cart works signed out - the login gate is at checkout.
router.use(optionalAuth);

router.post('/price', controller.price);
router.post('/optimize', controller.optimize);

module.exports = router;
