'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
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
import { Plus, UserCog, Trash2, Eye, EyeOff, UserPlus } from 'lucide-react';

const isAdminRole = (role: string) =>
  role === 'admin' || role === 'tournament-admin' || role === 'super-admin';

type DialogMode = 'new' | 'existing';

export default function RefereesPage() {
  const { user } = useAuth();
  const params = useParams();
  const tournamentId = params.id as string;
  const canManage = !!user && isAdminRole(user.role);

  const { alert, AlertDialogComponent } = useAlertDialog();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();

  const [referees, setReferees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<DialogMode>('new');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [selectedExistingId, setSelectedExistingId] = useState('');

  const loadReferees = useCallback(async () => {
    if (!canManage) return;
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'referee')));
      const all = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.(),
        updatedAt: d.data().updatedAt?.toDate?.(),
      })) as User[];
      setReferees(all);
    } catch (error) {
      console.error('Error loading referees:', error);
    } finally {
      setLoading(false);
    }
  }, [canManage, tournamentId]);

  useEffect(() => {
    loadReferees();
  }, [loadReferees]);

  const inTournament = useMemo(
    () => referees.filter((r) => (r.assignedTournaments || []).includes(tournamentId)),
    [referees, tournamentId]
  );
  const available = useMemo(
    () => referees.filter((r) => !(r.assignedTournaments || []).includes(tournamentId)),
    [referees, tournamentId]
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
      const response = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: form.password,
          name,
          role: 'referee',
          assignedTournaments: [tournamentId],
          isActive: true,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create referee');
      }
      setDialogOpen(false);
      await loadReferees();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create referee';
      alert({
        title: 'Error',
        description:
          message === 'Email is already in use'
            ? 'A user with this email already exists. If they are already a referee, use "Add existing referee" instead.'
            : message,
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const addExisting = async () => {
    if (!selectedExistingId) {
      alert({ title: 'Validation Error', description: 'Select a referee to add', variant: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'users', selectedExistingId), {
        assignedTournaments: arrayUnion(tournamentId),
        updatedAt: new Date(),
      });
      setDialogOpen(false);
      await loadReferees();
    } catch (error) {
      console.error('Error adding referee:', error);
      alert({ title: 'Error', description: 'Failed to add referee to this tournament.', variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (ref: User) => {
    try {
      await updateDoc(doc(db, 'users', ref.id), {
        isActive: ref.isActive === false,
        updatedAt: new Date(),
      });
      await loadReferees();
    } catch (error) {
      console.error('Error updating referee:', error);
      alert({ title: 'Error', description: 'Failed to update referee status.', variant: 'error' });
    }
  };

  const removeFromTournament = (ref: User) => {
    confirm({
      title: 'Remove Referee',
      description: `Remove ${ref.name} from this tournament? Their account stays active for any other tournaments they are assigned to.`,
      confirmText: 'Remove',
      cancelText: 'Cancel',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'users', ref.id), {
            assignedTournaments: arrayRemove(tournamentId),
            updatedAt: new Date(),
          });
          await loadReferees();
        } catch (error) {
          console.error('Error removing referee:', error);
          alert({ title: 'Error', description: 'Failed to remove referee.', variant: 'error' });
        }
      },
    });
  };

  if (!canManage) return null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold sm:text-lg">Referees</h3>
          <p className="text-xs text-gray-600 sm:text-sm">
            Manage referees who can score matches for this tournament.
          </p>
        </div>
        <Button onClick={openAdd} size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Referee
        </Button>
      </div>

      <Card className="rounded-none">
        <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
          <CardTitle className="text-sm font-semibold sm:text-base">
            Assigned Referees ({inTournament.length})
          </CardTitle>
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
                      Loading referees...
                    </TableCell>
                  </TableRow>
                ) : inTournament.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-gray-500 py-8">
                      <UserCog className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      No referees assigned to this tournament yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  inTournament.map((ref) => (
                    <TableRow key={ref.id}>
                      <TableCell className="font-medium text-xs sm:text-sm py-2">{ref.name}</TableCell>
                      <TableCell className="text-xs sm:text-sm py-2">{ref.email}</TableCell>
                      <TableCell className="py-2">
                        <Badge
                          className={
                            ref.isActive !== false
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }
                        >
                          {ref.isActive !== false ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 p-0"
                            title={ref.isActive !== false ? 'Deactivate' : 'Activate'}
                            onClick={() => toggleActive(ref)}
                          >
                            {ref.isActive !== false ? (
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
                            onClick={() => removeFromTournament(ref)}
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

      {/* Add referee dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Referee</DialogTitle>
            <DialogDescription>
              Create a new referee or add an existing one to this tournament.
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
              New referee
            </Button>
            <Button
              type="button"
              variant={mode === 'existing' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('existing')}
            >
              <UserCog className="h-4 w-4 mr-1.5" />
              Existing referee
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
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
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
                  {submitting ? 'Creating...' : 'Create Referee'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select referee</Label>
                {available.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No other referees available. Create a new one instead.
                  </p>
                ) : (
                  <Select value={selectedExistingId} onValueChange={setSelectedExistingId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a referee..." />
                    </SelectTrigger>
                    <SelectContent>
                      {available.map((ref) => (
                        <SelectItem key={ref.id} value={ref.id}>
                          {ref.name} — {ref.email}
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
    </div>
  );
}
