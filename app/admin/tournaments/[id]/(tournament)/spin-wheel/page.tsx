'use client';

import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTournament } from '@/hooks/use-tournament-queries';
import SpinWheel from '@/components/SpinWheel';

const isAdminRole = (role: string) =>
  role === 'admin' || role === 'tournament-admin' || role === 'super-admin';

export default function SpinWheelPage() {
  const { user } = useAuth();
  const params = useParams();
  const tournamentId = params.id as string;
  const queriesEnabled = !!user && isAdminRole(user.role) && !!tournamentId;

  const { data: tournamentData } = useTournament(tournamentId, { enabled: queriesEnabled });
  const tournament = tournamentData ?? null;

  if (!tournament || !user) return null;

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      <SpinWheel tournament={tournament} user={user} />
    </div>
  );
}
