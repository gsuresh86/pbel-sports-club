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

// ── Sport config ──────────────────────────────────────────────────────────
const SPORT_CFG: Record<string, { emoji: string; bar: string; glow: string }> = {
  badminton:      { emoji: '🏸', bar: 'from-yellow-500 to-amber-500',  glow: 'shadow-yellow-500/20'  },
  'table-tennis': { emoji: '🏓', bar: 'from-blue-500 to-cyan-500',     glow: 'shadow-blue-500/20'    },
  volleyball:     { emoji: '🏐', bar: 'from-purple-500 to-violet-500', glow: 'shadow-purple-500/20'  },
  tennis:         { emoji: '🎾', bar: 'from-lime-500 to-green-500',    glow: 'shadow-lime-500/20'    },
  basketball:     { emoji: '🏀', bar: 'from-orange-500 to-red-500',    glow: 'shadow-orange-500/20'  },
  football:       { emoji: '⚽', bar: 'from-emerald-500 to-teal-500',  glow: 'shadow-emerald-500/20' },
  'throw-ball':   { emoji: '🏐', bar: 'from-pink-500 to-rose-500',     glow: 'shadow-pink-500/20'    },
};
const SPORT_DEFAULT = { emoji: '🏆', bar: 'from-slate-500 to-slate-600', glow: 'shadow-slate-500/20' };
const sp = (sport: string) => SPORT_CFG[sport] ?? SPORT_DEFAULT;

const STATUS_CFG: Record<string, { label: string; dot: boolean; cls: string }> = {
  ongoing:   { label: 'Live Now',   dot: true,  cls: 'bg-green-500 text-white shadow-md shadow-green-500/40' },
  upcoming:  { label: 'Upcoming',   dot: false, cls: 'bg-blue-500/20 text-blue-300 border border-blue-400/30' },
  completed: { label: 'Completed',  dot: false, cls: 'bg-slate-700 text-slate-400' },
  cancelled: { label: 'Cancelled',  dot: false, cls: 'bg-red-500/20 text-red-400 border border-red-500/30' },
};

const fmt = (d: Date) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);

const fmtShort = (d: Date) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(d);

const daysLeft = (d: Date) => Math.ceil((d.getTime() - Date.now()) / 86_400_000);

// ── Featured live card ────────────────────────────────────────────────────
function FeaturedCard({ t, players }: { t: Tournament; players: number }) {
  const cfg = sp(t.sport);

  return (
    <Link href={`/tournament/${t.id}`}>
      <div className="group relative rounded-3xl overflow-hidden border border-green-500/30 hover:border-green-400/50 transition-all duration-300 hover:shadow-2xl hover:shadow-green-500/10 cursor-pointer">
        {/* Banner bg */}
        <div className="relative h-52 sm:h-64">
          {t.banner ? (
            <>
              <Image src={t.banner} alt={t.name} fill className="object-cover object-center scale-105 group-hover:scale-110 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/70 to-slate-950/40" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
            </>
          ) : (
            <div className={`absolute inset-0 bg-gradient-to-br ${cfg.bar} opacity-20`} />
          )}

          {/* Live badge + content */}
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

// ── Tournament card ───────────────────────────────────────────────────────
function TournamentCard({ t, players }: { t: Tournament; players: number }) {
  const cfg = sp(t.sport);
  const st = STATUS_CFG[t.status] ?? STATUS_CFG.upcoming;
  const dl = t.registrationDeadline ? daysLeft(t.registrationDeadline) : null;
  const regOpen = !!t.registrationOpen && dl !== null && dl >= 0;

  return (
    <div className={`group relative bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-white/5 overflow-hidden hover:border-white/15 hover:shadow-2xl ${cfg.glow} transition-all duration-300 hover:-translate-y-0.5`}>
      {/* Sport accent bar */}
      <div className={`h-1 bg-gradient-to-r ${cfg.bar}`} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl leading-none">{cfg.emoji}</span>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
              {t.sport.replace('-', ' ')}
            </span>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wide ${st.cls}`}>
            {st.dot && <span className="w-1.5 h-1.5 rounded-full bg-green-200 animate-pulse" />}
            {st.label}
          </span>
        </div>

        {/* Name */}
        <h3 className="text-base font-black text-white leading-snug mb-4 group-hover:text-yellow-400 transition-colors line-clamp-2 min-h-[2.5rem]">
          {t.name}
        </h3>

        {/* Info */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Calendar className="h-3.5 w-3.5 text-yellow-400 flex-shrink-0" />
            <span>{fmtShort(t.startDate)} — {fmtShort(t.endDate)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <MapPin className="h-3.5 w-3.5 text-yellow-400 flex-shrink-0" />
            <span className="truncate">{t.venue}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-slate-400">
              {players > 0 && (
                <>
                  <Users className="h-3.5 w-3.5 text-yellow-400 flex-shrink-0" />
                  {players} players
                </>
              )}
            </span>
            {t.entryFee ? (
              <span className="text-yellow-400 font-bold">₹{t.entryFee}</span>
            ) : (
              <span className="text-slate-600 font-bold">Free</span>
            )}
          </div>
        </div>

        {/* Deadline alert */}
        {regOpen && dl !== null && dl <= 5 && (
          <div className="mb-3 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
            <span className="text-[11px] text-red-400 font-semibold">
              {dl === 0 ? 'Closes today!' : `${dl} day${dl > 1 ? 's' : ''} left to register`}
            </span>
          </div>
        )}

        {/* CTAs */}
        <div className="flex gap-2 pt-3 border-t border-white/5">
          <Link href={`/tournament/${t.id}`} className="flex-1">
            <div className="text-center bg-white/5 hover:bg-white/10 rounded-xl py-2.5 text-xs font-bold text-slate-300 hover:text-white transition-all">
              View Details
            </div>
          </Link>
          {regOpen && (
            <Link href={`/tournament/${t.id}/register`}>
              <div className="bg-yellow-400 hover:bg-yellow-300 text-black rounded-xl px-4 py-2.5 text-xs font-black transition-colors whitespace-nowrap">
                Register →
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sportFilter, setSportFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'tournaments'), orderBy('createdAt', 'desc')));
      const all = snap.docs.map(d => ({
        id: d.id, ...d.data(),
        startDate: d.data().startDate?.toDate(),
        endDate: d.data().endDate?.toDate(),
        registrationDeadline: d.data().registrationDeadline?.toDate(),
        createdAt: d.data().createdAt?.toDate(),
        updatedAt: d.data().updatedAt?.toDate(),
      })) as Tournament[];

      const visible = all.filter(t => t.isPublic !== false);
      setTournaments(visible);

      // Load player counts from tournament aggregate (avoid legacy public registration scans)
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

  const sports = Array.from(new Set(tournaments.map(t => t.sport)));

  const filtered = tournaments.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      t.name.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.venue.toLowerCase().includes(q);
    const matchSport = sportFilter === 'all' || t.sport === sportFilter;
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchSport && matchStatus;
  });

  const liveOnes = filtered.filter(t => t.status === 'ongoing');
  const otherOnes = filtered.filter(t => t.status !== 'ongoing');

  const totalLive = tournaments.filter(t => t.status === 'ongoing').length;
  const totalUpcoming = tournaments.filter(t => t.status === 'upcoming').length;
  const totalPlayers = Object.values(playerCounts).reduce((a, b) => a + b, 0);

  if (loading) {
    return (
      <PublicLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400 text-sm tracking-widest uppercase">Loading Tournaments</p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16">

          {/* ── Hero ─────────────────────────────────────────────────── */}
          <div className="mb-10">
            <p className="text-xs text-yellow-400 font-bold uppercase tracking-widest mb-2">PBEL Sports Club</p>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white leading-none tracking-tight mb-4">
              Find Your<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-300">
                Tournament
              </span>
            </h1>
            <p className="text-slate-400 text-base max-w-xl mb-6">
              Compete. Connect. Conquer. Join our community sports tournaments and showcase your skills.
            </p>

            {/* Quick stats */}
            <div className="flex flex-wrap gap-3">
              {[
                { label: `${tournaments.length} Tournaments`, icon: Trophy },
                ...(totalLive > 0 ? [{ label: `${totalLive} Live Now`, icon: Flame, highlight: true }] : []),
                { label: `${totalUpcoming} Upcoming`, icon: Calendar },
                { label: `${totalPlayers}+ Players`, icon: Users },
              ].map(s => (
                <span
                  key={s.label}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${
                    (s as {highlight?: boolean}).highlight
                      ? 'bg-green-500/20 border-green-500/40 text-green-300'
                      : 'bg-white/5 border-white/10 text-slate-300'
                  }`}
                >
                  <s.icon className="h-3.5 w-3.5" />
                  {s.label}
                </span>
              ))}
            </div>
          </div>

          {/* ── Filters ───────────────────────────────────────────────── */}
          <div className="bg-black/30 backdrop-blur-md rounded-2xl border border-white/5 p-4 mb-8 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search tournaments, venues…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-yellow-400/50 focus:ring-0 rounded-xl h-10"
              />
            </div>

            {/* Sport pills */}
            {sports.length > 0 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
                {['all', ...sports].map(s => (
                  <button
                    key={s}
                    onClick={() => setSportFilter(s)}
                    className={`flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-full transition-all ${
                      sportFilter === s
                        ? 'bg-yellow-400 text-black shadow-md shadow-yellow-400/30'
                        : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/5'
                    }`}
                  >
                    {s === 'all' ? '🏆 All Sports' : `${(SPORT_CFG[s] ?? SPORT_DEFAULT).emoji} ${s.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}`}
                  </button>
                ))}
              </div>
            )}

            {/* Status pills */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
              {(['all', 'ongoing', 'upcoming', 'completed', 'cancelled'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`flex-shrink-0 text-xs font-bold px-3.5 py-1.5 rounded-full transition-all ${
                    statusFilter === s
                      ? 'bg-white/15 text-white border border-white/20'
                      : 'bg-white/5 text-slate-500 hover:text-slate-300 border border-white/5'
                  }`}
                >
                  {s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* ── Live section ─────────────────────────────────────────── */}
          {liveOnes.length > 0 && statusFilter !== 'upcoming' && statusFilter !== 'completed' && statusFilter !== 'cancelled' && (
            <section className="mb-10">
              <h2 className="text-xs uppercase tracking-widest text-green-400 font-black mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Live Now
              </h2>
              <div className={`grid gap-4 ${liveOnes.length === 1 ? 'grid-cols-1 max-w-2xl' : 'sm:grid-cols-2'}`}>
                {liveOnes.map(t => (
                  <FeaturedCard key={t.id} t={t} players={playerCounts[t.id] ?? 0} />
                ))}
              </div>
            </section>
          )}

          {/* ── Grid ─────────────────────────────────────────────────── */}
          {otherOnes.length > 0 && (
            <section>
              {liveOnes.length > 0 && statusFilter === 'all' && (
                <h2 className="text-xs uppercase tracking-widest text-slate-500 font-black mb-4">All Tournaments</h2>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {otherOnes.map(t => (
                  <TournamentCard key={t.id} t={t} players={playerCounts[t.id] ?? 0} />
                ))}
              </div>
            </section>
          )}

          {/* ── Empty state ───────────────────────────────────────────── */}
          {filtered.length === 0 && (
            <div className="text-center py-24">
              <div className="text-6xl mb-4">🏆</div>
              <h3 className="text-xl font-black text-white mb-2">No tournaments found</h3>
              <p className="text-slate-500 text-sm">
                {search || sportFilter !== 'all' || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Check back soon for new tournaments'}
              </p>
              {(search || sportFilter !== 'all' || statusFilter !== 'all') && (
                <button
                  onClick={() => { setSearch(''); setSportFilter('all'); setStatusFilter('all'); }}
                  className="mt-4 text-xs text-yellow-400 hover:text-yellow-300 underline underline-offset-2"
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
