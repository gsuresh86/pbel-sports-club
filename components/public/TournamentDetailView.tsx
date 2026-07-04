'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { tournamentMatchesOrderedQuery } from '@/lib/firestore-paths';
import { Button } from '@/components/ui/button';
import { Tournament, Match, Registration, Team, Pool, CategoryType } from '@/types';
import {
  previewKnockoutRound,
  KNOCKOUT_ROUND_LABELS,
  isKnockoutRound,
  getMatchWinner,
  getMatchLoser,
  extractBracketSrcMatchNo,
  findBracketSourceMatch,
  bracketMatchNumbersMatch,
} from '@/lib/knockoutBracket';
import {
  isIplPlayoffRound,
  isIplPlayoffSpecificRound,
  IPL_PLAYOFF_ROUND_LABELS,
  filterIplRoundMatches,
  normalizeIplPlayoffRound,
} from '@/lib/iplPlayoff';
import { getMatchSideDisplay, getInitials, firstName, toTitleCase, formatMatchSideLabel, type MatchSideDisplay } from '@/lib/utils';
import {
  Calendar, MapPin, Users, Trophy, Clock, Target,
  Shield, Users2, ScrollText, ChevronRight, ChevronDown,
  Flame, Star, Activity, ArrowLeft, GitBranch,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import TournamentStandingsView from '@/components/public/TournamentStandingsView';
import { TeamLogo } from '@/components/TeamLogo';
import { formatCategoryLabel } from '@/lib/categoryLabels';
import { scoreboardPath } from '@/lib/tournament-banner';
import { isRubberMatch, isTeamTieMatch, rubberTypeLabel } from '@/lib/teamMatchRubbers';
import { tournamentTabPath, type TournamentPublicTab } from '@/lib/tournament-public-tabs';

export default function TournamentDetailView({ activeTab }: { activeTab: TournamentPublicTab }) {
  const params = useParams();
  const tournamentId = params.id as string;
  const { user } = useAuth();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [participants, setParticipants] = useState<Registration[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamsCatFilter, setTeamsCatFilter] = useState<string>('all');
  const [matchRoundFilter, setMatchRoundFilter] = useState<string>('all');
  const [matchCategoryFilter, setMatchCategoryFilter] = useState<string>('all');
  const [matchSearch, setMatchSearch] = useState('');
  const [matchDateFilter, setMatchDateFilter] = useState('');
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);
  const [knockoutCat, setKnockoutCat] = useState('');

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
      const snap = await getDocs(tournamentMatchesOrderedQuery(tournamentId));
      setMatches((snap.docs.map(d => ({
        id: d.id, ...d.data(),
        scheduledTime: d.data().scheduledTime?.toDate(),
        actualStartTime: d.data().actualStartTime?.toDate(),
        actualEndTime: d.data().actualEndTime?.toDate(),
        updatedAt: d.data().updatedAt?.toDate(),
      })) as Match[]));
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

  const fmt = (d: Date) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtTime = (d: Date) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  // Public fixtures show team ties and individual matches only — not rubber sub-matches
  const displayMatches = matches.filter(m => !isRubberMatch(m));
  const fixtureMatches = displayMatches.filter(m => m.status === 'live' || m.status === 'scheduled');
  const resultMatches = displayMatches.filter(m => m.status === 'completed');

  const teamIds = new Set(teams.map(t => t.id));
  const rubbersByParent = matches.filter(isRubberMatch).reduce((map, rubber) => {
    const parentId = rubber.parentMatchId!;
    const list = map.get(parentId) ?? [];
    list.push(rubber);
    map.set(parentId, list);
    return map;
  }, new Map<string, Match[]>());
  for (const list of rubbersByParent.values()) {
    list.sort((a, b) => (a.rubberNumber ?? 0) - (b.rubberNumber ?? 0));
  }

  const KNOCKOUT_ROUND_SET = new Set(['QF', 'SF', 'F', 'TP']);
  const poolNameToCategory = new Map(pools.map(p => [p.name, p.category]));

  const getMatchCategory = (m: Match): string | undefined => {
    if (m.category) return m.category;
    const fromPool = poolNameToCategory.get(m.round);
    if (fromPool) return fromPool;
    const team1 = teams.find(t => t.id === m.player1Id);
    if (team1) return team1.category;
    const team2 = teams.find(t => t.id === m.player2Id);
    if (team2) return team2.category;
    const reg1 = participants.find(p => p.id === m.player1Id);
    if (reg1?.selectedCategory) return reg1.selectedCategory;
    const reg2 = participants.find(p => p.id === m.player2Id);
    if (reg2?.selectedCategory) return reg2.selectedCategory;
    return undefined;
  };

  const knockoutCats = [
    ...new Set(
      matches
        .filter(m => KNOCKOUT_ROUND_SET.has(m.round) || isIplPlayoffSpecificRound(m.round))
        .map(getMatchCategory)
        .filter((c): c is string => !!c),
    ),
  ].filter(Boolean);
  const activeKnockoutCat = (knockoutCat && knockoutCats.includes(knockoutCat))
    ? knockoutCat
    : knockoutCats[0] ?? '';

  const tabs = [
    { id: 'matches',  label: `Fixtures (${fixtureMatches.length})`, icon: Activity },
    { id: 'results',  label: `Results (${resultMatches.length})`, icon: Target },
    { id: 'pools',   label: `Points (${pools.length})`, icon: Users2 },
    { id: 'knockout', label: 'Knockout', icon: GitBranch },
    { id: 'overview', label: 'Overview', icon: Trophy },
    { id: 'teams',   label: `Teams (${teams.length})`, icon: Shield },
  ] as const;

  const matchDistinctRounds = Array.from(new Set(displayMatches.map(m => m.round))).sort();

  const matchDistinctCategories = Array.from(
    new Set(displayMatches.map(getMatchCategory).filter((c): c is string => !!c))
  ).sort();

  // Registration lookup so doubles matches can show both partners + avatars
  const regById = new Map(participants.map(p => [p.id, p]));
  const teamsById = new Map(teams.map(t => [t.id, { logoUrl: t.logoUrl, name: t.name }]));

  // Unfiltered — used by overview tab
  const allScheduledMatches = displayMatches.filter(m => m.status === 'scheduled');

  const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
  const toISTDate = (d: Date) => new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

  const applyMatchFilters = (list: Match[]) => list.filter(m => {
    if (matchRoundFilter !== 'all' && m.round !== matchRoundFilter) return false;
    if (matchCategoryFilter !== 'all' && getMatchCategory(m) !== matchCategoryFilter) return false;
    if (matchSearch) {
      const q = matchSearch.toLowerCase();
      if (![m.player1Name, m.player2Name, m.round].some(s => s.toLowerCase().includes(q))) return false;
    }
    if (matchDateFilter && toISTDate(new Date(m.scheduledTime)) !== matchDateFilter) return false;
    return true;
  });

  const fixturesFiltered = applyMatchFilters(fixtureMatches);
  const resultsFiltered = applyMatchFilters(resultMatches);

  const liveMatches = displayMatches.filter(m => m.status === 'live');
  const scheduledMatches = fixturesFiltered.filter(m => m.status === 'scheduled');
  const liveFixtures = fixturesFiltered.filter(m => m.status === 'live');

  const clearMatchFilters = () => {
    setMatchRoundFilter('all');
    setMatchCategoryFilter('all');
    setMatchSearch('');
    setMatchDateFilter('');
  };

  const hasActiveMatchFilters = !!(
    matchRoundFilter !== 'all' || matchCategoryFilter !== 'all' || matchSearch || matchDateFilter
  );

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm tracking-widest uppercase">Loading Tournament</p>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-5xl mb-4">🏆</p>
          <h1 className="text-2xl font-bold text-white mb-2">Tournament Not Found</h1>
          <Link href="/tournament"><Button variant="outline" className="border-white/20 text-white">← All Tournaments</Button></Link>
        </div>
      </div>
    );
  }

  const bannerUrl = tournament.banner || getSportBanner(tournament.sport);

  return (
    <div className="bg-slate-950 min-h-screen">

      {/* ── CUSTOM TOP BAR ─────────────────────────────────────── */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-12 flex items-center gap-4">
          <Link href="/tournament" className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs transition-colors flex-shrink-0 group">
            <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span className="hidden sm:inline">Tournaments</span>
          </Link>
          <div className="flex-1 text-center">
            <span className="text-sm font-bold text-white tracking-tight truncate">{tournament.name}</span>
          </div>
          <div className="w-20 flex-shrink-0" />
        </div>
      </div>

      {/* ── HERO + STATS + TABS — all on the banner ───────────── */}
        <div className="relative">
          {/* Image container — overflow-hidden only here for scale effect */}
          <div className="absolute inset-0 overflow-hidden">
            <Image src={bannerUrl} alt={tournament.name} fill className="object-cover object-center scale-105" priority />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/55 via-slate-950/45 to-slate-950" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-transparent to-slate-950/40" />
          </div>

          {/* All overlay content — flows naturally pushing the div taller */}
          <div className="relative z-10">
            {/* ── Title section ── */}
            <div className="max-w-7xl mx-auto px-6 pt-28 sm:pt-32 pb-10">
              {tournament.status === 'ongoing' && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-flex items-center gap-1.5 bg-emerald-600/90 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-200" /> Live Now
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3 mb-2">
                <span className="text-5xl drop-shadow-lg">{getSportEmoji(tournament.sport)}</span>
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white leading-none tracking-tight drop-shadow-xl">
                  {tournament.name}
                </h1>
              </div>
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
                    <button className="inline-flex items-center gap-2 bg-transparent border border-white/30 text-white hover:bg-white/10 h-11 rounded-full text-sm px-6 transition-colors">
                      <ScrollText className="h-4 w-4" /> Rules
                    </button>
                  </Link>
                )}
                {liveMatches.length > 0 && (
                  <Link href={scoreboardPath(liveMatches[0].id, tournamentId)} target="_blank" rel="noopener noreferrer">
                    <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-11 rounded-full px-6 text-sm">
                      <Flame className="h-4 w-4 mr-2" /> Watch Live
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            {/* ── Stats bar — inside banner ── */}
            <div className="border-t border-white/10 bg-black/20 backdrop-blur-sm">
              <div className="max-w-7xl mx-auto px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Players', value: participants.length, icon: Users, color: 'text-blue-400' },
                  { label: 'Teams', value: teams.length, icon: Shield, color: 'text-purple-400' },
                  { label: 'Matches', value: displayMatches.length, icon: Activity, color: 'text-yellow-400' },
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

            {/* ── Live ticker ── */}
            {liveMatches.length > 0 && (
              <div className="bg-emerald-800/80 border-t border-emerald-600/40">
                <div className="max-w-7xl mx-auto px-6 py-2 flex items-center gap-3 overflow-x-auto">
                  <span className="flex items-center gap-1.5 text-xs font-black text-emerald-100 uppercase tracking-widest flex-shrink-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-300" /> Live
                  </span>
                  {liveMatches.map(m => (
                    <Link key={m.id} href={scoreboardPath(m.id, tournamentId)} target="_blank" rel="noopener noreferrer"
                      className="flex-shrink-0 text-xs text-white/90 hover:text-white font-medium">
                      {m.player1Name} vs {m.player2Name}
                      {m.sets?.length ? ` · ${m.sets.map(s => `${s.player1Score}-${s.player2Score}`).join(', ')}` : ''}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* ── Tabs — inside banner, sticky ── */}
            <div className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-md border-t border-b border-white/10">
              <div className="max-w-7xl mx-auto px-6 flex gap-1 overflow-x-auto scrollbar-hide">
                {tabs.map(tab => (
                  <Link
                    key={tab.id}
                    href={tournamentTabPath(tournamentId, tab.id)}
                    className={`flex items-center gap-1.5 px-4 py-4 text-sm font-semibold whitespace-nowrap border-b-2 transition-all ${
                      activeTab === tab.id
                        ? 'border-yellow-400 text-yellow-400'
                        : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </Link>
                ))}
              </div>
            </div>
            {/* end tabs */}
          </div>
          {/* end relative z-10 */}
        </div>
        {/* end hero wrapper */}

        {/* ── CONTENT ────────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

          {/* OVERVIEW ─────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Categories — clickable cards linking to category pages */}
              <div className="bg-slate-900 rounded-2xl p-6 border border-white/5">
                  <h3 className="text-xs uppercase tracking-widest text-yellow-400 font-bold mb-4">Categories</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {tournament.categories?.map(cat => {
                      const catTeamCount = teams.filter(t => t.category === cat).length;
                      const catPlayerCount = participants.filter(p => p.selectedCategory === cat).length;
                      const catPoolCount = pools.filter(p => p.category === cat).length;
                      const isTCat = cat.includes('team') && !cat.includes('doubles') && !cat.includes('kids-team-u13') && !cat.includes('kids-team-u18') && !cat.includes('under-');
                      const parts: string[] = [];
                      if (isTCat) parts.push(`${catTeamCount} teams`);
                      if (catPoolCount > 0) parts.push(`${catPoolCount} pools`);
                      parts.push(`${catPlayerCount} players`);
                      return (
                        <Link key={cat} href={`/tournament/${tournamentId}/category/${cat}`}
                          className="group flex flex-col gap-1 bg-white/5 hover:bg-yellow-400/10 border border-white/10 hover:border-yellow-400/40 rounded-xl px-4 py-3 transition-all">
                          <span className="text-sm font-bold text-white capitalize group-hover:text-yellow-400 transition-colors leading-tight">
                            {cat.replace(/-/g, ' ')}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {parts.join(' · ')}
                          </span>
                        </Link>
                      );
                    })}
                  </div>

                  {/* Match summary bar */}
                  {displayMatches.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-white/5">
                      <h3 className="text-xs uppercase tracking-widest text-yellow-400 font-bold mb-3">Match Progress</h3>
                      <div className="flex gap-4 text-sm flex-wrap">
                        {[
                          { label: 'Completed', value: resultMatches.length, color: 'text-green-400' },
                          { label: 'Live', value: liveMatches.length, color: 'text-emerald-400' },
                          { label: 'Upcoming', value: allScheduledMatches.length, color: 'text-blue-400' },
                        ].map(s => (
                          <div key={s.label} className="flex items-center gap-2">
                            <span className={`text-2xl font-black tabular-nums ${s.color}`}>{s.value}</span>
                            <span className="text-slate-400">{s.label}</span>
                          </div>
                        ))}
                      </div>
                      {/* Progress bar */}
                      {displayMatches.length > 0 && (
                        <div className="mt-3 h-2 bg-white/5 rounded-full overflow-hidden flex">
                          <div className="h-full bg-green-500 transition-all" style={{ width: `${(displayMatches.filter(m => m.status === 'completed').length / displayMatches.length) * 100}%` }} />
                          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(displayMatches.filter(m => m.status === 'live').length / displayMatches.length) * 100}%` }} />
                          <div className="h-full bg-blue-500 transition-all" style={{ width: `${(allScheduledMatches.length / displayMatches.length) * 100}%` }} />
                        </div>
                      )}
                      {resultMatches.length > 0 && (
                        <Link
                          href={tournamentTabPath(tournamentId, 'results')}
                          className="mt-4 inline-block text-xs font-bold text-yellow-400 hover:text-yellow-300 transition-colors"
                        >
                          View all results →
                        </Link>
                      )}
                    </div>
                  )}
              </div>

              {pools.length > 0 && (
                <Link
                  href={`/tournament/${tournamentId}/standings`}
                  className="flex items-center justify-between bg-slate-900 hover:bg-slate-800/80 border border-white/5 hover:border-yellow-400/30 rounded-2xl px-6 py-5 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-yellow-400/10 flex items-center justify-center">
                      <Users2 className="h-5 w-5 text-yellow-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-yellow-400 transition-colors">View Standings</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{pools.length} pool{pools.length !== 1 ? 's' : ''} · Live points table</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-yellow-400 transition-colors" />
                </Link>
              )}

              {/* Upcoming fixtures preview */}
              {allScheduledMatches.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Clock className="h-5 w-5 text-yellow-400" /> Upcoming Fixtures
                    </h3>
                    <Link href={tournamentTabPath(tournamentId, 'matches')} className="text-xs text-yellow-400 hover:underline">View all →</Link>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {allScheduledMatches.slice(0, 6).map(m => (
                      <MatchCard key={m.id} match={m} tournamentId={tournamentId} regById={regById} teamsById={teamsById} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* FIXTURES ─────────────────────────────────────────── */}
          {activeTab === 'matches' && (
            <div className="space-y-6">
              {fixtureMatches.length > 0 && (
                <MatchFiltersBar
                  matchDistinctCategories={matchDistinctCategories}
                  matchDistinctRounds={matchDistinctRounds}
                  matchCategoryFilter={matchCategoryFilter}
                  matchRoundFilter={matchRoundFilter}
                  matchSearch={matchSearch}
                  matchDateFilter={matchDateFilter}
                  onCategoryChange={setMatchCategoryFilter}
                  onRoundChange={setMatchRoundFilter}
                  onSearchChange={setMatchSearch}
                  onDateChange={setMatchDateFilter}
                  onClear={clearMatchFilters}
                  hasActiveFilters={hasActiveMatchFilters}
                  shownCount={fixturesFiltered.length}
                  totalCount={fixtureMatches.length}
                />
              )}
              {liveFixtures.length > 0 && (
                <section>
                  <h3 className="text-xs uppercase tracking-widest text-emerald-400 font-bold mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" /> Live Matches
                  </h3>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {liveFixtures.map(m => <MatchCard key={m.id} match={m} tournamentId={tournamentId} regById={regById} teamsById={teamsById} />)}
                  </div>
                </section>
              )}
              {scheduledMatches.length > 0 && (
                <section>
                  <h3 className="text-xs uppercase tracking-widest text-blue-400 font-bold mb-3">Upcoming</h3>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {scheduledMatches.map(m => <MatchCard key={m.id} match={m} tournamentId={tournamentId} regById={regById} teamsById={teamsById} />)}
                  </div>
                </section>
              )}
              {fixturesFiltered.length === 0 && (
                <div className="text-center py-24">
                  <Activity className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                  {fixtureMatches.length === 0 ? (
                    <p className="text-slate-400">No upcoming fixtures yet</p>
                  ) : (
                    <p className="text-slate-400">No fixtures match your filters</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* RESULTS ────────────────────────────────────────────── */}
          {activeTab === 'results' && (
            <div className="space-y-6">
              {resultMatches.length > 0 && (
                <MatchFiltersBar
                  matchDistinctCategories={matchDistinctCategories}
                  matchDistinctRounds={matchDistinctRounds}
                  matchCategoryFilter={matchCategoryFilter}
                  matchRoundFilter={matchRoundFilter}
                  matchSearch={matchSearch}
                  matchDateFilter={matchDateFilter}
                  onCategoryChange={setMatchCategoryFilter}
                  onRoundChange={setMatchRoundFilter}
                  onSearchChange={setMatchSearch}
                  onDateChange={setMatchDateFilter}
                  onClear={clearMatchFilters}
                  hasActiveFilters={hasActiveMatchFilters}
                  shownCount={resultsFiltered.length}
                  totalCount={resultMatches.length}
                />
              )}
              {resultsFiltered.length > 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {resultsFiltered.map(m => (
                    <ResultMatchCard
                      key={m.id}
                      match={m}
                      tournamentId={tournamentId}
                      regById={regById}
                      teamsById={teamsById}
                      teamIds={teamIds}
                      rubbers={rubbersByParent.get(m.id) ?? []}
                      expanded={expandedResultId === m.id}
                      onToggle={() => setExpandedResultId(prev => (prev === m.id ? null : m.id))}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-24">
                  <Trophy className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                  {resultMatches.length === 0 ? (
                    <p className="text-slate-400">No completed matches yet</p>
                  ) : (
                    <p className="text-slate-400">No results match your filters</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TEAMS ────────────────────────────────────────────── */}
          {activeTab === 'teams' && (
            <div className="space-y-4">
              {teams.length > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    value={teamsCatFilter}
                    onChange={e => setTeamsCatFilter(e.target.value)}
                    className="bg-slate-800 border border-white/10 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-yellow-400/50"
                  >
                    <option value="all">All Categories</option>
                    {tournament.categories?.filter(cat => cat === 'mens-team' || cat === 'womens-team').map(cat => (
                      <option key={cat} value={cat}>{cat.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                    ))}
                  </select>
                  {teamsCatFilter !== 'all' && (
                    <button onClick={() => setTeamsCatFilter('all')} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Clear</button>
                  )}
                </div>
              )}
              {teams.length === 0 ? (
                <div className="text-center py-24">
                  <Shield className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">Teams will appear once they are created</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {teams
                    .filter(t => teamsCatFilter === 'all' || t.category === teamsCatFilter)
                    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
                    .map(team => {
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
                            <TeamLogo logoUrl={team.logoUrl} name={team.name} size={40} className="ring-2 ring-yellow-400/30" />
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
          {activeTab === 'pools' && tournament && (
            <TournamentStandingsView
              tournament={tournament}
              pools={pools}
              matches={matches}
              teams={teams}
              participants={participants}
              showFullPageLink
            />
          )}

          {/* KNOCKOUT ─────────────────────────────────────────── */}
          {activeTab === 'knockout' && (
            <div className="space-y-6">
              {knockoutCats.length === 0 ? (
                <div className="text-center py-24">
                  <GitBranch className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">No knockout stages yet</p>
                  <p className="text-slate-500 text-sm mt-1">Knockout fixtures will appear once the stage begins</p>
                </div>
              ) : (
                <>
                  {knockoutCats.length > 1 && (
                    <div className="flex flex-wrap gap-2">
                      {knockoutCats.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setKnockoutCat(cat)}
                          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                            activeKnockoutCat === cat
                              ? 'bg-yellow-400 text-black'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {formatCategoryLabel(cat)}
                        </button>
                      ))}
                    </div>
                  )}
                  {activeKnockoutCat && (
                    <KnockoutBracketView
                      category={activeKnockoutCat as CategoryType}
                      allMatches={matches}
                      displayMatches={displayMatches}
                      pools={pools}
                      teams={teams}
                      participants={participants}
                      tournament={tournament!}
                      tournamentId={tournamentId}
                      regById={regById}
                      teamsById={teamsById}
                    />
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ── FOOTER STRIP ────────────────────────────────────── */}
        <div className="border-t border-white/5 mt-12 py-8 px-6 text-center">
          <p className="text-slate-500 text-xs">PBEL Sports Club · {tournament.name}</p>
        </div>
    </div>
  );
}

// ── Edge-anchored player photo with fallback image + name tag ─────────────
const MATCH_CARD_BG_IMAGE = '/match-card-bg.png';

const MATCH_AVATAR_SIZE = 'h-[5.5rem] w-[5.5rem] sm:h-28 sm:w-28';
const TEAM_LOGO_SIZE = 'aspect-[3/4] w-[85%] max-w-[132px]';
const TEAM_LOGO_IMG = 'max-h-[5.5rem] sm:max-h-[6.25rem] max-w-[78%] object-contain';
/** Improves legibility of center labels on the textured match-card background */
const MATCH_CENTER_SHADOW = 'drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]';

function AvatarHalf({ name, photoUrl }: { name: string; photoUrl?: string }) {
  const [imgError, setImgError] = useState(false);
  const initials = getInitials(name) || '?';
  const showPhoto = !!photoUrl && !imgError;

  return (
    <div className="relative h-full w-1/2 overflow-hidden bg-slate-700/80">
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={name}
          onError={() => setImgError(true)}
          className="h-full w-full object-cover object-top"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm font-bold text-white">
          {initials}
        </div>
      )}
    </div>
  );
}

function MatchSideAvatar({ name, photoUrl }: { name: string; photoUrl?: string }) {
  const [imgError, setImgError] = useState(false);
  const initials = getInitials(name) || '?';
  const showPhoto = !!photoUrl && !imgError;

  return (
    <div className={`${MATCH_AVATAR_SIZE} shrink-0 overflow-hidden rounded-full bg-slate-700/80`}>
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={name}
          onError={() => setImgError(true)}
          className="h-full w-full object-cover object-top"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-base font-bold text-white">
          {initials}
        </div>
      )}
    </div>
  );
}

function PairCombinedAvatar({
  names,
  photoUrls,
}: {
  names: string[];
  photoUrls: (string | undefined)[];
}) {
  return (
    <div className={`${MATCH_AVATAR_SIZE} flex shrink-0 overflow-hidden rounded-full`}>
      <AvatarHalf name={names[0] ?? ''} photoUrl={photoUrls[0]} />
      <AvatarHalf name={names[1] ?? ''} photoUrl={photoUrls[1]} />
    </div>
  );
}

function PlayerPhoto({ side, isTeam, align }: { side: MatchSideDisplay; isTeam: boolean; align: 'left' | 'right' }) {
  const isDoubles = !isTeam && side.names.length > 1;
  const [teamLogoError, setTeamLogoError] = useState(false);
  const teamLogo = side.avatars[0];
  const teamName = side.names[0] ?? side.label;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-transparent px-1 py-2">
      <div className={isTeam ? 'flex min-h-0 flex-1 w-full items-center justify-center' : 'shrink-0'}>
        {isTeam ? (
          teamLogo && !teamLogoError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={teamLogo}
              alt={side.label}
              onError={() => setTeamLogoError(true)}
              className={TEAM_LOGO_IMG}
            />
          ) : (
            <div className={`${TEAM_LOGO_SIZE} flex items-center justify-center rounded-lg bg-slate-700/80 text-lg font-bold text-white`}>
              {getInitials(teamName) || '?'}
            </div>
          )
        ) : isDoubles ? (
          <PairCombinedAvatar names={side.names} photoUrls={side.avatars} />
        ) : (
          <MatchSideAvatar
            name={side.names[0] ?? side.label}
            photoUrl={side.avatars[0]}
          />
        )}
      </div>
      <p className="w-full shrink-0 px-0.5 text-center text-xs sm:text-sm font-bold leading-snug text-white">
        {isTeam ? toTitleCase(side.label) : toTitleCase(firstName(side.names[0] ?? side.label))}
      </p>
    </div>
  );
}

// ── Match card sub-component ──────────────────────────────────────────────
function MatchCard({
  match, tournamentId, regById, teamsById,
}: {
  match: Match;
  tournamentId: string;
  regById: Map<string, Registration>;
  teamsById: Map<string, { logoUrl?: string; name?: string }>;
}) {
  const isLive = match.status === 'live';
  const isDone = match.status === 'completed';
  const side1 = getMatchSideDisplay(match.player1Id, match.player1Name, regById, teamsById);
  const side2 = getMatchSideDisplay(match.player2Id, match.player2Name, regById, teamsById);
  const side1IsTeam = !regById.has(match.player1Id);
  const side2IsTeam = !regById.has(match.player2Id);

  const p1won = isDone && match.winner === match.player1Name;
  const p2won = isDone && match.winner === match.player2Name;
  const liveP1 = isLive && match.sets?.length ? (match.sets.at(-1)?.player1Score ?? 0) : null;
  const liveP2 = isLive && match.sets?.length ? (match.sets.at(-1)?.player2Score ?? 0) : null;

  const dateStr = new Date(match.scheduledTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const timeStr = new Date(match.scheduledTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const courtLabel = match.court ? `Court ${match.court}` : null;

  return (
    <div
      className="relative rounded-2xl overflow-hidden transition-all hover:scale-[1.01] bg-cover bg-center"
      style={{ backgroundImage: `url(${MATCH_CARD_BG_IMAGE})` }}
    >
      {/* Players on the edges + center info (UEFA-style) */}
      <div className="flex items-stretch min-h-[172px]">
        {/* Player 1 photo — left edge */}
        <div className="relative w-[36%] shrink-0">
          <PlayerPhoto side={side1} isTeam={side1IsTeam} align="left" />
        </div>

        {/* Center column */}
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center text-center gap-1.5 px-1 py-3">
          {/* Pool / round */}
          <span className={`whitespace-nowrap rounded-full border border-white/15 bg-black/45 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white ${MATCH_CENTER_SHADOW}`}>
            {match.round}
          </span>

          {/* Score / VS */}
          {isDone ? (
            <div className={`flex items-center gap-1 text-2xl font-black tabular-nums whitespace-nowrap text-white ${MATCH_CENTER_SHADOW}`}>
              <span className={p1won ? 'text-yellow-300' : 'text-white'}>{match.player1Score ?? '-'}</span>
              <span className="text-slate-300 text-lg">:</span>
              <span className={p2won ? 'text-yellow-300' : 'text-white'}>{match.player2Score ?? '-'}</span>
            </div>
          ) : isLive && liveP1 !== null ? (
            <div className={`flex items-center gap-1 text-2xl font-black tabular-nums text-white whitespace-nowrap ${MATCH_CENTER_SHADOW}`}>
              <span>{liveP1}</span><span className="text-emerald-300 text-lg">:</span><span>{liveP2}</span>
            </div>
          ) : (
            <span className={`text-xl font-black text-white whitespace-nowrap ${MATCH_CENTER_SHADOW}`}>VS</span>
          )}

          {/* Status */}
          <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${MATCH_CENTER_SHADOW} ${
            isLive ? 'bg-emerald-600/90 text-white' :
            isDone ? 'bg-slate-600 text-white' :
            'bg-blue-600 text-white'
          }`}>
            {isLive ? '● Live' : isDone ? 'Full Time' : 'Upcoming'}
          </span>

          {/* Time + court */}
          <div className="flex w-full flex-col items-center gap-1">
            <span className={`inline-flex max-w-full items-center justify-center gap-1 whitespace-nowrap text-[9px] font-semibold text-white ${MATCH_CENTER_SHADOW}`}>
              <Clock className="h-3 w-3 shrink-0 text-white" />
              <span>{dateStr} · {timeStr}</span>
            </span>
            {courtLabel && (
              <span className={`inline-flex items-center gap-1 whitespace-nowrap text-[9px] font-medium text-slate-200 ${MATCH_CENTER_SHADOW}`}>
                <MapPin className="h-3 w-3 shrink-0 text-slate-200" />
                {courtLabel}
              </span>
            )}
          </div>
        </div>

        {/* Player 2 photo — right edge */}
        <div className="relative w-[36%] shrink-0">
          <PlayerPhoto side={side2} isTeam={side2IsTeam} align="right" />
        </div>
      </div>

      {/* Winner label */}
      {isDone && match.winner && (
        <div className="px-3 pb-3 -mt-1 flex items-center justify-center gap-1 text-[11px] font-bold text-yellow-300">
          <Star className="h-3 w-3 fill-yellow-300" /> {!side1IsTeam && !side2IsTeam ? toTitleCase(match.winner) : match.winner}
        </div>
      )}

      {/* Live action button */}
      {isLive && (
        <div className="px-3 pb-3">
          <Link href={scoreboardPath(match.id, tournamentId)} target="_blank" rel="noopener noreferrer" className="block">
            <Button className="w-full h-9 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl">
              <Target className="h-3.5 w-3.5 mr-1.5" /> Watch Live Score
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

function rubberWinnerSide(rubber: Match): 1 | 2 | null {
  if (rubber.status !== 'completed') return null;
  if ((rubber.player1Score ?? 0) > (rubber.player2Score ?? 0)) return 1;
  if ((rubber.player2Score ?? 0) > (rubber.player1Score ?? 0)) return 2;
  return null;
}

function MatchFiltersBar({
  matchDistinctCategories,
  matchDistinctRounds,
  matchCategoryFilter,
  matchRoundFilter,
  matchSearch,
  matchDateFilter,
  onCategoryChange,
  onRoundChange,
  onSearchChange,
  onDateChange,
  onClear,
  hasActiveFilters,
  shownCount,
  totalCount,
}: {
  matchDistinctCategories: string[];
  matchDistinctRounds: string[];
  matchCategoryFilter: string;
  matchRoundFilter: string;
  matchSearch: string;
  matchDateFilter: string;
  onCategoryChange: (v: string) => void;
  onRoundChange: (v: string) => void;
  onSearchChange: (v: string) => void;
  onDateChange: (v: string) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
  shownCount: number;
  totalCount: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            type="text"
            value={matchSearch}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search player / team…"
            className="w-full bg-slate-800 border border-white/10 text-slate-200 text-xs rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-yellow-400/50 placeholder:text-slate-500"
          />
        </div>
        <input
          type="date"
          value={matchDateFilter}
          onChange={e => onDateChange(e.target.value)}
          title="Filter by date (IST)"
          className="bg-slate-800 border border-white/10 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-yellow-400/50"
        />
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        {matchDistinctCategories.length > 0 && (
          <select
            value={matchCategoryFilter}
            onChange={e => onCategoryChange(e.target.value)}
            className="bg-slate-800 border border-white/10 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-yellow-400/50"
          >
            <option value="all">All Categories</option>
            {matchDistinctCategories.map(c => (
              <option key={c} value={c}>{formatCategoryLabel(c)}</option>
            ))}
          </select>
        )}
        {matchDistinctRounds.length > 1 && (
          <select
            value={matchRoundFilter}
            onChange={e => onRoundChange(e.target.value)}
            className="bg-slate-800 border border-white/10 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-yellow-400/50"
          >
            <option value="all">All Rounds</option>
            {matchDistinctRounds.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
        {hasActiveFilters && (
          <button type="button" onClick={onClear} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            Clear all
          </button>
        )}
        <span className="text-xs text-slate-500 ml-auto">
          {shownCount} of {totalCount} match{totalCount === 1 ? '' : 'es'}
        </span>
      </div>
    </div>
  );
}

// ── Knockout bracket view ─────────────────────────────────────────────────

const BCARD_H = 158;
const BCARD_W = 200;
const B_TOPBAR_H = 22;
const B_MIDBAR_H = 30;
const B_ROW_H = (BCARD_H - B_TOPBAR_H - B_MIDBAR_H) / 2;
const B_GAP = 14;
const BCONN_W = 36;

function computeColLayouts(counts: number[], baseGap: number, cardH: number) {
  const halfH = cardH / 2;
  const layouts: { padTop: number; slotGap: number }[] = [];
  layouts.push({ padTop: 0, slotGap: baseGap });
  let prevCenters = Array.from({ length: counts[0] }, (_, k) => k * (cardH + baseGap) + halfH);
  for (let col = 1; col < counts.length; col++) {
    const n = counts[col];
    const centers: number[] = [];
    for (let j = 0; j < n; j++) {
      const a = prevCenters[j * 2] ?? prevCenters[prevCenters.length - 1] ?? 0;
      const b = prevCenters[j * 2 + 1] ?? prevCenters[prevCenters.length - 1] ?? 0;
      centers.push((a + b) / 2);
    }
    const padTop = Math.max(0, (centers[0] ?? 0) - halfH);
    const slotGap = n > 1 ? Math.max(0, (centers[1] ?? 0) - (centers[0] ?? 0) - cardH) : 0;
    layouts.push({ padTop, slotGap });
    prevCenters = centers;
  }
  return layouts;
}

interface BSlot {
  p1Name: string;
  p2Name: string;
  p1IsWinner?: boolean;
  p2IsWinner?: boolean;
  p1IsTBD?: boolean;
  p2IsTBD?: boolean;
  p1Pool?: string;
  p2Pool?: string;
  p1LogoUrl?: string;
  p2LogoUrl?: string;
  matchLabel: string;
  matchNumber?: string;
  roundStr?: string;
  dateStr?: string;
  timeStr?: string;
  isExpected?: boolean;
  status?: string;
  scoreStr?: string;
}

function bracketRoundLabel(round: string): string {
  if (isKnockoutRound(round)) return KNOCKOUT_ROUND_LABELS[round];
  const ipl = normalizeIplPlayoffRound(round);
  if (ipl) return IPL_PLAYOFF_ROUND_LABELS[ipl];
  return round;
}

function bracketScheduleFields(m: Match): Pick<BSlot, 'dateStr' | 'timeStr'> {
  if (!m.scheduledTime) return {};
  const when = new Date(m.scheduledTime);
  return {
    dateStr: when.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    }),
    timeStr: when.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    }),
  };
}

function shortBracketLabel(name: string): string {
  const wm = name.match(/^Winner\s+of\s+(.+)$/i);
  if (wm) return `W. ${wm[1]}`;
  const lm = name.match(/^Loser\s+of\s+(.+)$/i);
  if (lm) return `L. ${lm[1]}`;
  return name;
}

function bracketSideFromIds(
  playerId: string,
  playerName: string,
  regById: Map<string, Registration>,
  teamsById: Map<string, { logoUrl?: string; name?: string }>,
): { name: string; logoUrl?: string } {
  const display = getMatchSideDisplay(playerId, playerName, regById, teamsById);
  return { name: display.label, logoUrl: display.avatars[0] };
}

function bracketParticipantDisplay(
  participant: { id: string; name: string },
  regById: Map<string, Registration>,
  teamsById: Map<string, { logoUrl?: string; name?: string }>,
): { name: string; logoUrl?: string } {
  const resolved = bracketSideFromIds(participant.id, participant.name, regById, teamsById);
  return { name: resolved.name, logoUrl: resolved.logoUrl };
}

function resolveBracketSide(
  playerId: string,
  playerName: string,
  sourceMatches: Match[],
  teamsById: Map<string, { logoUrl?: string; name?: string }>,
  regById: Map<string, Registration>,
): { name: string; isTBD: boolean; logoUrl?: string } {
  const srcNo = extractBracketSrcMatchNo(playerName) || extractBracketSrcMatchNo(playerId);
  if (srcNo) {
    const srcMatch = findBracketSourceMatch(sourceMatches, srcNo);
    if (srcMatch?.status === 'completed') {
      const isLoser = /loser/i.test(playerId) || /^Loser\s+of/i.test(playerName);
      const participant = isLoser ? getMatchLoser(srcMatch) : getMatchWinner(srcMatch);
      if (participant) {
        const resolved = bracketParticipantDisplay(participant, regById, teamsById);
        return {
          name: resolved.name,
          isTBD: false,
          logoUrl: resolved.logoUrl,
        };
      }
    }
    return {
      name: playerName ? shortBracketLabel(playerName) : `W. ${srcNo}`,
      isTBD: true,
    };
  }

  if (teamsById.has(playerId)) {
    const resolved = bracketSideFromIds(playerId, playerName, regById, teamsById);
    return { name: resolved.name, isTBD: false, logoUrl: resolved.logoUrl };
  }

  if (playerId.startsWith('tbd-')) {
    return { name: shortBracketLabel(playerName) || 'TBD', isTBD: true };
  }

  const resolved = bracketSideFromIds(playerId, playerName, regById, teamsById);
  return { name: resolved.name, isTBD: !playerName, logoUrl: resolved.logoUrl };
}

function sideWonMatch(
  m: Match,
  sideId: string,
  sideName: string,
  resolvedName: string,
): boolean {
  if (m.status !== 'completed') return false;
  const winner = getMatchWinner(m);
  if (!winner) return false;
  return (
    winner.id === sideId
    || winner.name === sideName
    || winner.name === resolvedName
  );
}

function bracketScoreStr(m: Match): string | undefined {
  if (m.status !== 'completed') return undefined;
  if (m.player1Score == null && m.player2Score == null) return undefined;
  return `${m.player1Score ?? 0} : ${m.player2Score ?? 0}`;
}

function BracketSlotCard({ slot }: { slot: BSlot }) {
  const playerRow = (
    name: string,
    isWinner?: boolean,
    isTBD?: boolean,
    pool?: string,
    logoUrl?: string,
  ) => (
    <div
      className={`flex items-center gap-2.5 px-3 ${isWinner ? 'bg-yellow-400/15' : ''}`}
      style={{ height: B_ROW_H }}
    >
      {/* Logo or initials badge */}
      <div className={`h-8 w-8 rounded-full overflow-hidden flex items-center justify-center text-[11px] font-bold shrink-0 ${
        isWinner ? 'ring-2 ring-yellow-400/60' : ''
      } ${!logoUrl ? (isWinner ? 'bg-yellow-400 text-black' : isTBD ? 'bg-slate-800 text-slate-500' : 'bg-slate-700 text-slate-200') : 'bg-slate-800'}`}>
        {logoUrl ? (
          <img src={logoUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          isTBD ? '?' : (getInitials(name) || '?')
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`text-xs font-semibold truncate leading-tight ${
          isWinner ? 'text-yellow-300' : isTBD ? 'text-slate-500 italic' : 'text-white'
        }`}>
          {name || 'TBD'}
        </div>
        {pool && <div className="text-[9px] text-slate-600">{pool}</div>}
      </div>
      {isWinner && <Star className="h-3 w-3 text-yellow-400 fill-yellow-400 shrink-0" />}
    </div>
  );

  const scheduleLine = slot.dateStr
    ? `${slot.dateStr}${slot.timeStr ? ` · ${slot.timeStr}` : ''}`
    : null;

  const midContent = slot.status === 'completed'
    ? { date: scheduleLine, score: slot.scoreStr }
    : { date: scheduleLine, score: null };

  return (
    <div
      className={`rounded-xl border overflow-hidden flex flex-col shrink-0 ${
        slot.status === 'live'
          ? 'border-emerald-500/40 bg-slate-900 shadow-[0_0_14px_rgba(52,211,153,0.15)]'
          : slot.status === 'completed'
          ? 'border-white/15 bg-slate-900'
          : slot.isExpected
          ? 'border-amber-500/25 bg-slate-900/60'
          : 'border-white/10 bg-slate-900/80'
      }`}
      style={{ width: BCARD_W, height: BCARD_H }}
    >
      <div
        className="flex items-center justify-between px-3 bg-slate-800/70 border-b border-white/6 shrink-0"
        style={{ height: B_TOPBAR_H }}
      >
        <span className="text-[9px] font-bold text-yellow-400/90 uppercase tracking-wide truncate">
          {slot.roundStr ?? slot.matchLabel}
        </span>
        {slot.matchNumber && (
          <span className="text-[8px] text-white shrink-0 ml-1">#{slot.matchNumber}</span>
        )}
      </div>
      {playerRow(slot.p1Name, slot.p1IsWinner, slot.p1IsTBD, slot.p1Pool, slot.p1LogoUrl)}
      <div
        className="flex items-center justify-between gap-1.5 px-3 bg-slate-800/50 border-y border-white/6 shrink-0"
        style={{ height: B_MIDBAR_H }}
      >
        {slot.status === 'completed' ? (
          <>
            <span className="text-[9px] text-slate-400 font-medium truncate leading-tight min-w-0">
              {midContent.date ?? '—'}
            </span>
            {midContent.score && (
              <span className="text-[10px] font-bold text-yellow-300 tabular-nums shrink-0">
                {midContent.score}
              </span>
            )}
          </>
        ) : (
          <span className="text-[9px] text-slate-300 font-medium truncate leading-tight">
            {midContent.date ?? (slot.isExpected ? 'Schedule TBD' : '—')}
          </span>
        )}
        {slot.isExpected && slot.status !== 'completed' && (
          <span className="text-[8px] font-bold text-amber-400/70 uppercase tracking-wide shrink-0 ml-1">Est.</span>
        )}
        {slot.status === 'live' && (
          <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-wide shrink-0 ml-1 animate-pulse">Live</span>
        )}
      </div>
      {playerRow(slot.p2Name, slot.p2IsWinner, slot.p2IsTBD, slot.p2Pool, slot.p2LogoUrl)}
    </div>
  );
}

function BracketConnectorSVG({
  fromCount, fromLayout, toCount, toLayout, cardH, totalH,
}: {
  fromCount: number;
  fromLayout: { padTop: number; slotGap: number };
  toCount: number;
  toLayout: { padTop: number; slotGap: number };
  cardH: number;
  totalH: number;
}) {
  const midX = BCONN_W / 2;
  const halfH = cardH / 2;
  const fromCenters = Array.from({ length: fromCount }, (_, k) =>
    fromLayout.padTop + k * (cardH + fromLayout.slotGap) + halfH,
  );
  const toCenters = Array.from({ length: toCount }, (_, j) =>
    toLayout.padTop + j * (cardH + toLayout.slotGap) + halfH,
  );
  const lineColor = 'rgba(251,191,36,0.28)';
  const dotColor = 'rgba(251,191,36,0.6)';

  return (
    <svg width={BCONN_W} height={totalH} className="shrink-0 overflow-visible">
      {toCenters.map((dst, j) => {
        const srcA = fromCenters[j * 2] ?? fromCenters[fromCenters.length - 1] ?? 0;
        const srcB = fromCenters[j * 2 + 1] ?? srcA;
        const midY = (srcA + srcB) / 2;
        return (
          <g key={j}>
            <line x1={0} y1={srcA} x2={midX} y2={srcA} stroke={lineColor} strokeWidth={1.5} />
            {srcB !== srcA && (
              <>
                <line x1={0} y1={srcB} x2={midX} y2={srcB} stroke={lineColor} strokeWidth={1.5} />
                <line x1={midX} y1={srcA} x2={midX} y2={srcB} stroke={lineColor} strokeWidth={1.5} />
              </>
            )}
            <line x1={midX} y1={midY} x2={BCONN_W} y2={midY} stroke={lineColor} strokeWidth={1.5} />
            <circle cx={midX} cy={midY} r={3} fill={dotColor} />
          </g>
        );
      })}
    </svg>
  );
}

function IplPlayoffBracketView({
  catMatches,
  teamsById,
  regById,
}: {
  category: CategoryType;
  catMatches: Match[];
  teamsById: Map<string, { logoUrl?: string; name?: string }>;
  regById: Map<string, Registration>;
}) {
  const q1Matches = filterIplRoundMatches(catMatches, 'Qualifier1');
  const eMatches = filterIplRoundMatches(catMatches, 'Eliminator');
  const q2Matches = filterIplRoundMatches(catMatches, 'Qualifier2');
  const fMatches = filterIplRoundMatches(catMatches, 'F');

  const getWinner = (m: Match | undefined, tbdLabel: string) => {
    if (!m) return { name: tbdLabel, isTBD: true };
    const winner = getMatchWinner(m);
    if (winner) {
      const resolved = bracketParticipantDisplay(winner, regById, teamsById);
      return { name: resolved.name, isTBD: false, logoUrl: resolved.logoUrl };
    }
    return { name: tbdLabel, isTBD: true };
  };

  const matchToSlot = (m: Match, label: string): BSlot => {
    const p1 = bracketSideFromIds(m.player1Id, m.player1Name, regById, teamsById);
    const p2 = bracketSideFromIds(m.player2Id, m.player2Name, regById, teamsById);
    const winner = getMatchWinner(m);
    const p1won = winner != null && (winner.id === m.player1Id || winner.name === m.player1Name || winner.name === p1.name);
    const p2won = winner != null && (winner.id === m.player2Id || winner.name === m.player2Name || winner.name === p2.name);
    return {
      p1Name: p1.name || 'TBD',
      p2Name: p2.name || 'TBD',
      p1IsWinner: p1won,
      p2IsWinner: p2won,
      p1LogoUrl: p1.logoUrl,
      p2LogoUrl: p2.logoUrl,
      matchLabel: label,
      roundStr: bracketRoundLabel(m.round),
      matchNumber: m.matchNumber != null ? String(m.matchNumber) : undefined,
      ...bracketScheduleFields(m),
      status: m.status,
      scoreStr: bracketScoreStr(m),
    };
  };

  const q1Slots: BSlot[] = q1Matches.length > 0
    ? q1Matches.map(m => matchToSlot(m, IPL_PLAYOFF_ROUND_LABELS.Qualifier1))
    : [];

  const eSlots: BSlot[] = eMatches.length > 0
    ? eMatches.map(m => matchToSlot(m, IPL_PLAYOFF_ROUND_LABELS.Eliminator))
    : [];

  const q2Slots: BSlot[] = q2Matches.length > 0
    ? q2Matches.map(m => matchToSlot(m, IPL_PLAYOFF_ROUND_LABELS.Qualifier2))
    : (() => {
        if (!q1Matches[0] && !eMatches[0]) return [];
        const lq1 = getWinner(q1Matches[0], 'L. Qualifier1');
        const we = getWinner(eMatches[0], 'W. Eliminator');
        return [{
          p1Name: lq1.name, p2Name: we.name,
          p1IsTBD: lq1.isTBD, p2IsTBD: we.isTBD,
          matchLabel: IPL_PLAYOFF_ROUND_LABELS.Qualifier2,
          roundStr: IPL_PLAYOFF_ROUND_LABELS.Qualifier2,
          isExpected: lq1.isTBD || we.isTBD,
        }];
      })();

  const fSlots: BSlot[] = fMatches.length > 0
    ? fMatches.map(m => matchToSlot(m, IPL_PLAYOFF_ROUND_LABELS.F))
    : (() => {
        if (!q1Matches[0] && !q2Matches[0]) return [];
        const wq1 = getWinner(q1Matches[0], 'W. Qualifier1');
        const wq2 = getWinner(q2Matches[0], 'W. Qualifier2');
        return [{
          p1Name: wq1.name, p2Name: wq2.name,
          p1IsTBD: wq1.isTBD, p2IsTBD: wq2.isTBD,
          matchLabel: IPL_PLAYOFF_ROUND_LABELS.F,
          roundStr: IPL_PLAYOFF_ROUND_LABELS.F,
          isExpected: wq1.isTBD || wq2.isTBD,
        }];
      })();

  const col1Slots = [...q1Slots, ...eSlots];
  const columns: { label: string; slots: BSlot[] }[] = [];
  if (col1Slots.length > 0) columns.push({ label: 'Qualifier 1 / Eliminator', slots: col1Slots });
  if (q2Slots.length > 0) columns.push({ label: IPL_PLAYOFF_ROUND_LABELS.Qualifier2, slots: q2Slots });
  if (fSlots.length > 0) columns.push({ label: 'Final', slots: fSlots });

  if (columns.length === 0) {
    return (
      <div className="text-center py-16">
        <GitBranch className="h-10 w-10 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400 text-sm">No IPL playoff content for this category yet</p>
        <p className="text-slate-600 text-xs mt-1">Generate Qualifier1 and Eliminator after league play concludes</p>
      </div>
    );
  }

  const counts = columns.map(c => c.slots.length);
  const layouts = computeColLayouts(counts, B_GAP, BCARD_H);
  const totalSlotH = Math.max(...layouts.map((l, i) =>
    l.padTop + counts[i] * BCARD_H + Math.max(0, counts[i] - 1) * l.slotGap,
  ));
  const containerH = totalSlotH;
  const totalW = columns.length * BCARD_W + (columns.length - 1) * BCONN_W;

  return (
    <div className="overflow-x-auto pb-2">
      <div className="relative" style={{ width: totalW, height: containerH }}>
        {columns.map((col, colIdx) => {
          const layout = layouts[colIdx];
          const x = colIdx * (BCARD_W + BCONN_W);
          const nextLayout = layouts[colIdx + 1];
          const nextCount = counts[colIdx + 1];
          return (
            <div key={col.label}>
              {col.slots.map((slot, slotIdx) => (
                <div
                  key={`${col.label}-${slot.matchNumber ?? slot.matchLabel}-${slotIdx}`}
                  className="absolute"
                  style={{ top: layout.padTop + slotIdx * (BCARD_H + layout.slotGap), left: x }}
                >
                  <BracketSlotCard slot={slot} />
                </div>
              ))}
              {colIdx < columns.length - 1 && nextLayout != null && nextCount != null && (
                <div className="absolute" style={{ top: 0, left: x + BCARD_W }}>
                  <BracketConnectorSVG
                    fromCount={counts[colIdx]}
                    fromLayout={layout}
                    toCount={nextCount}
                    toLayout={nextLayout}
                    cardH={BCARD_H}
                    totalH={totalSlotH}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KnockoutBracketView({
  category, allMatches, pools, teams, participants, tournament, teamsById, regById,
}: {
  category: CategoryType;
  allMatches: Match[];
  displayMatches: Match[];
  pools: Pool[];
  teams: Team[];
  participants: Registration[];
  tournament: Tournament;
  tournamentId: string;
  regById: Map<string, Registration>;
  teamsById: Map<string, { logoUrl?: string; name?: string }>;
}) {
  const catPools = pools.filter(p => p.category === category);
  const bracketOpts = { teams, registrations: participants, categoryQualifyCounts: tournament.categoryQualifyCounts };
  const poolNameToCategory = new Map(pools.map(p => [p.name, p.category]));

  const getMatchCategory = (m: Match): string | undefined => {
    if (m.category) return m.category;
    const fromPool = poolNameToCategory.get(m.round);
    if (fromPool) return fromPool;
    const team1 = teams.find(t => t.id === m.player1Id);
    if (team1) return team1.category;
    const team2 = teams.find(t => t.id === m.player2Id);
    if (team2) return team2.category;
    const reg1 = participants.find(p => p.id === m.player1Id);
    if (reg1?.selectedCategory) return reg1.selectedCategory;
    const reg2 = participants.find(p => p.id === m.player2Id);
    if (reg2?.selectedCategory) return reg2.selectedCategory;
    return undefined;
  };

  const catMatches = allMatches.filter(m => getMatchCategory(m) === category && !isRubberMatch(m));
  const usesIplPlayoff = catMatches.some(m => isIplPlayoffSpecificRound(m.round));

  if (usesIplPlayoff) {
    return (
      <IplPlayoffBracketView
        category={category}
        catMatches={catMatches}
        teamsById={teamsById}
        regById={regById}
      />
    );
  }

  const byRound = (r: string) =>
    catMatches.filter(m => m.round === r)
      .sort((a, b) => String(a.matchNumber).localeCompare(String(b.matchNumber), undefined, { numeric: true }));

  const qfMatches = byRound('QF');
  const sfMatches = byRound('SF');
  const fMatches = byRound('F');
  const tpMatches = byRound('TP');

  // Only predict SF/F/TP from prior-round results — QF is never predicted from pool standings
  const sfExpected = sfMatches.length === 0
    ? previewKnockoutRound('SF', category, catPools, allMatches, bracketOpts).pairings
    : [];

  const getWinner = (m: Match | undefined, tbdLabel: string) => {
    if (!m) return { name: tbdLabel, isTBD: true };
    const winner = getMatchWinner(m);
    if (winner) {
      const resolved = bracketParticipantDisplay(winner, regById, teamsById);
      return { name: resolved.name, isTBD: false, logoUrl: resolved.logoUrl };
    }
    return { name: tbdLabel, isTBD: true };
  };

  const getLoser = (m: Match, idx: number) => {
    const loser = getMatchLoser(m);
    if (loser) {
      const resolved = bracketParticipantDisplay(loser, regById, teamsById);
      return { name: resolved.name, isTBD: false, logoUrl: resolved.logoUrl };
    }
    return { name: `L. SF${idx + 1}`, isTBD: true };
  };

  const matchToSlot = (m: Match, label: string, sourceMatches?: Match[]): BSlot => {
    const src = sourceMatches ?? [];
    const p1 = resolveBracketSide(m.player1Id, m.player1Name, src, teamsById, regById);
    const p2 = resolveBracketSide(m.player2Id, m.player2Name, src, teamsById, regById);
    return {
      p1Name: p1.name,
      p2Name: p2.name,
      p1IsWinner: sideWonMatch(m, m.player1Id, m.player1Name, p1.name),
      p2IsWinner: sideWonMatch(m, m.player2Id, m.player2Name, p2.name),
      p1IsTBD: p1.isTBD,
      p2IsTBD: p2.isTBD,
      p1LogoUrl: p1.logoUrl,
      p2LogoUrl: p2.logoUrl,
      matchLabel: label,
      roundStr: bracketRoundLabel(m.round),
      matchNumber: m.matchNumber != null ? String(m.matchNumber) : undefined,
      ...bracketScheduleFields(m),
      status: m.status,
      scoreStr: bracketScoreStr(m),
    };
  };

  // QF column — only show admin-generated actual matches, never predict from pool standings
  const qfSlotsRaw: BSlot[] = qfMatches.map((m, i) => matchToSlot(m, `QF ${i + 1}`));

  // Reorder QF so that the two QF matches feeding the same SF are always adjacent.
  let qfSlots = qfSlotsRaw;
  let orderedQfMatches = qfMatches;

  if (sfMatches.length > 0 && qfMatches.length >= 2) {
    const newOrder: number[] = [];
    const used = new Set<number>();
    for (const sf of sfMatches) {
      for (const ref of [sf.player1Id, sf.player1Name, sf.player2Id, sf.player2Name]) {
        if (!ref) continue;
        const src = extractBracketSrcMatchNo(ref);
        if (!src) continue;
        const idx = qfMatches.findIndex(m => bracketMatchNumbersMatch(src, m));
        if (idx >= 0 && !used.has(idx)) { newOrder.push(idx); used.add(idx); }
      }
    }
    for (let i = 0; i < qfMatches.length; i++) {
      if (!used.has(i)) newOrder.push(i);
    }
    if (newOrder.length === qfMatches.length && newOrder.some((v, i) => v !== i)) {
      qfSlots = newOrder.map(i => qfSlotsRaw[i]);
      orderedQfMatches = newOrder.map(i => qfMatches[i]);
    }
  }

  // SF column
  const sfSlots: BSlot[] = sfMatches.length > 0
    ? sfMatches.map((m, i) => matchToSlot(m, `SF ${i + 1}`, orderedQfMatches))
    : (() => {
        if (qfSlots.length > 0) {
          const n = Math.ceil(qfSlots.length / 2);
          return Array.from({ length: n }, (_, j) => {
            const qfA = orderedQfMatches[j * 2];
            const qfB = orderedQfMatches[j * 2 + 1];
            const w1 = getWinner(qfA, `W. ${qfA ? String(qfA.matchNumber) : `QF${j * 2 + 1}`}`);
            const w2 = getWinner(qfB, `W. ${qfB ? String(qfB.matchNumber) : `QF${j * 2 + 2}`}`);
            return {
              p1Name: w1.name, p2Name: w2.name,
              p1IsTBD: w1.isTBD, p2IsTBD: w2.isTBD,
              matchLabel: `SF ${j + 1}`,
              roundStr: KNOCKOUT_ROUND_LABELS.SF,
              isExpected: w1.isTBD || w2.isTBD,
            };
          });
        }
        return sfExpected.map((p, i) => ({
          p1Name: p.player1.name, p2Name: p.player2.name,
          p1Pool: p.player1.poolName, p2Pool: p.player2.poolName,
          matchLabel: `SF ${i + 1}`,
          roundStr: KNOCKOUT_ROUND_LABELS.SF,
          isExpected: true,
        }));
      })();

  // Final column
  const fSlots: BSlot[] = fMatches.length > 0
    ? fMatches.map(m => matchToSlot(m, 'Final', sfMatches))
    : (() => {
        if (sfSlots.length === 0) return [];
        const w1 = getWinner(sfMatches[0], 'W. SF1');
        const w2 = getWinner(sfMatches[1], 'W. SF2');
        return [{
          p1Name: w1.name, p2Name: w2.name,
          p1IsTBD: w1.isTBD, p2IsTBD: w2.isTBD,
          matchLabel: 'Final',
          roundStr: KNOCKOUT_ROUND_LABELS.F,
          isExpected: w1.isTBD || w2.isTBD,
        }];
      })();

  // Third place
  const tpSlots: BSlot[] = tpMatches.length > 0
    ? tpMatches.map(m => matchToSlot(m, '3rd Place', sfMatches))
    : (() => {
        if (sfMatches.length >= 2) {
          const l1 = getLoser(sfMatches[0], 0);
          const l2 = getLoser(sfMatches[1], 1);
          return [{
            p1Name: l1.name, p2Name: l2.name,
            p1IsTBD: l1.isTBD, p2IsTBD: l2.isTBD,
            matchLabel: '3rd Place',
            roundStr: KNOCKOUT_ROUND_LABELS.TP,
            isExpected: l1.isTBD || l2.isTBD,
          }];
        }
        return [];
      })();

  const columns: { label: string; slots: BSlot[] }[] = [];
  if (qfSlots.length > 0) columns.push({ label: 'Quarter Final', slots: qfSlots });
  if (sfSlots.length > 0) columns.push({ label: 'Semi Final', slots: sfSlots });
  if (fSlots.length > 0) columns.push({ label: 'Final', slots: fSlots });

  if (columns.length === 0) {
    return (
      <div className="text-center py-16">
        <GitBranch className="h-10 w-10 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400 text-sm">No knockout content for this category yet</p>
        {catPools.length > 0 && (
          <p className="text-slate-600 text-xs mt-1">Bracket will form once pool play concludes</p>
        )}
      </div>
    );
  }

  const counts = columns.map(c => c.slots.length);
  const layouts = computeColLayouts(counts, B_GAP, BCARD_H);
  const totalSlotH = Math.max(...layouts.map((l, i) =>
    l.padTop + counts[i] * BCARD_H + Math.max(0, counts[i] - 1) * l.slotGap,
  ));
  const containerH = totalSlotH;
  const totalW = columns.length * BCARD_W + (columns.length - 1) * BCONN_W;

  return (
    <div className="space-y-8">
      <div className="overflow-x-auto pb-2">
        <div className="relative" style={{ width: totalW, height: containerH }}>
          {columns.map((col, colIdx) => {
            const layout = layouts[colIdx];
            const x = colIdx * (BCARD_W + BCONN_W);
            const nextLayout = layouts[colIdx + 1];
            const nextCount = counts[colIdx + 1];
            return (
              <div key={col.label}>
                {col.slots.map((slot, slotIdx) => (
                  <div
                    key={slotIdx}
                    className="absolute"
                    style={{ top: layout.padTop + slotIdx * (BCARD_H + layout.slotGap), left: x }}
                  >
                    <BracketSlotCard slot={slot} />
                  </div>
                ))}

                {colIdx < columns.length - 1 && nextLayout != null && nextCount != null && (
                  <div className="absolute" style={{ top: 0, left: x + BCARD_W }}>
                    <BracketConnectorSVG
                      fromCount={counts[colIdx]}
                      fromLayout={layout}
                      toCount={nextCount}
                      toLayout={nextLayout}
                      cardH={BCARD_H}
                      totalH={totalSlotH}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Third place play-off */}
      {tpSlots.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-white/8" />
            <span className="text-[10px] text-slate-500 uppercase tracking-widest whitespace-nowrap">3rd Place Play-off</span>
            <div className="flex-1 h-px bg-white/8" />
          </div>
          <div className="flex gap-4 flex-wrap">
            {tpSlots.map((slot, i) => (
              <div key={i}>
                <BracketSlotCard slot={slot} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TeamRubberDetails({
  rubbers,
  regById,
}: {
  rubbers: Match[];
  regById: Map<string, Registration>;
}) {
  if (rubbers.length === 0) {
    return (
      <div className="px-4 py-3 text-xs text-slate-500 italic border-t border-white/10 bg-slate-900/95">
        Game details not available yet.
      </div>
    );
  }

  return (
    <div className="border-t border-white/10 bg-slate-900/95 px-3 py-3 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-1">Games</p>
      {rubbers.map(rubber => {
        const side1 = formatMatchSideLabel(rubber, 1, regById);
        const side2 = formatMatchSideLabel(rubber, 2, regById);
        const winner = rubberWinnerSide(rubber);
        const setScores = rubber.sets?.map(s => `${s.player1Score}–${s.player2Score}`).join(', ');

        return (
          <div
            key={rubber.id}
            className="rounded-xl bg-slate-800/80 border border-white/5 px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                Game {rubber.rubberNumber} · {rubberTypeLabel(rubber.rubberType ?? 'single')}
              </span>
              {rubber.status === 'completed' ? (
                <span className="text-[10px] font-bold text-green-400/90 uppercase">Done</span>
              ) : (
                <span className="text-[10px] font-bold text-slate-500 uppercase">{rubber.status}</span>
              )}
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
              <span className={`truncate font-medium ${winner === 1 ? 'text-yellow-300' : 'text-white'}`} title={side1}>
                {side1}
              </span>
              <span className="font-black tabular-nums text-white whitespace-nowrap px-1">
                {rubber.player1Score ?? 0}
                <span className="text-slate-500 mx-0.5">–</span>
                {rubber.player2Score ?? 0}
              </span>
              <span className={`truncate font-medium text-right ${winner === 2 ? 'text-yellow-300' : 'text-white'}`} title={side2}>
                {side2}
              </span>
            </div>
            {setScores && (
              <p className="text-[10px] text-slate-500 mt-1.5 tabular-nums">({setScores})</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ResultMatchCard({
  match,
  tournamentId,
  regById,
  teamsById,
  teamIds,
  rubbers,
  expanded,
  onToggle,
}: {
  match: Match;
  tournamentId: string;
  regById: Map<string, Registration>;
  teamsById: Map<string, { logoUrl?: string; name?: string }>;
  teamIds: Set<string>;
  rubbers: Match[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const isTeamTie = isTeamTieMatch(match, teamIds);
  const canExpand = isTeamTie && (rubbers.length > 0 || !!match.rubbersGenerated);

  return (
    <div className={`rounded-2xl overflow-hidden border transition-colors ${expanded ? 'border-yellow-400/30' : 'border-white/5'}`}>
      <div
        className={canExpand ? 'cursor-pointer group' : undefined}
        onClick={canExpand ? onToggle : undefined}
        onKeyDown={canExpand ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } } : undefined}
        role={canExpand ? 'button' : undefined}
        tabIndex={canExpand ? 0 : undefined}
        aria-expanded={canExpand ? expanded : undefined}
      >
        <MatchCard match={match} tournamentId={tournamentId} regById={regById} teamsById={teamsById} />
        {canExpand && (
          <div className="flex items-center justify-center gap-1.5 py-2 -mt-1 bg-slate-950/40 text-[10px] font-bold uppercase tracking-wide text-slate-400 group-hover:text-yellow-400 transition-colors">
            <span>{expanded ? 'Hide games' : 'View games'}</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </div>
        )}
      </div>
      {expanded && isTeamTie && (
        <TeamRubberDetails rubbers={rubbers} regById={regById} />
      )}
    </div>
  );
}
