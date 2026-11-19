'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PublicLayout } from '@/components/PublicLayout';
import { Input } from '@/components/ui/input';
import { Tournament } from '@/types';
import { Search, Calendar, MapPin, Users, Trophy, ChevronRight, Flame } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Reveal } from '@/components/public/Reveal';

const SPORT_CFG: Record<string, { emoji: string; bar: string; glow: string }> = {
  badminton: { emoji: '🏸', bar: 'from-amber-500 to-yellow-500', glow: 'shadow-amber-500/20' },
  'table-tennis': { emoji: '🏓', bar: 'from-sky-500 to-cyan-500', glow: 'shadow-sky-500/20' },
  volleyball: { emoji: '🏐', bar: 'from-indigo-500 to-blue-500', glow: 'shadow-indigo-500/20' },
  tennis: { emoji: '🎾', bar: 'from-lime-500 to-green-500', glow: 'shadow-lime-500/20' },
  basketball: { emoji: '🏀', bar: 'from-orange-500 to-red-500', glow: 'shadow-orange-500/20' },
  football: { emoji: '⚽', bar: 'from-emerald-500 to-teal-500', glow: 'shadow-emerald-500/20' },
  'throw-ball': { emoji: '🏐', bar: 'from-rose-500 to-orange-500', glow: 'shadow-rose-500/20' },
};
const SPORT_DEFAULT = { emoji: '🏆', bar: 'from-slate-500 to-slate-600', glow: 'shadow-slate-500/20' };
const sp = (sport: string) => SPORT_CFG[sport] ?? SPORT_DEFAULT;

const STATUS_CFG: Record<string, { label: string; dot: boolean; cls: string }> = {
  ongoing: {
    label: 'Live Now',
    dot: true,
    cls: 'bg-green-500 text-white shadow-md shadow-green-500/40',
  },
  upcoming: {
    label: 'Upcoming',
    dot: false,
    cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30',
  },
  completed: {
    label: 'Completed',
    dot: false,
    cls: 'bg-muted text-muted-foreground border border-border',
  },
  cancelled: {
    label: 'Cancelled',
    dot: false,
    cls: 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30',
  },
};

const fmtShort = (d: Date) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(d);

const daysLeft = (d: Date) => Math.ceil((d.getTime() - Date.now()) / 86_400_000);

function FeaturedCard({ t, players }: { t: Tournament; players: number }) {
  const cfg = sp(t.sport);

  return (
    <Link href={`/tournament/${t.id}`}>
      <div className="group relative rounded-3xl overflow-hidden border border-green-500/30 hover:border-green-400/50 transition-all duration-300 hover:shadow-2xl hover:shadow-green-500/10 cursor-pointer">
        <div className="relative h-52 sm:h-64">
          {t.banner ? (
            <>
              <Image
                src={t.banner}
                alt={`${t.name} tournament banner`}
                fill
                className="object-cover object-center scale-105 group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/70 to-slate-950/40" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
            </>
          ) : (
            <div className={`absolute inset-0 bg-gradient-to-br ${cfg.bar} opacity-20`} />
          )}

          <div className="absolute inset-0 flex flex-col justify-between p-6">
            <div className="flex items-start justify-between">
              <span className="inline-flex items-center gap-2 bg-green-500 text-white text-xs font-black px-3 py-1.5 rounded-full uppercase tracking-widest shadow-lg shadow-green-500/40">
                <span className="w-2 h-2 rounded-full bg-green-200 animate-pulse" />
                Live Now
              </span>
              <span className="text-3xl drop-shadow-lg">{cfg.emoji}</span>
            </div>

            <div>
              <p className="text-xs text-green-400 font-bold uppercase tracking-widest mb-1.5">
                {t.sport.replace('-', ' ')}
              </p>
              <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight mb-3 drop-shadow-lg group-hover:text-yellow-300 transition-colors">
                {t.name}
              </h3>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-yellow-400" />
                  {fmtShort(t.startDate)} — {fmtShort(t.endDate)}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-yellow-400" />
                  {t.venue}
                </span>
                {players > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-yellow-400" />
                    {players} players
                  </span>
                )}
              </div>
              <div className="flex gap-2 mt-4">
                <span className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/10 text-white text-xs font-bold px-4 py-2 rounded-full transition-colors">
                  View Details <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function TournamentCard({ t, players }: { t: Tournament; players: number }) {
  const cfg = sp(t.sport);
  const st = STATUS_CFG[t.status] ?? STATUS_CFG.upcoming;
  const dl = t.registrationDeadline ? daysLeft(t.registrationDeadline) : null;
  const regOpen = !!t.registrationOpen && dl !== null && dl >= 0;

  return (
    <div
      className={`group relative bg-card rounded-2xl border border-border overflow-hidden hover:border-foreground/20 hover:shadow-2xl ${cfg.glow} transition-all duration-300 hover:-translate-y-0.5`}
    >
      <div className={`h-1 bg-gradient-to-r ${cfg.bar}`} />

      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl leading-none">{cfg.emoji}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
              {t.sport.replace('-', ' ')}
            </span>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wide ${st.cls}`}
          >
            {st.dot && <span className="w-1.5 h-1.5 rounded-full bg-green-200 animate-pulse" />}
            {st.label}
          </span>
        </div>

        <h3 className="text-base font-black text-foreground leading-snug mb-4 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors line-clamp-2 min-h-[2.5rem]">
          {t.name}
        </h3>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
            <span>
              {fmtShort(t.startDate)} — {fmtShort(t.endDate)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
            <span className="truncate">{t.venue}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-muted-foreground">
              {players > 0 && (
                <>
                  <Users className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                  {players} players
                </>
              )}
            </span>
            {t.entryFee ? (
              <span className="text-amber-600 dark:text-amber-400 font-bold">₹{t.entryFee}</span>
            ) : (
              <span className="text-muted-foreground/60 font-bold">Free</span>
            )}
          </div>
        </div>

        {regOpen && dl !== null && dl <= 5 && (
          <div className="mb-3 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
            <span className="text-[11px] text-red-600 dark:text-red-400 font-semibold">
              {dl === 0 ? 'Closes today!' : `${dl} day${dl > 1 ? 's' : ''} left to register`}
            </span>
          </div>
        )}

        <div className="flex gap-2 pt-3 border-t border-border">
          <Link href={`/tournament/${t.id}`} className="flex-1">
            <div className="text-center bg-muted hover:bg-muted/80 rounded-xl py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-all">
              View Details
            </div>
          </Link>
          {regOpen && (
            <Link href={`/tournament/${t.id}/register`}>
              <div className="bg-yellow-400 hover:bg-yellow-300 text-slate-950 rounded-xl px-4 py-2.5 text-xs font-black transition-colors whitespace-nowrap">
                Register →
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sportFilter, setSportFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'tournaments'), orderBy('createdAt', 'desc')));
      const all = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        startDate: d.data().startDate?.toDate(),
        endDate: d.data().endDate?.toDate(),
        registrationDeadline: d.data().registrationDeadline?.toDate(),
        createdAt: d.data().createdAt?.toDate(),
        updatedAt: d.data().updatedAt?.toDate(),
      })) as Tournament[];

      const visible = all.filter(
        (t) => t.isPublic !== false && t.approvalStatus !== 'pending' && t.approvalStatus !== 'rejected',
      );
      setTournaments(visible);

      const counts: Record<string, number> = {};
      visible.forEach((t) => {
        counts[t.id] = typeof t.currentParticipants === 'number' ? t.currentParticipants : 0;
      });
      setPlayerCounts(counts);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const sports = Array.from(new Set(tournaments.map((t) => t.sport)));

  const filtered = tournaments.filter((t) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.venue.toLowerCase().includes(q);
    const matchSport = sportFilter === 'all' || t.sport === sportFilter;
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchSport && matchStatus;
  });

  const liveOnes = filtered.filter((t) => t.status === 'ongoing');
  const otherOnes = filtered.filter((t) => t.status !== 'ongoing');

  const totalLive = tournaments.filter((t) => t.status === 'ongoing').length;
  const totalUpcoming = tournaments.filter((t) => t.status === 'upcoming').length;
  const totalPlayers = Object.values(playerCounts).reduce((a, b) => a + b, 0);

  if (loading) {
    return (
      <PublicLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground text-sm tracking-widest uppercase">
              Loading Tournaments
            </p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16">
          <Reveal className="mb-10">
            <p className="text-xs text-amber-600 dark:text-amber-400 font-bold uppercase tracking-widest mb-2">
              TourneyCraft
            </p>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-foreground leading-none tracking-tight mb-4">
              Find Your
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-yellow-400">
                Tournament
              </span>
            </h1>
            <p className="text-muted-foreground text-base max-w-xl mb-6">
              Compete. Connect. Conquer. Join our community sports tournaments and showcase your
              skills.
            </p>

            <div className="flex flex-wrap gap-3">
              {[
                { label: `${tournaments.length} Tournaments`, icon: Trophy },
                ...(totalLive > 0
                  ? [{ label: `${totalLive} Live Now`, icon: Flame, highlight: true }]
                  : []),
                { label: `${totalUpcoming} Upcoming`, icon: Calendar },
                { label: `${totalPlayers}+ Players`, icon: Users },
              ].map((s) => (
                <span
                  key={s.label}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${
                    (s as { highlight?: boolean }).highlight
                      ? 'bg-green-500/20 border-green-500/40 text-green-700 dark:text-green-300'
                      : 'bg-muted border-border text-muted-foreground'
                  }`}
                >
                  <s.icon className="h-3.5 w-3.5" />
                  {s.label}
                </span>
              ))}
            </div>
          </Reveal>

          <div className="bg-card/80 backdrop-blur-md rounded-2xl border border-border p-4 mb-8 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tournaments, venues…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-muted border-border text-foreground placeholder:text-muted-foreground focus:border-amber-500/50 focus:ring-0 rounded-xl h-10"
              />
            </div>

            {sports.length > 0 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
                {['all', ...sports].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSportFilter(s)}
                    className={`flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-full transition-all ${
                      sportFilter === s
                        ? 'bg-yellow-400 text-slate-950 shadow-md shadow-amber-500/30'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground border border-border'
                    }`}
                  >
                    {s === 'all'
                      ? 'All Sports'
                      : `${(SPORT_CFG[s] ?? SPORT_DEFAULT).emoji} ${s
                          .replace('-', ' ')
                          .replace(/\b\w/g, (c) => c.toUpperCase())}`}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
              {(['all', 'ongoing', 'upcoming', 'completed', 'cancelled'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`flex-shrink-0 text-xs font-bold px-3.5 py-1.5 rounded-full transition-all ${
                    statusFilter === s
                      ? 'bg-foreground/10 text-foreground border border-border'
                      : 'bg-muted text-muted-foreground hover:text-foreground border border-border'
                  }`}
                >
                  {s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {liveOnes.length > 0 &&
            statusFilter !== 'upcoming' &&
            statusFilter !== 'completed' &&
            statusFilter !== 'cancelled' && (
              <section className="mb-10">
                <h2 className="text-xs uppercase tracking-widest text-green-600 dark:text-green-400 font-black mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Live Now
                </h2>
                <div
                  className={`grid gap-4 ${liveOnes.length === 1 ? 'grid-cols-1 max-w-2xl' : 'sm:grid-cols-2'}`}
                >
                  {liveOnes.map((t) => (
                    <FeaturedCard key={t.id} t={t} players={playerCounts[t.id] ?? 0} />
                  ))}
                </div>
              </section>
            )}

          {otherOnes.length > 0 && (
            <section>
              {liveOnes.length > 0 && statusFilter === 'all' && (
                <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-black mb-4">
                  All Tournaments
                </h2>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {otherOnes.map((t, i) => (
                  <Reveal key={t.id} delay={Math.min(i * 50, 300)}>
                    <TournamentCard t={t} players={playerCounts[t.id] ?? 0} />
                  </Reveal>
                ))}
              </div>
            </section>
          )}

          {filtered.length === 0 && (
            <div className="text-center py-24">
              <h3 className="text-xl font-black text-foreground mb-2">No tournaments found</h3>
              <p className="text-muted-foreground text-sm">
                {search || sportFilter !== 'all' || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Check back soon for new tournaments'}
              </p>
              {(search || sportFilter !== 'all' || statusFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearch('');
                    setSportFilter('all');
                    setStatusFilter('all');
                  }}
                  className="mt-4 text-xs text-amber-600 dark:text-amber-400 hover:underline underline-offset-2"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
