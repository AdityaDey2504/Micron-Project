const { genAIClient } = require('../../config/gemini');
const logger = require('../../utils/logger');

/**
 * Text -> vector, via the @google/genai SDK against gemini-embedding-2.
 *
 * Both the live per-query embedding (embedText, called by toolDispatcher.js
 * on every chat search) and the bulk product embedding (embedBatch, called by
 * the seed script) go through this same model/client. That matters:
 * match_products compares vectors by cosine similarity, which is only
 * meaningful when the query vector and the stored product vectors came from
 * the same embedder - mixing models here would make search silently return
 * junk instead of erroring.
 *
 * Both functions return null (per-item, for embedBatch) instead of throwing
 * whenever embedding is unavailable - no API key, quota exhausted, retries
 * exhausted - so callers fall back to keyword search rather than the whole
 * request/run failing.
 */

const EMBEDDING_MODEL = 'gemini-embedding-2';
const OUTPUT_DIMENSIONALITY = 768;

const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500; // 500ms, 1000ms, ... exponential backoff
const RATE_LIMIT_DELAY_MS = 1100; // keeps embedBatch under Gemini free-tier's ~60 RPM

// gemini-embedding-2 has no task_type param (unlike the older embedding-001
// model) - task instructions have to be baked directly into the input text.
// Documents (products) and queries get the matching half of that instruction
// so the two stay comparable under asymmetric retrieval.
const DOCUMENT_TASK_PREFIX = 'task: search_result — ';
const QUERY_TASK_PREFIX = 'task: search_query — ';

const MAX_TEXT_LENGTH = 2000;

// Query text repeats hard during a demo ("gaming laptop under 80k" typed
// again and again). A small in-process cache keeps that off the quota.
const cache = new Map();
const CACHE_MAX = 500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** One embedContent call, retried with exponential backoff on failure. */
async function embedOnce(text, attempt = 1) {
  try {
    const response = await genAIClient.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text,
      config: { outputDimensionality: OUTPUT_DIMENSIONALITY },
    });
    const vector = response?.embeddings?.[0]?.values;
    if (!Array.isArray(vector)) throw new Error('Embedding response had no vector');
    return vector;
  } catch (err) {
    if (attempt >= MAX_ATTEMPTS) throw err;
    const backoff = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
    logger.warn(`Embedding attempt ${attempt} failed, retrying in ${backoff}ms: ${err.message}`);
    await sleep(backoff);
    return embedOnce(text, attempt + 1);
  }
}

/** Embed a single query at chat time. Cached, never throws. */
async function embedText(text) {
  if (!text || !text.trim()) return null;

  if (!genAIClient) {
    logger.warn('GEMINI_API_KEY not set - skipping embedding, keyword search will be used');
    return null;
  }

  const key = text.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key);

  try {
    const vector = await embedOnce(`${QUERY_TASK_PREFIX}${text}`);
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, vector);
    return vector;
  } catch (err) {
    logger.warn('Embedding call failed, falling back to keyword search:', err.message);
    return null;
  }
}

/**
 * Embed many texts. Used by the seed script that backfills
 * products.embedding. Sequential, not concurrent - the free tier is capped
 * at ~60 RPM for embeddings, so a burst just gets rate-limited - with a
 * delay between calls and retry-with-backoff on transient failures.
 *
 * Returns a vector per input, same order/length as `texts`; null for any
 * entry that still fails after retries, so callers can zip it back against
 * their own array by index.
 */
async function embedBatch(texts) {
  const results = new Array(texts.length).fill(null);

  if (!genAIClient) {
    logger.warn('GEMINI_API_KEY not set - skipping embeddings, keyword search will be used');
    return results;
  }

  for (let i = 0; i < texts.length; i += 1) {
    try {
      results[i] = await embedOnce(texts[i]);
    } catch (err) {
      logger.warn(`Embedding ${i + 1}/${texts.length} failed after retries: ${err.message}`);
      results[i] = null;
    }
    console.log(`embedded ${i + 1}/${texts.length}`);

    if (i < texts.length - 1) await sleep(RATE_LIMIT_DELAY_MS);
  }

  return results;
}

/** The text that represents a product in embedding space (document side). */
function productToEmbeddingText({ name, category, description }) {
  const text = `${DOCUMENT_TASK_PREFIX}${[name, category, description].filter(Boolean).join(' - ')}`;
  return text.slice(0, MAX_TEXT_LENGTH);
}

module.exports = { embedText, embedBatch, productToEmbeddingText, DOCUMENT_TASK_PREFIX };
