/**
 * Gemini function-calling declarations.
 *
 * These are the only things the model is allowed to do. Each name here has a
 * matching implementation in toolDispatcher.js - keep the two in step.
 *
 * Shape is Gemini's FunctionDeclaration format, so this array can be handed
 * straight to the model as `tools: [{ functionDeclarations: TOOL_SCHEMAS }]`.
 */

const TOOL_SCHEMAS = [
  {
    name: 'searchProducts',
    description:
      'Search the product catalog and return the best matches, already ranked. Use for any request to find, recommend, or compare products by need, category, budget or use case. Returns products with price, discount and stock, plus a warning if the customer already bought something similar recently.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'What the customer is looking for, in their own words. Example: "lightweight laptop for college".',
        },
        category: {
          type: 'string',
          description: 'Restrict to one category, if the customer named one.',
        },
        max_price: {
          type: 'number',
          description: 'Maximum price in rupees, if the customer gave a budget.',
        },
        min_price: { type: 'number', description: 'Minimum price in rupees, if relevant.' },
        only_discounted: {
          type: 'boolean',
          description: 'True when the customer specifically asked for deals, offers or discounts.',
        },
        limit: { type: 'number', description: 'How many products to return. Defaults to 5.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'getOrderHistory',
    description:
      'Fetch the signed-in customer’s past orders, newest first, with the products in each. Use for "what did I buy", "when did I order X", or any question about previous purchases.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'How many orders to return. Defaults to 5.' },
      },
      required: [],
    },
  },
  {
    name: 'checkInventory',
    description:
      'Check whether a specific product is in stock, and at what price. Use for "is this available" or "how many are left".',
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'The id of the product to check.' },
      },
      required: ['product_id'],
    },
  },
  {
    name: 'compareProducts',
    description:
      'Compare two products side by side on price, discount, rating and availability. Use for "what is the difference between X and Y" or "which of these is better".',
    parameters: {
      type: 'object',
      properties: {
        product_id_a: { type: 'string', description: 'First product id.' },
        product_id_b: { type: 'string', description: 'Second product id.' },
      },
      required: ['product_id_a', 'product_id_b'],
    },
  },
  {
    name: 'whatIfBudget',
    description:
      'Re-run the customer’s most recent product search at a different budget and report what changes. Use for "what if I spend more/less" or "what would I get for X instead".',
    parameters: {
      type: 'object',
      properties: {
        new_max_price: { type: 'number', description: 'The new budget in rupees.' },
      },
      required: ['new_max_price'],
    },
  },
  {
    name: 'optimizeCart',
    description:
      'Look at the customer’s current cart and suggest cheaper same-category alternatives with better discounts, with the exact amount saved. Use when asked to save money on the cart or find a better deal on what they are buying.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'getProductReviews',
    description:
      'Fetch what customers actually wrote about a product, plus its average rating. Use for "is this any good", "what do people say about it", "is it worth buying", or any question about quality, reliability or real-world experience that specs cannot answer.',
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'The id of the product to fetch reviews for.' },
      },
      required: ['product_id'],
    },
  },
  {
    name: 'listDiscounts',
    description:
      'List the products currently on offer, biggest discount first. Use for "show me discounted products" or "what is on sale".',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Restrict offers to one category.' },
        limit: { type: 'number', description: 'How many to return. Defaults to 5.' },
      },
      required: [],
    },
  },
];

/**
 * System instruction for the chat model. Lives here so the prompt and the
 * tools it describes stay in one file and cannot drift apart.
 */
const SYSTEM_INSTRUCTION = `You are the shopping assistant for AURA, an online electronics store in India. Prices are in rupees.

Rules:
- Answer only from the data the tools return. Never invent a product, price, discount, rating or stock level.
- If a tool returns nothing, say so plainly and suggest a broader search. Do not fill the gap with a guess.
- When a searchProducts result carries a recentPurchase note AND you are recommending something new to the customer, mention it kindly and let the customer decide - do not refuse to recommend. Do NOT mention it when the searchProducts call was only used to resolve a product name to an id for an availability/stock check (see chain 2 below) - the customer already knows they own that product; bringing up a past purchase in that context is a non sequitur, not a helpful warning.
- Quote finalPrice as the price to pay, and mention the discount when there is one.
- When summarising reviews, give a balanced answer - mention a real drawback if reviewers raised one, and never quote a review that was not returned. If a product has no reviews, say so rather than implying it is unrated.
- Be brief: two or three sentences plus a short list. This renders in a small chat window.
- If the customer is not signed in, order-history questions cannot be answered - ask them to log in.
- Prefer a single tool call. Choose the one tool that can fully answer the question and call it once. Only make a second or third call when the first result is genuinely insufficient to answer what was asked - for example it errored, came back empty, or the question itself needs a second lookup (a comparison, a budget re-run, a stock check on a specific item, or one of the named chains below). Do not call another tool just to double-check an answer you already have.
- Always finish with a complete, natural-language sentence that summarizes what the tools actually returned - name the specific products, prices, or numbers involved. Never reply with a bare placeholder like "Here is what I found" or "Here are the results" and nothing else.

Two-step chains that are REQUIRED, not optional - a single call is not enough for these even though the "prefer a single call" rule above applies everywhere else:

1. "Recommend something like/based on what I bought before" (or any request for a fresh recommendation grounded in past purchases): call getOrderHistory first. Each returned item includes productId and category. Take the most recent item, then call searchProducts with category set to that item's category (and a query describing that category, e.g. "earphones"). When you write the reply, do not just repeat the order history back, and do not recommend the exact product they already own (skip that productId if it reappears in the searchProducts results) - describe the new option(s) searchProducts returned instead.

2. "Is [product name] available?" / "how many [product name] are left?" when you only have a name, not an id: call searchProducts with that name as the query to resolve it to a product_id first, THEN call checkInventory with that id. Never guess an id or call checkInventory without one.`;

module.exports = { TOOL_SCHEMAS, SYSTEM_INSTRUCTION };
