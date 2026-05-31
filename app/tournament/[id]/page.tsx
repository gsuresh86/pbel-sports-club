'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PublicLayout } from '@/components/PublicLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tournament, Match, Registration, Team, Pool } from '@/types';
import {
  Calendar, MapPin, Users, Trophy, Clock, Target,
  Shield, Users2, ScrollText, Zap, ChevronRight,
  Flame, Star, Activity,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';

export default function TournamentDetailPage() {
  const params = useParams();
  const tournamentId = params.id as string;
  const { user } = useAuth();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [participants, setParticipants] = useState<Registration[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'matches' | 'teams' | 'pools'>('overview');

  useEffect(() => {
    if (tournamentId) {
      loadTournament();
      loadMatches();
      loadParticipants();
      loadTeams();
      loadPools();
    }
  }, [tournamentId]);

  const loadTournament = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'tournaments', tournamentId));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTournament({
          id: docSnap.id, ...data,
          startDate: data.startDate?.toDate(),
          endDate: data.endDate?.toDate(),
          registrationDeadline: data.registrationDeadline?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as Tournament);
      }
    } catch (e) { console.error(e); }
  };

  const loadMatches = async () => {
    try {
      const q = query(collection(db, 'matches'), where('tournamentId', '==', tournamentId), orderBy('scheduledTime', 'asc'));
      const snap = await getDocs(q);
      setMatches(snap.docs.map(d => ({
        id: d.id, ...d.data(),
        scheduledTime: d.data().scheduledTime?.toDate(),
        actualStartTime: d.data().actualStartTime?.toDate(),
        actualEndTime: d.data().actualEndTime?.toDate(),
        updatedAt: d.data().updatedAt?.toDate(),
      })) as Match[]);
    } catch (e) { console.error(e); }
  };

  const loadParticipants = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'tournaments', tournamentId, 'registrations'), orderBy('registeredAt', 'desc')));
      setParticipants(snap.docs.map(d => ({
        id: d.id, ...d.data(),
        registeredAt: d.data().registeredAt?.toDate(),
        approvedAt: d.data().approvedAt?.toDate(),
      })) as Registration[]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadTeams = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'tournaments', tournamentId, 'teams'), orderBy('createdAt', 'desc')));
      setTeams(snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate(), updatedAt: d.data().updatedAt?.toDate() })) as Team[]);
    } catch (e) { console.error(e); }
  };

  const loadPools = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'tournaments', tournamentId, 'pools'), orderBy('createdAt', 'desc')));
      setPools(snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate(), updatedAt: d.data().updatedAt?.toDate() })) as Pool[]);
    } catch (e) { console.error(e); }
  };

  const getSportBanner = (sport: string) => {
    switch (sport) {
      case 'badminton': return 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1600&h=600&q=80';
      case 'table-tennis': return 'https://images.unsplash.com/photo-1534158914592-062992fbe900?auto=format&fit=crop&w=1600&h=600&q=80';
      case 'volleyball': return 'https://images.unsplash.com/photo-1612872087720-b8768760e99a?auto=format&fit=crop&w=1600&h=600&q=80';
      default: return 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1600&h=600&q=80';
    }
  };

  const getSportEmoji = (sport: string) => {
    switch (sport) {
      case 'badminton': return '🏸';
      case 'table-tennis': return '🏓';
      case 'volleyball': return '🏐';
      default: return '🏆';
    }
  };

  const isRegistrationOpen = () =>
    !!tournament?.registrationOpen && new Date() <= new Date(tournament.registrationDeadline);

  const statusConfig = {
    upcoming: { label: 'Upcoming', bg: 'bg-blue-500', dot: 'bg-blue-400' },
    ongoing:  { label: 'Live Now', bg: 'bg-green-500', dot: 'bg-green-300' },
    completed:{ label: 'Completed', bg: 'bg-gray-500', dot: 'bg-gray-400' },
    cancelled:{ label: 'Cancelled', bg: 'bg-red-500', dot: 'bg-red-400' },
  };

  const fmt = (d: Date) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtTime = (d: Date) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Trophy },
    { id: 'matches',  label: `Fixtures (${matches.length})`, icon: Activity },
    { id: 'teams',   label: `Teams (${teams.length})`, icon: Shield },
    { id: 'pools',   label: `Pools (${pools.length})`, icon: Users2 },
  ] as const;

  const liveMatches = matches.filter(m => m.status === 'live');
  const scheduledMatches = matches.filter(m => m.status === 'scheduled');
  const completedMatches = matches.filter(m => m.status === 'completed');

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <PublicLayout>
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400 text-sm tracking-widest uppercase">Loading Tournament</p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  if (!tournament) {
    return (
      <PublicLayout>
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="text-center">
            <p className="text-5xl mb-4">🏆</p>
            <h1 className="text-2xl font-bold text-white mb-2">Tournament Not Found</h1>
            <Link href="/tournament"><Button variant="outline" className="border-white/20 text-white">← All Tournaments</Button></Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const sc = statusConfig[tournament.status as keyof typeof statusConfig] ?? statusConfig.upcoming;
  const bannerUrl = tournament.banner || getSportBanner(tournament.sport);

  return (
    <PublicLayout>
      <div className="bg-slate-950 min-h-screen">

        {/* ── HERO ─────────────────────────────────────────────────── */}
        <div className="relative h-[70vh] min-h-[480px] overflow-hidden">
          {/* Background image */}
          <Image src={bannerUrl} alt={tournament.name} fill className="object-cover object-center scale-105" priority />
          {/* Heavy gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/50 to-slate-950" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-transparent to-slate-950/40" />

          {/* Content */}
          <div className="relative h-full flex flex-col justify-end pb-12 px-6 max-w-7xl mx-auto">
            {/* Status pill */}
            <div className="flex items-center gap-2 mb-4">
              <span className={`inline-flex items-center gap-1.5 ${sc.bg} text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest`}>
                {tournament.status === 'ongoing' && <span className={`w-1.5 h-1.5 rounded-full ${sc.dot} animate-pulse`} />}
                {sc.label}
              </span>
              {isRegistrationOpen() && (
                <span className="inline-flex items-center gap-1 bg-yellow-400 text-black text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                  <Zap className="h-3 w-3" /> Registration Open
                </span>
              )}
            </div>

            {/* Sport emoji + Title */}
            <div className="flex items-center gap-3 mb-2">
              <span className="text-5xl drop-shadow-lg">{getSportEmoji(tournament.sport)}</span>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white leading-none tracking-tight drop-shadow-xl">
                {tournament.name}
              </h1>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-3 text-slate-300">
              <span className="flex items-center gap-1.5 text-sm">
                <Calendar className="h-4 w-4 text-yellow-400 flex-shrink-0" />
                {fmt(tournament.startDate)} — {fmt(tournament.endDate)}
              </span>
              <span className="flex items-center gap-1.5 text-sm">
                <MapPin className="h-4 w-4 text-yellow-400 flex-shrink-0" />
                {tournament.venue}
              </span>
              <span className="flex items-center gap-1.5 text-sm capitalize">
                <Trophy className="h-4 w-4 text-yellow-400 flex-shrink-0" />
                {tournament.sport} · {tournament.tournamentType || 'individual'}
              </span>
            </div>

            {/* CTA buttons */}
            <div className="flex flex-wrap gap-3 mt-6">
              {isRegistrationOpen() && (
                <Link href={`/tournament/${tournamentId}/register`}>
                  <Button className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold px-6 h-11 rounded-full text-sm shadow-lg shadow-yellow-400/30 transition-all hover:scale-105">
                    Register Now <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              )}
              {tournament.rules && (
                <Link href={`/tournament/${tournamentId}/rules`}>
                  <Button variant="outline" className="border-white/30 text-white hover:bg-white/10 h-11 rounded-full text-sm px-6">
                    <ScrollText className="h-4 w-4 mr-2" /> Rules
                  </Button>
                </Link>
              )}
              {liveMatches.length > 0 && (
                <Link href={`/tournament/${tournamentId}/live/${liveMatches[0].id}`}>
                  <Button className="bg-red-600 hover:bg-red-500 text-white font-bold h-11 rounded-full px-6 text-sm animate-pulse">
                    <Flame className="h-4 w-4 mr-2" /> Watch Live
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* ── STATS BAR ──────────────────────────────────────────── */}
        <div className="bg-slate-900 border-y border-white/5">
          <div className="max-w-7xl mx-auto px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Players', value: participants.length, icon: Users, color: 'text-blue-400' },
              { label: 'Teams', value: teams.length, icon: Shield, color: 'text-purple-400' },
              { label: 'Matches', value: matches.length, icon: Activity, color: 'text-yellow-400' },
              { label: 'Pools', value: pools.length, icon: Users2, color: 'text-emerald-400' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-white/5 ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xl font-black text-white tabular-nums">{s.value}</p>
                  <p className="text-xs text-slate-400 uppercase tracking-widest">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── LIVE TICKER (only when live matches exist) ─────────── */}
        {liveMatches.length > 0 && (
          <div className="bg-red-600/90 border-b border-red-500">
            <div className="max-w-7xl mx-auto px-6 py-2 flex items-center gap-3 overflow-x-auto">
              <span className="flex items-center gap-1.5 text-xs font-black text-white uppercase tracking-widest flex-shrink-0">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> Live
              </span>
              {liveMatches.map(m => (
                <Link key={m.id} href={`/tournament/${tournamentId}/live/${m.id}`}
                  className="flex-shrink-0 text-xs text-white/90 hover:text-white font-medium">
                  {m.player1Name} vs {m.player2Name}
                  {m.sets?.length ? ` · ${m.sets.map(s => `${s.player1Score}-${s.player2Score}`).join(', ')}` : ''}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── TABS ───────────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur border-b border-white/10">
          <div className="max-w-7xl mx-auto px-6 flex gap-1 overflow-x-auto scrollbar-hide">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-1.5 px-4 py-4 text-sm font-semibold whitespace-nowrap border-b-2 transition-all ${
                  activeTab === tab.id
                    ? 'border-yellow-400 text-yellow-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── CONTENT ────────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

          {/* OVERVIEW ─────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Info cards row */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Key Info */}
                <div className="col-span-full lg:col-span-1 bg-slate-900 rounded-2xl p-6 border border-white/5">
                  <h3 className="text-xs uppercase tracking-widest text-yellow-400 font-bold mb-4">Tournament Info</h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Format', value: (tournament.tournamentType || 'individual').replace('-', ' ') },
                      { label: 'Categories', value: tournament.categories?.length ?? 0, suffix: ' categories' },
                      { label: 'Deadline', value: fmt(tournament.registrationDeadline) },
                      ...(tournament.entryFee ? [{ label: 'Entry Fee', value: `₹${tournament.entryFee}` }] : []),
                      ...(tournament.prizePool ? [{ label: 'Prize Pool', value: `₹${tournament.prizePool}` }] : []),
                    ].map(row => (
                      <div key={row.label} className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                        <span className="text-slate-400">{row.label}</span>
                        <span className="text-white font-semibold capitalize">{row.value}{(row as {suffix?: string}).suffix ?? ''}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Categories pill grid */}
                <div className="col-span-full lg:col-span-2 bg-slate-900 rounded-2xl p-6 border border-white/5">
                  <h3 className="text-xs uppercase tracking-widest text-yellow-400 font-bold mb-4">Categories</h3>
                  <div className="flex flex-wrap gap-2">
                    {tournament.categories?.map(cat => (
                      <span key={cat} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm text-white capitalize transition-colors">
                        {cat.replace(/-/g, ' ')}
                      </span>
                    ))}
                  </div>

                  {/* Match summary bar */}
                  {matches.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-white/5">
                      <h3 className="text-xs uppercase tracking-widest text-yellow-400 font-bold mb-3">Match Progress</h3>
                      <div className="flex gap-4 text-sm flex-wrap">
                        {[
                          { label: 'Completed', value: completedMatches.length, color: 'text-green-400' },
                          { label: 'Live', value: liveMatches.length, color: 'text-red-400' },
                          { label: 'Upcoming', value: scheduledMatches.length, color: 'text-blue-400' },
                        ].map(s => (
                          <div key={s.label} className="flex items-center gap-2">
                            <span className={`text-2xl font-black tabular-nums ${s.color}`}>{s.value}</span>
                            <span className="text-slate-400">{s.label}</span>
                          </div>
                        ))}
                      </div>
                      {/* Progress bar */}
                      {matches.length > 0 && (
                        <div className="mt-3 h-2 bg-white/5 rounded-full overflow-hidden flex">
                          <div className="h-full bg-green-500 transition-all" style={{ width: `${(completedMatches.length / matches.length) * 100}%` }} />
                          <div className="h-full bg-red-500 transition-all" style={{ width: `${(liveMatches.length / matches.length) * 100}%` }} />
                          <div className="h-full bg-blue-500 transition-all" style={{ width: `${(scheduledMatches.length / matches.length) * 100}%` }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Upcoming fixtures preview */}
              {scheduledMatches.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Clock className="h-5 w-5 text-yellow-400" /> Upcoming Fixtures
                    </h3>
                    <button onClick={() => setActiveTab('matches')} className="text-xs text-yellow-400 hover:underline">View all →</button>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {scheduledMatches.slice(0, 6).map(m => (
                      <MatchCard key={m.id} match={m} tournamentId={tournamentId} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MATCHES ──────────────────────────────────────────── */}
          {activeTab === 'matches' && (
            <div className="space-y-6">
              {/* Live */}
              {liveMatches.length > 0 && (
                <section>
                  <h3 className="text-xs uppercase tracking-widest text-red-400 font-bold mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" /> Live Matches
                  </h3>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {liveMatches.map(m => <MatchCard key={m.id} match={m} tournamentId={tournamentId} />)}
                  </div>
                </section>
              )}
              {/* Upcoming */}
              {scheduledMatches.length > 0 && (
                <section>
                  <h3 className="text-xs uppercase tracking-widest text-blue-400 font-bold mb-3">Upcoming</h3>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {scheduledMatches.map(m => <MatchCard key={m.id} match={m} tournamentId={tournamentId} />)}
                  </div>
                </section>
              )}
              {/* Completed */}
              {completedMatches.length > 0 && (
                <section>
                  <h3 className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-3">Results</h3>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {completedMatches.map(m => <MatchCard key={m.id} match={m} tournamentId={tournamentId} />)}
                  </div>
                </section>
              )}
              {matches.length === 0 && (
                <div className="text-center py-24">
                  <Activity className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">No matches scheduled yet</p>
                </div>
              )}
            </div>
          )}

          {/* TEAMS ────────────────────────────────────────────── */}
          {activeTab === 'teams' && (
            <div>
              {teams.length === 0 ? (
                <div className="text-center py-24">
                  <Shield className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">Teams will appear once they are created</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {teams.map(team => {
                    const teamPlayers = team.players.map(id => participants.find(p => p.id === id)).filter(Boolean) as Registration[];
                    const captain = participants.find(p => p.id === team.captainId);
                    return (
                      <div key={team.id} className="bg-slate-900 rounded-2xl border border-white/5 overflow-hidden hover:border-yellow-400/30 transition-colors group">
                        {/* Team header */}
                        <div className="bg-gradient-to-r from-yellow-400/20 to-amber-500/10 px-5 py-4 border-b border-white/5">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-black text-white text-lg">{team.name}</h3>
                              <p className="text-xs text-slate-400 capitalize mt-0.5">{team.category.replace(/-/g, ' ')}</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-yellow-400/20 flex items-center justify-center">
                              <Shield className="h-5 w-5 text-yellow-400" />
                            </div>
                          </div>
                        </div>
                        {/* Players */}
                        <div className="p-4 space-y-2">
                          {teamPlayers.map((player, i) => {
                            const initials = player.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
                            const isCaptain = player.id === team.captainId;
                            return (
                              <div key={player.id} className="flex items-center gap-3 py-1">
                                {player.profilePhotoUrl ? (
                                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-white/10">
                                    <Image src={player.profilePhotoUrl} alt={player.name} width={32} height={32} className="object-cover w-full h-full" />
                                  </div>
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                                    {initials}
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-white font-medium truncate">{player.name}</p>
                                  {(player.tower || player.flatNumber) && (
                                    <p className="text-[10px] text-slate-500">{player.tower} {player.flatNumber}</p>
                                  )}
                                </div>
                                {isCaptain && (
                                  <span className="flex-shrink-0 flex items-center gap-0.5 text-[10px] text-yellow-400 font-bold uppercase">
                                    <Star className="h-2.5 w-2.5 fill-yellow-400" /> C
                                  </span>
                                )}
                              </div>
                            );
                          })}
                          {teamPlayers.length === 0 && (
                            <p className="text-xs text-slate-500 italic py-2">No players assigned yet</p>
                          )}
                        </div>
                        <div className="px-4 pb-3 flex items-center justify-between">
                          <span className="text-xs text-slate-500">{teamPlayers.length} players</span>
                          {captain && <span className="text-xs text-yellow-400">Captain: {captain.name.split(' ')[0]}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* POOLS ────────────────────────────────────────────── */}
          {activeTab === 'pools' && (
            <div className="space-y-6">
              {pools.length === 0 ? (
                <div className="text-center py-24">
                  <Users2 className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">Pools will appear once they are created</p>
                </div>
              ) : (
                pools.map(pool => {
                  const isKidsCategory = pool.category.includes('kids-team-u13') || pool.category.includes('kids-team-u18');
                  const isTeamCategory = (pool.category.includes('team') || pool.category.includes('doubles')) && !isKidsCategory;
                  return (
                    <div key={pool.id} className="bg-slate-900 rounded-2xl border border-white/5 overflow-hidden">
                      <div className="bg-gradient-to-r from-purple-500/20 to-indigo-500/10 px-6 py-4 border-b border-white/5 flex items-center justify-between">
                        <div>
                          <h3 className="font-black text-white text-lg">{pool.name}</h3>
                          <p className="text-xs text-slate-400 capitalize mt-0.5">
                            {pool.category.replace(/-/g, ' ')} · max {pool.maxTeams} {isTeamCategory ? 'teams' : 'players'}
                          </p>
                        </div>
                        <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full ${pool.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                          {pool.status}
                        </span>
                      </div>
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {pool.teams.map((itemId, idx) => {
                          if (isTeamCategory) {
                            const team = teams.find(t => t.id === itemId);
                            return (
                              <div key={idx} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2.5">
                                <span className="w-6 h-6 rounded-full bg-purple-500/30 text-purple-300 text-xs font-bold flex items-center justify-center flex-shrink-0">{idx + 1}</span>
                                <div>
                                  <p className="text-sm font-semibold text-white">{team?.name ?? `Team ${idx + 1}`}</p>
                                  {team && <p className="text-[10px] text-slate-400">{team.players.length} players</p>}
                                </div>
                              </div>
                            );
                          } else {
                            const player = participants.find(p => p.id === itemId);
                            const initials = player?.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() ?? '?';
                            return (
                              <div key={idx} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2.5">
                                {player?.profilePhotoUrl ? (
                                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-white/10">
                                    <Image src={player.profilePhotoUrl} alt={player.name} width={32} height={32} className="object-cover" />
                                  </div>
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">{initials}</div>
                                )}
                                <div>
                                  <p className="text-sm font-semibold text-white">{player?.name ?? `Player ${idx + 1}`}</p>
                                  {player && <p className="text-[10px] text-slate-400 capitalize">{player.expertiseLevel}</p>}
                                </div>
                              </div>
                            );
                          }
                        })}
                        {pool.teams.length === 0 && (
                          <p className="text-sm text-slate-500 italic col-span-full py-2 px-2">No {isTeamCategory ? 'teams' : 'players'} assigned yet</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* ── FOOTER STRIP ────────────────────────────────────── */}
        <div className="border-t border-white/5 mt-12 py-8 px-6 text-center">
          <p className="text-slate-500 text-xs">PBEL Sports Club · {tournament.name}</p>
        </div>
      </div>
    </PublicLayout>
  );
}

// ── Match card sub-component ──────────────────────────────────────────────
function MatchCard({ match, tournamentId }: { match: Match; tournamentId: string }) {
  const isLive = match.status === 'live';
  const isDone = match.status === 'completed';

  return (
    <div className={`relative rounded-2xl border overflow-hidden transition-all hover:scale-[1.01] ${
      isLive ? 'border-red-500/50 bg-gradient-to-b from-red-950/40 to-slate-900' : 'border-white/5 bg-slate-900 hover:border-white/10'
    }`}>
      {isLive && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500 via-orange-400 to-red-500 animate-pulse" />
      )}
      <div className="p-4">
        {/* Round + court */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{match.round}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
            isLive ? 'bg-red-500 text-white animate-pulse' :
            isDone ? 'bg-slate-700 text-slate-300' :
            'bg-blue-500/20 text-blue-400'
          }`}>
            {isLive ? '● Live' : isDone ? 'FT' : 'Soon'}
          </span>
        </div>

        {/* Players VS row */}
        <div className="flex items-center gap-2">
          <div className="flex-1 text-right">
            <p className="font-bold text-white text-sm leading-tight">{match.player1Name}</p>
            {isDone && <p className={`text-2xl font-black tabular-nums mt-1 ${match.winner === match.player1Name ? 'text-yellow-400' : 'text-slate-500'}`}>{match.player1Score ?? '-'}</p>}
            {isLive && match.sets?.length ? <p className="text-lg font-black text-white tabular-nums">{match.sets.at(-1)?.player1Score ?? 0}</p> : null}
          </div>

          <div className="flex-shrink-0 w-8 text-center">
            <span className="text-xs font-black text-slate-500">VS</span>
          </div>

          <div className="flex-1 text-left">
            <p className="font-bold text-white text-sm leading-tight">{match.player2Name}</p>
            {isDone && <p className={`text-2xl font-black tabular-nums mt-1 ${match.winner === match.player2Name ? 'text-yellow-400' : 'text-slate-500'}`}>{match.player2Score ?? '-'}</p>}
            {isLive && match.sets?.length ? <p className="text-lg font-black text-white tabular-nums">{match.sets.at(-1)?.player2Score ?? 0}</p> : null}
          </div>
        </div>

        {/* Winner label */}
        {isDone && match.winner && (
          <div className="mt-2 text-center">
            <span className="inline-flex items-center gap-1 text-[10px] text-yellow-400 font-bold">
              <Star className="h-2.5 w-2.5 fill-yellow-400" /> {match.winner}
            </span>
          </div>
        )}

        {/* Date + venue */}
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            {new Date(match.scheduledTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            {' '}{new Date(match.scheduledTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {match.court && <span className="flex items-center gap-1"><MapPin className="h-2.5 w-2.5" />{match.court}</span>}
        </div>

        {/* Live action button */}
        {isLive && (
          <Link href={`/tournament/${tournamentId}/live/${match.id}`} className="block mt-3">
            <Button className="w-full h-8 text-xs bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl">
              <Target className="h-3.5 w-3.5 mr-1.5" /> Live Score
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
