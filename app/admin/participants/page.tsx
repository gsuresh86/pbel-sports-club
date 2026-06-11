'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/** Legacy global registrations route — redirects into the tournament console. */
export default function ParticipantsRedirectPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    const firstTournament = user.assignedTournaments?.[0];
    if (firstTournament) {
      router.replace(`/admin/tournaments/${firstTournament}/participants`);
      return;
    }
    router.replace('/admin/tournaments');
  }, [user, loading, router]);

  return null;
}
