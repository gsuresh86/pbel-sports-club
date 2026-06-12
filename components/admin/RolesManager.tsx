'use client';

import { useMemo, useState } from 'react';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useRoles } from '@/hooks/use-roles';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAlertDialog } from '@/components/ui/alert-dialog-component';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { RoleFormDialog, RoleFormValues } from '@/components/admin/RoleFormDialog';
import { NAV_ROUTE_ITEMS, RoleDefinition } from '@/lib/permissions';
import { Plus, Edit, Trash2, Shield, Eye } from 'lucide-react';

function accessSummary(role: RoleDefinition): string {
  const routes = NAV_ROUTE_ITEMS.filter((item) =>
    role.permissions.includes(item.permission)
  ).map((item) => item.label);
  return routes.length ? routes.join(', ') : 'No access';
}

export function RolesManager({
  canManage = true,
  embedded = false,
}: {
  /** When false, roles are view-only (no create/edit/delete). */
  canManage?: boolean;
  /** Match tournament console card styling. */
  embedded?: boolean;
}) {
  const { user } = useAuth();
  const { roles, loading, refresh } = useRoles();
  const { alert, AlertDialogComponent } = useAlertDialog();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);

  const existingSlugs = useMemo(() => roles.map((r) => r.slug), [roles]);

  const openCreate = () => {
    setEditingRole(null);
    setDialogOpen(true);
  };

  const openEdit = (role: RoleDefinition) => {
    setEditingRole(role);
    setDialogOpen(true);
  };

  const handleSubmit = async (values: RoleFormValues) => {
    if (!user) throw new Error('Not authenticated');

    await setDoc(
      doc(db, 'roles', values.slug),
      {
        slug: values.slug,
        name: values.name,
        description: values.description,
        permissions: values.permissions,
        isSystem: false,
        updatedAt: new Date(),
        updatedBy: user.id,
        ...(editingRole ? {} : { createdAt: new Date(), createdBy: user.id }),
      },
      { merge: true }
    );

    await refresh();
    alert({
      title: editingRole ? 'Role updated' : 'Role created',
      description: `"${values.name}" is now available when assigning tournament staff.`,
      variant: 'success',
    });
  };

  const handleDelete = (role: RoleDefinition) => {
    confirm({
      title: 'Delete Role',
      description: `Delete "${role.name}"? Staff already assigned this role keep their current access until roles are updated.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'roles', role.slug));
          await refresh();
        } catch (error) {
          console.error('Error deleting role:', error);
          alert({ title: 'Error', description: 'Failed to delete role.', variant: 'error' });
        }
      },
    });
  };

  return (
    <>
      <Card className={embedded ? 'rounded-none mb-0' : 'mb-6'}>
        <CardHeader className={embedded ? 'p-4 pb-2 sm:p-6 sm:pb-3' : undefined}>
          <div className="flex flex-wrap justify-between items-start gap-2">
            <div>
              <CardTitle className={`flex items-center gap-2 ${embedded ? 'text-sm font-semibold sm:text-base' : ''}`}>
                <Shield className="h-5 w-5" />
                Roles
              </CardTitle>
              <CardDescription className={embedded ? 'text-xs sm:text-sm' : undefined}>
                Create roles and map which tournament pages each role can access.
              </CardDescription>
            </div>
            {canManage && (
              <Button onClick={openCreate} size={embedded ? 'sm' : 'default'} variant={embedded ? 'outline' : 'default'}>
                <Plus className="h-4 w-4 mr-2" />
                Create Role
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className={embedded ? 'p-0' : undefined}>
          {loading ? (
            <p className="text-sm text-gray-500 py-6 text-center">Loading roles...</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Access</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow key={role.slug}>
                      <TableCell>
                        <div className="font-medium">{role.name}</div>
                        {role.description && (
                          <div className="text-xs text-gray-500 mt-0.5">{role.description}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 max-w-xs">
                        {accessSummary(role)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={role.isSystem ? 'secondary' : 'outline'}>
                          {role.isSystem ? 'System' : 'Custom'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2"
                            onClick={() => openEdit(role)}
                          >
                            {role.isSystem || !canManage ? (
                              <>
                                <Eye className="h-3.5 w-3.5 mr-1" />
                                View
                              </>
                            ) : (
                              <>
                                <Edit className="h-3.5 w-3.5 mr-1" />
                                Edit
                              </>
                            )}
                          </Button>
                          {canManage && !role.isSystem && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0 text-red-600"
                              onClick={() => handleDelete(role)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <RoleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialRole={editingRole}
        existingSlugs={existingSlugs}
        onSubmit={handleSubmit}
      />

      {AlertDialogComponent}
      {ConfirmDialogComponent}
    </>
  );
}
