'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { TournamentTestimonialsManager } from '@/components/admin/TournamentTestimonialsManager';
import {
  collection,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTournaments } from '@/hooks/use-tournament-queries';
import {
  canReviewTestimonials,
  canSubmitTestimonials,
  hasPermission,
} from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  MessageSquareQuote,
  Star,
  Globe,
  Clock,
  Check,
  X,
  Trash2,
  Search,
  Filter,
} from 'lucide-react';
import type { Testimonial } from '@/types';

function SuperAdminTestimonialsReview() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'published'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    return onSnapshot(collection(db, 'testimonials'), (snap) => {
      setTestimonials(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Testimonial))
          .sort(
            (a, b) =>
              (b.createdAt?.toDate?.()?.getTime() ?? 0) -
              (a.createdAt?.toDate?.()?.getTime() ?? 0),
          ),
      );
    });
  }, []);

  async function togglePublish(t: Testimonial) {
    setTogglingId(t.id);
    try {
      await updateDoc(doc(db, 'testimonials', t.id), { published: !t.published });
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, 'testimonials', id));
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = testimonials.filter((t) => {
    const matchesSearch =
      !search ||
      t.author.toLowerCase().includes(search.toLowerCase()) ||
      t.quote.toLowerCase().includes(search.toLowerCase()) ||
      t.tournamentName?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'pending' && !t.published) ||
      (statusFilter === 'published' && t.published);
    return matchesSearch && matchesStatus;
  });

  const pendingCount = testimonials.filter((t) => !t.published).length;
  const publishedCount = testimonials.filter((t) => t.published).length;

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl">
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-2xl font-black text-gray-900">{testimonials.length}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Total</div>
          </CardContent>
        </Card>
        <Card className="text-center border-amber-200 bg-amber-50/50">
          <CardContent className="py-4">
            <div className="text-2xl font-black text-amber-600">{pendingCount}</div>
            <div className="text-xs text-amber-700 mt-0.5">Pending Review</div>
          </CardContent>
        </Card>
        <Card className="text-center border-green-200 bg-green-50/50">
          <CardContent className="py-4">
            <div className="text-2xl font-black text-green-600">{publishedCount}</div>
            <div className="text-xs text-green-700 mt-0.5">Published</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by author, quote, or tournament…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-full sm:w-44">
            <Filter className="h-4 w-4 mr-2 text-gray-400" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Testimonials</SelectItem>
            <SelectItem value="pending">Pending Review</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquareQuote className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-base font-semibold mb-1">No testimonials found</h3>
            <p className="text-sm text-muted-foreground">
              {testimonials.length === 0
                ? 'Testimonials submitted by tournament admins will appear here for review.'
                : 'Try adjusting your filters.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <Card key={t.id} className={t.published ? 'border-green-200 bg-green-50/30' : 'border-amber-100'}>
              <CardHeader className="pb-2 pt-4 px-4 sm:px-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center font-bold text-blue-700 text-sm flex-shrink-0">
                      {t.author.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-semibold leading-tight">{t.author}</CardTitle>
                      <CardDescription className="text-xs leading-tight">
                        {t.authorRole && <span>{t.authorRole} · </span>}
                        <span className="font-medium text-blue-600">{t.tournamentName}</span>
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {t.published ? (
                      <>
                        <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                          <Globe className="h-3 w-3 mr-1" /> Published
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2 text-amber-600 border-amber-200 hover:bg-amber-50"
                          disabled={togglingId === t.id}
                          onClick={() => togglePublish(t)}
                        >
                          <X className="h-3 w-3 mr-1" />
                          {togglingId === t.id ? '…' : 'Unpublish'}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50">
                          <Clock className="h-3 w-3 mr-1" /> Pending
                        </Badge>
                        <Button
                          size="sm"
                          className="h-7 text-xs px-2 bg-green-600 hover:bg-green-700 text-white border-0"
                          disabled={togglingId === t.id}
                          onClick={() => togglePublish(t)}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          {togglingId === t.id ? '…' : 'Approve'}
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                      disabled={deletingId === t.id}
                      onClick={() => handleDelete(t.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="px-4 sm:px-5 pb-4">
                <div className="flex gap-0.5 mb-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`h-3.5 w-3.5 ${
                        n <= t.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-sm text-gray-700 italic leading-relaxed mb-2">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {t.sport && (
                    <span className="text-xs bg-gray-100 text-gray-600 border border-gray-200 rounded-full px-2 py-0.5">
                      {t.sport}
                    </span>
                  )}
                  {t.createdAt && (
                    <span className="text-xs text-muted-foreground">
                      {t.createdAt.toDate().toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TestimonialsAdminPage() {
  return (
    <Suspense fallback={null}>
      <TestimonialsAdminPageInner />
    </Suspense>
  );
}

function TestimonialsAdminPageInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTournamentId = searchParams.get('tournament') ?? undefined;

  const isReviewer = canReviewTestimonials(user);
  const isSubmitter = canSubmitTestimonials(user);

  const assignedIds = isSubmitter && !isReviewer ? user?.assignedTournaments : undefined;
  const { data: tournaments = [] } = useTournaments({
    assignedIds,
    enabled: !loading && isSubmitter && !isReviewer && !!user,
  });

  const manageableTournaments = useMemo(
    () =>
      tournaments
        .filter((t) => hasPermission(user, 'tournament.testimonials', t.id))
        .map((t) => ({ id: t.id, name: t.name })),
    [tournaments, user],
  );

  useEffect(() => {
    if (!loading && user && !isReviewer && !isSubmitter) {
      router.push('/admin/tournaments');
    }
  }, [user, loading, router, isReviewer, isSubmitter]);

  if (loading || !user) return null;
  if (!isReviewer && !isSubmitter) return null;

  return (
    <AdminLayout moduleName="Testimonials">
      {isReviewer ? (
        <SuperAdminTestimonialsReview />
      ) : (
        <div className="p-4 sm:p-6">
          <TournamentTestimonialsManager
            user={user}
            tournaments={manageableTournaments}
            initialTournamentId={initialTournamentId}
          />
        </div>
      )}
    </AdminLayout>
  );
}
