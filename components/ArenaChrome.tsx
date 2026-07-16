'use client';

import { useEffect, useRef, useState } from 'react';
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

  // Constellation starfield (asterin): drifting dots joined by faint violet
  // lines, with occasional cyan "lit" flares. Decorative only — hidden for
  // prefers-reduced-motion via CSS, canvas loop stops when unmounted.
  const skyRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = skyRef.current;
    if (!cv || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    let W = 0;
    let H = 0;
    const rsz = () => {
      W = cv.width = window.innerWidth;
      H = cv.height = window.innerHeight;
    };
    rsz();
    window.addEventListener('resize', rsz);

    type Star = { x: number; y: number; vx: number; vy: number; r: number; o: number; tw: number; lit: boolean; lt: number };
    const stars: Star[] = Array.from({ length: 42 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
      r: Math.random() * 0.7 + 0.15,
      o: Math.random() * 0.25 + 0.05,
      tw: Math.random() * Math.PI * 2,
      lit: false,
      lt: 0,
    }));

    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const dx = stars[i].x - stars[j].x;
          const dy = stars[i].y - stars[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 135) {
            const a = (1 - d / 135) * (stars[i].lit || stars[j].lit ? 0.13 : 0.04);
            ctx.beginPath();
            ctx.moveTo(stars[i].x, stars[i].y);
            ctx.lineTo(stars[j].x, stars[j].y);
            ctx.strokeStyle = `rgba(124,58,237,${a})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      for (const s of stars) {
        s.x += s.vx;
        s.y += s.vy;
        if (s.x < 0) s.x = W;
        if (s.x > W) s.x = 0;
        if (s.y < 0) s.y = H;
        if (s.y > H) s.y = 0;
        s.tw += 0.006;
        if (s.lit && --s.lt <= 0) s.lit = false;
        const o = s.o * (0.6 + 0.4 * Math.sin(s.tw));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * (s.lit ? 2.2 : 1), 0, Math.PI * 2);
        ctx.fillStyle = s.lit ? 'rgba(103,232,249,.85)' : `rgba(124,58,237,${o})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    // Occasionally flare a star and its neighbours cyan.
    const flare = setInterval(() => {
      const s = stars[Math.floor(Math.random() * stars.length)];
      s.lit = true;
      s.lt = 75;
      for (const q of stars) {
        const dx = s.x - q.x;
        const dy = s.y - q.y;
        if (Math.sqrt(dx * dx + dy * dy) < 135 && Math.random() > 0.55) {
          q.lit = true;
          q.lt = 50;
        }
      }
    }, 1300);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(flare);
      window.removeEventListener('resize', rsz);
    };
  }, []);

  return (
    <>
      <div className="arena-atmosphere" aria-hidden>
        <div className="ao ao1" />
        <div className="ao ao2" />
        <div className="ao ao3" />
        <div className="ao ao4" />
      </div>
      <canvas ref={skyRef} className="arena-sky" aria-hidden />
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
