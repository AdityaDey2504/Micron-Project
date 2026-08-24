const express = require('express');
const controller = require('../controllers/orders.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// Everything about orders is personal, so the whole router is authenticated.
router.use(requireAuth);

router.get('/', controller.listMine);
router.post('/checkout', controller.checkout);
router.get('/:id', controller.getOne);

module.exports = router;
