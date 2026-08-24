const { runChat } = require('../services/ai/orchestrator');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const { randomUUID } = require('crypto');

const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_TURNS = 10;

/**
 * POST /api/chat
 *
 * Body: {
 *   message:   string,          required
 *   history?:  [{ role: 'user' | 'assistant', content: string }],
 *   cart?:     [{ productId, quantity }],   // needed for cart optimisation
 *   sessionId?: string                      // or send the x-session-id header
 * }
 *
 * Auth is optional: anonymous visitors can ask product questions, signed-in
 * customers additionally get history-aware answers and the don't-buy warning.
 */
const chat = asyncHandler(async (req, res) => {
  const { message, history, cart } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    throw ApiError.badRequest('message is required');
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw ApiError.badRequest(`message must be under ${MAX_MESSAGE_LENGTH} characters`);
  }

  // The session id ties consecutive turns together so "what if I raise my
  // budget" can find the previous search. Generated if the client has none.
  const sessionId = req.body?.sessionId || req.get('x-session-id') || randomUUID();

  const result = await runChat({
    message: message.trim(),
    history: sanitiseHistory(history),
    context: {
      customerId: req.user?.id ?? null,
      sessionId,
      cart: Array.isArray(cart) ? cart : [],
    },
  });

  res.json({ ...result, sessionId });
});

/** Trust nothing from the client: clamp roles, types and length. */
function sanitiseHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((turn) => turn && typeof turn.content === 'string' && turn.content.trim())
    .slice(-MAX_HISTORY_TURNS)
    .map((turn) => ({
      role: turn.role === 'assistant' || turn.role === 'model' ? 'assistant' : 'user',
      content: turn.content.slice(0, MAX_MESSAGE_LENGTH),
    }));
}

module.exports = { chat };
