'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Check, Loader2, X } from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { approveOrganizerTournament, rejectOrganizerTournament } from '@/lib/organizer-access';
import { isSystemAdmin } from '@/lib/permissions';
import type { Tournament } from '@/types';

function toDate(value: unknown): Date | undefined {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  return undefined;
}

export default function OrganizerReviewsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<Tournament[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && (!user || !isSystemAdmin(user.role))) {
      router.push('/login');
    }
  }, [user, loading, router]);

  async function load() {
    setLoadingRows(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'tournaments'), where('approvalStatus', 'in', ['pending', 'rejected'])),
      );
      const next = snap.docs
        .map((item) => {
          const data = item.data();
          return {
            id: item.id,
            ...data,
            startDate: toDate(data.startDate) ?? new Date(0),
            endDate: toDate(data.endDate) ?? new Date(0),
            createdAt: toDate(data.createdAt),
          } as Tournament;
        })
        .sort((a, b) => {
          if (a.approvalStatus === b.approvalStatus) {
            return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
          }
          return a.approvalStatus === 'pending' ? -1 : 1;
        });
      setRows(next);
    } catch (err) {
      console.error(err);
      setError('Could not load organizer submissions.');
    } finally {
      setLoadingRows(false);
    }
  }

  useEffect(() => {
    if (user && isSystemAdmin(user.role)) load();
    // Reload when the signed-in reviewer changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function approve(id: string) {
    if (!user) return;
    setBusyId(id);
    setError('');
    try {
      await approveOrganizerTournament(id, user.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    if (!user) return;
    if (!reason.trim()) {
      setError('Add a short reason so the organizer knows what to change.');
      return;
    }
    setBusyId(id);
    setError('');
    try {
      await rejectOrganizerTournament(id, user.id, reason);
      setRejectingId(null);
      setReason('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not decline this tournament.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading || !user || !isSystemAdmin(user.role)) return null;

  const pending = rows.filter((row) => row.approvalStatus === 'pending').length;

  return (
    <AdminLayout moduleName="Organizer reviews">
      <div className="p-4 sm:p-6 max-w-4xl">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">Organizer reviews</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {pending} tournament{pending === 1 ? '' : 's'} waiting for approval. Approving gives that account access to run the event. The tournament stays private until they publish it.
          </p>
        </div>
        {error && <p className="mb-4 text-sm text-red-500">{error}</p>}
        {loadingRows ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading submissions…
          </div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-sm text-muted-foreground">No organizer submissions yet.</CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <Card key={row.id}>
                <CardContent className="py-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{row.name}</p>
                        <Badge variant="outline">
                          {row.approvalStatus === 'pending' ? 'Pending' : 'Changes requested'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 capitalize">
                        {row.sport?.replace('-', ' ')}
                        {row.organisation ? ` · ${row.organisation}` : ''}
                        {row.venue ? ` · ${row.venue}` : ''}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {row.startDate ? new Date(row.startDate).toLocaleDateString() : 'Date TBD'}
                        {row.ownerPhone ? ` · ${row.ownerPhone}` : ''}
                      </p>
                      {row.description && <p className="text-sm mt-2">{row.description}</p>}
                      {row.rejectionReason && (
                        <p className="text-sm text-red-500 mt-2">Last note: {row.rejectionReason}</p>
                      )}
                    </div>
                    {row.approvalStatus === 'pending' && (
                      <div className="flex gap-2">
                        <Button size="sm" disabled={busyId === row.id} onClick={() => approve(row.id)}>
                          <Check className="h-4 w-4 mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === row.id}
                          onClick={() => {
                            setRejectingId(row.id);
                            setReason('');
                            setError('');
                          }}
                        >
                          <X className="h-4 w-4 mr-1" /> Request changes
                        </Button>
                      </div>
                    )}
                  </div>
                  {rejectingId === row.id && (
                    <div className="space-y-2">
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        placeholder="What should they change before this can be approved?"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" variant="destructive" disabled={busyId === row.id} onClick={() => reject(row.id)}>
                          Send back
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRejectingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
