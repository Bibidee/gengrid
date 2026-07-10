'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';

const LINKS = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/templates', label: 'Templates' },
  { href: '/admin/puzzles', label: 'Puzzles' },
  { href: '/admin/rooms', label: 'Rooms' },
];

export function AdminNav() {
  const router = useRouter();

  async function handleLogout() {
    await supabaseBrowser.auth.signOut();
    router.replace('/admin/login');
  }

  return (
    <nav className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:gap-6">
        <span className="font-bold text-slate-900">GenGrid Admin</span>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="text-slate-600 hover:text-slate-900">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <button onClick={handleLogout} className="text-sm text-slate-500 hover:text-slate-900">
        Log out
      </button>
    </nav>
  );
}
