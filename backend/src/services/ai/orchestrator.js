const gemini = require('../../config/gemini');
const { dispatch } = require('./toolDispatcher');
const { TOOL_SCHEMAS, SYSTEM_INSTRUCTION } = require('./toolSchemas');
const { formatDaysAgo } = require('../../utils/formatDaysAgo');
const logger = require('../../utils/logger');

const customerHistory = new Map();
const MAX_BACKEND_HISTORY_TURNS = 6;

function getCustomerHistory(customerId) {
  return customerHistory.get(customerId) || [];
}

function appendCustomerHistory(customerId, userText, modelText) {
  if (!customerId) return;
  const h = customerHistory.get(customerId) || [];
  h.push(
    { role: 'user', content: userText },
    { role: 'assistant', content: modelText }
  );
  if (h.length > MAX_BACKEND_HISTORY_TURNS * 2) {
    h.splice(0, h.length - (MAX_BACKEND_HISTORY_TURNS * 2));
  }
  customerHistory.set(customerId, h);
}

/**
 * ===========================================================================
 * OWNED BY THE AI TEAMMATE.
 * ===========================================================================
 *
 * This file is the seam between the chat endpoint and Gemini. The backend
 * side of it is finished and stable:
 *
 *   - tool declarations ......... toolSchemas.js  (TOOL_SCHEMAS)
 *   - system prompt ............. toolSchemas.js  (SYSTEM_INSTRUCTION)
 *   - tool execution ............ toolDispatcher.js dispatch(name, args, ctx)
 *   - Gemini HTTP ............... config/gemini.js generateContent(...)
 *
 * All that is left is the loop below: ask the model, run whatever tools it
 * asks for through dispatch(), feed the results back, return the prose.
 * runGeminiLoop() implements exactly that and works as-is; replace or extend
 * it freely - just keep runChat's signature and return shape, because
 * chat.controller.js and the frontend both depend on them.
 *
 * CONTRACT - do not change without telling the backend and frontend owners:
 *
 *   runChat({ message, history, context }) resolves to
 *   {
 *     reply:     string,     // prose shown in the chat bubble
 *     products:  Product[],  // any products worth rendering as cards
 *     toolCalls: [{ name, args }],  // what was called, for the debug panel
 *     usedModel: boolean     // false when the deterministic fallback answered
 *   }
 *
 *   context = { customerId, sessionId, cart }
 */

const MAX_TOOL_ROUNDS = 3;

async function runChat({ message, history = [], context = {} }) {
  if (context.customerId) {
    history = getCustomerHistory(context.customerId);
  }

  if (!message || !message.trim()) {
    return { reply: 'What are you shopping for?', products: [], toolCalls: [], usedModel: false };
  }

  // No key, or the model is failing: still answer. A chatbot that goes silent
  // when the quota runs out is worse than one that answers mechanically.
  if (!gemini.isConfigured()) {
    logger.warn('GEMINI_API_KEY missing - answering with the deterministic fallback');
    return fallbackChat(message, context);
  }

  try {
    const { ROUTES } = require('./intentRouter');
    for (const route of ROUTES) {
      if (route.pattern.test(message)) {
        const routeData = await route.chain(message, context);
        if (routeData) {
          // Skip tool loop, do synthesis call
          const contents = [
            ...history.map((turn) => ({
              role: turn.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: turn.content }],
            })),
            { role: 'user', parts: [{ text: message }] },
          ];

          // Push the fake model turn making the function calls
          contents.push({
            role: 'model',
            parts: routeData.toolCalls.map(c => ({ functionCall: { name: c.name, args: c.args } }))
          });

          // Push the fake user turn with the function responses
          contents.push({
            role: 'user',
            parts: routeData.results.map(r => ({ functionResponse: { name: r.name, response: r.response } }))
          });

          // Single synthesis call, NO tools provided
          const final = await gemini.generateContent({ contents, systemInstruction: SYSTEM_INSTRUCTION });
          const replyText = gemini.extractText(final) || 'Here is what I found.';
          if (context.customerId) appendCustomerHistory(context.customerId, message, replyText);

          return {
            reply: replyText,
            products: routeData.products || [],
            toolCalls: routeData.toolCalls,
            usedModel: true,
          };
        }
      }
    }

    return await runGeminiLoop({ message, history, context });
  } catch (err) {
    logger.error('Gemini loop failed, using deterministic fallback', err.message);
    return fallbackChat(message, context);
  }
}

async function runGeminiLoop({ message, history, context }) {
  const contents = [
    ...history.map((turn) => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.content }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ];

  const tools = [{ functionDeclarations: TOOL_SCHEMAS }];
  const toolCalls = [];
  const products = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const response = await gemini.generateContent({
      contents,
      tools,
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    const calls = gemini.extractFunctionCalls(response);

    if (calls.length === 0) {
      const replyText = gemini.extractText(response) || 'I could not find anything for that.';
      if (context.customerId) appendCustomerHistory(context.customerId, message, replyText);
      return {
        reply: replyText,
        products,
        toolCalls,
        usedModel: true,
      };
    }

    // Record the model's turn, then every tool result, so the next round sees
    // the full exchange.
    contents.push(response.candidates[0].content);

    // Calls within a single round come from one Gemini response - the model
    // never saw one call's result before emitting the next, so they have no
    // dependency on each other and are safe to run concurrently. Chaining
    // ACROSS rounds (this round's results feeding the next round's call)
    // still happens in order, because the next generateContent() only fires
    // after this whole round's results are pushed onto `contents` below.
    const results = await Promise.all(
      calls.map((call) => dispatch(call.name, call.args, context))
    );

    const responseParts = [];
    calls.forEach((call, i) => {
      const result = results[i];
      toolCalls.push(call);
      if (Array.isArray(result.products)) products.push(...result.products);
      responseParts.push({
        functionResponse: { name: call.name, response: result },
      });
    });

    contents.push({ role: 'user', parts: responseParts });
  }

  // Out of rounds - summarise what we have rather than looping forever.
  const final = await gemini.generateContent({ contents, systemInstruction: SYSTEM_INSTRUCTION });
  const replyText = gemini.extractText(final) || 'Here is what I found.';
  if (context.customerId) appendCustomerHistory(context.customerId, message, replyText);
  return {
    reply: replyText,
    products,
    toolCalls,
    usedModel: true,
  };
}

/**
 * Keyword router used when Gemini is unavailable.
 *
 * Not clever, and not meant to be: it picks one tool by keyword and formats
 * the result with string templates. It exists so the chat endpoint is
 * demoable before the model is wired up, and so a blown quota during judging
 * degrades the answer instead of breaking the feature.
 */
async function fallbackChat(message, context) {
  const text = message.toLowerCase();
  const toolCalls = [];

  const call = async (name, args) => {
    toolCalls.push({ name, args });
    return dispatch(name, args, context);
  };

  if (/(last time|previous|order history|what did i (buy|order)|my orders)/.test(text)) {
    const result = await call('getOrderHistory', { limit: 5 });
    if (result.error) return done(result.error, [], toolCalls);
    if (!result.orders?.length) return done('You have no orders yet.', [], toolCalls);

    const lines = result.orders.map((order) => {
      const names = order.items.map((i) => `${i.name} x${i.quantity}`).join(', ');
      return `- ${new Date(order.placedOn).toLocaleDateString('en-IN')}: ${names} (₹${order.total})`;
    });
    return done(`Here are your recent orders:\n${lines.join('\n')}`, [], toolCalls);
  }

  if (/(discount|offer|sale|deal)/.test(text)) {
    const result = await call('listDiscounts', { limit: 5 });
    return done(
      result.products?.length
        ? `These are on offer right now:\n${result.products.map(bullet).join('\n')}`
        : 'Nothing is discounted at the moment.',
      result.products || [],
      toolCalls
    );
  }

  if (/(cheaper|save money|optimi[sz]e|better deal).*(cart)|cart.*(cheaper|save|optimi[sz]e)/.test(text)) {
    const result = await call('optimizeCart', {});
    if (result.error) return done(result.error, [], toolCalls);
    if (!result.suggestions?.length) {
      return done('Your cart already looks like the best available pricing.', [], toolCalls);
    }
    const lines = result.suggestions.map(
      (s) => `- Swap ${s.from.name} for ${s.to.name} and save ₹${s.saves}`
    );
    return done(
      `${lines.join('\n')}\nTotal saving: ₹${result.totalSavings}.`,
      [],
      toolCalls
    );
  }

  // Default: treat it as a product search.
  const result = await call('searchProducts', {
    query: message,
    max_price: extractBudget(text),
    limit: 5,
  });

  if (result.error || !result.products?.length) {
    return done('I could not find anything matching that. Try a broader search.', [], toolCalls);
  }

  // The recent-purchase note is only useful context for a NEW recommendation.
  // "Is X available" is a direct lookup on a product the customer already
  // knows they own - repurposing searchProducts to answer it (this fallback
  // has no id-resolution step of its own) should not also surface an
  // unrelated "you already bought this" warning.
  const warning =
    result.recentPurchase && !AVAILABILITY_INTENT.test(text)
      ? `\n\nHeads up: you bought ${result.recentPurchase.productName} ${formatDaysAgo(result.recentPurchase.daysAgo)}.`
      : '';

  return done(
    `Here is what I found:\n${result.products.map(bullet).join('\n')}${warning}`,
    result.products,
    toolCalls
  );
}

function bullet(product) {
  const discount = product.discountPercent ? ` (${product.discountPercent}% off)` : '';
  return `- ${product.name} - ₹${product.price}${discount}`;
}

/** "Is it available", "how many are left" - a direct lookup, not a discovery ask. */
const AVAILABILITY_INTENT = /\b(available|availability|in stock|out of stock|stock left|how many.*(left|available|in stock)|do (you|we) have)\b/;

/** Reads "under 80k", "below 50,000", "₹1,20,000" out of a message. */
function extractBudget(text) {
  const match = text.match(/(?:under|below|less than|upto|up to|within|budget of)\s*₹?\s*([\d,.]+)\s*(k|thousand|lakh)?/);
  if (!match) return undefined;

  const amount = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(amount)) return undefined;

  const unit = match[2];
  if (unit === 'k' || unit === 'thousand') return amount * 1000;
  if (unit === 'lakh') return amount * 100000;
  return amount;
}

function done(reply, products, toolCalls) {
  return { reply, products, toolCalls, usedModel: false };
}

module.exports = { runChat };
