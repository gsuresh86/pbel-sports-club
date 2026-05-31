'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Team, Registration, Tournament, CategoryType } from '@/types';
import { Shuffle, Users, Target, Crown, Zap, RotateCcw, RefreshCw } from 'lucide-react';
import Image from 'next/image';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAlertDialog } from '@/components/ui/alert-dialog-component';

interface SpinWheelProps {
  tournament: Tournament;
  user: { id: string; role: string; email: string };
}

interface SpinResult extends Registration {
  assignedTeam?: string;
}

export default function SpinWheel({ tournament, user }: SpinWheelProps) {
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();
  const { alert, AlertDialogComponent } = useAlertDialog();
  
  const [teams, setTeams] = useState<Team[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<CategoryType | ''>('');
  const [selectedGender, setSelectedGender] = useState<'male' | 'female' | 'all'>('all');
  const [selectedLevel, setSelectedLevel] = useState<'beginner' | 'intermediate' | 'advanced' | 'expert' | 'all'>('all');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<SpinResult | null>(null);
  const [filteredRegistrations, setFilteredRegistrations] = useState<Registration[]>([]);
  const [unassignedRegistrations, setUnassignedRegistrations] = useState<Registration[]>([]);
  const [roundMode, setRoundMode] = useState(false);
  const [roundResults, setRoundResults] = useState<SpinResult[]>([]);

  useEffect(() => {
    loadData();
  }, [tournament.id]);

  useEffect(() => {
    if (selectedCategory) {
      filterRegistrations();
    }
  }, [selectedCategory, selectedGender, selectedLevel, registrations, teams]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadTeams(),
      loadRegistrations(),
    ]);
    setLoading(false);
  };

  const loadTeams = async () => {
    try {
      const teamsSnapshot = await getDocs(
        query(collection(db, 'tournaments', tournament.id, 'teams'), orderBy('createdAt', 'desc'))
      );
      const teamsData = teamsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Team[];
      setTeams(teamsData);
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  };

  const loadRegistrations = async () => {
    try {
      const registrationsSnapshot = await getDocs(
        query(collection(db, 'tournaments', tournament.id, 'registrations'), orderBy('registeredAt', 'desc'))
      );
      const registrationsData = registrationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        registeredAt: doc.data().registeredAt?.toDate(),
        paymentVerifiedAt: doc.data().paymentVerifiedAt?.toDate(),
      })) as Registration[];
      setRegistrations(registrationsData);
    } catch (error) {
      console.error('Error loading registrations:', error);
    }
  };

  const filterRegistrations = () => {
    if (!selectedCategory) return;

    let filtered = registrations.filter(registration => registration.selectedCategory === selectedCategory);

    // Filter by gender
    if (selectedGender !== 'all') {
      filtered = filtered.filter(registration => registration.gender === selectedGender);
    }

    // Filter by expertise level
    if (selectedLevel !== 'all') {
      filtered = filtered.filter(registration => registration.expertiseLevel === selectedLevel);
    }

    setFilteredRegistrations(filtered);

    // Get unassigned registrations (not in any team)
    const assignedPlayerIds = teams
      .filter(team => team.category === selectedCategory)
      .flatMap(team => team.players);

    const unassigned = filtered.filter(registration => !assignedPlayerIds.includes(registration.id));
    setUnassignedRegistrations(unassigned);
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

    // Simulate spinning animation
    const spinDuration = 2000; // 2 seconds
    const spinInterval = 50; // Update every 50ms
    let currentIndex = 0;
    const totalUpdates = spinDuration / spinInterval;

    const spinIntervalId = setInterval(() => {
      currentIndex = Math.floor(Math.random() * unassignedRegistrations.length);
      setSpinResult(unassignedRegistrations[currentIndex]);
    }, spinInterval);

    setTimeout(async () => {
      clearInterval(spinIntervalId);
      setIsSpinning(false);
      
      // Final result
      const finalIndex = Math.floor(Math.random() * unassignedRegistrations.length);
      const selectedPlayer = unassignedRegistrations[finalIndex];
      setSpinResult(selectedPlayer);
      
      // Automatically assign to the next available team
      await autoAssignPlayerToNextTeam(selectedPlayer);
    }, spinDuration);
  };

  const spinWheelRound = async () => {
    if (unassignedRegistrations.length === 0) return;

    const categoryTeams = teams
      .filter(team => team.category === selectedCategory)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    if (categoryTeams.length === 0) return;

    setIsSpinning(true);
    setSpinResult(null);
    setRoundResults([]);

    // Calculate how many players to assign in this round
    const playersToAssign = Math.min(
      unassignedRegistrations.length,
      categoryTeams.length
    );

    // Shuffle unassigned players
    const shuffledPlayers = [...unassignedRegistrations].sort(() => Math.random() - 0.5);
    const selectedPlayers = shuffledPlayers.slice(0, playersToAssign);

    // Simulate spinning animation for round
    const spinDuration = 3000; // 3 seconds for round
    const spinInterval = 100; // Update every 100ms

    const spinIntervalId = setInterval(() => {
      // Show random selection of players during spinning
      const randomSelection = selectedPlayers.map(player => ({
        ...player,
        assignedTeam: categoryTeams[Math.floor(Math.random() * categoryTeams.length)].name
      }));
      setRoundResults(randomSelection);
    }, spinInterval);

    setTimeout(async () => {
      clearInterval(spinIntervalId);
      setIsSpinning(false);
      
      // Assign players to teams in round-robin fashion
      const finalResults: SpinResult[] = [];
      
      for (let i = 0; i < selectedPlayers.length; i++) {
        const player = selectedPlayers[i];
        const team = categoryTeams[i % categoryTeams.length];
        
        // Assign player to team
        const updatedPlayers = [...team.players, player.id];
        await updateDoc(doc(db, 'tournaments', tournament.id, 'teams', team.id), {
          players: updatedPlayers,
          updatedAt: new Date(),
        });

        finalResults.push({
          ...player,
          assignedTeam: team.name
        });
      }

      setRoundResults(finalResults);
      
      // Refresh data to update unassigned players
      await loadData();
      filterRegistrations();
      
    }, spinDuration);
  };

  const assignPlayerToTeam = async (registrationId: string, teamId: string) => {
    try {
      const team = teams.find(t => t.id === teamId);
      if (!team) return;

      const updatedPlayers = [...team.players, registrationId];
      await updateDoc(doc(db, 'tournaments', tournament.id, 'teams', teamId), {
        players: updatedPlayers,
        updatedAt: new Date(),
      });

      // Refresh data
      await loadData();
      filterRegistrations();
      setSpinResult(null);
    } catch (error) {
      console.error('Error assigning player to team:', error);
    }
  };

  const autoAssignPlayerToNextTeam = async (player: Registration) => {
    try {
      // Get teams for the selected category, sorted by name (Team 1, Team 2, etc.)
      const categoryTeams = teams
        .filter(team => team.category === selectedCategory)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      if (categoryTeams.length === 0) {
        console.error('No teams found for category:', selectedCategory);
        return;
      }

      // Find the team with the least number of players
      let targetTeam = categoryTeams[0];
      let minPlayers = targetTeam.players.length;

      for (const team of categoryTeams) {
        if (team.players.length < minPlayers) {
          minPlayers = team.players.length;
          targetTeam = team;
        }
      }

      // Assign player to the selected team
      const updatedPlayers = [...targetTeam.players, player.id];
      await updateDoc(doc(db, 'tournaments', tournament.id, 'teams', targetTeam.id), {
        players: updatedPlayers,
        updatedAt: new Date(),
      });

      // Refresh data
      await loadData();
      filterRegistrations();
      
      // Update spin result to show which team the player was assigned to
      setSpinResult({
        ...player,
        assignedTeam: targetTeam.name
      });
      
    } catch (error) {
      console.error('Error auto-assigning player to team:', error);
    }
  };

  const removePlayerFromTeam = async (registrationId: string, teamId: string) => {
    try {
      const team = teams.find(t => t.id === teamId);
      if (!team) return;

      const updatedPlayers = team.players.filter(id => id !== registrationId);
      await updateDoc(doc(db, 'tournaments', tournament.id, 'teams', teamId), {
        players: updatedPlayers,
        updatedAt: new Date(),
      });

      // Refresh data
      await loadData();
      filterRegistrations();
    } catch (error) {
      console.error('Error removing player from team:', error);
    }
  };

  const autoAssignAllPlayers = async () => {
    if (!selectedCategory) return;

    const categoryTeams = teams.filter(team => team.category === selectedCategory);
    if (categoryTeams.length === 0) return;

    let teamIndex = 0;
    for (const registration of unassignedRegistrations) {
      const team = categoryTeams[teamIndex % categoryTeams.length];
      await assignPlayerToTeam(registration.id, team.id);
      teamIndex++;
    }
  };

  const unassignAllPlayersFromCategory = async () => {
    if (!selectedCategory) return;

    try {
      const categoryTeams = teams.filter(team => team.category === selectedCategory);
      
      // Update all teams in the category to have empty players array
      const updatePromises = categoryTeams.map(team => 
        updateDoc(doc(db, 'tournaments', tournament.id, 'teams', team.id), {
          players: [],
          updatedAt: new Date(),
        })
      );

      await Promise.all(updatePromises);

      // Refresh data
      await loadData();
      filterRegistrations();
      
      // Clear spin result
      setSpinResult(null);
      
      alert({
        title: 'Success',
        description: `All players have been unassigned from ${selectedCategory} teams. You can now run the wheel again.`,
        variant: 'success'
      });
      
    } catch (error) {
      console.error('Error unassigning all players:', error);
      alert({
        title: 'Error',
        description: 'Failed to unassign all players. Please try again.',
        variant: 'error'
      });
    }
  };

  const handleUnassignAll = () => {
    if (!selectedCategory) {
      alert({
        title: 'No Category Selected',
        description: 'Please select a category first.',
        variant: 'warning'
      });
      return;
    }

    const categoryTeams = teams.filter(team => team.category === selectedCategory);
    const totalAssignedPlayers = categoryTeams.reduce((sum, team) => sum + team.players.length, 0);

    if (totalAssignedPlayers === 0) {
      alert({
        title: 'No Players Assigned',
        description: 'There are no players assigned to teams in this category.',
        variant: 'warning'
      });
      return;
    }

    confirm({
      title: 'Unassign All Players',
      description: `Are you sure you want to unassign all ${totalAssignedPlayers} players from ${selectedCategory} teams? This will reset all team assignments and allow you to run the wheel again.`,
      confirmText: 'Unassign All',
      cancelText: 'Cancel',
      variant: 'destructive',
      onConfirm: unassignAllPlayersFromCategory
    });
  };

  const getTeamStats = () => {
    if (!selectedCategory) return null;

    const categoryTeams = teams.filter(team => team.category === selectedCategory);
    
    // Use filtered registrations instead of all registrations
    const totalPlayers = filteredRegistrations.length;
    const totalAssigned = categoryTeams.reduce((sum, team) => {
      // Count only assigned players that match current filters
      const assignedFilteredPlayers = team.players.filter(playerId => 
        filteredRegistrations.some(reg => reg.id === playerId)
      );
      return sum + assignedFilteredPlayers.length;
    }, 0);
    const totalUnassigned = unassignedRegistrations.length;

    return {
      totalPlayers,
      totalAssigned,
      totalUnassigned,
      teamsCount: categoryTeams.length,
      averagePerTeam: categoryTeams.length > 0 ? Math.round(totalAssigned / categoryTeams.length) : 0,
    };
  };

  const PlayerAvatar = ({ registration, size = 'md' }: { registration: Registration; size?: 'sm' | 'md' | 'lg' }) => {
    const initials = registration.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    const sizeClasses = {
      sm: 'w-10 h-10 text-sm',
      md: 'w-16 h-16 text-lg',
      lg: 'w-24 h-24 text-2xl',
    };
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

  const teamStats = getTeamStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Spin the Wheel</h2>
          <p className="text-gray-600">Assign players to teams randomly</p>
        </div>
        <div className="flex gap-2">
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

      {/* Category Selection — compact toolbar */}
      <div className="flex flex-wrap items-center gap-3 px-1">
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

        {selectedCategory && (
          <>
            <Select value={selectedGender} onValueChange={(value) => setSelectedGender(value as 'male' | 'female' | 'all')}>
              <SelectTrigger className="w-28 h-8 text-sm">
                <SelectValue placeholder="Gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All genders</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedLevel} onValueChange={(value) => setSelectedLevel(value as 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'all')}>
              <SelectTrigger className="w-32 h-8 text-sm">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
                <SelectItem value="expert">Expert</SelectItem>
              </SelectContent>
            </Select>

            <label className="flex items-center gap-1.5 cursor-pointer select-none ml-1">
              <input
                type="checkbox"
                checked={roundMode}
                onChange={(e) => setRoundMode(e.target.checked)}
                className="w-3.5 h-3.5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-xs font-medium text-gray-700">Round mode</span>
            </label>
          </>
        )}
      </div>

      {selectedCategory && (
        <>
          {/* Merged Spin Wheel + Unassigned Players */}
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
                  ? 'Assign multiple players to all teams in one round'
                  : 'Randomly assign unassigned players to teams'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-6">
                {/* Left: Spin button + result */}
                <div className="flex flex-col items-center gap-4 w-64 shrink-0 pt-2">
                  {roundMode && (
                    <div className="text-xs text-blue-600 bg-blue-50 p-2.5 rounded-lg border border-blue-200 text-center w-full">
                      <div className="font-medium mb-0.5">Round Mode</div>
                      <div>
                        {Math.min(unassignedRegistrations.length, teams.filter(t => t.category === selectedCategory).length)} players →{' '}
                        {teams.filter(t => t.category === selectedCategory).length} teams
                      </div>
                    </div>
                  )}

                  {isSpinning && spinResult && !roundMode && (
                    <div className="transition-opacity duration-75 opacity-100">
                      <PlayerAvatar registration={spinResult} size="lg" />
                    </div>
                  )}

                  <Button
                    onClick={spinWheel}
                    disabled={unassignedRegistrations.length === 0 || isSpinning}
                    size="lg"
                    className="w-32 h-32 rounded-full text-lg font-bold"
                  >
                    {isSpinning ? 'SPINNING...' : roundMode ? 'ROUND!' : 'SPIN!'}
                  </Button>

                  {/* Single Player Result */}
                  {spinResult && !roundMode && (
                    <div className="w-full p-3 bg-green-50 rounded-lg border border-green-200 text-center">
                      <p className="text-sm font-semibold text-green-800 mb-2">Player Assigned!</p>
                      <div className="flex items-center gap-2 mb-2">
                        <PlayerAvatar registration={spinResult} size="sm" />
                        <div className="text-left min-w-0">
                          <div className="font-medium text-sm truncate">{spinResult.name}</div>
                          <div className="text-xs text-gray-500">{spinResult.age} · {spinResult.gender}</div>
                          <Badge variant="outline" className="text-[10px] mt-0.5">{spinResult.expertiseLevel}</Badge>
                        </div>
                      </div>
                      {spinResult.assignedTeam ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-800 rounded-lg text-xs font-medium">
                          <Target className="h-3 w-3" />
                          → {spinResult.assignedTeam}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                            <SelectTrigger className="w-full h-8 text-xs">
                              <SelectValue placeholder="Select team" />
                            </SelectTrigger>
                            <SelectContent>
                              {teams.filter(team => team.category === selectedCategory).map(team => (
                                <SelectItem key={team.id} value={team.id}>
                                  {team.name} ({team.players.length})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button size="sm" className="w-full" onClick={() => assignPlayerToTeam(spinResult.id, selectedTeam)} disabled={!selectedTeam}>
                            Assign
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Round Results */}
                  {roundResults.length > 0 && roundMode && (
                    <div className="w-full p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-1.5">
                        <RefreshCw className="h-4 w-4" />
                        Round Complete!
                      </p>
                      <div className="space-y-2">
                        {roundResults.map((result) => (
                          <div key={result.id} className="bg-white p-2 rounded border border-blue-200 flex items-center gap-2">
                            <PlayerAvatar registration={result} size="sm" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-xs truncate">{result.name}</div>
                              <div className="text-[10px] text-blue-600 font-medium">→ {result.assignedTeam}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                      <p className="text-xs text-gray-500 mt-1">All players have been assigned to teams</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                      {unassignedRegistrations.map(registration => {
                        const isSelected = !isSpinning && spinResult?.id === registration.id;
                        const initials = registration.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
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
                        const levelColor: Record<string, string> = {
                          beginner: 'bg-emerald-500',
                          intermediate: 'bg-blue-500',
                          advanced: 'bg-violet-500',
                          expert: 'bg-orange-500',
                        };
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
                              <div className="absolute top-2 right-2">
                                <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white ${levelColor[registration.expertiseLevel] ?? 'bg-gray-500'}`}>
                                  {registration.expertiseLevel}
                                </span>
                              </div>
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

          {/* Team Statistics */}
          {teamStats && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Team Statistics
                </CardTitle>
                <CardDescription>
                  Current team composition and balance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{teamStats.totalPlayers}</div>
                    <div className="text-sm text-gray-600">Total Players</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{teamStats.totalAssigned}</div>
                    <div className="text-sm text-gray-600">Assigned</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">{teamStats.totalUnassigned}</div>
                    <div className="text-sm text-gray-600">Unassigned</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{teamStats.averagePerTeam}</div>
                    <div className="text-sm text-gray-600">Avg per Team</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
      
      {ConfirmDialogComponent}
      {AlertDialogComponent}
    </div>
  );
}
