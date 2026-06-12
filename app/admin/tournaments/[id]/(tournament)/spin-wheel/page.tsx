'use client';

import { useTournament } from '@/hooks/use-tournament-queries';
import SpinWheel from '@/components/SpinWheel';
import { useTournamentPageGate } from '@/hooks/use-tournament-page-gate';

export default function SpinWheelPage() {
  const { user, tournamentId, queriesEnabled } = useTournamentPageGate('spin-wheel');

  const { data: tournamentData } = useTournament(tournamentId, { enabled: queriesEnabled });
  const tournament = tournamentData ?? null;

  if (!tournament || !user) return null;

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      <SpinWheel tournament={tournament} user={user} />
    </div>
  );
}
