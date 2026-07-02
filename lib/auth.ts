import { NextResponse } from 'next/server';
import { supabaseServer } from './supabase-server';

export type AdminAuthResult =
  | { ok: true; adminId: string }
  | { ok: false; response: NextResponse };

/**
 * Verifies the caller's Supabase Auth access token (sent as
 * `Authorization: Bearer <token>` by the admin frontend after login) and
 * confirms a matching row exists in `admin_profiles`. Use at the top of
 * every `/api/admin/**` route handler.
 */
export async function requireAdmin(request: Request): Promise<AdminAuthResult> {
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Missing admin session token' }, { status: 401 }),
    };
  }

  const { data: userData, error: userError } = await supabaseServer.auth.getUser(token);
  if (userError || !userData?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await supabaseServer
    .from('admin_profiles')
    .select('id')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Not an admin' }, { status: 403 }),
    };
  }

  return { ok: true, adminId: profile.id };
}
