import type { Metadata } from 'next';
import { fetchTournamentMeta, tournamentPageMetadata } from '@/lib/tournament-meta';

type Props = { params: Promise<{ id: string }>; children: React.ReactNode };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const t = await fetchTournamentMeta(id);
  return tournamentPageMetadata(t, 'Tournament', {
    descriptionFallback: (name) =>
      `View details, registration, standings, and results for ${name} on TourneyCraft.`,
  });
}

export default function TournamentDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
