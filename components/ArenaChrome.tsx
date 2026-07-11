'use client';

import { useEffect, useState } from 'react';
import { isMuted, toggleMute, onMuteChange, primeAudioOnGesture, startMusic } from '@/lib/sound';

/**
 * Player-facing "arena" chrome: the fixed atmosphere background (gradient +
 * light beams) and the mute toggle. Rendered once from the (public) layout.
 */
export function ArenaChrome() {
  // Render a stable default server-side; sync the real preference after mount.
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMuted(isMuted());
    const off = onMuteChange(setMuted);
    const offGesture = primeAudioOnGesture();
    // Theme song across every player page (home, join, lobby, game). Autoplay
    // policy delays it to the first tap/keypress; only the mute button stops it.
    startMusic();
    return () => {
      off();
      offGesture();
    };
  }, []);

  return (
    <>
      <div className="arena-atmosphere" aria-hidden>
        <div className="beam b1" />
        <div className="beam b2" />
        <div className="beam b3" />
      </div>
      <button
        type="button"
        className="mute-btn"
        onClick={() => toggleMute()}
        aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
        title={muted ? 'Unmute sounds' : 'Mute sounds'}
      >
        {muted ? '✕' : '♪'}
      </button>
    </>
  );
}
