'use client';

export type LeaderboardEntry = {
  player_id: string;
  username: string;
  score: number;
  time_used_seconds: number;
  finished_by: 'submitted' | 'timeout';
  rank: number;
  correct_words?: number | null;
  total_words?: number | null;
};

type Props = {
  entries: LeaderboardEntry[];
  highlightUsername?: string;
};

export function Leaderboard({ entries, highlightUsername }: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Player</th>
            <th className="px-3 py-2 text-right">Score</th>
            <th className="px-2 py-2 text-right">Words</th>
            <th className="px-3 py-2 text-right">Time</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr
              key={e.player_id}
              className={`border-t border-slate-100 ${
                e.username === highlightUsername ? 'bg-amber-50 font-semibold' : ''
              }`}
            >
              <td className="px-3 py-2 text-slate-500">{e.rank}</td>
              <td className="px-3 py-2">
                {e.username}
                {e.finished_by === 'timeout' && (
                  <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    timed out
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-right">{e.score}</td>
              <td className="whitespace-nowrap px-2 py-2 text-right text-slate-500">
                {e.correct_words != null && e.total_words != null
                  ? `${e.correct_words}/${e.total_words}`
                  : '—'}
              </td>
              <td className="px-3 py-2 text-right text-slate-500">{e.time_used_seconds}s</td>
            </tr>
          ))}
          {entries.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                No players in this room
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
