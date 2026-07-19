'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  arrayRemove,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { Plus, UserCog, Trash2, Eye, EyeOff, UserPlus, Users2 } from 'lucide-react';

type ManagedRole = 'referee' | 'tournament-admin';

type DialogMode = 'new' | 'existing';

const ROLE_CONFIG: Record<
  ManagedRole,
  {
    label: string;
    labelPlural: string;
    emptyIcon: typeof UserCog;
    createDescription: string;
    removeTitle: string;
    removeDescription: (name: string) => string;
  }
> = {
  referee: {
    label: 'Referee',
    labelPlural: 'Referees',
    emptyIcon: UserCog,
    createDescription: 'Referees can sign in and score matches only.',
    removeTitle: 'Remove Referee',
    removeDescription: (name) =>
      `Remove ${name} from this tournament? Their account stays active for any other tournaments they are assigned to.`,
  },
  'tournament-admin': {
    label: 'Tournament Admin',
    labelPlural: 'Tournament Admins',
    emptyIcon: Users2,
    createDescription: 'Tournament admins can manage this tournament (registrations, matches, users, etc.).',
    removeTitle: 'Remove Tournament Admin',
    removeDescription: (name) =>
      `Remove ${name} from this tournament? They will lose access to manage this tournament unless assigned elsewhere.`,
  },
};

interface TournamentUsersSectionProps {
  role: ManagedRole;
  tournamentId: string;
  currentUserId?: string;
  canManage: boolean;
}

export function TournamentUsersSection({
  role,
  tournamentId,
  currentUserId,
  canManage,
}: TournamentUsersSectionProps) {
  const config = ROLE_CONFIG[role];
  const EmptyIcon = config.emptyIcon;

  const { alert, AlertDialogComponent } = useAlertDialog();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<DialogMode>('new');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [selectedExistingId, setSelectedExistingId] = useState('');

  const loadUsers = useCallback(async () => {
    if (!canManage) return;
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('role', '==', role)));
      const all = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.(),
        updatedAt: d.data().updatedAt?.toDate?.(),
      })) as User[];
      setUsers(all);
    } catch (error) {
      console.error(`Error loading ${role} users:`, error);
      alert({
        title: 'Error',
        description: `Could not load ${config.labelPlural.toLowerCase()}. Please refresh and try again.`,
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [canManage, role, tournamentId, alert, config.labelPlural]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const inTournament = useMemo(
    () => users.filter((u) => (u.assignedTournaments || []).includes(tournamentId)),
    [users, tournamentId]
  );
  const available = useMemo(
    () => users.filter((u) => !(u.assignedTournaments || []).includes(tournamentId)),
    [users, tournamentId]
  );

  const openAdd = () => {
    setMode('new');
    setForm({ name: '', email: '', password: '' });
    setSelectedExistingId('');
    setDialogOpen(true);
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
    setSubmitting(true);
    try {
      const { getAuthHeaders } = await import('@/lib/client-auth-headers');
      const response = await fetch('/api/create-user', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          email,
          password: form.password,
          name,
          role,
          assignedTournaments: [tournamentId],
          isActive: true,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Failed to create ${config.label.toLowerCase()}`);
      }
      setDialogOpen(false);
      await loadUsers();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : `Failed to create ${config.label.toLowerCase()}`;
      alert({
        title: 'Error',
        description:
          message === 'Email is already in use'
            ? `A user with this email already exists. Try "Add existing ${config.label.toLowerCase()}" instead.`
            : message,
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const addExisting = async () => {
    if (!selectedExistingId) {
      alert({
        title: 'Validation Error',
        description: `Select a ${config.label.toLowerCase()} to add`,
        variant: 'error',
      });
      return;
    }
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'users', selectedExistingId), {
        assignedTournaments: arrayUnion(tournamentId),
        updatedAt: new Date(),
      });
      setDialogOpen(false);
      await loadUsers();
    } catch (error) {
      console.error(`Error adding ${role}:`, error);
      alert({
        title: 'Error',
        description: `Failed to add ${config.label.toLowerCase()} to this tournament.`,
        variant: 'error',
      });
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
      title: config.removeTitle,
      description: config.removeDescription(target.name),
      confirmText: 'Remove',
      cancelText: 'Cancel',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'users', target.id), {
            assignedTournaments: arrayRemove(tournamentId),
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

  if (!canManage) return null;

  return (
    <>
      <Card className="rounded-none">
        <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold sm:text-base">
              {config.labelPlural} ({inTournament.length})
            </CardTitle>
            <Button onClick={openAdd} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1.5" />
              Add {config.label}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead className="text-xs sm:text-sm">Name</TableHead>
                  <TableHead className="text-xs sm:text-sm">Email</TableHead>
                  <TableHead className="text-xs sm:text-sm">Status</TableHead>
                  <TableHead className="text-right text-xs sm:text-sm">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-gray-500 py-6">
                      Loading {config.labelPlural.toLowerCase()}...
                    </TableCell>
                  </TableRow>
                ) : inTournament.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-gray-500 py-8">
                      <EmptyIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      No {config.labelPlural.toLowerCase()} assigned to this tournament yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  inTournament.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium text-xs sm:text-sm py-2">
                        {u.name}
                        {u.id === currentUserId && (
                          <Badge variant="outline" className="ml-2 text-[10px]">You</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm py-2">{u.email}</TableCell>
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add {config.label}</DialogTitle>
            <DialogDescription>
              Create a new {config.label.toLowerCase()} or add an existing one to this tournament.
              {' '}
              {config.createDescription}
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

          {mode === 'new' ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createNew();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor={`${role}-name`}>Full Name</Label>
                <Input
                  id={`${role}-name`}
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${role}-email`}>Email Address</Label>
                <Input
                  id={`${role}-email`}
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${role}-password`}>Password</Label>
                <Input
                  id={`${role}-password`}
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
                  {submitting ? 'Creating...' : `Create ${config.label}`}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select {config.label.toLowerCase()}</Label>
                {available.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No other {config.labelPlural.toLowerCase()} available. Create a new one instead.
                  </p>
                ) : (
                  <Select value={selectedExistingId} onValueChange={setSelectedExistingId}>
                    <SelectTrigger>
                      <SelectValue placeholder={`Choose a ${config.label.toLowerCase()}...`} />
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

      {AlertDialogComponent}
      {ConfirmDialogComponent}
    </>
  );
}
