'use client';

import { useParams } from 'next/navigation';
import { useTournament } from '@/hooks/use-tournament-queries';
import TeamManagement from '@/components/TeamManagement';
import { useTournamentPageGate } from '@/hooks/use-tournament-page-gate';

export default function TeamsPage() {
  const { user, tournamentId, queriesEnabled } = useTournamentPageGate('teams');

  const { data: tournamentData } = useTournament(tournamentId, { enabled: queriesEnabled });
  const tournament = tournamentData ?? null;

  if (!tournament || !user) return null;

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      <TeamManagement tournament={tournament} user={user} />
    </div>
  );
}
