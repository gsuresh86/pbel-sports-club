import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Match Schedules',
  description:
    'View upcoming and completed match schedules across TourneyCraft sports tournaments.',
  alternates: { canonical: '/schedules' },
  openGraph: {
    title: 'Match Schedules | TourneyCraft',
    description: 'Fixtures, times, and venues for TourneyCraft tournament matches.',
    url: '/schedules',
  },
};

export default function SchedulesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
