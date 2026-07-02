'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from './supabase-browser';
import type { Session } from '@supabase/supabase-js';

/** Redirects to /admin/login if there's no active Supabase Auth session. */
export function useAdminSession() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace('/admin/login');
      } else {
        setSession(data.session);
      }
      setLoading(false);
    });

    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) router.replace('/admin/login');
    });

    return () => sub.subscription.unsubscribe();
  }, [router]);

  return { session, loading };
}
