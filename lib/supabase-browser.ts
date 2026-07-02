'use client';

import { createClient } from '@supabase/supabase-js';

// Browser client used ONLY for the admin login form to establish a
// Supabase Auth session. It never queries application tables directly —
// all data access goes through /api/admin/** routes using the caller's
// access token in the Authorization header.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabaseBrowser = createClient(supabaseUrl, anonKey);
