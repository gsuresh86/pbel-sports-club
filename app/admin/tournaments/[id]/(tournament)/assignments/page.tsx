'use client';

import { useTournament } from '@/hooks/use-tournament-queries';
import SpinWheel from '@/components/SpinWheel';
import { useTournamentPageGate } from '@/hooks/use-tournament-page-gate';

export default function AssignmentsPage() {
  const { user, tournamentId, queriesEnabled } = useTournamentPageGate('assignments');

  const { data: tournamentData } = useTournament(tournamentId, { enabled: queriesEnabled });
  const tournament = tournamentData ?? null;

  if (!tournament || !user) return null;

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Assignments</h2>
        <p className="text-muted-foreground">
          Draw players onto teams with the spin wheel, or place a player on a team yourself.
        </p>
      </div>
      <SpinWheel tournament={tournament} user={user} />
    </div>
  );
}
