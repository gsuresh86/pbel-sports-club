'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  query,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MessageSquareQuote,
  Plus,
  Star,
  Trash2,
  Globe,
  Clock,
  Pencil,
  Quote,
  Info,
} from 'lucide-react';
import type { Testimonial, User } from '@/types';

const EMPTY_FORM = { author: '', authorRole: '', quote: '', rating: 5, sport: '' };

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
        >
          <Star
            className={`h-6 w-6 transition-colors ${
              n <= (hovered || value) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

interface TournamentOption {
  id: string;
  name: string;
}

interface TournamentTestimonialsManagerProps {
  user: User;
  tournaments: TournamentOption[];
  initialTournamentId?: string;
}

export function TournamentTestimonialsManager({
  user,
  tournaments,
  initialTournamentId,
}: TournamentTestimonialsManagerProps) {
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Testimonial | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const selectedTournament = useMemo(
    () => tournaments.find((t) => t.id === selectedTournamentId) ?? null,
    [tournaments, selectedTournamentId],
  );

  useEffect(() => {
    if (tournaments.length === 0) return;
    const preferred =
      (initialTournamentId && tournaments.some((t) => t.id === initialTournamentId)
        ? initialTournamentId
        : undefined) ?? tournaments[0]?.id;
    setSelectedTournamentId((current) =>
      current && tournaments.some((t) => t.id === current) ? current : preferred ?? '',
    );
  }, [tournaments, initialTournamentId]);

  useEffect(() => {
    if (!selectedTournamentId) return;
    const q = query(
      collection(db, 'testimonials'),
      where('tournamentId', '==', selectedTournamentId),
    );
    return onSnapshot(q, (snap) => {
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
  }, [selectedTournamentId]);

  function openAdd() {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  }

  function openEdit(t: Testimonial) {
    setEditTarget(t);
    setForm({
      author: t.author,
      authorRole: t.authorRole,
      quote: t.quote,
      rating: t.rating,
      sport: t.sport,
    });
    setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.author.trim() || !form.quote.trim() || !selectedTournament) return;
    setSaving(true);
    try {
      if (editTarget) {
        await updateDoc(doc(db, 'testimonials', editTarget.id), {
          author: form.author.trim(),
          authorRole: form.authorRole.trim(),
          quote: form.quote.trim(),
          rating: form.rating,
          sport: form.sport.trim(),
        });
      } else {
        await addDoc(collection(db, 'testimonials'), {
          tournamentId: selectedTournamentId,
          tournamentName: selectedTournament.name,
          author: form.author.trim(),
          authorRole: form.authorRole.trim(),
          quote: form.quote.trim(),
          rating: form.rating,
          sport: form.sport.trim(),
          published: false,
          createdAt: serverTimestamp(),
          createdBy: user.id,
        });
      }
      setDialogOpen(false);
    } finally {
      setSaving(false);
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

  if (tournaments.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <MessageSquareQuote className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-base font-semibold mb-1">No tournaments assigned</h3>
          <p className="text-sm text-muted-foreground">
            You need access to a tournament before you can submit testimonials.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MessageSquareQuote className="h-5 w-5 text-blue-500" />
            Testimonials
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Add quotes from participants or attendees of your tournaments.
          </p>
        </div>
        <Button onClick={openAdd} size="sm" disabled={!selectedTournament}>
          <Plus className="h-4 w-4 mr-1" /> Add Testimonial
        </Button>
      </div>

      {tournaments.length > 1 && (
        <div className="max-w-sm">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">
            Tournament
          </label>
          <Select value={selectedTournamentId} onValueChange={setSelectedTournamentId}>
            <SelectTrigger>
              <SelectValue placeholder="Select tournament" />
            </SelectTrigger>
            <SelectContent>
              {tournaments.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex gap-2.5">
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600" />
        <span>
          Testimonials you add are <strong>pending review</strong>. A Super Admin will approve them
          before they appear on the public homepage. You can edit or delete unpublished testimonials
          at any time.
        </span>
      </div>

      {testimonials.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Quote className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-base font-semibold mb-1">No testimonials yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {selectedTournament
                ? `Capture a quote from a player or attendee of ${selectedTournament.name}.`
                : 'Select a tournament to get started.'}
            </p>
            <Button onClick={openAdd} size="sm" disabled={!selectedTournament}>
              <Plus className="h-4 w-4 mr-1" /> Add First Testimonial
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {testimonials.map((t) => (
            <Card key={t.id} className={t.published ? 'border-green-200 bg-green-50/40' : ''}>
              <CardHeader className="pb-2 pt-4 px-4 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center font-bold text-blue-700 text-sm flex-shrink-0">
                      {t.author.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-semibold leading-tight">{t.author}</CardTitle>
                      {t.authorRole && (
                        <CardDescription className="text-xs leading-tight">{t.authorRole}</CardDescription>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {t.published ? (
                      <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                        <Globe className="h-3 w-3 mr-1" /> Published
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50">
                        <Clock className="h-3 w-3 mr-1" /> Pending Review
                      </Badge>
                    )}
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
                <p className="text-sm text-gray-700 italic leading-relaxed mb-3">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
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
                  <div className="flex items-center gap-1.5">
                    {!t.published && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-2"
                        onClick={() => openEdit(t)}
                      >
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                      disabled={deletingId === t.id || t.published}
                      title={t.published ? 'Cannot delete a published testimonial' : 'Delete'}
                      onClick={() => handleDelete(t.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Testimonial' : 'Add Testimonial'}</DialogTitle>
            <DialogDescription>
              {editTarget
                ? 'Update the quote details below.'
                : 'Capture a quote from a participant or attendee. A Super Admin will review and approve it for the public site.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">
                  Name *
                </label>
                <input
                  required
                  value={form.author}
                  onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
                  placeholder="Amit Sharma"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">
                  Role / Title
                </label>
                <input
                  value={form.authorRole}
                  onChange={(e) => setForm((f) => ({ ...f, authorRole: e.target.value }))}
                  placeholder="Sports Secretary, PBEL City"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">
                Sport
              </label>
              <input
                value={form.sport}
                onChange={(e) => setForm((f) => ({ ...f, sport: e.target.value }))}
                placeholder="Badminton, Volleyball…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">
                Quote *
              </label>
              <textarea
                required
                rows={4}
                value={form.quote}
                onChange={(e) => setForm((f) => ({ ...f, quote: e.target.value }))}
                placeholder="Manchplay made our event incredibly smooth…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">
                Rating
              </label>
              <StarPicker value={form.rating} onChange={(n) => setForm((f) => ({ ...f, rating: n }))} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Submit for Review'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
