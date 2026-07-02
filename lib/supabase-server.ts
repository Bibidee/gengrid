import { createClient } from '@supabase/supabase-js';

// Server-only Supabase client using the service-role key. This key bypasses
// RLS and must never be imported by any client component or bundled to the
// browser — only import this from API routes (`app/api/**/route.ts`).
if (typeof window !== 'undefined') {
  throw new Error('lib/supabase-server.ts must not be imported in client code');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables'
  );
}

export const supabaseServer = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
