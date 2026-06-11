'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/** Legacy route — redirects to tournament Users page. */
export default function RefereesRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const tournamentId = params.id as string;

  useEffect(() => {
    router.replace(`/admin/tournaments/${tournamentId}/users`);
  }, [router, tournamentId]);

  return null;
}
