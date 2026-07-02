'use client';

import { supabaseBrowser } from './supabase-browser';

/** fetch() wrapper that attaches the admin's Supabase Auth token. */
export async function adminFetch(input: string, init: RequestInit = {}) {
  const { data } = await supabaseBrowser.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  return fetch(input, { ...init, headers });
}
