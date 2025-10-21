'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Team, Pool, Player, Tournament, CategoryType } from '@/types';
import { Users, Plus, Edit, Trash2, Crown, Target } from 'lucide-react';

interface TeamManagementProps {
  tournament: Tournament;
  user: { id: string; role: string; email: string };
}

export default function TeamManagement({ tournament, user }: TeamManagementProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showCreatePool, setShowCreatePool] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

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

  useEffect(() => {
    loadData();
  }, [tournament.id]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadTeams(),
      loadPools(),
      loadPlayers(),
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

  const loadPools = async () => {
    try {
      const poolsSnapshot = await getDocs(
        query(collection(db, 'tournaments', tournament.id, 'pools'), orderBy('createdAt', 'desc'))
      );
      const poolsData = poolsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Pool[];
      setPools(poolsData);
    } catch (error) {
      console.error('Error loading pools:', error);
    }
  };

  const loadPlayers = async () => {
    try {
      const playersSnapshot = await getDocs(
        query(collection(db, 'tournaments', tournament.id, 'players'), orderBy('createdAt', 'desc'))
      );
      const playersData = playersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Player[];
      setPlayers(playersData);
    } catch (error) {
      console.error('Error loading players:', error);
    }
  };

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
      loadTeams();
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
      loadPools();
    } catch (error) {
      console.error('Error creating pool:', error);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (confirm('Are you sure you want to delete this team?')) {
      try {
        await deleteDoc(doc(db, 'tournaments', tournament.id, 'teams', teamId));
        loadTeams();
      } catch (error) {
        console.error('Error deleting team:', error);
      }
    }
  };

  const handleDeletePool = async (poolId: string) => {
    if (confirm('Are you sure you want to delete this pool?')) {
      try {
        await deleteDoc(doc(db, 'tournaments', tournament.id, 'pools', poolId));
        loadPools();
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
    return players.filter(player => team.players.includes(player.id));
  };

  const getTeamsForPool = (pool: Pool) => {
    return teams.filter(team => pool.teams.includes(team.id));
  };

  const getCategoryPlayers = (category: CategoryType) => {
    return players.filter(player => player.selectedCategory === category);
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
                        <Button size="sm" variant="outline">
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
                        <Button size="sm" variant="outline">
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
    </div>
  );
}
