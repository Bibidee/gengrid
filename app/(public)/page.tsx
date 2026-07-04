import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="home-badge mb-8">
        <span className="hb-dot" />
        Live crossword competitions
      </div>
      <h1 className="home-title mb-2">
        Gen<span>Grid</span>
      </h1>
      <div className="home-kicker mb-11">The Intelligence Arena</div>
      <Link href="/join" className="enter-arena inline-block no-underline">
        Enter Arena →
      </Link>
      <div className="home-stats">
        <div className="text-center">
          <div className="hs-num">LIVE</div>
          <div className="hs-lbl">Room-Based</div>
        </div>
        <div className="text-center">
          <div className="hs-num">1v1+</div>
          <div className="hs-lbl">Compete</div>
        </div>
        <div className="text-center">
          <div className="hs-num">GL</div>
          <div className="hs-lbl">GenLayer Community</div>
        </div>
      </div>
    </main>
  );
}
