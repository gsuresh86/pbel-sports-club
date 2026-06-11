'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useProfileSidebar } from '@/contexts/ProfileSidebarContext';
import { getProfileBackHref } from '@/lib/profile-utils';
import { Loader2 } from 'lucide-react';

/** Opens the profile sidebar and returns the user to their home view. */
export default function ProfilePage() {
  const { user, loading } = useAuth();
  const { openProfile } = useProfileSidebar();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    openProfile();
    router.replace(getProfileBackHref(user.role, user.assignedTournaments));
  }, [user, loading, openProfile, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    </div>
  );
}
