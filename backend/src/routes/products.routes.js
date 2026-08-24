const express = require('express');
const controller = require('../controllers/products.controller');
const { optionalAuth, requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// Order matters: the literal paths must be declared before '/:id', or
// '/categories' would be read as a product id.
router.get('/categories', controller.categories);
router.get('/discounted', controller.discounted);
router.get('/search', optionalAuth, controller.search);
router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.get('/:id/reviews', controller.reviews);
router.post('/:id/reviews', requireAuth, controller.createReview);

module.exports = router;
