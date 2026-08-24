const { GoogleGenAI } = require('@google/genai');
const env = require('./env');
const logger = require('../utils/logger');

/**
 * Minimal Gemini REST client.
 *
 * Provided for whoever owns the chat pipeline (orchestrator.js) so they do not
 * have to think about endpoints, keys or timeouts. Plain fetch, no SDK.
 */

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const isConfigured = () => Boolean(env.geminiApiKey);

/**
 * @google/genai SDK client, used by services/ai/embeddings.js for the
 * embedContent calls (gemini-embedding-2). Kept separate from the fetch-based
 * client above so the existing generateContent/isConfigured contract that
 * orchestrator.js depends on is untouched. null when no API key is set -
 * embeddings.js falls back to keyword search in that case.
 */
const genAIClient = env.geminiApiKey ? new GoogleGenAI({ apiKey: env.geminiApiKey }) : null;

/**
 * One generateContent call.
 *
 * @param {object} options
 * @param {Array}  options.contents          Gemini `contents` array (the conversation).
 * @param {Array}  [options.tools]           e.g. [{ functionDeclarations: TOOL_SCHEMAS }]
 * @param {string} [options.systemInstruction]
 * @param {object} [options.generationConfig]
 * @returns {Promise<object>} the raw Gemini response body
 */
async function generateContent({
  contents,
  tools,
  systemInstruction,
  generationConfig,
  model = env.geminiModel,
  timeoutMs = 20_000,
} = {}) {
  if (!isConfigured()) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const body = { contents };
  if (tools) body.tools = tools;
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }
  if (generationConfig) body.generationConfig = generationConfig;

  const response = await fetch(`${BASE}/${model}:generateContent?key=${env.geminiApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    logger.error(`Gemini ${response.status}`, detail.slice(0, 500));
    throw new Error(`Gemini request failed with ${response.status}`);
  }

  return response.json();
}

/** Pull the plain text out of a response, if there is any. */
function extractText(response) {
  const parts = response?.candidates?.[0]?.content?.parts || [];
  return parts
    .map((p) => p.text)
    .filter(Boolean)
    .join('')
    .trim();
}

/** Pull function calls out of a response as [{ name, args }]. */
function extractFunctionCalls(response) {
  const parts = response?.candidates?.[0]?.content?.parts || [];
  return parts
    .filter((p) => p.functionCall)
    .map((p) => ({ name: p.functionCall.name, args: p.functionCall.args || {} }));
}

module.exports = { generateContent, extractText, extractFunctionCalls, isConfigured, genAIClient };
