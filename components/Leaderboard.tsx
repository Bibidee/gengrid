'use client';

export type LeaderboardEntry = {
  id: string;
  username: string;
  score: number | null;
  time_used_seconds: number | null;
  submitted_at: string | null;
};

type Props = {
  entries: LeaderboardEntry[];
  caller?: { rank: number; username: string; score: number | null };
  highlightUsername?: string;
};

export function Leaderboard({ entries, caller, highlightUsername }: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Player</th>
            <th className="px-3 py-2 text-right">Score</th>
            <th className="px-3 py-2 text-right">Time</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr
              key={e.id}
              className={`border-t border-slate-100 ${
                e.username === highlightUsername ? 'bg-amber-50 font-semibold' : ''
              }`}
            >
              <td className="px-3 py-2 text-slate-500">{i + 1}</td>
              <td className="px-3 py-2">{e.username}</td>
              <td className="px-3 py-2 text-right">{e.score ?? '—'}</td>
              <td className="px-3 py-2 text-right text-slate-500">
                {e.time_used_seconds != null ? `${e.time_used_seconds}s` : '—'}
              </td>
            </tr>
          ))}
          {entries.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                No submissions yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {caller && (
        <div className="border-t border-slate-200 bg-amber-50 px-3 py-2 text-sm font-semibold">
          You: rank #{caller.rank} — {caller.score ?? 0} pts
        </div>
      )}
    </div>
  );
}
