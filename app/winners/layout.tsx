import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hall of Champions',
  description:
    'Celebrate tournament champions and podium finishers across TourneyCraft sports events.',
  alternates: { canonical: '/winners' },
  openGraph: {
    title: 'Hall of Champions | TourneyCraft',
    description: 'Results and champions from TourneyCraft community sports tournaments.',
    url: '/winners',
  },
};

export default function WinnersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
