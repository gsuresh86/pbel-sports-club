'use client';

import { useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc, getDoc, query, where } from 'firebase/firestore';
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

import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Team, Pool, Tournament, CategoryType } from '@/types';
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

  const [activeSubTab, setActiveSubTab] = useState<'teams' | 'pools'>('teams');
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showCreatePool, setShowCreatePool] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editingPool, setEditingPool] = useState<Pool | null>(null);

  const [teamForm, setTeamForm] = useState({ name: '', category: '' as CategoryType, captainId: '', maxPlayers: 6 });

  const defaultMaxPlayers = (category: CategoryType) =>
    category === 'womens-team' ? 5 : category === 'mens-team' ? 6 : 6;
  const [poolForm, setPoolForm] = useState({ name: '', category: '' as CategoryType, maxTeams: 4 });

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'tournaments', tournament.id, 'teams'), {
        ...teamForm,
        tournamentId: tournament.id,
        players: [],
        status: 'active',
        createdAt: new Date(),
        createdBy: user.id,
      });
      setShowCreateTeam(false);
      setTeamForm({ name: '', category: '' as CategoryType, captainId: '', maxPlayers: 6 });
      invalidateTournament(tournament.id);
    } catch (error) {
      console.error('Error creating team:', error);
    }
  };

  const handleCreatePool = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'tournaments', tournament.id, 'pools'), {
        ...poolForm,
        tournamentId: tournament.id,
        teams: [],
        status: 'pending',
        createdAt: new Date(),
        createdBy: user.id,
      });
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
      maxPlayers: team.maxPlayers ?? defaultMaxPlayers(team.category),
    });
  };

  const handleEditPool = (pool: Pool) => {
    setEditingPool(pool);
    setPoolForm({ name: pool.name, category: pool.category, maxTeams: pool.maxTeams });
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
        maxPlayers: teamForm.maxPlayers,
        updatedAt: new Date(),
      });

      const matchesSnap = await getDocs(
        query(collection(db, 'matches'), where('tournamentId', '==', tournament.id))
      );
      for (const matchDoc of matchesSnap.docs) {
        const data = matchDoc.data();
        const isP1 = data.player1Id === editingTeam.id;
        const isP2 = data.player2Id === editingTeam.id;
        if (!isP1 && !isP2) continue;
        const matchUpdate: Record<string, unknown> = { updatedAt: new Date() };
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
      setTeamForm({ name: '', category: '' as CategoryType, captainId: 'none', maxPlayers: 6 });
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

  const filteredTeams = teams.filter(t => selectedCategory === 'all' || t.category === selectedCategory);
  const filteredPools = pools.filter(p => selectedCategory === 'all' || p.category === selectedCategory);

  const getPlayersForTeam = (team: Team) =>
    registrations.filter(r => (team.players || []).includes(r.id));

  const getTeamsForPool = (pool: Pool) =>
    teams.filter(t => pool.teams.includes(t.id));

  const formatCategory = (cat: string) =>
    cat.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Team & Pool Management</h2>
          <p className="text-gray-600">Manage teams and pools for {tournament.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {tournament.categories.map(category => (
                <SelectItem key={category} value={category}>
                  {formatCategory(category)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      {/* Sub-tabs */}
      <Tabs value={activeSubTab} onValueChange={v => setActiveSubTab(v as 'teams' | 'pools')}>
        <TabsList>
          <TabsTrigger value="teams">
            <Users className="h-4 w-4 mr-2" />
            Teams ({filteredTeams.length})
          </TabsTrigger>
          <TabsTrigger value="pools">
            <Target className="h-4 w-4 mr-2" />
            Pools ({filteredPools.length})
          </TabsTrigger>
        </TabsList>

        {/* Teams Table */}
        <TabsContent value="teams" className="mt-4">
          {filteredTeams.length === 0 ? (
            <div className="text-center py-12 border rounded-lg">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No teams created</h3>
              <p className="text-gray-600 mb-4">Create teams to organize players for the tournament</p>
              <Button onClick={() => setShowCreateTeam(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Team
              </Button>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Captain</TableHead>
                    <TableHead className="text-center">Players / Max</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeams.map((team, idx) => {
                    const teamPlayers = getPlayersForTeam(team);
                    const captain = teamPlayers.find(p => p.id === team.captainId);
                    return (
                      <TableRow key={team.id}>
                        <TableCell className="text-gray-500 text-sm">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="font-medium">{team.name}</div>
                          {team.seed && (
                            <div className="text-xs text-gray-500">Seed #{team.seed}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{formatCategory(team.category)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={team.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                            {team.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            {captain ? (
                              <>
                                <Crown className="h-3 w-3 text-yellow-500 shrink-0" />
                                {captain.name}
                              </>
                            ) : (
                              <span className="text-gray-400">Not assigned</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {teamPlayers.length}{team.maxPlayers != null ? ` / ${team.maxPlayers}` : ''}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(team.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleEditTeam(team)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleDeleteTeam(team.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Pools Table */}
        <TabsContent value="pools" className="mt-4">
          {filteredPools.length === 0 ? (
            <div className="text-center py-12 border rounded-lg">
              <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No pools created</h3>
              <p className="text-gray-600 mb-4">Create pools to organize teams into groups</p>
              <Button onClick={() => setShowCreatePool(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Pool
              </Button>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="py-2 w-8">#</TableHead>
                    <TableHead className="py-2">Name</TableHead>
                    <TableHead className="py-2">Category</TableHead>
                    <TableHead className="py-2">Status</TableHead>
                    <TableHead className="py-2">Teams</TableHead>
                    <TableHead className="py-2 text-center w-20">Cap.</TableHead>
                    <TableHead className="py-2 text-right w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPools.map((pool, idx) => {
                    const poolTeams = getTeamsForPool(pool);
                    return (
                      <TableRow key={pool.id} className="text-sm">
                        <TableCell className="py-1.5 text-gray-400 text-xs">{idx + 1}</TableCell>
                        <TableCell className="py-1.5 font-medium">{pool.name}</TableCell>
                        <TableCell className="py-1.5">
                          <Badge variant="outline" className="text-xs py-0">{formatCategory(pool.category)}</Badge>
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Badge className={`text-xs py-0 ${pool.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {pool.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5">
                          {poolTeams.length === 0 ? (
                            <span className="text-gray-400 text-xs">None</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {poolTeams.map(t => (
                                <Badge key={t.id} variant="secondary" className="text-xs py-0">{t.name}</Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-1.5 text-center text-xs text-gray-500">
                          {poolTeams.length}/{pool.maxTeams}
                        </TableCell>
                        <TableCell className="py-1.5 text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleEditPool(pool)}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-600" onClick={() => handleDeletePool(pool.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

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
                <Select
                  value={teamForm.category}
                  onValueChange={(value) => {
                    const cat = value as CategoryType;
                    setTeamForm(prev => ({ ...prev, category: cat, maxPlayers: defaultMaxPlayers(cat) }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {tournament.categories.map(category => (
                      <SelectItem key={category} value={category}>
                        {formatCategory(category)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="team-max-players">Max Players per Team</Label>
                <Input
                  id="team-max-players"
                  type="number"
                  min="1"
                  max="20"
                  value={teamForm.maxPlayers}
                  onChange={(e) => setTeamForm(prev => ({ ...prev, maxPlayers: parseInt(e.target.value) || 1 }))}
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateTeam(false)}>Cancel</Button>
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
                        {formatCategory(category)}
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
                <Button type="button" variant="outline" onClick={() => setShowCreatePool(false)}>Cancel</Button>
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
                <Label htmlFor="edit-team-max-players">Max Players per Team</Label>
                <Input
                  id="edit-team-max-players"
                  type="number"
                  min="1"
                  max="20"
                  value={teamForm.maxPlayers}
                  onChange={(e) => setTeamForm(prev => ({ ...prev, maxPlayers: parseInt(e.target.value) || 1 }))}
                  required
                />
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
                <Button type="button" variant="outline" onClick={() => setEditingTeam(null)}>Cancel</Button>
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
                <Button type="button" variant="outline" onClick={() => setEditingPool(null)}>Cancel</Button>
                <Button type="submit">Update Pool</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
