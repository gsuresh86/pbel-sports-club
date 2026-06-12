'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { User } from '@/types';
import { useRoles } from '@/hooks/use-roles';
import {
  createStaffUserPayload,
  getRoleSlugsDisplay,
  getStaffForTournament,
  setTournamentRolesForUser,
  stripTournamentFromUser,
} from '@/lib/tournament-access';
import { Plus, UserCog, Trash2, Eye, EyeOff, UserPlus, Users2 } from 'lucide-react';

type DialogMode = 'new' | 'existing';

interface TournamentStaffSectionProps {
  tournamentId: string;
  currentUserId?: string;
  canManage: boolean;
  /** When false, tournament-admin role cannot be assigned (e.g. by non-admin staff managers). */
  canAssignTournamentAdmin?: boolean;
}

export function TournamentStaffSection({
  tournamentId,
  currentUserId,
  canManage,
  canAssignTournamentAdmin = true,
}: TournamentStaffSectionProps) {
  const { alert, AlertDialogComponent } = useAlertDialog();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();
  const { roles: allRoles, registry, getRoleLabel } = useRoles();

  const assignableRoles = useMemo(
    () =>
      allRoles.filter(
        (r) => canAssignTournamentAdmin || r.slug !== 'tournament-admin'
      ),
    [allRoles, canAssignTournamentAdmin]
  );

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [mode, setMode] = useState<DialogMode>('new');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [selectedExistingId, setSelectedExistingId] = useState('');
  const [selectedRoleSlugs, setSelectedRoleSlugs] = useState<string[]>(['referee']);

  const loadUsers = useCallback(async () => {
    if (!canManage) return;
    try {
      const staffQuery = query(
        collection(db, 'users'),
        where('role', 'in', ['staff', 'referee', 'tournament-admin'])
      );
      const snap = await getDocs(staffQuery);
      const all = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.(),
        updatedAt: d.data().updatedAt?.toDate?.(),
      })) as User[];
      setUsers(all);
    } catch (error) {
      console.error('Error loading staff users:', error);
      alert({
        title: 'Error',
        description: 'Could not load tournament staff. Please refresh and try again.',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [canManage, alert]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const inTournament = useMemo(
    () => getStaffForTournament(users, tournamentId),
    [users, tournamentId]
  );

  const available = useMemo(
    () => users.filter((u) => !(u.assignedTournaments || []).includes(tournamentId)),
    [users, tournamentId]
  );

  const toggleRoleSlug = (slug: string) => {
    setSelectedRoleSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const openAdd = () => {
    setMode('new');
    setForm({ name: '', email: '', password: '' });
    setSelectedExistingId('');
    setSelectedRoleSlugs(['referee']);
    setDialogOpen(true);
  };

  const openEditRoles = (target: User) => {
    setEditingUser(target);
    setSelectedRoleSlugs(getRoleSlugsDisplay(target, tournamentId));
    setEditDialogOpen(true);
  };

  const createNew = async () => {
    const name = form.name.trim();
    const email = form.email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!name) {
      alert({ title: 'Validation Error', description: 'Name is required', variant: 'error' });
      return;
    }
    if (!emailRegex.test(email)) {
      alert({ title: 'Validation Error', description: 'Enter a valid email address', variant: 'error' });
      return;
    }
    if (form.password.length < 6) {
      alert({ title: 'Validation Error', description: 'Password must be at least 6 characters', variant: 'error' });
      return;
    }
    if (selectedRoleSlugs.length === 0) {
      alert({ title: 'Validation Error', description: 'Select at least one role', variant: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      const staffPayload = createStaffUserPayload(tournamentId, selectedRoleSlugs, registry);
      const response = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: form.password,
          name,
          role: staffPayload.role,
          assignedTournaments: staffPayload.assignedTournaments,
          tournamentRoles: staffPayload.tournamentRoles,
          tournamentPermissions: staffPayload.tournamentPermissions,
          isActive: true,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create staff user');
      }
      setDialogOpen(false);
      await loadUsers();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create staff user';
      alert({
        title: 'Error',
        description:
          message === 'Email is already in use'
            ? 'A user with this email already exists. Try "Add existing staff" instead.'
            : message,
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const addExisting = async () => {
    if (!selectedExistingId) {
      alert({ title: 'Validation Error', description: 'Select a user to add', variant: 'error' });
      return;
    }
    if (selectedRoleSlugs.length === 0) {
      alert({ title: 'Validation Error', description: 'Select at least one role', variant: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      const target = users.find((u) => u.id === selectedExistingId);
      if (!target) throw new Error('User not found');
      const update = setTournamentRolesForUser(target, tournamentId, selectedRoleSlugs, registry);
      await updateDoc(doc(db, 'users', selectedExistingId), {
        ...update,
        updatedAt: new Date(),
      });
      setDialogOpen(false);
      await loadUsers();
    } catch (error) {
      console.error('Error adding staff:', error);
      alert({ title: 'Error', description: 'Failed to add staff to this tournament.', variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const saveRoles = async () => {
    if (!editingUser) return;
    if (selectedRoleSlugs.length === 0) {
      alert({ title: 'Validation Error', description: 'Select at least one role', variant: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      const update = setTournamentRolesForUser(editingUser, tournamentId, selectedRoleSlugs, registry);
      await updateDoc(doc(db, 'users', editingUser.id), {
        ...update,
        updatedAt: new Date(),
      });
      setEditDialogOpen(false);
      setEditingUser(null);
      await loadUsers();
    } catch (error) {
      console.error('Error updating roles:', error);
      alert({ title: 'Error', description: 'Failed to update roles.', variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (target: User) => {
    if (target.id === currentUserId) {
      alert({
        title: 'Not allowed',
        description: 'You cannot change your own active status here.',
        variant: 'error',
      });
      return;
    }
    try {
      await updateDoc(doc(db, 'users', target.id), {
        isActive: target.isActive === false,
        updatedAt: new Date(),
      });
      await loadUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
      alert({ title: 'Error', description: 'Failed to update user status.', variant: 'error' });
    }
  };

  const removeFromTournament = (target: User) => {
    if (target.id === currentUserId) {
      alert({
        title: 'Not allowed',
        description: 'You cannot remove yourself from this tournament here.',
        variant: 'error',
      });
      return;
    }
    confirm({
      title: 'Remove Staff',
      description: `Remove ${target.name} from this tournament? Their account stays active for other tournaments.`,
      confirmText: 'Remove',
      cancelText: 'Cancel',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          const update = stripTournamentFromUser(target, tournamentId);
          await updateDoc(doc(db, 'users', target.id), {
            ...update,
            updatedAt: new Date(),
          });
          await loadUsers();
        } catch (error) {
          console.error('Error removing user:', error);
          alert({ title: 'Error', description: 'Failed to remove user.', variant: 'error' });
        }
      },
    });
  };

  const roleCheckboxes = (
    <div className="space-y-2">
      <Label>Roles</Label>
      <div className="space-y-2 rounded-md border p-3">
        {assignableRoles.map((role) => {
          const checkboxId = `staff-role-${role.slug}`;
          return (
            <div key={role.slug} className="flex items-start gap-2">
              <Checkbox
                id={checkboxId}
                checked={selectedRoleSlugs.includes(role.slug)}
                onCheckedChange={() => toggleRoleSlug(role.slug)}
                className="mt-0.5"
              />
              <label htmlFor={checkboxId} className="cursor-pointer">
                <div className="text-sm font-medium">{role.name}</div>
                {role.description && (
                  <div className="text-xs text-gray-500">{role.description}</div>
                )}
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (!canManage) return null;

  return (
    <>
      <Card className="rounded-none">
        <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold sm:text-base">
              Tournament Staff ({inTournament.length})
            </CardTitle>
            <Button onClick={openAdd} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1.5" />
              Add Staff
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead className="text-xs sm:text-sm">Name</TableHead>
                  <TableHead className="text-xs sm:text-sm">Email</TableHead>
                  <TableHead className="text-xs sm:text-sm">Roles</TableHead>
                  <TableHead className="text-xs sm:text-sm">Status</TableHead>
                  <TableHead className="text-right text-xs sm:text-sm">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-gray-500 py-6">
                      Loading staff...
                    </TableCell>
                  </TableRow>
                ) : inTournament.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-gray-500 py-8">
                      <Users2 className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      No staff assigned to this tournament yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  inTournament.map((u) => {
                    const slugs = getRoleSlugsDisplay(u, tournamentId);
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium text-xs sm:text-sm py-2">
                          {u.name}
                          {u.id === currentUserId && (
                            <Badge variant="outline" className="ml-2 text-[10px]">You</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm py-2">{u.email}</TableCell>
                        <TableCell className="py-2">
                          <div className="flex flex-wrap gap-1">
                            {slugs.map((slug) => (
                              <Badge key={slug} variant="secondary" className="text-[10px]">
                                {getRoleLabel(slug)}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge
                            className={
                              u.isActive !== false
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }
                          >
                            {u.isActive !== false ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => openEditRoles(u)}
                            >
                              <UserCog className="h-3.5 w-3.5 mr-1" />
                              Roles
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 w-7 p-0"
                              title={u.isActive !== false ? 'Deactivate' : 'Activate'}
                              onClick={() => toggleActive(u)}
                              disabled={u.id === currentUserId}
                            >
                              {u.isActive !== false ? (
                                <EyeOff className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                              title="Remove from tournament"
                              onClick={() => removeFromTournament(u)}
                              disabled={u.id === currentUserId}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Tournament Staff</DialogTitle>
            <DialogDescription>
              Create a new user or add an existing one, then assign roles for this tournament.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={mode === 'new' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('new')}
            >
              <UserPlus className="h-4 w-4 mr-1.5" />
              New
            </Button>
            <Button
              type="button"
              variant={mode === 'existing' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('existing')}
            >
              <UserCog className="h-4 w-4 mr-1.5" />
              Existing
            </Button>
          </div>

          {roleCheckboxes}

          {mode === 'new' ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createNew();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="staff-name">Full Name</Label>
                <Input
                  id="staff-name"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-email">Email Address</Label>
                <Input
                  id="staff-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-password">Password</Label>
                <Input
                  id="staff-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="At least 6 characters"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Staff'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select user</Label>
                {available.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No other staff available. Create a new user instead.
                  </p>
                ) : (
                  <Select value={selectedExistingId} onValueChange={setSelectedExistingId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a user..." />
                    </SelectTrigger>
                    <SelectContent>
                      {available.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} — {u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={submitting || available.length === 0}
                  onClick={addExisting}
                >
                  {submitting ? 'Adding...' : 'Add to Tournament'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Roles — {editingUser?.name}</DialogTitle>
            <DialogDescription>
              Update which roles this user has for this tournament.
            </DialogDescription>
          </DialogHeader>
          {roleCheckboxes}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={submitting} onClick={saveRoles}>
              {submitting ? 'Saving...' : 'Save Roles'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {AlertDialogComponent}
      {ConfirmDialogComponent}
    </>
  );
}
