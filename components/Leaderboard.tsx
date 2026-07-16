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

// Gold / silver / bronze trophy treatment for the top 3 ranks.
const MEDALS: Record<number, { icon: string; color: string }> = {
  1: { icon: '🥇', color: '#F6C453' },
  2: { icon: '🥈', color: '#C0C7D1' },
  3: { icon: '🥉', color: '#C08A5A' },
};

export function Leaderboard({ entries, highlightUsername }: Props) {
  return (
    <div className="glass-card overflow-hidden !rounded-2xl">
      <table className="w-full text-sm">
        <thead className="font-arena-mono text-left text-xs uppercase tracking-wide text-[#7A8DB0]">
          <tr className="border-b border-[rgba(255,255,255,0.09)]">
            <th className="px-3 py-2.5">#</th>
            <th className="px-3 py-2.5">Player</th>
            <th className="px-3 py-2.5 text-right">Score</th>
            <th className="px-2 py-2.5 text-right">Words</th>
            <th className="px-3 py-2.5 text-right">Time</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const medal = MEDALS[e.rank];
            return (
              <tr
                key={e.player_id}
                className={`border-t border-[rgba(255,255,255,0.06)] ${
                  e.username === highlightUsername
                    ? 'bg-[rgba(124,58,237,0.14)] font-semibold text-[#F8FAFC]'
                    : 'text-[#C4CFE2]'
                }`}
              >
                <td className="whitespace-nowrap px-3 py-2.5">
                  {medal ? (
                    <span className="font-arena-mono font-semibold" style={{ color: medal.color }}>
                      <span className="mr-1">{medal.icon}</span>
                      {e.rank}
                    </span>
                  ) : (
                    <span className="text-[#7A8DB0]">{e.rank}</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <span className="font-sg">{e.username}</span>
                  {e.finished_by === 'timeout' && (
                    <span className="ml-2 rounded bg-[rgba(255,255,255,0.07)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#7A8DB0]">
                      timed out
                    </span>
                  )}
                </td>
                <td className="font-arena-mono px-3 py-2.5 text-right text-[#9D60FF]">{e.score}</td>
                <td className="font-arena-mono whitespace-nowrap px-2 py-2.5 text-right text-[#94A3B8]">
                  {e.correct_words != null && e.total_words != null
                    ? `${e.correct_words}/${e.total_words}`
                    : '—'}
                </td>
                <td className="font-arena-mono px-3 py-2.5 text-right text-[#94A3B8]">{e.time_used_seconds}s</td>
              </tr>
            );
          })}
          {entries.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-[#5B7194]">
                No players in this room
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
