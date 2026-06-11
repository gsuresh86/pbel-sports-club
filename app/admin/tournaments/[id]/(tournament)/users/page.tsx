'use client';

import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { TournamentUsersSection } from '@/components/admin/TournamentUsersSection';

const isAdminRole = (role: string) =>
  role === 'admin' || role === 'tournament-admin' || role === 'super-admin';

export default function TournamentUsersPage() {
  const { user } = useAuth();
  const params = useParams();
  const tournamentId = params.id as string;
  const canManage = !!user && isAdminRole(user.role);
  const canManageAdmins =
    !!user && (user.role === 'admin' || user.role === 'super-admin' || user.role === 'tournament-admin');

  if (!canManage) return null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h3 className="text-base font-semibold sm:text-lg">Users</h3>
        <p className="text-xs text-gray-600 sm:text-sm">
          Manage who can administer this tournament and who can score matches as a referee.
        </p>
      </div>

      {canManageAdmins && (
        <TournamentUsersSection
          role="tournament-admin"
          tournamentId={tournamentId}
          currentUserId={user?.id}
          canManage={canManageAdmins}
        />
      )}

      <TournamentUsersSection
        role="referee"
        tournamentId={tournamentId}
        currentUserId={user?.id}
        canManage={canManage}
      />
    </div>
  );
}
