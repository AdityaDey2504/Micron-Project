// Single shared Supabase client. Service-role key, so it bypasses RLS -
// never expose this client or its key to the frontend.
const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

const supabase = createClient(env.supabaseUrl, env.supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

module.exports = supabase;
