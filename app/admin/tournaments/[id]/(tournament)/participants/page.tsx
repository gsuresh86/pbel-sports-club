'use client';

import { useParams } from 'next/navigation';
import { RegistrationsManager } from '@/components/admin/RegistrationsManager';

export default function TournamentParticipantsPage() {
  const params = useParams();
  const tournamentId = params.id as string;

  return <RegistrationsManager fixedTournamentId={tournamentId} embedded />;
}
