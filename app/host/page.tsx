'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { addDoc, collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';
import { PublicLayout } from '@/components/PublicLayout';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { authErrorMessage } from '@/lib/auth-errors';
import { db } from '@/lib/firebase';
import { isSystemAdmin } from '@/lib/permissions';
import type { SportType, Tournament } from '@/types';

const SPORTS: { value: SportType; label: string }[] = [
  { value: 'badminton', label: 'Badminton' },
  { value: 'table-tennis', label: 'Table Tennis' },
  { value: 'volleyball', label: 'Volleyball' },
  { value: 'throw-ball', label: 'Throw Ball' },
];

const EMPTY = {
  name: '',
  sport: '' as SportType | '',
  venue: '',
  startDate: '',
  endDate: '',
  phone: '',
  organisation: '',
  description: '',
};

function toDate(value: unknown): Date | undefined {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  if (value instanceof Date) return value;
  return undefined;
}

export default function HostTournamentPage() {
  const { user, loading, signInWithGoogle, refreshUser } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const refreshedApproval = useRef(false);

  useEffect(() => {
    if (!loading && user && isSystemAdmin(user.role)) {
      router.replace('/admin/reviews');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (refreshedApproval.current || !user || user.role !== 'public') return;
    if (tournaments.some((tournament) => tournament.approvalStatus === 'approved')) {
      refreshedApproval.current = true;
      refreshUser();
    }
  }, [tournaments, user, refreshUser]);

  useEffect(() => {
    if (!user || user.role === 'admin' || user.role === 'super-admin') return;
    let cancelled = false;
    setLoadingList(true);
    getDocs(query(collection(db, 'tournaments'), where('ownerId', '==', user.id)))
      .then((snap) => {
        if (cancelled) return;
        const rows = snap.docs
          .map((item) => {
            const data = item.data();
            return {
              id: item.id,
              ...data,
              startDate: toDate(data.startDate),
              endDate: toDate(data.endDate),
              createdAt: toDate(data.createdAt),
            } as Tournament;
          })
          .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
        setTournaments(rows);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError('Could not load your tournaments.');
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  function setField(field: keyof typeof EMPTY, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleGoogle() {
    setError('');
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(authErrorMessage(err, 'Google sign-in failed. Please try again.'));
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError('');

    if (!form.sport) {
      setError('Choose a sport.');
      return;
    }
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      setError('Enter a valid date range.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      sport: form.sport,
      tournamentType: 'individual' as const,
      categories: [],
      startDate: start,
      endDate: end,
      venue: form.venue.trim() || 'TBD',
      description: form.description.trim(),
      registrationDeadline: start,
      currentParticipants: 0,
      rules: 'Standard tournament rules apply.',
      status: 'upcoming' as const,
      registrationOpen: false,
      isPublic: false,
      approvalStatus: 'pending' as const,
      ownerId: user.id,
      ownerPhone: form.phone.trim(),
      organisation: form.organisation.trim(),
      createdBy: user.id,
      updatedAt: new Date(),
    };

    setSubmitting(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'tournaments', editingId), {
          ...payload,
          rejectionReason: null,
        });
      } else {
        await addDoc(collection(db, 'tournaments'), {
          ...payload,
          createdAt: new Date(),
        });
      }
      setForm(EMPTY);
      setEditingId(null);
      const snap = await getDocs(query(collection(db, 'tournaments'), where('ownerId', '==', user.id)));
      setTournaments(
        snap.docs
          .map((item) => {
            const data = item.data();
            return {
              id: item.id,
              ...data,
              startDate: toDate(data.startDate),
              endDate: toDate(data.endDate),
              createdAt: toDate(data.createdAt),
            } as Tournament;
          })
          .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)),
      );
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Could not submit the tournament.');
    } finally {
      setSubmitting(false);
    }
  }

  function editTournament(tournament: Tournament) {
    const start = tournament.startDate ? new Date(tournament.startDate) : null;
    const end = tournament.endDate ? new Date(tournament.endDate) : null;
    const iso = (date: Date | null) => (date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : '');
    setEditingId(tournament.id);
    setForm({
      name: tournament.name,
      sport: tournament.sport,
      venue: tournament.venue === 'TBD' ? '' : tournament.venue,
      startDate: iso(start),
      endDate: iso(end),
      phone: tournament.ownerPhone || '',
      organisation: tournament.organisation || '',
      description: tournament.description || '',
    });
  }

  const inputCls =
    'w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-all outline-none';
  const labelCls = 'block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide';

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 pt-24 pb-16">
        <p className="text-xs text-amber-600 dark:text-amber-400 font-bold uppercase tracking-widest mb-3">
          Host on TourneyCraft
        </p>
        <h1 className="text-4xl font-black tracking-tight mb-3">Create a tournament</h1>
        <p className="text-muted-foreground mb-8 max-w-2xl">
          Create an account, submit your event, and the TourneyCraft team reviews it. After approval you can open registration, build the draw, and run the tournament.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking your account…
          </div>
        ) : !user ? (
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Sign in to submit a tournament. New accounts are free.
            </p>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <GoogleSignInButton
              onClick={handleGoogle}
              disabled={googleLoading}
              label={googleLoading ? 'Opening Google…' : 'Continue with Google'}
            />
            <div className="flex gap-3 text-sm">
              <Link href="/signup" className="text-amber-600 dark:text-amber-400 font-semibold hover:underline">
                Create an account with email
              </Link>
              <Link href="/login" className="text-muted-foreground hover:underline">
                Sign in
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <section className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-bold">{editingId ? 'Update submission' : 'Tournament details'}</h2>
                {user.role === 'tournament-admin' && (
                  <Button asChild variant="outline" size="sm">
                    <Link href="/admin/tournaments">Open console</Link>
                  </Button>
                )}
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={labelCls}>Tournament name *</label>
                  <input required value={form.name} onChange={(e) => setField('name', e.target.value)} className={inputCls} placeholder="City Open 2026" />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Sport *</label>
                    <select
                      required
                      value={form.sport}
                      onChange={(e) => setField('sport', e.target.value)}
                      className={inputCls}
                    >
                      <option value="" disabled>Select sport…</option>
                      {SPORTS.map((sport) => (
                        <option key={sport.value} value={sport.value}>{sport.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Venue</label>
                    <input value={form.venue} onChange={(e) => setField('venue', e.target.value)} className={inputCls} placeholder="Sports club, city" />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Start date *</label>
                    <input required type="date" value={form.startDate} onChange={(e) => setField('startDate', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>End date *</label>
                    <input required type="date" value={form.endDate} onChange={(e) => setField('endDate', e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Phone</label>
                    <input value={form.phone} onChange={(e) => setField('phone', e.target.value)} className={inputCls} placeholder="+91 9000000000" />
                  </div>
                  <div>
                    <label className={labelCls}>Club / organisation</label>
                    <input value={form.organisation} onChange={(e) => setField('organisation', e.target.value)} className={inputCls} placeholder="City Sports Club" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Notes</label>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => setField('description', e.target.value)}
                    className={`${inputCls} resize-none`}
                    placeholder="Format, expected entries, anything the review team should know."
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-60 text-slate-950 font-bold px-5 py-3 rounded-xl text-sm"
                  >
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {editingId ? 'Resubmit for review' : 'Submit for review'}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      className="text-sm text-muted-foreground underline"
                      onClick={() => {
                        setEditingId(null);
                        setForm(EMPTY);
                      }}
                    >
                      Cancel edit
                    </button>
                  )}
                </div>
              </form>
            </section>

            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold">Your submissions</h2>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline"
                  onClick={() => refreshUser()}
                >
                  Refresh approval status
                </button>
              </div>
              {loadingList ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : tournaments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing submitted yet.</p>
              ) : (
                <ul className="space-y-3">
                  {tournaments.map((tournament) => {
                    const status = tournament.approvalStatus ?? 'approved';
                    const approved = status === 'approved';
                    return (
                      <li key={tournament.id} className="rounded-2xl border border-border bg-card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{tournament.name}</p>
                            <p className="text-sm text-muted-foreground capitalize">
                              {tournament.sport.replace('-', ' ')}
                              {tournament.venue ? ` · ${tournament.venue}` : ''}
                            </p>
                          </div>
                          <StatusPill status={status} />
                        </div>
                        {status === 'rejected' && tournament.rejectionReason && (
                          <p className="mt-2 text-sm text-red-500">{tournament.rejectionReason}</p>
                        )}
                        <div className="mt-3 flex gap-3 text-sm">
                          {approved ? (
                            <Link href={`/admin/tournaments/${tournament.id}/overview`} className="font-semibold text-amber-600 dark:text-amber-400 hover:underline">
                              Continue setup
                            </Link>
                          ) : (
                            <button type="button" className="font-semibold text-amber-600 dark:text-amber-400 hover:underline" onClick={() => editTournament(tournament)}>
                              {status === 'rejected' ? 'Edit and resubmit' : 'Edit'}
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 text-green-700 dark:text-green-400 px-2.5 py-1 text-xs font-semibold">
        <CheckCircle2 className="h-3.5 w-3.5" /> Approved
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 text-red-600 px-2.5 py-1 text-xs font-semibold">
        <XCircle className="h-3.5 w-3.5" /> Needs changes
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2.5 py-1 text-xs font-semibold">
      <Clock className="h-3.5 w-3.5" /> In review
    </span>
  );
}
