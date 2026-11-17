import type { Metadata } from 'next';
import { fetchTournamentMeta, tournamentPageMetadata } from '@/lib/tournament-meta';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const t = await fetchTournamentMeta(id);
  return tournamentPageMetadata(t, 'Tournament Registration', {
    titlePrefix: 'Register',
    descriptionFallback: (name) =>
      `Register for ${name}${t?.sport ? `, a ${t.sport} tournament` : ''}${t?.venue ? ` at ${t.venue}` : ''}.`,
  });
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
