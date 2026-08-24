const productsService = require('../products.service');
const { dispatch } = require('./toolDispatcher');

// Fixed list of filler words and quantity suffixes to strip from product names
const STRIP_WORDS = new Set(['is', 'are', 'there', 'please', 'the', 'a', 'an']);

function extractProductName(captured) {
  // Split into tokens, strip known filler words and x1/x2 quantity suffixes
  const tokens = captured
    .split(/\s+/)
    .filter((word) => {
      const lower = word.toLowerCase();
      if (STRIP_WORDS.has(lower)) return false;
      if (/^x\d+$/i.test(lower)) return false; // strip x1, x2, etc
      return true;
    });
  return tokens.join(' ').trim();
}

const ROUTES = [
  {
    name: 'availability_check',
    pattern: /^(?:is|are|how many)?\s*(.*?)\s*(?:available|in stock|are left|left)\??$/i,
    chain: async (message, context) => {
      const match = message.match(/^(?:is|are|how many)?\s*(.*?)\s*(?:available|in stock|are left|left)\??$/i);
      if (!match) return null;

      const rawName = match[1];
      const cleanName = extractProductName(rawName);
      if (!cleanName) return null;

      const productId = await productsService.resolveProductNameToId(cleanName);
      if (!productId) return null; // Fall through if ambiguous or not found

      const toolCalls = [{ name: 'checkInventory', args: { product_id: productId } }];
      const result = await dispatch('checkInventory', { product_id: productId }, context);

      return { 
        toolCalls, 
        results: [{ name: 'checkInventory', response: result }],
        products: []
      };
    },
  },
  {
    name: 'recommend_similar',
    pattern: /(similar to|like my previous|based on my (last|previous) purchase)/i,
    chain: async (message, context) => {
      const historyCall = { name: 'getOrderHistory', args: { limit: 1 } };
      const historyResult = await dispatch('getOrderHistory', { limit: 1 }, context);

      if (historyResult.error || !historyResult.orders || historyResult.orders.length === 0) {
        return null; // Fall through if no order history
      }

      // We need the category and productId of the most recent item.
      const ordersService = require('../orders.service');
      const { items } = await ordersService.listOrdersForCustomer(context.customerId, { limit: 1 });
      if (!items || items.length === 0 || !items[0].items || items[0].items.length === 0) {
        return null;
      }
      const lastItem = items[0].items[0];
      const category = lastItem.product.category;
      const purchasedProductId = lastItem.productId;

      const searchCall = { name: 'searchProducts', args: { category } };
      const searchResult = await dispatch('searchProducts', { category }, context);

      // Filter out the exact purchased product id so we recommend similar, not identical
      if (searchResult.products) {
        searchResult.products = searchResult.products.filter((p) => p.id !== purchasedProductId);
      }

      const toolCalls = [historyCall, searchCall];
      return { 
        toolCalls, 
        results: [
          { name: 'getOrderHistory', response: historyResult },
          { name: 'searchProducts', response: searchResult }
        ],
        products: searchResult.products || []
      };
    },
  },
];

// To add a third route:
// 1. Add an object to ROUTES with name, pattern (regex), and chain (async function).
// 2. The chain function receives (message, context).
// 3. Perform data fetches using dispatch() or services directly.
// 4. Return { data, toolCalls } if successful, or null to fallback to Gemini.

module.exports = { ROUTES };
