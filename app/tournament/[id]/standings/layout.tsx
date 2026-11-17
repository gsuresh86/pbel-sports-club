import type { Metadata } from 'next';
import { fetchTournamentMeta, tournamentPageMetadata } from '@/lib/tournament-meta';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const t = await fetchTournamentMeta(id);
  return tournamentPageMetadata(t, 'Tournament Standings', {
    titlePrefix: 'Standings',
    descriptionFallback: (name) => `Live pool standings for ${name}.`,
  });
}

export default function StandingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
