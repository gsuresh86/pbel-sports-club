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
import { Shuffle, Users, Target, Crown, Zap, RotateCcw } from 'lucide-react';
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

    setIsSpinning(true);
    setSpinResult(null);

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
    const totalAssigned = categoryTeams.reduce((sum, team) => sum + team.players.length, 0);
    const totalUnassigned = unassignedRegistrations.length;
    const totalPlayers = totalAssigned + totalUnassigned;

    return {
      totalPlayers,
      totalAssigned,
      totalUnassigned,
      teamsCount: categoryTeams.length,
      averagePerTeam: categoryTeams.length > 0 ? Math.round(totalAssigned / categoryTeams.length) : 0,
    };
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

      {/* Category Selection */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Label htmlFor="category-select">Select Category:</Label>
              <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as CategoryType)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Choose category" />
                </SelectTrigger>
                <SelectContent>
                  {tournament.categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCategory && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-4">
                  <Label htmlFor="gender-select">Filter by Gender:</Label>
                  <Select value={selectedGender} onValueChange={(value) => setSelectedGender(value as 'male' | 'female' | 'all')}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-4">
                  <Label htmlFor="level-select">Filter by Level:</Label>
                  <Select value={selectedLevel} onValueChange={(value) => setSelectedLevel(value as 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'all')}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                      <SelectItem value="expert">Expert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedCategory && (
        <>
          {/* Spin Wheel Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shuffle className="h-5 w-5" />
                Spin the Wheel
              </CardTitle>
              <CardDescription>
                Randomly assign unassigned players to teams
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center space-y-4">
                <div className="text-lg font-medium">
                  Unassigned Players: {unassignedRegistrations.length}
                </div>
                
                <Button 
                  onClick={spinWheel} 
                  disabled={unassignedRegistrations.length === 0 || isSpinning}
                  size="lg"
                  className="w-32 h-32 rounded-full text-lg font-bold"
                >
                  {isSpinning ? 'SPINNING...' : 'SPIN!'}
                </Button>

                {spinResult && (
                  <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                    <h3 className="text-lg font-semibold mb-2 text-green-800">Player Selected & Assigned!</h3>
                    <div className="flex items-center justify-center gap-4 mb-4">
                      <div className="text-center">
                        <div className="font-medium text-lg">{spinResult.name}</div>
                        <div className="text-sm text-gray-600">Age: {spinResult.age} | Gender: {spinResult.gender}</div>
                        <div className="text-sm text-gray-600">Tower: {spinResult.tower} | Flat: {spinResult.flatNumber}</div>
                        <Badge variant="outline" className="mt-1">{spinResult.expertiseLevel}</Badge>
                      </div>
                    </div>
                    
                    {spinResult.assignedTeam ? (
                      <div className="text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg font-medium">
                          <Target className="h-4 w-4" />
                          Automatically assigned to: {spinResult.assignedTeam}
                        </div>
                        <p className="text-sm text-gray-600 mt-2">
                          Player was assigned to the team with the least players to maintain balance.
                        </p>
                      </div>
                    ) : (
                      <div className="flex justify-center gap-2">
                        <Label>Assign to team:</Label>
                        <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Select team" />
                          </SelectTrigger>
                          <SelectContent>
                            {teams.filter(team => team.category === selectedCategory).map(team => (
                              <SelectItem key={team.id} value={team.id}>
                                {team.name} ({team.players.length} players)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button 
                          onClick={() => assignPlayerToTeam(spinResult.id, selectedTeam)}
                          disabled={!selectedTeam}
                        >
                          Assign
                        </Button>
                      </div>
                    )}
                  </div>
                )}
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

          {/* Unassigned Players */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Unassigned Players ({unassignedRegistrations.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {unassignedRegistrations.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">All players assigned!</h3>
                  <p className="text-gray-600">All players in this category have been assigned to teams</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {unassignedRegistrations.map(registration => (
                    <div key={registration.id} className="bg-gray-50 p-3 rounded-lg">
                      <div className="font-medium text-sm">{registration.name}</div>
                      <div className="text-xs text-gray-600">Age: {registration.age} | {registration.gender}</div>
                      <div className="text-xs text-gray-600">{registration.tower} - {registration.flatNumber}</div>
                      <Badge variant="outline" className="text-xs mt-1">
                        {registration.expertiseLevel}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
      
      {ConfirmDialogComponent}
      {AlertDialogComponent}
    </div>
  );
}
