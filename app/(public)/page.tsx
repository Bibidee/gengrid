import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-6 text-center">
      <div>
        <h1 className="text-5xl font-black tracking-tight text-slate-900">GenGrid</h1>
        <p className="mt-2 text-slate-600">
          Live, room-based crossword competitions for the GenLayer community.
        </p>
      </div>
      <Link
        href="/join"
        className="rounded-lg bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-slate-700"
      >
        Join a game
      </Link>
    </main>
  );
}
