'use client';

import { useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc, getDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  useTournamentTeams,
  useTournamentPools,
  useTournamentRegistrations,
  useInvalidateTournament,
} from '@/hooks/use-tournament-queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Team, Pool, Registration, Tournament, CategoryType } from '@/types';
import { Users, Plus, Edit, Trash2, Crown, Target } from 'lucide-react';

interface TeamManagementProps {
  tournament: Tournament;
  user: { id: string; role: string; email: string };
}

export default function TeamManagement({ tournament, user }: TeamManagementProps) {
  const invalidateTournament = useInvalidateTournament();
  const { data: teams = [], isLoading: teamsLoading } = useTournamentTeams(tournament.id);
  const { data: pools = [], isLoading: poolsLoading } = useTournamentPools(tournament.id);
  const { data: registrations = [], isLoading: registrationsLoading } =
    useTournamentRegistrations(tournament.id);
  const loading = teamsLoading || poolsLoading || registrationsLoading;

  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showCreatePool, setShowCreatePool] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editingPool, setEditingPool] = useState<Pool | null>(null);

  // Form states
  const [teamForm, setTeamForm] = useState({
    name: '',
    category: '' as CategoryType,
    captainId: '',
  });

  const [poolForm, setPoolForm] = useState({
    name: '',
    category: '' as CategoryType,
    maxTeams: 4,
  });

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const teamData = {
        ...teamForm,
        tournamentId: tournament.id,
        players: [],
        status: 'active',
        createdAt: new Date(),
        createdBy: user.id,
      };

      await addDoc(collection(db, 'tournaments', tournament.id, 'teams'), teamData);
      setShowCreateTeam(false);
      setTeamForm({ name: '', category: '' as CategoryType, captainId: '' });
      invalidateTournament(tournament.id);
    } catch (error) {
      console.error('Error creating team:', error);
    }
  };

  const handleCreatePool = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const poolData = {
        ...poolForm,
        tournamentId: tournament.id,
        teams: [],
        status: 'pending',
        createdAt: new Date(),
        createdBy: user.id,
      };

      await addDoc(collection(db, 'tournaments', tournament.id, 'pools'), poolData);
      setShowCreatePool(false);
      setPoolForm({ name: '', category: '' as CategoryType, maxTeams: 4 });
      invalidateTournament(tournament.id);
    } catch (error) {
      console.error('Error creating pool:', error);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (confirm('Are you sure you want to delete this team?')) {
      try {
        await deleteDoc(doc(db, 'tournaments', tournament.id, 'teams', teamId));
        invalidateTournament(tournament.id);
      } catch (error) {
        console.error('Error deleting team:', error);
      }
    }
  };

  const handleEditTeam = (team: Team) => {
    setEditingTeam(team);
    setTeamForm({
      name: team.name,
      category: team.category,
      captainId: team.captainId || 'none',
    });
  };

  const handleEditPool = (pool: Pool) => {
    setEditingPool(pool);
    setPoolForm({
      name: pool.name,
      category: pool.category,
      maxTeams: pool.maxTeams,
    });
  };

  const handleUpdateTeam = async () => {
    if (!editingTeam) return;
    const oldName = editingTeam.name;
    const newName = teamForm.name.trim();
    if (!newName) return;

    try {
      await updateDoc(doc(db, 'tournaments', tournament.id, 'teams', editingTeam.id), {
        name: newName,
        category: teamForm.category,
        captainId: teamForm.captainId === 'none' ? null : teamForm.captainId,
        updatedAt: new Date(),
      });

      // Sync new team name to all matches and liveScores for this tournament
      const matchesSnap = await getDocs(
        query(collection(db, 'matches'), where('tournamentId', '==', tournament.id))
      );
      for (const matchDoc of matchesSnap.docs) {
        const data = matchDoc.data();
        const isP1 = data.player1Id === editingTeam.id;
        const isP2 = data.player2Id === editingTeam.id;
        if (!isP1 && !isP2) continue;
        const matchUpdate: Record<string, unknown> = {
          updatedAt: new Date(),
        };
        if (isP1) matchUpdate.player1Name = newName;
        if (isP2) matchUpdate.player2Name = newName;
        if (data.winner === oldName) matchUpdate.winner = newName;
        await updateDoc(doc(db, 'matches', matchDoc.id), matchUpdate);
        const liveSnap = await getDoc(doc(db, 'liveScores', matchDoc.id));
        if (liveSnap.exists()) {
          const liveUpdate: Record<string, unknown> = {};
          if (isP1) liveUpdate.player1Name = newName;
          if (isP2) liveUpdate.player2Name = newName;
          if (Object.keys(liveUpdate).length) {
            liveUpdate.lastUpdated = new Date();
            await updateDoc(doc(db, 'liveScores', matchDoc.id), liveUpdate);
          }
        }
      }

      setEditingTeam(null);
      setTeamForm({ name: '', category: '' as CategoryType, captainId: 'none' });
      invalidateTournament(tournament.id);
    } catch (error) {
      console.error('Error updating team:', error);
    }
  };

  const handleUpdatePool = async () => {
    if (!editingPool) return;

    try {
      await updateDoc(doc(db, 'tournaments', tournament.id, 'pools', editingPool.id), {
        name: poolForm.name,
        category: poolForm.category,
        maxTeams: poolForm.maxTeams,
        updatedAt: new Date(),
      });

      setEditingPool(null);
      setPoolForm({ name: '', category: '' as CategoryType, maxTeams: 4 });
      invalidateTournament(tournament.id);
    } catch (error) {
      console.error('Error updating pool:', error);
    }
  };

  const handleDeletePool = async (poolId: string) => {
    if (confirm('Are you sure you want to delete this pool?')) {
      try {
        await deleteDoc(doc(db, 'tournaments', tournament.id, 'pools', poolId));
        invalidateTournament(tournament.id);
      } catch (error) {
        console.error('Error deleting pool:', error);
      }
    }
  };

  const filteredTeams = teams.filter(team => 
    selectedCategory === 'all' || team.category === selectedCategory
  );

  const filteredPools = pools.filter(pool => 
    selectedCategory === 'all' || pool.category === selectedCategory
  );

  const getPlayersForTeam = (team: Team) => {
    const teamPlayerIds = team.players || [];
    return registrations.filter(registration => teamPlayerIds.includes(registration.id));
  };

  const getTeamsForPool = (pool: Pool) => {
    return teams.filter(team => pool.teams.includes(team.id));
  };

  const getCategoryRegistrations = (category: CategoryType) => {
    return registrations.filter(registration => registration.selectedCategory === category);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Team & Pool Management</h2>
          <p className="text-gray-600">Manage teams and pools for {tournament.name}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowCreateTeam(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Team
          </Button>
          <Button onClick={() => setShowCreatePool(true)} variant="outline">
            <Target className="h-4 w-4 mr-2" />
            Create Pool
          </Button>
        </div>
      </div>

      {/* Category Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Label htmlFor="category-filter">Filter by Category:</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {tournament.categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Teams Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Teams ({filteredTeams.length})
          </CardTitle>
          <CardDescription>
            Manage tournament teams and their players
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTeams.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No teams created</h3>
              <p className="text-gray-600 mb-4">Create teams to organize players for the tournament</p>
              <Button onClick={() => setShowCreateTeam(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Team
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTeams.map(team => {
                const teamPlayers = getPlayersForTeam(team);
                const captain = teamPlayers.find(p => p.id === team.captainId);
                return (
                  <div key={team.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-lg font-semibold">{team.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">
                            {team.category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Badge>
                          <Badge className={team.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                            {team.status}
                          </Badge>
                          {team.seed && (
                            <Badge variant="secondary">Seed #{team.seed}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEditTeam(team)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDeleteTeam(team.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium mb-2">Players ({teamPlayers.length})</h4>
                        <div className="space-y-1">
                          {teamPlayers.map(player => (
                            <div key={player.id} className="flex items-center gap-2 text-sm">
                              {player.id === team.captainId && <Crown className="h-3 w-3 text-yellow-500" />}
                              <span className={player.id === team.captainId ? 'font-medium' : ''}>
                                {player.name}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {player.expertiseLevel}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-2">Team Info</h4>
                        <div className="text-sm space-y-1">
                          <p><strong>Captain:</strong> {captain?.name || 'Not assigned'}</p>
                          <p><strong>Players:</strong> {teamPlayers.length}</p>
                          <p><strong>Created:</strong> {new Date(team.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pools Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Pools ({filteredPools.length})
          </CardTitle>
          <CardDescription>
            Manage tournament pools/groups
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredPools.length === 0 ? (
            <div className="text-center py-8">
              <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No pools created</h3>
              <p className="text-gray-600 mb-4">Create pools to organize teams into groups</p>
              <Button onClick={() => setShowCreatePool(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Pool
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPools.map(pool => {
                const poolTeams = getTeamsForPool(pool);
                return (
                  <div key={pool.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-lg font-semibold">{pool.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">
                            {pool.category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Badge>
                          <Badge className={pool.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                            {pool.status}
                          </Badge>
                          <span className="text-sm text-gray-600">
                            {poolTeams.length}/{pool.maxTeams} teams
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEditPool(pool)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDeletePool(pool.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2">Teams in Pool</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {poolTeams.map(team => (
                          <div key={team.id} className="bg-gray-50 p-2 rounded text-sm">
                            {team.name}
                          </div>
                        ))}
                        {poolTeams.length === 0 && (
                          <div className="col-span-full text-center text-gray-500 py-4">
                            No teams assigned to this pool
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Team Modal */}
      {showCreateTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create New Team</h3>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <Label htmlFor="team-name">Team Name</Label>
                <Input
                  id="team-name"
                  value={teamForm.name}
                  onChange={(e) => setTeamForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="team-category">Category</Label>
                <Select value={teamForm.category} onValueChange={(value) => setTeamForm(prev => ({ ...prev, category: value as CategoryType }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
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
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateTeam(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Team</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Pool Modal */}
      {showCreatePool && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create New Pool</h3>
            <form onSubmit={handleCreatePool} className="space-y-4">
              <div>
                <Label htmlFor="pool-name">Pool Name</Label>
                <Input
                  id="pool-name"
                  value={poolForm.name}
                  onChange={(e) => setPoolForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="pool-category">Category</Label>
                <Select value={poolForm.category} onValueChange={(value) => setPoolForm(prev => ({ ...prev, category: value as CategoryType }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
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
              <div>
                <Label htmlFor="max-teams">Max Teams</Label>
                <Input
                  id="max-teams"
                  type="number"
                  min="2"
                  max="8"
                  value={poolForm.maxTeams}
                  onChange={(e) => setPoolForm(prev => ({ ...prev, maxTeams: parseInt(e.target.value) }))}
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowCreatePool(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Pool</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Team Modal */}
      {editingTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Edit Team</h3>
            <form onSubmit={(e) => { e.preventDefault(); handleUpdateTeam(); }} className="space-y-4">
              <div>
                <Label htmlFor="edit-team-name">Team Name</Label>
                <Input
                  id="edit-team-name"
                  value={teamForm.name}
                  onChange={(e) => setTeamForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-team-category">Category</Label>
                <Select value={teamForm.category} onValueChange={(value) => setTeamForm(prev => ({ ...prev, category: value as CategoryType }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open-team">Open Team</SelectItem>
                    <SelectItem value="kids-team-13">Kids Team 13</SelectItem>
                    <SelectItem value="kids-team-18">Kids Team 18</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-team-captain">Captain</Label>
                <Select value={teamForm.captainId} onValueChange={(value) => setTeamForm(prev => ({ ...prev, captainId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select captain" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No captain</SelectItem>
                    {getPlayersForTeam(editingTeam).map(player => (
                      <SelectItem key={player.id} value={player.id}>
                        {player.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingTeam(null)}>
                  Cancel
                </Button>
                <Button type="submit">Update Team</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Pool Modal */}
      {editingPool && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Edit Pool</h3>
            <form onSubmit={(e) => { e.preventDefault(); handleUpdatePool(); }} className="space-y-4">
              <div>
                <Label htmlFor="edit-pool-name">Pool Name</Label>
                <Input
                  id="edit-pool-name"
                  value={poolForm.name}
                  onChange={(e) => setPoolForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-pool-category">Category</Label>
                <Select value={poolForm.category} onValueChange={(value) => setPoolForm(prev => ({ ...prev, category: value as CategoryType }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open-team">Open Team</SelectItem>
                    <SelectItem value="kids-team-13">Kids Team 13</SelectItem>
                    <SelectItem value="kids-team-18">Kids Team 18</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-pool-max-teams">Max Teams</Label>
                <Input
                  id="edit-pool-max-teams"
                  type="number"
                  min="2"
                  max="8"
                  value={poolForm.maxTeams}
                  onChange={(e) => setPoolForm(prev => ({ ...prev, maxTeams: parseInt(e.target.value) }))}
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingPool(null)}>
                  Cancel
                </Button>
                <Button type="submit">Update Pool</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
