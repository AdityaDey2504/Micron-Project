const productsService = require('../services/products.service');
const discountsService = require('../services/discounts.service');
const reviewsService = require('../services/reviews.service');
const { asyncHandler } = require('../middleware/errorHandler');
const { PAGE_SIZE_DEFAULT } = require('../utils/constants');

function readPaging(query) {
  return {
    limit: Number(query.limit) || PAGE_SIZE_DEFAULT,
    offset: Number(query.offset) || 0,
  };
}

const list = asyncHandler(async (req, res) => {
  const { category, search, q, minPrice, maxPrice, discounted, sort } = req.query;
  const result = await productsService.listProducts({
    category,
    // Accept ?q= as well as ?search= so the frontend can use either.
    search: search || q,
    minPrice: minPrice != null ? Number(minPrice) : undefined,
    maxPrice: maxPrice != null ? Number(maxPrice) : undefined,
    onlyDiscounted: discounted === 'true',
    sort,
    ...readPaging(req.query),
  });
  res.json(result);
});

const getOne = asyncHandler(async (req, res) => {
  res.json(await productsService.getProductById(req.params.id));
});

const categories = asyncHandler(async (req, res) => {
  res.json({ items: await productsService.listCategories() });
});

const discounted = asyncHandler(async (req, res) => {
  res.json(
    await discountsService.listDiscountedProducts({
      category: req.query.category,
      ...readPaging(req.query),
    })
  );
});

/**
 * Natural-language product search - the same ranked pipeline the chatbot
 * uses, exposed directly so the search page can use it without spending a
 * model call on prose.
 */
const search = asyncHandler(async (req, res) => {
  const { dispatch } = require('../services/ai/toolDispatcher');
  const result = await dispatch(
    'searchProducts',
    {
      query: req.query.q || '',
      category: req.query.category,
      max_price: req.query.maxPrice != null ? Number(req.query.maxPrice) : undefined,
      limit: Number(req.query.limit) || 10,
    },
    { customerId: req.user?.id, sessionId: req.get('x-session-id') }
  );
  res.json(result);
});

/**
 * Reviews for one product, with the rating summary alongside so the page can
 * render the header and the list from a single request.
 */
const reviews = asyncHandler(async (req, res) => {
  const [list, summary] = await Promise.all([
    reviewsService.listForProduct(req.params.id, readPaging(req.query)),
    reviewsService.summaryForProduct(req.params.id),
  ]);
  res.json({ ...list, summary });
});

module.exports = { list, getOne, categories, discounted, search, reviews };
