'use client';

import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/use-permissions';
import { TournamentStaffSection } from '@/components/admin/TournamentStaffSection';
import { RolesManager } from '@/components/admin/RolesManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isSystemAdmin } from '@/lib/permissions';

export default function TournamentUsersPage() {
  const { user } = useAuth();
  const params = useParams();
  const tournamentId = params.id as string;
  const { canManageUsers, canAccessRoute } = usePermissions(tournamentId);

  const canManageStaff = canManageUsers() || isSystemAdmin(user?.role);
  const canManageRoles =
    isSystemAdmin(user?.role) ||
    user?.role === 'tournament-admin';

  if (!canManageStaff || !canAccessRoute('users')) return null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h3 className="text-base font-semibold sm:text-lg">Users &amp; Roles</h3>
        <p className="text-xs text-gray-600 sm:text-sm">
          Assign staff to this tournament and configure role-based page access.
        </p>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="w-full grid grid-cols-2 sm:w-fit">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <TournamentStaffSection
            tournamentId={tournamentId}
            currentUserId={user?.id}
            canManage={canManageStaff}
            canAssignTournamentAdmin={canManageRoles}
          />
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <RolesManager canManage={canManageRoles} embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
