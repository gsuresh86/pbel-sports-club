'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Team, Pool, Tournament, CategoryType } from '@/types';
import { Target, Users, Shuffle, ArrowRight, ArrowLeft } from 'lucide-react';

interface PoolAssignmentProps {
  tournament: Tournament;
  user: { id: string; role: string; email: string };
}

export default function PoolAssignment({ tournament, user }: PoolAssignmentProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<CategoryType | ''>('');
  const [selectedPool, setSelectedPool] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [tournament.id]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadTeams(),
      loadPools(),
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

  const assignTeamToPool = async (teamId: string, poolId: string) => {
    try {
      const pool = pools.find(p => p.id === poolId);
      if (!pool) return;

      // Check if pool is full
      if (pool.teams.length >= pool.maxTeams) {
        alert('Pool is full! Cannot add more teams.');
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

      // Refresh data
      await loadData();
    } catch (error) {
      console.error('Error assigning team to pool:', error);
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
        poolId: null,
        updatedAt: new Date(),
      });

      // Refresh data
      await loadData();
    } catch (error) {
      console.error('Error removing team from pool:', error);
    }
  };

  const autoAssignTeamsToPools = async () => {
    if (!selectedCategory) return;

    const categoryTeams = teams.filter(team => 
      team.category === selectedCategory && !team.poolId
    );
    const categoryPools = pools.filter(pool => pool.category === selectedCategory);

    if (categoryTeams.length === 0 || categoryPools.length === 0) return;

    // Distribute teams evenly across pools
    let poolIndex = 0;
    for (const team of categoryTeams) {
      const pool = categoryPools[poolIndex % categoryPools.length];
      
      // Check if pool has space
      if (pool.teams.length < pool.maxTeams) {
        await assignTeamToPool(team.id, pool.id);
      }
      
      poolIndex++;
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

  const getUnassignedTeams = () => {
    return getCategoryTeams().filter(team => !team.poolId);
  };

  const getPoolTeams = (pool: Pool) => {
    return teams.filter(team => pool.teams.includes(team.id));
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
          <p className="text-gray-600">Assign teams to pools/groups</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={autoAssignTeamsToPools} disabled={!selectedCategory || unassignedTeams.length === 0}>
            <Shuffle className="h-4 w-4 mr-2" />
            Auto Assign Teams
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
                <div className="text-2xl font-bold text-blue-600">{categoryTeams.length}</div>
                <div className="text-sm text-gray-600">Total Teams</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{categoryTeams.length - unassignedTeams.length}</div>
                <div className="text-sm text-gray-600">Assigned Teams</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">{unassignedTeams.length}</div>
                <div className="text-sm text-gray-600">Unassigned Teams</div>
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
                Assign individual teams to pools
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium mb-3">Unassigned Teams</h3>
                  <div className="space-y-2">
                    {unassignedTeams.map(team => (
                      <div key={team.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium">{team.name}</div>
                          <div className="text-sm text-gray-600">{team.players.length} players</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select value={selectedPool} onValueChange={setSelectedPool}>
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
                            onClick={() => assignTeamToPool(team.id, selectedPool)}
                            disabled={!selectedPool}
                          >
                            Assign
                          </Button>
                        </div>
                      </div>
                    ))}
                    {unassignedTeams.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        All teams have been assigned to pools
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
                              {pool.teams.length}/{pool.maxTeams} teams
                            </div>
                          </div>
                          <Badge className={pool.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                            {pool.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-500">
                          Teams: {getPoolTeams(pool).map(team => team.name).join(', ') || 'None'}
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
                Current pool assignments and team distribution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryPools.map(pool => {
                  const poolTeams = getPoolTeams(pool);
                  return (
                    <div key={pool.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-semibold">{pool.name}</h3>
                        <Badge variant="outline">
                          {poolTeams.length}/{pool.maxTeams}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="text-sm text-gray-600">
                          Status: <Badge className={pool.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                            {pool.status}
                          </Badge>
                        </div>
                        
                        <div>
                          <div className="text-sm font-medium mb-1">Teams:</div>
                          <div className="space-y-1">
                            {poolTeams.map(team => (
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
                            ))}
                            {poolTeams.length === 0 && (
                              <div className="text-center text-gray-500 py-2 text-sm">
                                No teams assigned
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
    </div>
  );
}
