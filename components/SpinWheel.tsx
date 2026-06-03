'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Team, Pool, Registration, Tournament, CategoryType } from '@/types';
import { Shuffle, Users, Target, Zap, RotateCcw, RefreshCw, Trophy } from 'lucide-react';
import Image from 'next/image';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAlertDialog } from '@/components/ui/alert-dialog-component';
import { assignByTierQuota, selectQuotaTeamForPlayer, selectQuotaPlayerForTeam, topTiersAvailable } from '@/lib/teamAssignment';

interface SpinWheelProps {
  tournament: Tournament;
  user: { id: string; role: string; email: string };
}

interface SpinResult extends Registration {
  assignedTeam?: string;
}

const TEAM_CATEGORIES: CategoryType[] = ['mens-team', 'womens-team'];

export default function SpinWheel({ tournament, user }: SpinWheelProps) {
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();
  const { alert, AlertDialogComponent } = useAlertDialog();

  const [teams, setTeams] = useState<Team[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<CategoryType | ''>('');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedPool, setSelectedPool] = useState<string>('');
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<SpinResult | null>(null);
  const [filteredRegistrations, setFilteredRegistrations] = useState<Registration[]>([]);
  const [unassignedRegistrations, setUnassignedRegistrations] = useState<Registration[]>([]);
  const [roundMode, setRoundMode] = useState(false);
  const [roundResults, setRoundResults] = useState<SpinResult[]>([]);
  const [showSpinDialog, setShowSpinDialog] = useState(false);

  useEffect(() => {
    loadData();
  }, [tournament.id]);

  useEffect(() => {
    if (selectedCategory) {
      filterRegistrations();
    }
  }, [selectedCategory, registrations, teams, pools]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSpinResult(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const isTeamCategory = () =>
    selectedCategory !== '' && TEAM_CATEGORIES.includes(selectedCategory as CategoryType);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadTeams(), loadPools(), loadRegistrations()]);
    setLoading(false);
  };

  const loadTeams = async () => {
    try {
      const snapshot = await getDocs(
        query(collection(db, 'tournaments', tournament.id, 'teams'), orderBy('createdAt', 'desc'))
      );
      setTeams(snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate(),
        updatedAt: d.data().updatedAt?.toDate(),
      })) as Team[]);
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  };

  const loadPools = async () => {
    try {
      const snapshot = await getDocs(
        query(collection(db, 'tournaments', tournament.id, 'pools'), orderBy('createdAt', 'desc'))
      );
      setPools(snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate(),
        updatedAt: d.data().updatedAt?.toDate(),
      })) as Pool[]);
    } catch (error) {
      console.error('Error loading pools:', error);
    }
  };

  const loadRegistrations = async () => {
    try {
      const snapshot = await getDocs(
        query(collection(db, 'tournaments', tournament.id, 'registrations'), orderBy('registeredAt', 'desc'))
      );
      setRegistrations(snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        registeredAt: d.data().registeredAt?.toDate(),
        paymentVerifiedAt: d.data().paymentVerifiedAt?.toDate(),
      })) as Registration[]);
    } catch (error) {
      console.error('Error loading registrations:', error);
    }
  };

  const filterRegistrations = () => {
    if (!selectedCategory) return;

    const filtered = registrations.filter(r => r.selectedCategory === selectedCategory);
    setFilteredRegistrations(filtered);

    let assignedPlayerIds: string[];
    if (isTeamCategory()) {
      assignedPlayerIds = teams
        .filter(team => team.category === selectedCategory)
        .flatMap(team => team.players);
    } else {
      // pool.teams stores player IDs for non-team categories
      assignedPlayerIds = pools
        .filter(pool => pool.category === selectedCategory)
        .flatMap(pool => pool.teams);
    }

    setUnassignedRegistrations(filtered.filter(r => !assignedPlayerIds.includes(r.id)));
  };

  const spinWheel = async () => {
    if (unassignedRegistrations.length === 0) return;
    if (roundMode) {
      await spinWheelRound();
    } else {
      await spinWheelSingle();
    }
  };

  const spinWheelSingle = async () => {
    setIsSpinning(true);
    setSpinResult(null);
    setRoundResults([]);

    // Show the loader for a moment, then pick a random player who actually fits a
    // team/pool and assign them.
    const spinDuration = 1500;
    await new Promise(resolve => setTimeout(resolve, spinDuration));

    if (isTeamCategory()) {
      await assignRandomPlayerToTeam();
    } else {
      await assignRandomPlayerToPool();
    }
    setIsSpinning(false);
  };

  // Picks a random unassigned player who can be placed under the quota rules,
  // scans for the team that fits them, and assigns them.
  const assignRandomPlayerToTeam = async () => {
    const categoryTeams = teams
      .filter(t => t.category === selectedCategory)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (categoryTeams.length === 0) return;

    const levelOf = makeLevelOf();
    const availableTopTiers = topTiersAvailable(unassignedRegistrations.map(r => r.expertiseLevel));

    // Random order, then take the first player who has a team that fits.
    const shuffled = [...unassignedRegistrations].sort(() => Math.random() - 0.5);
    for (const player of shuffled) {
      const team = selectQuotaTeamForPlayer(player.expertiseLevel, categoryTeams, levelOf, availableTopTiers);
      if (team) {
        await assignPlayerToTeam(player.id, team.id);
        setSpinResult({ ...player, assignedTeam: team.name });
        return;
      }
    }

    // Quota rules blocked everyone — try again without tier reservations (last-player fallback).
    const teamsWithCapacity = categoryTeams.filter(t => t.maxPlayers == null || t.players.length < t.maxPlayers);
    if (teamsWithCapacity.length > 0 && shuffled.length > 0) {
      const player = shuffled[0];
      const team = teamsWithCapacity.reduce((a, b) => a.players.length <= b.players.length ? a : b);
      await assignPlayerToTeam(player.id, team.id);
      setSpinResult({ ...player, assignedTeam: team.name });
      return;
    }

    alert({
      title: 'Teams Are Full',
      description: 'Every team has reached its maximum players, so no more players can be assigned.',
      variant: 'warning',
    });
  };

  const assignRandomPlayerToPool = async () => {
    const categoryPools = pools
      .filter(p => p.category === selectedCategory)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (categoryPools.length === 0) return;

    const idx = Math.floor(Math.random() * unassignedRegistrations.length);
    const player = unassignedRegistrations[idx];
    const targetPool = categoryPools.reduce((min, p) => (p.teams.length < min.teams.length ? p : min), categoryPools[0]);
    await assignPlayerToPool(player.id, targetPool.id);
    setSpinResult({ ...player, assignedTeam: targetPool.name });
  };

  const spinWheelRound = async () => {
    if (unassignedRegistrations.length === 0) return;

    const targets = isTeamCategory()
      ? teams.filter(t => t.category === selectedCategory).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
      : pools.filter(p => p.category === selectedCategory).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    if (targets.length === 0) return;

    setIsSpinning(true);
    setSpinResult(null);
    setRoundResults([]);
    setShowSpinDialog(true);

    const shuffledPlayers = [...unassignedRegistrations].sort(() => Math.random() - 0.5);

    setTimeout(async () => {
      setIsSpinning(false);

      const finalResults: SpinResult[] = [];

      if (isTeamCategory()) {
        const categoryTeams = targets as Team[];

        // Track local team compositions so each team builds toward one expert,
        // one advanced and one intermediate within the round (one player per team).
        const localPlayers: Record<string, string[]> = Object.fromEntries(
          categoryTeams.map(t => [t.id, [...t.players]])
        );
        const used = new Set<string>();
        const levelOf = makeLevelOf();

        // shuffledPlayers already randomised above; keep that order as the priority.
        for (const team of categoryTeams) {
          if (team.maxPlayers != null && localPlayers[team.id].length >= team.maxPlayers) continue;
          const available = shuffledPlayers.filter(p => !used.has(p.id)).map(p => p.id);
          const matchId = selectQuotaPlayerForTeam(available, localPlayers[team.id], levelOf);
          // Nothing suitable for this team (e.g. only surplus top-tier players
          // remain and it already has those tiers); skip it.
          if (!matchId) continue;
          const match = shuffledPlayers.find(p => p.id === matchId)!;

          used.add(match.id);
          localPlayers[team.id].push(match.id);
          await updateDoc(doc(db, 'tournaments', tournament.id, 'teams', team.id), {
            players: localPlayers[team.id],
            updatedAt: new Date(),
          });
          finalResults.push({ ...match, assignedTeam: team.name });
        }
      } else {
        const categoryPools = targets as Pool[];
        const playersForRound = shuffledPlayers.slice(0, Math.min(shuffledPlayers.length, categoryPools.length));
        for (let i = 0; i < playersForRound.length; i++) {
          const player = playersForRound[i];
          const pool = categoryPools[i % categoryPools.length];
          await updateDoc(doc(db, 'tournaments', tournament.id, 'pools', pool.id), {
            teams: [...pool.teams, player.id],
            updatedAt: new Date(),
          });
          finalResults.push({ ...player, assignedTeam: pool.name });
        }
      }

      setRoundResults(finalResults);
      await loadData();
      filterRegistrations();
    }, 3000);
  };

  const assignPlayerToTeam = async (registrationId: string, teamId: string) => {
    try {
      const team = teams.find(t => t.id === teamId);
      if (!team) return;
      await updateDoc(doc(db, 'tournaments', tournament.id, 'teams', teamId), {
        players: [...team.players, registrationId],
        updatedAt: new Date(),
      });
      await loadData();
      filterRegistrations();
      setSpinResult(null);
    } catch (error) {
      console.error('Error assigning player to team:', error);
    }
  };

  const assignPlayerToPool = async (registrationId: string, poolId: string) => {
    try {
      const pool = pools.find(p => p.id === poolId);
      if (!pool) return;
      await updateDoc(doc(db, 'tournaments', tournament.id, 'pools', poolId), {
        teams: [...pool.teams, registrationId],
        updatedAt: new Date(),
      });
      await loadData();
      filterRegistrations();
      setSpinResult(null);
    } catch (error) {
      console.error('Error assigning player to pool:', error);
    }
  };

  // Builds a fast resolver from player id to expertise level for the current registrations.
  const makeLevelOf = () => {
    const levelById = new Map(registrations.map(r => [r.id, r.expertiseLevel as string]));
    return (id: string) => levelById.get(id) ?? 'beginner';
  };

  const removePlayerFromTeam = async (registrationId: string, teamId: string) => {
    try {
      const team = teams.find(t => t.id === teamId);
      if (!team) return;
      await updateDoc(doc(db, 'tournaments', tournament.id, 'teams', teamId), {
        players: team.players.filter(id => id !== registrationId),
        updatedAt: new Date(),
      });
      await loadData();
      filterRegistrations();
    } catch (error) {
      console.error('Error removing player from team:', error);
    }
  };

  const autoAssignAllPlayers = async () => {
    if (!selectedCategory) return;

    if (isTeamCategory()) {
      const categoryTeams = teams.filter(t => t.category === selectedCategory);
      if (categoryTeams.length === 0) return;

      // Give each team one expert, one advanced and one intermediate, then fill
      // the rest with beginners. Surplus top-tier players are left unassigned.
      const { assignments } = assignByTierQuota(
        unassignedRegistrations.map(r => r.id),
        categoryTeams,
        makeLevelOf(),
      );

      await Promise.all(
        categoryTeams.map(team =>
          updateDoc(doc(db, 'tournaments', tournament.id, 'teams', team.id), {
            players: assignments[team.id],
            updatedAt: new Date(),
          })
        )
      );
      await loadData();
      filterRegistrations();
    } else {
      const categoryPools = pools.filter(p => p.category === selectedCategory);
      if (categoryPools.length === 0) return;
      let poolIndex = 0;
      for (const registration of unassignedRegistrations) {
        const pool = categoryPools[poolIndex % categoryPools.length];
        await assignPlayerToPool(registration.id, pool.id);
        poolIndex++;
      }
    }
  };

  const unassignAllPlayersFromCategory = async () => {
    if (!selectedCategory) return;
    try {
      if (isTeamCategory()) {
        const categoryTeams = teams.filter(t => t.category === selectedCategory);
        await Promise.all(categoryTeams.map(team =>
          updateDoc(doc(db, 'tournaments', tournament.id, 'teams', team.id), {
            players: [],
            updatedAt: new Date(),
          })
        ));
      } else {
        const categoryPools = pools.filter(p => p.category === selectedCategory);
        await Promise.all(categoryPools.map(pool =>
          updateDoc(doc(db, 'tournaments', tournament.id, 'pools', pool.id), {
            teams: [],
            updatedAt: new Date(),
          })
        ));
      }
      await loadData();
      filterRegistrations();
      setSpinResult(null);
      alert({
        title: 'Success',
        description: `All players have been unassigned from ${selectedCategory} ${isTeamCategory() ? 'teams' : 'pools'}. You can now run the wheel again.`,
        variant: 'success',
      });
    } catch (error) {
      console.error('Error unassigning all players:', error);
      alert({ title: 'Error', description: 'Failed to unassign all players. Please try again.', variant: 'error' });
    }
  };

  const handleUnassignAll = () => {
    if (!selectedCategory) {
      alert({ title: 'No Category Selected', description: 'Please select a category first.', variant: 'warning' });
      return;
    }

    let totalAssigned = 0;
    if (isTeamCategory()) {
      totalAssigned = teams.filter(t => t.category === selectedCategory).reduce((sum, t) => sum + t.players.length, 0);
    } else {
      totalAssigned = pools.filter(p => p.category === selectedCategory).reduce((sum, p) => sum + p.teams.length, 0);
    }

    if (totalAssigned === 0) {
      alert({ title: 'No Players Assigned', description: `There are no players assigned to ${isTeamCategory() ? 'teams' : 'pools'} in this category.`, variant: 'warning' });
      return;
    }

    confirm({
      title: `Unassign All Players`,
      description: `Are you sure you want to unassign all ${totalAssigned} players from ${selectedCategory} ${isTeamCategory() ? 'teams' : 'pools'}? This will reset all assignments and allow you to run the wheel again.`,
      confirmText: 'Unassign All',
      cancelText: 'Cancel',
      variant: 'destructive',
      onConfirm: unassignAllPlayersFromCategory,
    });
  };

  const getStats = () => {
    if (!selectedCategory) return null;
    const totalPlayers = filteredRegistrations.length;
    const totalUnassigned = unassignedRegistrations.length;
    const totalAssigned = totalPlayers - totalUnassigned;

    if (isTeamCategory()) {
      const categoryTeams = teams.filter(t => t.category === selectedCategory);
      const assignedFiltered = categoryTeams.reduce((sum, team) => {
        return sum + team.players.filter(pid => filteredRegistrations.some(r => r.id === pid)).length;
      }, 0);
      return {
        totalPlayers,
        totalAssigned: assignedFiltered,
        totalUnassigned,
        bucketsCount: categoryTeams.length,
        averagePerBucket: categoryTeams.length > 0 ? Math.round(assignedFiltered / categoryTeams.length) : 0,
        bucketLabel: 'Team',
      };
    } else {
      const categoryPools = pools.filter(p => p.category === selectedCategory);
      const assignedFiltered = categoryPools.reduce((sum, pool) => {
        return sum + pool.teams.filter(pid => filteredRegistrations.some(r => r.id === pid)).length;
      }, 0);
      return {
        totalPlayers,
        totalAssigned: assignedFiltered,
        totalUnassigned,
        bucketsCount: categoryPools.length,
        averagePerBucket: categoryPools.length > 0 ? Math.round(assignedFiltered / categoryPools.length) : 0,
        bucketLabel: 'Pool',
      };
    }
  };

  const PlayerAvatar = ({ registration, size = 'md' }: { registration: Registration; size?: 'sm' | 'md' | 'lg' }) => {
    const initials = registration.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    const sizeClasses = { sm: 'w-10 h-10 text-sm', md: 'w-16 h-16 text-lg', lg: 'w-24 h-24 text-2xl' };
    const px = { sm: 40, md: 64, lg: 96 }[size];
    return registration.profilePhotoUrl ? (
      <div className={`${sizeClasses[size]} rounded-full overflow-hidden flex-shrink-0`}>
        <Image src={registration.profilePhotoUrl} alt={registration.name} width={px} height={px} className="object-cover w-full h-full" />
      </div>
    ) : (
      <div className={`${sizeClasses[size]} rounded-full bg-gray-800 text-white flex items-center justify-center font-bold flex-shrink-0`}>
        {initials}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 gap-6">
        {/* Layered spinning rings */}
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-violet-500 border-r-violet-300 animate-spin" style={{ animationDuration: '0.9s' }} />
          <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-pink-500 border-r-pink-300 animate-spin" style={{ animationDuration: '1.3s', animationDirection: 'reverse' }} />
          <div className="absolute inset-4 rounded-full border-4 border-transparent border-t-cyan-500 border-r-cyan-300 animate-spin" style={{ animationDuration: '0.7s' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <Shuffle className="h-5 w-5 text-violet-500 animate-pulse" />
          </div>
        </div>
        {/* Bouncing dots */}
        <div className="flex gap-2">
          {['bg-violet-500', 'bg-pink-500', 'bg-cyan-500', 'bg-amber-500'].map((color, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${color} animate-bounce`}
              style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.8s' }}
            />
          ))}
        </div>
        <p className="text-sm font-semibold uppercase tracking-widest bg-gradient-to-r from-violet-500 via-pink-500 to-cyan-500 bg-clip-text text-transparent animate-pulse">
          Loading…
        </p>
      </div>
    );
  }

  const stats = getStats();
  const categoryTargets = isTeamCategory()
    ? teams.filter(t => t.category === selectedCategory)
    : pools.filter(p => p.category === selectedCategory);
  const bucketLabel = isTeamCategory() ? 'team' : 'pool';

  return (
    <div className="space-y-3">
      {/* Single card — no pool warning sits above it */}
      {selectedCategory && !isTeamCategory() && pools.filter(p => p.category === selectedCategory).length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No pools found for this category. Create pools in the <strong>Pools</strong> tab first, then come back to spin.
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Left: Stats KPIs */}
            {stats ? (
              <div className="flex gap-2 shrink-0">
                {[
                  { value: stats.totalPlayers,    label: 'Total',           bg: 'bg-blue-50',   fg: 'text-blue-600'   },
                  { value: stats.totalAssigned,   label: 'Assigned',        bg: 'bg-green-50',  fg: 'text-green-600'  },
                  { value: stats.totalUnassigned, label: 'Unassigned',      bg: 'bg-orange-50', fg: 'text-orange-600' },
                  { value: stats.averagePerBucket,label: `Avg/${stats.bucketLabel}`, bg: 'bg-purple-50', fg: 'text-purple-600' },
                ].map(({ value, label, bg, fg }) => (
                  <div key={label} className={`text-center px-3 py-2 rounded-lg ${bg}`}>
                    <div className={`text-xl font-bold ${fg}`}>{value}</div>
                    <div className="text-[10px] text-gray-500 leading-tight">{label}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div />
            )}

            {/* Right: all controls */}
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as CategoryType)}>
                <SelectTrigger className="w-40 h-8 text-sm">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {tournament.categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={roundMode}
                  onChange={(e) => setRoundMode(e.target.checked)}
                  className="w-3.5 h-3.5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Round mode</span>
              </label>
              <Button size="sm" onClick={autoAssignAllPlayers} disabled={!selectedCategory || unassignedRegistrations.length === 0}>
                <Zap className="h-4 w-4 mr-1.5" />
                Auto Assign All
              </Button>
              <Button
                size="sm"
                onClick={handleUnassignAll}
                disabled={!selectedCategory}
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400"
              >
                <RotateCcw className="h-4 w-4 mr-1.5" />
                Unassign All
              </Button>
            </div>
          </div>
          {/* Round mode info strip */}
          {roundMode && selectedCategory && (
            <p className="text-xs text-blue-600 mt-1">
              Round — {Math.min(unassignedRegistrations.length, categoryTargets.length)} players → {categoryTargets.length} {bucketLabel}s
            </p>
          )}
        </CardHeader>
        <CardContent>
              {(() => {
                /* ── Orbital bubble layout ── */
                const HALF = 360;
                const AVATAR = 46;
                const RADII = [108, 170, 234, 298];
                const SPACING = 54;
                const positions: { x: number; y: number }[] = [];
                let remaining = unassignedRegistrations.length;
                for (const r of RADII) {
                  if (remaining <= 0) break;
                  const n = Math.min(remaining, Math.floor((2 * Math.PI * r) / SPACING));
                  for (let i = 0; i < n; i++) {
                    const a = (i / n) * 2 * Math.PI - Math.PI / 2;
                    positions.push({ x: Math.round(r * Math.cos(a)), y: Math.round(r * Math.sin(a)) });
                  }
                  remaining -= n;
                }
                const bubbleColors = [
                  'from-blue-600 to-blue-400','from-purple-600 to-purple-400','from-emerald-600 to-emerald-400',
                  'from-rose-600 to-rose-400','from-amber-600 to-amber-400','from-cyan-600 to-cyan-400',
                  'from-indigo-600 to-indigo-400','from-teal-600 to-teal-400','from-pink-600 to-pink-400',
                  'from-orange-600 to-orange-400',
                ];

                return (
                  <div className="flex flex-col items-center gap-2 py-2">
                    {roundMode && (
                      <div className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200 text-center">
                        <span className="font-semibold">Round Mode — </span>
                        {Math.min(unassignedRegistrations.length, categoryTargets.length)} players → {categoryTargets.length} {bucketLabel}s
                      </div>
                    )}

                    {/* Orbital canvas */}
                    <div className="relative overflow-x-auto w-full">
                      <div className="relative mx-auto" style={{ width: HALF * 2, height: HALF * 2, minWidth: HALF * 2 }}>

                        {/* Faint orbit rings */}
                        {RADII.slice(0, Math.ceil(unassignedRegistrations.length / 5) || 1).map(r => (
                          <div key={r} className="absolute rounded-full border border-dashed border-gray-200 pointer-events-none"
                            style={{ width: r * 2, height: r * 2, left: HALF - r, top: HALF - r }} />
                        ))}

                        {/* Player avatar bubbles */}
                        {unassignedRegistrations.map((reg, i) => {
                          if (!positions[i]) return null;
                          const pos = positions[i];
                          const initials = reg.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();
                          const color = bubbleColors[reg.name.charCodeAt(0) % bubbleColors.length];
                          const isSelected = spinResult?.id === reg.id && !isSpinning;
                          return (
                            <div
                              key={reg.id}
                              title={reg.name}
                              className="absolute transition-all duration-300"
                              style={{
                                width: AVATAR, height: AVATAR,
                                left: HALF + pos.x - AVATAR / 2,
                                top: HALF + pos.y - AVATAR / 2,
                              }}
                            >
                              <div className={`w-full h-full rounded-full overflow-hidden border-2 shadow-md transition-all duration-300 ${
                                isSelected
                                  ? 'border-green-400 ring-4 ring-green-300 scale-125 shadow-green-300'
                                  : isSpinning
                                    ? 'border-white/60 opacity-60'
                                    : 'border-white hover:scale-110 hover:shadow-lg'
                              }`}>
                                {reg.profilePhotoUrl ? (
                                  <Image src={reg.profilePhotoUrl} alt={reg.name} width={AVATAR} height={AVATAR} className="object-cover w-full h-full object-top" />
                                ) : (
                                  <div className={`w-full h-full bg-gradient-to-br ${color} flex items-center justify-center text-white text-[11px] font-bold`}>
                                    {initials}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Center: SPIN button or spinner or all-done */}
                        <div className="absolute" style={{ left: HALF - 56, top: HALF - 56, width: 112, height: 112 }}>
                          {unassignedRegistrations.length === 0 ? (
                            <div className="w-full h-full rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex flex-col items-center justify-center shadow-xl text-white text-center">
                              <Trophy className="h-7 w-7 mb-0.5" />
                              <span className="text-[10px] font-bold uppercase tracking-wide">Done!</span>
                            </div>
                          ) : isSpinning ? (
                            <div className="w-full h-full relative">
                              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-violet-400 via-pink-400 to-cyan-400 opacity-25 animate-ping" style={{ animationDuration: '1s' }} />
                              <div className="absolute inset-0 rounded-full border-[5px] border-transparent border-t-violet-500 border-r-violet-300 animate-spin" style={{ animationDuration: '0.75s' }} />
                              <div className="absolute inset-[10px] rounded-full border-[5px] border-transparent border-t-pink-500 border-r-pink-300 animate-spin" style={{ animationDuration: '1.1s', animationDirection: 'reverse' }} />
                              <div className="absolute inset-[22px] rounded-full border-[4px] border-transparent border-t-cyan-500 border-r-cyan-300 animate-spin" style={{ animationDuration: '0.6s' }} />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 via-pink-500 to-cyan-500 flex items-center justify-center shadow-lg animate-pulse">
                                  <Shuffle className="h-6 w-6 text-white" />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={spinWheel}
                              disabled={!selectedCategory || unassignedRegistrations.length === 0 || (!isTeamCategory() && categoryTargets.length === 0)}
                              className="w-full h-full rounded-full bg-gray-900 text-white font-extrabold text-xl shadow-2xl hover:scale-105 hover:bg-gray-700 active:scale-95 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 select-none"
                            >
                              {roundMode ? 'ROUND!' : 'SPIN!'}
                            </button>
                          )}
                        </div>

                      </div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
        </Card>

      {ConfirmDialogComponent}
      {AlertDialogComponent}

      {/* Single spin — congrats popup */}
      {spinResult && !isSpinning && !roundMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden" style={{ animation: 'spinResultIn 0.35s cubic-bezier(0.34,1.56,0.64,1)' }}>
            {/* Celebratory header — solid amber/yellow */}
            <div className="relative bg-amber-400 px-6 pt-8 pb-6 text-center overflow-hidden">
              {/* Sparkle dots */}
              {[...Array(8)].map((_, i) => (
                <div key={i} className="absolute w-1.5 h-1.5 rounded-full bg-white/60 animate-ping"
                  style={{ top: `${10 + (i * 11) % 70}%`, left: `${5 + (i * 13) % 90}%`, animationDelay: `${i * 0.15}s`, animationDuration: '1.4s' }} />
              ))}
              <div className="relative">
                <div className="text-5xl mb-3 leading-none">🎉</div>
                <p className="text-white font-extrabold text-lg uppercase tracking-widest drop-shadow">Congratulations!</p>
                <p className="text-white/80 text-xs mt-0.5 font-medium">Player Selected</p>
                {/* Avatar inside header */}
                <div className="flex justify-center mt-5">
                  <div className="ring-4 ring-white/60 rounded-full shadow-lg">
                    <PlayerAvatar registration={spinResult} size="lg" />
                  </div>
                </div>
              </div>
            </div>

            {/* Player info */}
            <div className="px-6 py-5 text-center">
              <h3 className="text-xl font-bold text-gray-900 mb-0.5">{spinResult.name}</h3>
              {(spinResult.tower || spinResult.flatNumber) && (
                <p className="text-sm text-gray-500 mb-3">{spinResult.tower || ''}{spinResult.flatNumber ? ` - ${spinResult.flatNumber}` : ''}</p>
              )}

              {spinResult.assignedTeam ? (
                <div className="mt-2 p-3 bg-green-50 rounded-xl border border-green-200">
                  <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wide mb-0.5">Assigned to</p>
                  <div className="flex items-center justify-center gap-1.5 text-base font-bold text-green-800">
                    <Target className="h-4 w-4" />
                    {spinResult.assignedTeam}
                  </div>
                </div>
              ) : isTeamCategory() ? (
                <div className="space-y-2 mt-2">
                  <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select team" /></SelectTrigger>
                    <SelectContent>
                      {teams.filter(t => t.category === selectedCategory).map(team => (
                        <SelectItem key={team.id} value={team.id}>{team.name} ({team.players.length})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button className="w-full" onClick={() => assignPlayerToTeam(spinResult.id, selectedTeam)} disabled={!selectedTeam}>
                    Assign to Team
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 mt-2">
                  <Select value={selectedPool} onValueChange={setSelectedPool}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select pool" /></SelectTrigger>
                    <SelectContent>
                      {pools.filter(p => p.category === selectedCategory).map(pool => (
                        <SelectItem key={pool.id} value={pool.id}>{pool.name} ({pool.teams.length})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button className="w-full" onClick={() => assignPlayerToPool(spinResult.id, selectedPool)} disabled={!selectedPool}>
                    Assign to Pool
                  </Button>
                </div>
              )}

              <Button variant="outline" className="w-full mt-3" onClick={() => setSpinResult(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Round mode dialog */}
      {showSpinDialog && roundMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            {isSpinning ? (
              <div className="p-12 text-center">
                <div className="flex justify-center mb-6">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-[4px] border-transparent border-t-violet-500 border-r-violet-300 animate-spin" style={{ animationDuration: '0.8s' }} />
                    <div className="absolute inset-2 rounded-full border-[4px] border-transparent border-t-pink-500 border-r-pink-300 animate-spin" style={{ animationDuration: '1.2s', animationDirection: 'reverse' }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <RefreshCw className="h-5 w-5 text-violet-500 animate-pulse" />
                    </div>
                  </div>
                </div>
                <p className="text-sm font-bold uppercase tracking-widest bg-gradient-to-r from-violet-500 via-pink-500 to-cyan-500 bg-clip-text text-transparent animate-pulse">
                  Assigning Players…
                </p>
              </div>
            ) : (
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <RefreshCw className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-bold text-gray-900">Round Complete!</h3>
                  <span className="ml-auto text-sm text-gray-400">{roundResults.length} assigned</span>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {roundResults.map(result => (
                    <div key={result.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <PlayerAvatar registration={result} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{result.name}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 bg-blue-100 text-blue-800 rounded-lg px-2.5 py-1 text-xs font-semibold">
                        <Target className="h-3 w-3" />
                        {result.assignedTeam}
                      </div>
                    </div>
                  ))}
                </div>
                <Button className="w-full mt-4" onClick={() => setShowSpinDialog(false)}>
                  Done
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
