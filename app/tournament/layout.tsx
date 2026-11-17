import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tournaments',
  description:
    'Browse live, upcoming, and completed sports tournaments on TourneyCraft — badminton, table tennis, volleyball, and more.',
  alternates: { canonical: '/tournament' },
  openGraph: {
    title: 'Tournaments | TourneyCraft',
    description:
      'Find and join community sports tournaments. Live scoring, registration, and results in one place.',
    url: '/tournament',
  },
};

export default function TournamentListLayout({ children }: { children: React.ReactNode }) {
  return children;
}
