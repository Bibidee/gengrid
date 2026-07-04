import { ArenaChrome } from '@/components/ArenaChrome';

// Player-facing pages get the dark "Intelligence Arena" theme. Admin pages
// (outside this route group) keep the light theme.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="arena relative flex min-h-screen flex-1 flex-col">
      <ArenaChrome />
      <div className="relative z-10 flex min-h-screen flex-1 flex-col">{children}</div>
    </div>
  );
}
