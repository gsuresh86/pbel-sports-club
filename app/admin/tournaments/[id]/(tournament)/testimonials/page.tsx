'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function TournamentTestimonialsRedirect() {
  const router = useRouter();
  const params = useParams();
  const tournamentId = params.id as string;

  useEffect(() => {
    router.replace(`/admin/testimonials?tournament=${tournamentId}`);
  }, [router, tournamentId]);

  return null;
}
