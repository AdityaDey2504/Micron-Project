// Loads and validates environment. Fail fast at boot rather than at 2am
// mid-demo with a confusing "undefined is not a URL" from the Supabase client.
require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var ${name}. Copy .env.example to .env and fill it in.`
    );
  }
  return value;
}

// The Supabase dashboard displays the API URL with /rest/v1/ on the end, but
// supabase-js appends that itself - pasting it verbatim produces
// /rest/v1/rest/v1/... and a 404 on every single query. Strip it here so the
// value works whichever form it was copied in.
function normaliseSupabaseUrl(url) {
  return url.replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
}

const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',

  supabaseUrl: normaliseSupabaseUrl(required('SUPABASE_URL')),
  supabaseKey: required('SUPABASE_SERVICE_KEY'),

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004',
};

env.isProd = env.nodeEnv === 'production';

module.exports = env;
