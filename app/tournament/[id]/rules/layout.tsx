import type { Metadata } from 'next';
import { fetchTournamentMeta, tournamentPageMetadata } from '@/lib/tournament-meta';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const t = await fetchTournamentMeta(id);
  return tournamentPageMetadata(t, 'Tournament Rules', {
    titlePrefix: 'Rules',
    descriptionFallback: (name) => `Official rules and regulations for ${name}.`,
  });
}

export default function RulesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
