const env = require('../../config/env');
const logger = require('../../utils/logger');

/**
 * Text -> vector, using the Gemini embedding API over plain fetch (Node 18+
 * has it built in, so this needs no SDK).
 *
 * Returns null instead of throwing whenever embedding is unavailable - no API
 * key, quota exhausted, network down. Callers are expected to fall back to
 * keyword search, which keeps the chatbot answering during a demo even if the
 * embedding quota runs out.
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

// Query text repeats hard during a demo ("gaming laptop under 80k" typed
// again and again). A small in-process cache keeps that off the quota.
const cache = new Map();
const CACHE_MAX = 500;

async function embedText(text) {
  if (!text || !text.trim()) return null;

  if (!env.geminiApiKey) {
    logger.warn('GEMINI_API_KEY not set - skipping embedding, keyword search will be used');
    return null;
  }

  const key = text.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key);

  try {
    const model = env.geminiEmbeddingModel;
    const response = await fetch(
      `${ENDPOINT}/${model}:embedContent?key=${env.geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${model}`,
          content: { parts: [{ text }] },
        }),
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!response.ok) {
      logger.warn(`Embedding request failed with ${response.status}`, await safeText(response));
      return null;
    }

    const body = await response.json();
    const vector = body?.embedding?.values;
    if (!Array.isArray(vector)) {
      logger.warn('Embedding response had no vector');
      return null;
    }

    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, vector);
    return vector;
  } catch (err) {
    logger.warn('Embedding call threw, falling back to keyword search', err.message);
    return null;
  }
}

/**
 * Embed many texts. Used by the seed script that backfills
 * products.embedding once the DB owner adds that column.
 */
async function embedBatch(texts, { concurrency = 5 } = {}) {
  const results = new Array(texts.length).fill(null);
  let cursor = 0;

  async function worker() {
    while (cursor < texts.length) {
      const index = cursor++;
      results[index] = await embedText(texts[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, texts.length) }, worker));
  return results;
}

/** The text that represents a product in embedding space. */
function productToEmbeddingText(product) {
  return [product.name, product.brand, product.category, product.description]
    .filter(Boolean)
    .join(' - ');
}

async function safeText(response) {
  try {
    return await response.text();
  } catch {
    return '<unreadable body>';
  }
}

module.exports = { embedText, embedBatch, productToEmbeddingText };
