import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '⚠️ Supabase environment variables are missing! Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set for this environment.'
  );
}

// createClient throws if url/key are empty, which crashes the whole app on Vercel
// when those public vars are not present at build time.
export const supabase = createClient(
  supabaseUrl || 'https://unavailable.supabase.co',
  supabaseAnonKey || 'public-anon-key',
);
