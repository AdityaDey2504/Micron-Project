const express = require('express');
const controller = require('../controllers/admin.controller');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');

const router = express.Router();

// Every admin route is gated here rather than per-handler, so a new route
// cannot accidentally ship unprotected.
router.use(requireAuth, requireAdmin);

router.post('/products', controller.createProduct);
router.patch('/products/:id', controller.updateProduct);
router.delete('/products/:id', controller.deleteProduct);
router.put('/products/:id/stock', controller.setStock);
router.put('/products/:id/discount', controller.setDiscount);

router.get('/inventory', controller.inventory);
router.get('/orders', controller.listOrders);
router.patch('/orders/:id/status', controller.updateOrderStatus);

module.exports = router;
