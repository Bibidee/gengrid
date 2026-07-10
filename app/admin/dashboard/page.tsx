'use client';

import Link from 'next/link';
import { AdminNav } from '@/components/AdminNav';
import { useAdminSession } from '@/lib/use-admin-session';

const CARDS = [
  { href: '/admin/templates', title: 'Templates', desc: 'Browse the seed bank or design a new grid shape.' },
  { href: '/admin/puzzles', title: 'Puzzles', desc: 'Create puzzles from a template and fill in clues.' },
  { href: '/admin/rooms', title: 'Rooms', desc: 'Schedule a room, start it, and watch live submissions.' },
];

export default function AdminDashboardPage() {
  const { loading } = useAdminSession();
  if (loading) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">Dashboard</h1>
        <div className="grid gap-4 sm:grid-cols-3">
          {CARDS.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-400"
            >
              <h2 className="font-semibold text-slate-900">{c.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{c.desc}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
