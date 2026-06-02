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
import { Shuffle, Users, Target, Zap, RotateCcw, RefreshCw } from 'lucide-react';
import Image from 'next/image';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAlertDialog } from '@/components/ui/alert-dialog-component';
import { assignByTierQuota, selectQuotaTeamForPlayer, selectQuotaPlayerForTeam } from '@/lib/teamAssignment';

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
    setShowSpinDialog(true);

    const spinDuration = 2000;
    const spinIntervalId = setInterval(() => {
      const idx = Math.floor(Math.random() * unassignedRegistrations.length);
      setSpinResult(unassignedRegistrations[idx]);
    }, 50);

    setTimeout(async () => {
      clearInterval(spinIntervalId);
      setIsSpinning(false);
      const finalIndex = Math.floor(Math.random() * unassignedRegistrations.length);
      const selectedPlayer = unassignedRegistrations[finalIndex];
      setSpinResult(selectedPlayer);
      if (isTeamCategory()) {
        await autoAssignPlayerToNextTeam(selectedPlayer);
      } else {
        await autoAssignPlayerToNextPool(selectedPlayer);
      }
    }, spinDuration);
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

    const playersToAssign = Math.min(unassignedRegistrations.length, targets.length);
    const shuffledPlayers = [...unassignedRegistrations].sort(() => Math.random() - 0.5);
    const selectedPlayers = shuffledPlayers.slice(0, playersToAssign);

    const spinIntervalId = setInterval(() => {
      setRoundResults(selectedPlayers.map(player => ({
        ...player,
        assignedTeam: targets[Math.floor(Math.random() * targets.length)].name,
      })));
    }, 100);

    setTimeout(async () => {
      clearInterval(spinIntervalId);
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
        for (let i = 0; i < selectedPlayers.length; i++) {
          const player = selectedPlayers[i];
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

  const autoAssignPlayerToNextTeam = async (player: Registration) => {
    try {
      const categoryTeams = teams
        .filter(t => t.category === selectedCategory)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      if (categoryTeams.length === 0) return;

      // Place the player on a team that still needs their tier (beginners go to
      // the smallest team). A surplus expert/advanced/intermediate has no eligible
      // team and is left unassigned.
      const targetTeam = selectQuotaTeamForPlayer(player.expertiseLevel, categoryTeams, makeLevelOf());
      if (!targetTeam) {
        alert({
          title: 'No Team Available',
          description: `Every team already has ${player.expertiseLevel === 'expert' ? 'an' : 'a'} ${player.expertiseLevel} player. Each team holds at most one expert, one advanced and one intermediate, so this player was left unassigned.`,
          variant: 'warning',
        });
        setSpinResult(null);
        return;
      }

      await updateDoc(doc(db, 'tournaments', tournament.id, 'teams', targetTeam.id), {
        players: [...targetTeam.players, player.id],
        updatedAt: new Date(),
      });
      await loadData();
      filterRegistrations();
      setSpinResult({ ...player, assignedTeam: targetTeam.name });
    } catch (error) {
      console.error('Error auto-assigning player to team:', error);
    }
  };

  const autoAssignPlayerToNextPool = async (player: Registration) => {
    try {
      const categoryPools = pools
        .filter(p => p.category === selectedCategory)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      if (categoryPools.length === 0) return;

      const targetPool = categoryPools.reduce((min, p) => p.teams.length < min.teams.length ? p : min, categoryPools[0]);
      await updateDoc(doc(db, 'tournaments', tournament.id, 'pools', targetPool.id), {
        teams: [...targetPool.teams, player.id],
        updatedAt: new Date(),
      });
      await loadData();
      filterRegistrations();
      setSpinResult({ ...player, assignedTeam: targetPool.name });
    } catch (error) {
      console.error('Error auto-assigning player to pool:', error);
    }
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
      const { assignments, unassigned } = assignByTierQuota(
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

      if (unassigned.length > 0) {
        alert({
          title: 'Some Players Left Unassigned',
          description: `${unassigned.length} player(s) could not be placed. Each team holds at most one expert, one advanced and one intermediate, so surplus players of those levels were left unassigned.`,
          variant: 'warning',
        });
      }
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
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const stats = getStats();
  const categoryTargets = isTeamCategory()
    ? teams.filter(t => t.category === selectedCategory)
    : pools.filter(p => p.category === selectedCategory);
  const bucketLabel = isTeamCategory() ? 'team' : 'pool';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Spin the Wheel</h2>
          <p className="text-gray-600">Assign players to {bucketLabel}s randomly</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as CategoryType)}>
            <SelectTrigger className="w-44 h-8 text-sm">
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
          <Button onClick={autoAssignAllPlayers} disabled={!selectedCategory || unassignedRegistrations.length === 0}>
            <Zap className="h-4 w-4 mr-2" />
            Auto Assign All
          </Button>
          <Button
            onClick={handleUnassignAll}
            disabled={!selectedCategory}
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Unassign All
          </Button>
        </div>
      </div>

      {selectedCategory && (
        <>
          {/* No pools warning for non-team categories */}
          {!isTeamCategory() && pools.filter(p => p.category === selectedCategory).length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No pools found for this category. Create pools in the <strong>Pools</strong> tab first, then come back to spin.
            </div>
          )}

          {/* Spin Wheel + Unassigned Players */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shuffle className="h-5 w-5" />
                {roundMode ? 'Round Assignment' : 'Spin the Wheel'}
                <span className="ml-1 text-sm font-normal text-gray-500">
                  — {unassignedRegistrations.length} unassigned
                </span>
              </CardTitle>
              <CardDescription>
                {roundMode
                  ? `Assign multiple players to all ${bucketLabel}s in one round`
                  : `Randomly assign unassigned players to ${bucketLabel}s`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-6">
                {/* Left: Spin button */}
                <div className="flex flex-col items-center gap-4 w-48 shrink-0 pt-2">
                  {roundMode && (
                    <div className="text-xs text-blue-600 bg-blue-50 p-2.5 rounded-lg border border-blue-200 text-center w-full">
                      <div className="font-medium mb-0.5">Round Mode</div>
                      <div>
                        {Math.min(unassignedRegistrations.length, categoryTargets.length)} players →{' '}
                        {categoryTargets.length} {bucketLabel}s
                      </div>
                    </div>
                  )}
                  <Button
                    onClick={spinWheel}
                    disabled={unassignedRegistrations.length === 0 || isSpinning || (!isTeamCategory() && categoryTargets.length === 0)}
                    size="lg"
                    className="w-32 h-32 rounded-full text-lg font-bold"
                  >
                    {roundMode ? 'ROUND!' : 'SPIN!'}
                  </Button>
                </div>

                {/* Right: Unassigned Players grid */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="h-4 w-4 text-gray-600" />
                    <h3 className="text-sm font-semibold text-gray-700">
                      Unassigned Players ({unassignedRegistrations.length})
                    </h3>
                  </div>

                  {unassignedRegistrations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-center">
                      <Users className="h-10 w-10 text-gray-300 mb-3" />
                      <p className="text-sm font-medium text-gray-700">All players assigned!</p>
                      <p className="text-xs text-gray-500 mt-1">All players have been assigned to {bucketLabel}s</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                      {unassignedRegistrations.map(registration => {
                        const isSelected = !isSpinning && spinResult?.id === registration.id;
                        const initials = registration.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
                        const partnerInitials = registration.partnerName
                          ? registration.partnerName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                          : '';
                        const cardColors = [
                          'from-blue-900 to-blue-700',
                          'from-purple-900 to-purple-700',
                          'from-emerald-900 to-emerald-700',
                          'from-rose-900 to-rose-700',
                          'from-amber-900 to-amber-700',
                          'from-cyan-900 to-cyan-700',
                          'from-indigo-900 to-indigo-700',
                          'from-teal-900 to-teal-700',
                        ];
                        const colorClass = cardColors[registration.name.charCodeAt(0) % cardColors.length];
                        const partnerColorClass = cardColors[(registration.partnerName?.charCodeAt(0) ?? 1) % cardColors.length];
                        const isDoubles = selectedCategory === 'mixed-doubles' || selectedCategory === 'family-doubles';
                        const showPartner = isDoubles && !!registration.partnerName;

                        return (
                          <div
                            key={registration.id}
                            className={`group relative rounded-xl overflow-hidden border shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 bg-white ${
                              isSelected
                                ? 'border-green-500 ring-2 ring-green-400 scale-105 shadow-green-200'
                                : 'border-gray-200'
                            }`}
                          >
                            <div className={`relative bg-gradient-to-b ${colorClass} overflow-hidden`} style={{ aspectRatio: '3/4' }}>
                              {/* Primary player — full card */}
                              {registration.profilePhotoUrl ? (
                                <Image
                                  src={registration.profilePhotoUrl}
                                  alt={registration.name}
                                  fill
                                  className="object-cover object-top"
                                />
                              ) : (
                                <div className="flex h-full flex-col items-center justify-center gap-2">
                                  <div className="w-20 h-20 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-white text-3xl font-bold">
                                    {initials}
                                  </div>
                                </div>
                              )}
                              <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/60 to-transparent" />
                              {/* Partner thumbnail — bottom-right circle */}
                              {showPartner && (
                                <div className="absolute bottom-2 right-2 w-16 h-16 rounded-full border-2 border-white shadow-lg overflow-hidden">
                                  {registration.partnerProfilePhotoUrl ? (
                                    <Image
                                      src={registration.partnerProfilePhotoUrl}
                                      alt={registration.partnerName ?? 'Partner'}
                                      fill
                                      className="object-cover object-top"
                                    />
                                  ) : (
                                    <div className={`w-full h-full bg-gradient-to-b ${partnerColorClass} flex items-center justify-center text-white text-sm font-bold`}>
                                      {partnerInitials}
                                    </div>
                                  )}
                                </div>
                              )}
                              {isSelected && (
                                <div className="absolute top-2 left-2">
                                  <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white bg-green-500">
                                    Selected
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="px-2 py-2 text-center">
                              <p className="text-xs font-bold uppercase tracking-wide leading-tight truncate" title={registration.name}>
                                {registration.name}
                              </p>
                              {showPartner && registration.partnerName && (
                                <p className="text-xs font-bold uppercase tracking-wide leading-tight truncate" title={registration.partnerName}>
                                  & {registration.partnerName}
                                </p>
                              )}
                              {(registration.tower || registration.flatNumber) && (
                                <p className="text-[10px] text-gray-500 mt-0.5">
                                  {registration.tower || ''}{registration.flatNumber ? ` - ${registration.flatNumber}` : ''}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          {stats && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  {stats.bucketLabel} Statistics
                </CardTitle>
                <CardDescription>
                  Current {stats.bucketLabel.toLowerCase()} composition and balance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{stats.totalPlayers}</div>
                    <div className="text-sm text-gray-600">Total Players</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{stats.totalAssigned}</div>
                    <div className="text-sm text-gray-600">Assigned</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">{stats.totalUnassigned}</div>
                    <div className="text-sm text-gray-600">Unassigned</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{stats.averagePerBucket}</div>
                    <div className="text-sm text-gray-600">Avg per {stats.bucketLabel}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {ConfirmDialogComponent}
      {AlertDialogComponent}

      {/* Spin Dialog Overlay */}
      {showSpinDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {isSpinning ? (
              /* ── Spinning state ── */
              <div className="p-8 text-center">
                <p className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-6">
                  {roundMode ? 'Selecting players…' : 'Spinning…'}
                </p>
                {!roundMode && spinResult && (
                  <div className="flex flex-col items-center gap-3 animate-pulse">
                    <PlayerAvatar registration={spinResult} size="lg" />
                    <p className="text-xl font-bold text-gray-900">{spinResult.name}</p>
                  </div>
                )}
                {roundMode && roundResults.length > 0 && (
                  <div className="space-y-2 max-h-72 overflow-y-auto text-left">
                    {roundResults.map(r => (
                      <div key={r.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                        <PlayerAvatar registration={r} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{r.name}</p>
                        </div>
                        <span className="text-xs font-semibold text-blue-600 shrink-0">→ {r.assignedTeam}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-8 flex justify-center gap-1.5">
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="inline-block w-2.5 h-2.5 rounded-full bg-gray-800 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            ) : roundMode ? (
              /* ── Round complete ── */
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
            ) : spinResult ? (
              /* ── Single spin result ── */
              <div className="p-8 text-center">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-5">
                  Player Selected!
                </p>
                <div className="flex justify-center mb-4">
                  <PlayerAvatar registration={spinResult} size="lg" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-1">{spinResult.name}</h3>
                {(spinResult.tower || spinResult.flatNumber) && (
                  <p className="text-sm text-gray-500 mb-3">
                    {spinResult.tower || ''}{spinResult.flatNumber ? ` - ${spinResult.flatNumber}` : ''}
                  </p>
                )}
                {spinResult.assignedTeam ? (
                  <div className="mt-2 p-4 bg-green-50 rounded-xl border border-green-200">
                    <p className="text-xs text-green-600 font-medium mb-1 uppercase tracking-wide">Assigned to</p>
                    <div className="flex items-center justify-center gap-2 text-xl font-bold text-green-800">
                      <Target className="h-5 w-5" />
                      {spinResult.assignedTeam}
                    </div>
                  </div>
                ) : isTeamCategory() ? (
                  <div className="space-y-2 mt-2">
                    <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select team" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.filter(t => t.category === selectedCategory).map(team => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name} ({team.players.length})
                          </SelectItem>
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
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select pool" />
                      </SelectTrigger>
                      <SelectContent>
                        {pools.filter(p => p.category === selectedCategory).map(pool => (
                          <SelectItem key={pool.id} value={pool.id}>
                            {pool.name} ({pool.teams.length})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button className="w-full" onClick={() => assignPlayerToPool(spinResult.id, selectedPool)} disabled={!selectedPool}>
                      Assign to Pool
                    </Button>
                  </div>
                )}

                <Button variant="outline" className="w-full mt-3" onClick={() => setShowSpinDialog(false)}>
                  Close
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
