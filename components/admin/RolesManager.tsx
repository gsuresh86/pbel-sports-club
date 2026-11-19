'use client';

import { useMemo, useState } from 'react';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useRoles } from '@/hooks/use-roles';
import {
  DataTableCard,
  DataTableEmpty,
  DataTableSearch,
  dataTableBadgeClass,
  dataTableButtonClass,
  dataTableClass,
  dataTableDangerActionClass,
  dataTableHeadRowClass,
  dataTableRowClass,
} from '@/components/admin/DataTableCard';
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
import { Plus, Edit, Trash2, Eye, Search } from 'lucide-react';

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

  const [roleSearch, setRoleSearch] = useState('');
  const filteredRoles = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q)
    );
  }, [roles, roleSearch]);
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
      <DataTableCard
        className={embedded ? undefined : 'mb-6'}
        title="Roles"
        description="Create roles and map which tournament pages each role can access."
        toolbar={
          <>
            <DataTableSearch value={roleSearch} onChange={setRoleSearch} placeholder="Search roles" />
            {canManage && (
              <Button onClick={openCreate} className={`${dataTableButtonClass} bg-slate-900 hover:bg-slate-800`}>
                <Plus className="h-4 w-4 mr-1.5" />
                Create Role
              </Button>
            )}
          </>
        }
      >
          {loading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Loading roles...</p>
          ) : filteredRoles.length === 0 ? (
            <DataTableEmpty
              icon={Search}
              title="No roles found"
              description="Try adjusting your search"
              action={
                <Button variant="outline" className="rounded-xl" onClick={() => setRoleSearch('')}>
                  Clear Search
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table className={dataTableClass}>
                <TableHeader>
                  <TableRow className={dataTableHeadRowClass}>
                    <TableHead>Role</TableHead>
                    <TableHead>Access</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRoles.map((role, index) => (
                    <TableRow key={role.slug} className={dataTableRowClass(index)}>
                      <TableCell>
                        <div className="font-medium text-foreground">{role.name}</div>
                        {role.description && (
                          <div className="text-xs text-muted-foreground mt-0.5">{role.description}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs">
                        {accessSummary(role)}
                      </TableCell>
                      <TableCell>
                        <Badge className={dataTableBadgeClass(role.isSystem ? 'slate' : 'sky')}>
                          {role.isSystem ? 'System' : 'Custom'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-0.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-muted-foreground hover:text-foreground"
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
                              variant="ghost"
                              className={dataTableDangerActionClass}
                              onClick={() => handleDelete(role)}
                              title="Delete role"
                            >
                              <Trash2 className="h-4 w-4" />
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
      </DataTableCard>

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
