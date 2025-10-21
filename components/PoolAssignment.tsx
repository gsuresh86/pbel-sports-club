'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Team, Pool, Registration, Tournament, CategoryType } from '@/types';
import { Target, Users, Shuffle, ArrowRight, ArrowLeft, Edit, Plus, X } from 'lucide-react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAlertDialog } from '@/components/ui/alert-dialog-component';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

interface PoolAssignmentProps {
  tournament: Tournament;
  user: { id: string; role: string; email: string };
}

export default function PoolAssignment({ tournament, user }: PoolAssignmentProps) {
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();
  const { alert, AlertDialogComponent } = useAlertDialog();
  
  const [teams, setTeams] = useState<Team[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<CategoryType | ''>('');
  const [selectedPool, setSelectedPool] = useState<string>('');
  const [playerPoolSelections, setPlayerPoolSelections] = useState<Record<string, string>>({});
  const [teamPoolSelections, setTeamPoolSelections] = useState<Record<string, string>>({});
  
  // Edit pool state
  const [editPoolOpen, setEditPoolOpen] = useState(false);
  const [editingPool, setEditingPool] = useState<Pool | null>(null);
  const [selectedTeamsForPool, setSelectedTeamsForPool] = useState<string[]>([]);
  const [selectedPlayersForPool, setSelectedPlayersForPool] = useState<string[]>([]);
  const [editingPoolName, setEditingPoolName] = useState<string | null>(null);
  const [editingPoolNameValue, setEditingPoolNameValue] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [tournament.id]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadTeams(),
      loadPools(),
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

  const loadRegistrations = async () => {
    try {
      const registrationsSnapshot = await getDocs(collection(db, 'tournaments', tournament.id, 'registrations'));
      
      const registrationsData = registrationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        registeredAt: doc.data().registeredAt?.toDate(),
        approvedAt: doc.data().approvedAt?.toDate(),
      })) as unknown as Registration[];
      
      setRegistrations(registrationsData);
    } catch (error) {
      console.error('Error loading registrations:', error);
    }
  };

  const assignTeamToPool = async (teamId: string, poolId: string) => {
    try {
      const pool = pools.find(p => p.id === poolId);
      if (!pool) return;

      // Check if pool is full
      if (pool.teams.length >= pool.maxTeams) {
        alert({
          title: 'Pool Full',
          description: 'Pool is full! Cannot add more teams.',
          variant: 'warning'
        });
        return;
      }

      // Update pool with new team
      const updatedTeams = [...pool.teams, teamId];
      await updateDoc(doc(db, 'tournaments', tournament.id, 'pools', poolId), {
        teams: updatedTeams,
        updatedAt: new Date(),
      });

      // Update team with pool reference
      await updateDoc(doc(db, 'tournaments', tournament.id, 'teams', teamId), {
        poolId: poolId,
        updatedAt: new Date(),
      });

      // Update local state immediately instead of reloading
      setPools(prevPools => 
        prevPools.map(p => 
          p.id === poolId 
            ? { ...p, teams: updatedTeams, updatedAt: new Date() }
            : p
        )
      );

      setTeams(prevTeams =>
        prevTeams.map(t =>
          t.id === teamId
            ? { ...t, poolId: poolId, updatedAt: new Date() }
            : t
        )
      );

      // Clear the selection for this team
      setTeamPoolSelections(prev => {
        const newSelections = { ...prev };
        delete newSelections[teamId];
        return newSelections;
      });
    } catch (error) {
      console.error('Error assigning team to pool:', error);
    }
  };

  const assignPlayerToPool = async (playerId: string, poolId: string) => {
    try {
      const pool = pools.find(p => p.id === poolId);
      if (!pool) return;

      // Check if pool is full (for player pools, we'll use maxTeams as maxPlayers)
      if (pool.teams.length >= pool.maxTeams) {
        alert({
          title: 'Pool Full',
          description: 'Pool is full! Cannot add more players.',
          variant: 'warning'
        });
        return;
      }

      // Update pool with new player (using teams array to store player IDs)
      const updatedPlayers = [...pool.teams, playerId];
      await updateDoc(doc(db, 'tournaments', tournament.id, 'pools', poolId), {
        teams: updatedPlayers,
        updatedAt: new Date(),
      });

      // Update local state immediately instead of reloading
      setPools(prevPools => 
        prevPools.map(p => 
          p.id === poolId 
            ? { ...p, teams: updatedPlayers, updatedAt: new Date() }
            : p
        )
      );

      // Clear the selection for this player
      setPlayerPoolSelections(prev => {
        const newSelections = { ...prev };
        delete newSelections[playerId];
        return newSelections;
      });
    } catch (error) {
      console.error('Error assigning player to pool:', error);
    }
  };

  const removePlayerFromPool = async (playerId: string, poolId: string) => {
    try {
      const pool = pools.find(p => p.id === poolId);
      if (!pool) return;

      // Remove player from pool
      const updatedPlayers = pool.teams.filter(id => id !== playerId);
      await updateDoc(doc(db, 'tournaments', tournament.id, 'pools', poolId), {
        teams: updatedPlayers,
        updatedAt: new Date(),
      });

      // Update local state immediately instead of reloading
      setPools(prevPools => 
        prevPools.map(p => 
          p.id === poolId 
            ? { ...p, teams: updatedPlayers, updatedAt: new Date() }
            : p
        )
      );
    } catch (error) {
      console.error('Error removing player from pool:', error);
    }
  };

  const removeTeamFromPool = async (teamId: string, poolId: string) => {
    try {
      const pool = pools.find(p => p.id === poolId);
      if (!pool) return;

      // Remove team from pool
      const updatedTeams = pool.teams.filter(id => id !== teamId);
      await updateDoc(doc(db, 'tournaments', tournament.id, 'pools', poolId), {
        teams: updatedTeams,
        updatedAt: new Date(),
      });

      // Remove pool reference from team
      await updateDoc(doc(db, 'tournaments', tournament.id, 'teams', teamId), {
        poolId: undefined,
        updatedAt: new Date(),
      });

      // Update local state immediately instead of reloading
      setPools(prevPools => 
        prevPools.map(p => 
          p.id === poolId 
            ? { ...p, teams: updatedTeams, updatedAt: new Date() }
            : p
        )
      );

      setTeams(prevTeams =>
        prevTeams.map(t =>
          t.id === teamId
            ? { ...t, poolId: undefined, updatedAt: new Date() }
            : t
        )
      );
    } catch (error) {
      console.error('Error removing team from pool:', error);
    }
  };

  const autoAssignToPools = async () => {
    if (!selectedCategory) return;

    const categoryPools = getCategoryPools();
    if (categoryPools.length === 0) return;

    if (isOpenTeamCategory()) {
      // For open-team category: assign teams to pools
      const unassignedTeams = getUnassignedTeams();
      if (unassignedTeams.length === 0) return;

      // Distribute teams evenly across pools
      let poolIndex = 0;
      for (const team of unassignedTeams) {
        const pool = categoryPools[poolIndex % categoryPools.length];
        
        // Check if pool has space
        if (pool.teams.length < pool.maxTeams) {
          await assignTeamToPool(team.id, pool.id);
        }
        
        poolIndex++;
      }
    } else {
      // For other categories: assign players to pools
      const unassignedPlayers = getUnassignedPlayers();
      if (unassignedPlayers.length === 0) return;

      // Distribute players evenly across pools
      let poolIndex = 0;
      for (const player of unassignedPlayers) {
        const pool = categoryPools[poolIndex % categoryPools.length];
        
        // Check if pool has space
        if (pool.teams.length < pool.maxTeams) {
          await assignPlayerToPool(player.id, pool.id);
        }
        
        poolIndex++;
      }
    }
  };

  const getCategoryTeams = () => {
    if (!selectedCategory) return [];
    return teams.filter(team => team.category === selectedCategory);
  };

  const getCategoryPools = () => {
    if (!selectedCategory) return [];
    return pools.filter(pool => pool.category === selectedCategory);
  };

  const getCategoryPlayers = () => {
    if (!selectedCategory) return [];
    return registrations.filter(registration => registration.selectedCategory === selectedCategory);
  };

  const getUnassignedPlayers = () => {
    const categoryPlayers = getCategoryPlayers();
    const categoryPools = getCategoryPools();
    
    // Get all player IDs that are already assigned to pools
    const assignedPlayerIds = categoryPools.flatMap(pool => pool.teams);
    
    return categoryPlayers.filter(player => !assignedPlayerIds.includes(player.id));
  };

  const getPoolPlayers = (pool: Pool) => {
    return registrations.filter(registration => pool.teams.includes(registration.id));
  };

  const startEditingPoolName = (pool: Pool) => {
    setEditingPoolName(pool.id);
    setEditingPoolNameValue(pool.name);
  };

  const cancelEditingPoolName = () => {
    setEditingPoolName(null);
    setEditingPoolNameValue('');
  };

  const savePoolName = async (poolId: string) => {
    if (!editingPoolNameValue.trim()) return;

    try {
      await updateDoc(doc(db, 'tournaments', tournament.id, 'pools', poolId), {
        name: editingPoolNameValue.trim(),
        updatedAt: new Date(),
      });

      // Update local state immediately instead of reloading
      setPools(prevPools => 
        prevPools.map(p => 
          p.id === poolId 
            ? { ...p, name: editingPoolNameValue.trim(), updatedAt: new Date() }
            : p
        )
      );

      setEditingPoolName(null);
      setEditingPoolNameValue('');
    } catch (error) {
      console.error('Error updating pool name:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, poolId: string) => {
    if (e.key === 'Enter') {
      savePoolName(poolId);
    } else if (e.key === 'Escape') {
      cancelEditingPoolName();
    }
  };

  const isOpenTeamCategory = () => {
    return selectedCategory === 'open-team';
  };

  const getUnassignedTeams = () => {
    return getCategoryTeams().filter(team => !team.poolId);
  };

  const getPoolTeams = (pool: Pool) => {
    return teams.filter(team => pool.teams.includes(team.id));
  };

  const openEditPool = (pool: Pool) => {
    setEditingPool(pool);
    if (isOpenTeamCategory()) {
      setSelectedTeamsForPool(pool.teams);
    } else {
      setSelectedPlayersForPool(pool.teams);
    }
    setEditPoolOpen(true);
  };

  const closeEditPool = () => {
    setEditPoolOpen(false);
    setEditingPool(null);
    setSelectedTeamsForPool([]);
    setSelectedPlayersForPool([]);
  };

  const handleTeamSelection = (teamId: string, checked: boolean) => {
    if (checked) {
      setSelectedTeamsForPool(prev => [...prev, teamId]);
    } else {
      setSelectedTeamsForPool(prev => prev.filter(id => id !== teamId));
    }
  };

  const handlePlayerSelection = (playerId: string, checked: boolean) => {
    if (checked) {
      setSelectedPlayersForPool(prev => [...prev, playerId]);
    } else {
      setSelectedPlayersForPool(prev => prev.filter(id => id !== playerId));
    }
  };

  const savePoolChanges = async () => {
    if (!editingPool) return;

    try {
      // Update pool teams/players
      const selectedItems = isOpenTeamCategory() ? selectedTeamsForPool : selectedPlayersForPool;
      await updateDoc(doc(db, 'tournaments', tournament.id, 'pools', editingPool.id), {
        teams: selectedItems,
        updatedAt: new Date(),
      });

      if (isOpenTeamCategory()) {
        // Update team pool references
        const allTeams = getCategoryTeams();
        
        // Remove pool reference from teams no longer in this pool
        const teamsToRemovePool = allTeams.filter(team => 
          editingPool.teams.includes(team.id) && !selectedTeamsForPool.includes(team.id)
        );
        
        // Add pool reference to newly assigned teams
        const teamsToAddPool = allTeams.filter(team => 
          !editingPool.teams.includes(team.id) && selectedTeamsForPool.includes(team.id)
        );

        // Update teams
        const updatePromises = [
          ...teamsToRemovePool.map(team => 
            updateDoc(doc(db, 'tournaments', tournament.id, 'teams', team.id), {
              poolId: null,
              updatedAt: new Date(),
            })
          ),
          ...teamsToAddPool.map(team => 
            updateDoc(doc(db, 'tournaments', tournament.id, 'teams', team.id), {
              poolId: editingPool.id,
              updatedAt: new Date(),
            })
          )
        ];

        await Promise.all(updatePromises);
      }
      // For player assignments, no additional updates needed

      // Refresh data
      await loadData();
      closeEditPool();

      alert({
        title: 'Success',
        description: 'Pool assignments updated successfully!',
        variant: 'success'
      });

    } catch (error) {
      console.error('Error updating pool:', error);
      alert({
        title: 'Error',
        description: 'Failed to update pool assignments. Please try again.',
        variant: 'error'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const categoryTeams = getCategoryTeams();
  const categoryPools = getCategoryPools();
  const unassignedTeams = getUnassignedTeams();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pool Assignment</h2>
          <p className="text-gray-600">Assign {isOpenTeamCategory() ? 'teams' : 'players'} to pools/groups</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={autoAssignToPools} disabled={!selectedCategory || (isOpenTeamCategory() ? unassignedTeams.length === 0 : getUnassignedPlayers().length === 0)}>
            <Shuffle className="h-4 w-4 mr-2" />
            Auto Assign {isOpenTeamCategory() ? 'Teams' : 'Players'}
          </Button>
        </div>
      </div>

      {/* Category Selection */}
      <Card>
        <CardContent className="p-4">
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
        </CardContent>
      </Card>

      {selectedCategory && (
        <>
          {/* Statistics */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {isOpenTeamCategory() ? categoryTeams.length : getCategoryPlayers().length}
                </div>
                <div className="text-sm text-gray-600">Total {isOpenTeamCategory() ? 'Teams' : 'Players'}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {isOpenTeamCategory() 
                    ? categoryTeams.length - unassignedTeams.length 
                    : getCategoryPlayers().length - getUnassignedPlayers().length
                  }
                </div>
                <div className="text-sm text-gray-600">Assigned {isOpenTeamCategory() ? 'Teams' : 'Players'}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {isOpenTeamCategory() ? unassignedTeams.length : getUnassignedPlayers().length}
                </div>
                <div className="text-sm text-gray-600">Unassigned {isOpenTeamCategory() ? 'Teams' : 'Players'}</div>
              </CardContent>
            </Card>
          </div>

          {/* Manual Assignment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRight className="h-5 w-5" />
                Manual Assignment
              </CardTitle>
              <CardDescription>
                Assign individual {isOpenTeamCategory() ? 'teams' : 'players'} to pools
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium mb-3">Unassigned {isOpenTeamCategory() ? 'Teams' : 'Players'}</h3>
                  <div className="space-y-2">
                    {isOpenTeamCategory() ? (
                      unassignedTeams.map(team => (
                        <div key={team.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <div className="font-medium">{team.name}</div>
                            <div className="text-sm text-gray-600">{team.players.length} players</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Select value={teamPoolSelections[team.id] || ''} onValueChange={(value) => setTeamPoolSelections(prev => ({ ...prev, [team.id]: value }))}>
                              <SelectTrigger className="w-32">
                                <SelectValue placeholder="Pool" />
                              </SelectTrigger>
                              <SelectContent>
                                {categoryPools.map(pool => (
                                  <SelectItem key={pool.id} value={pool.id}>
                                    {pool.name} ({pool.teams.length}/{pool.maxTeams})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button 
                              size="sm"
                              onClick={() => assignTeamToPool(team.id, teamPoolSelections[team.id])}
                              disabled={!teamPoolSelections[team.id]}
                            >
                              Assign
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      getUnassignedPlayers().map(player => (
                        <div key={player.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <div className="font-medium">{player.name}</div>
                            <div className="text-sm text-gray-600">{player.expertiseLevel}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Select value={playerPoolSelections[player.id] || ''} onValueChange={(value) => setPlayerPoolSelections(prev => ({ ...prev, [player.id]: value }))}>
                              <SelectTrigger className="w-32">
                                <SelectValue placeholder="Pool" />
                              </SelectTrigger>
                              <SelectContent>
                                {categoryPools.map(pool => (
                                  <SelectItem key={pool.id} value={pool.id}>
                                    {pool.name} ({pool.teams.length}/{pool.maxTeams})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button 
                              size="sm"
                              onClick={() => assignPlayerToPool(player.id, playerPoolSelections[player.id])}
                              disabled={!playerPoolSelections[player.id]}
                            >
                              Assign
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                    {(isOpenTeamCategory() ? unassignedTeams.length === 0 : getUnassignedPlayers().length === 0) && (
                      <div className="text-center py-8 text-gray-500">
                        All {isOpenTeamCategory() ? 'teams' : 'players'} have been assigned to pools
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-3">Available Pools</h3>
                  <div className="space-y-2">
                    {categoryPools.map(pool => (
                      <div key={pool.id} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-medium">{pool.name}</div>
                            <div className="text-sm text-gray-600">
                              {pool.teams.length}/{pool.maxTeams} {isOpenTeamCategory() ? 'teams' : 'players'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={pool.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                              {pool.status}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditPool(pool)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          {isOpenTeamCategory() ? 'Teams' : 'Players'}: {
                            isOpenTeamCategory() 
                              ? getPoolTeams(pool).map(team => team.name).join(', ') || 'None'
                              : getPoolPlayers(pool).map(player => player.name).join(', ') || 'None'
                          }
                        </div>
                      </div>
                    ))}
                    {categoryPools.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        No pools created for this category
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pool Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Pool Overview
              </CardTitle>
              <CardDescription>
                Current pool assignments and {isOpenTeamCategory() ? 'team' : 'player'} distribution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryPools.map(pool => {
                  const poolTeams = isOpenTeamCategory() ? getPoolTeams(pool) : [];
                  const poolPlayers = isOpenTeamCategory() ? [] : getPoolPlayers(pool);
                  const items = isOpenTeamCategory() ? poolTeams : poolPlayers;
                  
                  return (
                    <div key={pool.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        {editingPoolName === pool.id ? (
                          <div className="flex items-center gap-2 flex-1">
                            <Input
                              value={editingPoolNameValue}
                              onChange={(e) => setEditingPoolNameValue(e.target.value)}
                              onKeyDown={(e) => handleKeyPress(e, pool.id)}
                              className="h-8"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              onClick={() => savePoolName(pool.id)}
                              className="h-8 px-2"
                            >
                              ✓
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={cancelEditingPoolName}
                              className="h-8 px-2"
                            >
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <h3 
                            className="font-semibold cursor-pointer hover:text-blue-600"
                            onClick={() => startEditingPoolName(pool)}
                            title="Click to edit pool name"
                          >
                            {pool.name}
                          </h3>
                        )}
                        <Badge variant="outline">
                          {items.length}/{pool.maxTeams}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="text-sm text-gray-600">
                          Status: <Badge className={pool.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                            {pool.status}
                          </Badge>
                        </div>
                        
                        <div>
                          <div className="text-sm font-medium mb-1">{isOpenTeamCategory() ? 'Teams' : 'Players'}:</div>
                          <div className="space-y-1">
                            {isOpenTeamCategory() ? (
                              poolTeams.map(team => (
                                <div key={team.id} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                                  <span>{team.name}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">
                                      {team.players.length} players
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => removeTeamFromPool(team.id, pool.id)}
                                      className="h-4 w-4 p-0 text-red-500"
                                    >
                                      ×
                                    </Button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              poolPlayers.map(player => (
                                <div key={player.id} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                                  <span>{player.name}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">
                                      {player.expertiseLevel}
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => removePlayerFromPool(player.id, pool.id)}
                                      className="h-4 w-4 p-0 text-red-500"
                                    >
                                      ×
                                    </Button>
                                  </div>
                                </div>
                              ))
                            )}
                            {items.length === 0 && (
                              <div className="text-center text-gray-500 py-2 text-sm">
                                No {isOpenTeamCategory() ? 'teams' : 'players'} assigned
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
      
      {/* Edit Pool Dialog */}
      <Dialog open={editPoolOpen} onOpenChange={setEditPoolOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Pool: {editingPool?.name}</DialogTitle>
            <DialogDescription>
              Select {isOpenTeamCategory() ? 'teams' : 'players'} to assign to this pool. {isOpenTeamCategory() ? 'Teams' : 'Players'} can only be assigned to one pool at a time.
            </DialogDescription>
          </DialogHeader>
          
          {editingPool && (
            <div className="space-y-6">
              {/* Pool Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <Label className="text-sm font-medium">Pool Name</Label>
                  <div className="text-lg font-semibold">{editingPool.name}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Capacity</Label>
                  <div className="text-lg font-semibold">{editingPool.maxTeams} {isOpenTeamCategory() ? 'teams' : 'players'}</div>
                </div>
              </div>

              {/* Team Selection */}
              <div>
                <Label className="text-base font-semibold mb-4 block">Select {isOpenTeamCategory() ? 'Teams' : 'Players'}</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                  {isOpenTeamCategory() ? (
                    getCategoryTeams().map(team => (
                      <div key={team.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                        <Checkbox
                          id={`team-${team.id}`}
                          checked={selectedTeamsForPool.includes(team.id)}
                          onCheckedChange={(checked) => handleTeamSelection(team.id, checked as boolean)}
                        />
                        <div className="flex-1">
                          <Label htmlFor={`team-${team.id}`} className="font-medium cursor-pointer">
                            {team.name}
                          </Label>
                          <div className="text-sm text-gray-600">
                            {team.players.length} players
                            {team.poolId && team.poolId !== editingPool.id && (
                              <span className="text-orange-600 ml-2">(Currently in another pool)</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    getCategoryPlayers().map(player => (
                      <div key={player.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                        <Checkbox
                          id={`player-${player.id}`}
                          checked={selectedPlayersForPool.includes(player.id)}
                          onCheckedChange={(checked) => handlePlayerSelection(player.id, checked as boolean)}
                        />
                        <div className="flex-1">
                          <Label htmlFor={`player-${player.id}`} className="font-medium cursor-pointer">
                            {player.name}
                          </Label>
                          <div className="text-sm text-gray-600">
                            {player.expertiseLevel}
                            {getCategoryPools().some(pool => pool.id !== editingPool.id && pool.teams.includes(player.id)) && (
                              <span className="text-orange-600 ml-2">(Currently in another pool)</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                {(isOpenTeamCategory() ? getCategoryTeams().length === 0 : getCategoryPlayers().length === 0) && (
                  <div className="text-center py-8 text-gray-500">
                    No {isOpenTeamCategory() ? 'teams' : 'players'} available for this category
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button variant="outline" onClick={closeEditPool}>
                  Cancel
                </Button>
                <Button 
                  onClick={savePoolChanges}
                  disabled={selectedTeamsForPool.length > editingPool.maxTeams}
                >
                  Save Changes
                </Button>
              </div>
              
              {selectedTeamsForPool.length > editingPool.maxTeams && (
                <div className="text-sm text-red-600 text-center">
                  Cannot assign more than {editingPool.maxTeams} teams to this pool
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {ConfirmDialogComponent}
      {AlertDialogComponent}
    </div>
  );
}
