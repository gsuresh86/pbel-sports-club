'use client';

import { useState } from 'react';
import { collection, getDocs, updateDoc, doc, query, orderBy, addDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { tournamentMatchesRef } from '@/lib/firestore-paths';

// IST = UTC+5:30
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/** UTC Date → "YYYY-MM-DDTHH:mm" string in IST, for datetime-local inputs */
function toISTLocal(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 16);
}

/** "YYYY-MM-DDTHH:mm" string treated as IST → UTC Date */
function fromISTLocal(value: string): Date {
  return new Date(new Date(value + ':00Z').getTime() - IST_OFFSET_MS);
}
import {
  useTournamentTeams,
  useTournamentPools,
  useTournamentRegistrations,
  useTournamentMatches,
  useInvalidateTournament,
} from '@/hooks/use-tournament-queries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Team, Pool, Registration, Tournament, CategoryType, Match } from '@/types';
import { Target, Users, Shuffle, ArrowRight, ArrowLeft, Edit, Plus, X, Swords, Trophy, Award } from 'lucide-react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog'; // ConfirmDialogComponent still rendered
import { useAlertDialog } from '@/components/ui/alert-dialog-component';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Categories whose pools are filled with teams (assign team numbers) rather than
// individual players. Mirrors the team categories used at registration time.
const TEAM_CATEGORIES: CategoryType[] = ['mens-team', 'womens-team', 'kids-team-u13', 'kids-team-u18', 'open-team'];

interface PoolAssignmentProps {
  tournament: Tournament;
  user: { id: string; role: string; email: string };
}

export default function PoolAssignment({ tournament, user }: PoolAssignmentProps) {
  const { ConfirmDialogComponent } = useConfirmDialog();
  const { alert, AlertDialogComponent } = useAlertDialog();
  const invalidateTournament = useInvalidateTournament();
  const { data: teams = [], isLoading: teamsLoading } = useTournamentTeams(tournament.id);
  const { data: pools = [], isLoading: poolsLoading } = useTournamentPools(tournament.id);
  const { data: registrations = [], isLoading: registrationsLoading } =
    useTournamentRegistrations(tournament.id);
  const { data: matches = [], isLoading: matchesLoading } = useTournamentMatches(tournament.id);
  const loading = teamsLoading || poolsLoading || registrationsLoading || matchesLoading;

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
  const [editingPoolQualifyCount, setEditingPoolQualifyCount] = useState(2);
  const [categoryQualifyCount, setCategoryQualifyCount] = useState('2');
  const [savingQualifySettings, setSavingQualifySettings] = useState(false);

  // Single match generation state
  const [singleMatchDialogPool, setSingleMatchDialogPool] = useState<Pool | null>(null);
  const [singleMatchP1, setSingleMatchP1] = useState<string>('');
  const [singleMatchP2, setSingleMatchP2] = useState<string>('');
  const [singleMatchScheduledTime, setSingleMatchScheduledTime] = useState<string>('');
  const [creatingSingleMatch, setCreatingSingleMatch] = useState(false);

  // Generate matches dialog (round-robin, category or per-pool)
  const [genDialogOpen, setGenDialogOpen] = useState(false);
  const [genDialogPool, setGenDialogPool] = useState<Pool | null>(null); // null = all pools in category
  const [genForm, setGenForm] = useState({ startDateTime: '', intervalMinutes: '30', matchFormat: 'best-of-3' as 'single-set-11' | 'single-set' | 'best-of-3' | 'best-of-3-15pt' | 'single-set-30' });
  const [generating, setGenerating] = useState(false);

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

      invalidateTournament(tournament.id);
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

      invalidateTournament(tournament.id);
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

      invalidateTournament(tournament.id);
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

      invalidateTournament(tournament.id);
      setTeamPoolSelections(prev => {
        const next = { ...prev };
        delete next[teamId];
        return next;
      });
    } catch (error) {
      console.error('Error removing team from pool:', error);
    }
  };

  const autoAssignToPools = async () => {
    if (!selectedCategory) return;

    const categoryPools = getCategoryPools();
    if (categoryPools.length === 0) return;

    if (isTeamCategory()) {
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

  const SKILL_RANK: Record<string, number> = { expert: 0, advanced: 1, intermediate: 2, beginner: 3 };

  const getPoolPlayers = (pool: Pool) => {
    return registrations
      .filter(registration => pool.teams.includes(registration.id))
      .sort((a, b) =>
        (SKILL_RANK[a.expertiseLevel] ?? 4) - (SKILL_RANK[b.expertiseLevel] ?? 4) ||
        a.name.localeCompare(b.name)
      );
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

      invalidateTournament(tournament.id);
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

  const isTeamCategory = () => {
    return selectedCategory !== '' && TEAM_CATEGORIES.includes(selectedCategory as CategoryType);
  };

  const syncCategoryQualifyCount = (cat: CategoryType) => {
    const count = tournament.categoryQualifyCounts?.[cat] ?? 2;
    setCategoryQualifyCount(String(count));
  };

  const saveCategoryQualifySettings = async () => {
    if (!selectedCategory) return;
    setSavingQualifySettings(true);
    try {
      const count = Math.max(1, parseInt(categoryQualifyCount) || 2);
      await updateDoc(doc(db, 'tournaments', tournament.id), {
        categoryQualifyCounts: {
          ...(tournament.categoryQualifyCounts ?? {}),
          [selectedCategory]: count,
        },
        updatedAt: new Date(),
      });
      invalidateTournament(tournament.id);
      setCategoryQualifyCount(String(count));
      alert({
        title: 'Saved',
        description: `Default qualification count set to ${count} for this category.`,
        variant: 'success',
      });
    } catch (error) {
      console.error('Error saving qualification settings:', error);
      alert({ title: 'Error', description: 'Failed to save qualification settings.', variant: 'error' });
    } finally {
      setSavingQualifySettings(false);
    }
  };

  const applyCategoryQualifyToAllPools = async () => {
    if (!selectedCategory) return;
    const count = Math.max(1, parseInt(categoryQualifyCount) || 2);
    setSavingQualifySettings(true);
    try {
      await updateDoc(doc(db, 'tournaments', tournament.id), {
        categoryQualifyCounts: {
          ...(tournament.categoryQualifyCounts ?? {}),
          [selectedCategory]: count,
        },
        updatedAt: new Date(),
      });
      const categoryPools = getCategoryPools();
      await Promise.all(
        categoryPools.map(pool =>
          updateDoc(doc(db, 'tournaments', tournament.id, 'pools', pool.id), {
            qualifyCount: count,
            updatedAt: new Date(),
          }),
        ),
      );
      invalidateTournament(tournament.id);
      alert({
        title: 'Applied',
        description: `Set ${count} qualifier(s) on all ${categoryPools.length} pools.`,
        variant: 'success',
      });
    } catch (error) {
      console.error('Error applying qualification settings:', error);
      alert({ title: 'Error', description: 'Failed to apply to pools.', variant: 'error' });
    } finally {
      setSavingQualifySettings(false);
    }
  };

  const getUnassignedTeams = () => {
    return getCategoryTeams().filter(team => !team.poolId);
  };

  const getPoolTeams = (pool: Pool) => {
    return teams.filter(team => pool.teams.includes(team.id));
  };

  type PoolStandingRow = { id: string; name: string; played: number; wins: number; losses: number; setsFor: number; setsAgainst: number };
  const getPoolStandings = (pool: Pool): PoolStandingRow[] => {
    const poolMatches = matches.filter(
      m => m.round === pool.name && m.status === 'completed'
    );
    const map = new Map<string, PoolStandingRow>();
    for (const m of poolMatches) {
      const p1Sets = m.player1Score ?? 0;
      const p2Sets = m.player2Score ?? 0;
      const p1Won = p1Sets > p2Sets;
      if (!map.has(m.player1Id)) {
        map.set(m.player1Id, { id: m.player1Id, name: m.player1Name, played: 0, wins: 0, losses: 0, setsFor: 0, setsAgainst: 0 });
      }
      if (!map.has(m.player2Id)) {
        map.set(m.player2Id, { id: m.player2Id, name: m.player2Name, played: 0, wins: 0, losses: 0, setsFor: 0, setsAgainst: 0 });
      }
      const r1 = map.get(m.player1Id)!;
      const r2 = map.get(m.player2Id)!;
      r1.played++; r2.played++;
      r1.setsFor += p1Sets; r1.setsAgainst += p2Sets;
      r2.setsFor += p2Sets; r2.setsAgainst += p1Sets;
      if (p1Won) { r1.wins++; r2.losses++; } else { r2.wins++; r1.losses++; }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return (b.setsFor - b.setsAgainst) - (a.setsFor - a.setsAgainst);
    });
  };

  const openGenerateDialog = (pool: Pool | null) => {
    setGenDialogPool(pool);
    const defaultStart = tournament.startDate ? toISTLocal(new Date(tournament.startDate)) : '';
    const defaultFormat = ((tournament as any).matchFormat as 'single-set-11' | 'single-set' | 'best-of-3' | 'best-of-3-15pt' | 'single-set-30') || 'best-of-3';
    setGenForm({ startDateTime: defaultStart, intervalMinutes: '30', matchFormat: defaultFormat });
    setGenDialogOpen(true);
  };

  const runGenerateMatches = async () => {
    if (!genForm.startDateTime) {
      alert({ title: 'Missing date', description: 'Please enter a start date and time (IST).', variant: 'error' });
      return;
    }
    setGenerating(true);
    try {
      const pools = genDialogPool ? [genDialogPool] : getCategoryPools();
      const startTime = fromISTLocal(genForm.startDateTime);
      const intervalMs = Math.max(0, parseInt(genForm.intervalMinutes) || 0) * 60 * 1000;
      const venue = tournament.venue || 'TBD';
      let matchIndex = 0;
      let totalCreated = 0;

      for (const pool of pools) {
        const items = isTeamCategory() ? getPoolTeams(pool) : getPoolPlayers(pool);
        if (items.length < 2) continue;
        const roundLabel = pool.name || `Pool ${pool.id.slice(0, 6)}`;
        let matchNumber = 1;

        for (let i = 0; i < items.length; i++) {
          for (let j = i + 1; j < items.length; j++) {
            await addDoc(tournamentMatchesRef(tournament.id), {
              tournamentId: tournament.id,
              round: roundLabel,
              matchNumber,
              player1Id: items[i].id,
              player1Name: items[i].name,
              player2Id: items[j].id,
              player2Name: items[j].name,
              scheduledTime: new Date(startTime.getTime() + matchIndex * intervalMs),
              venue,
              status: 'not-scheduled',
              sets: [],
              matchFormat: genForm.matchFormat,
              updatedAt: new Date(),
              createdBy: user.id,
            });
            matchNumber++;
            matchIndex++;
            totalCreated++;
          }
        }
      }

      if (totalCreated === 0) {
        alert({ title: 'No matches created', description: `Each pool needs at least 2 ${isTeamCategory() ? 'teams' : 'players'}.`, variant: 'error' });
      } else {
        invalidateTournament(tournament.id);
        setGenDialogOpen(false);
        alert({ title: 'Matches generated', description: `Created ${totalCreated} match${totalCreated === 1 ? '' : 'es'}.`, variant: 'success' });
      }
    } catch (err) {
      alert({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to generate matches.', variant: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  const generateMatchesFromPools = () => {
    if (!selectedCategory) {
      alert({ title: 'Select category', description: 'Please select a category first.', variant: 'error' });
      return;
    }
    if (getCategoryPools().length === 0) {
      alert({ title: 'No pools', description: 'Create and fill at least one pool for this category first.', variant: 'error' });
      return;
    }
    openGenerateDialog(null);
  };

  const generateMatchesForPool = (pool: Pool) => {
    const items = isTeamCategory() ? getPoolTeams(pool) : getPoolPlayers(pool);
    if (items.length < 2) {
      alert({ title: 'Not enough participants', description: `Pool needs at least 2 ${isTeamCategory() ? 'teams' : 'players'}.`, variant: 'error' });
      return;
    }
    openGenerateDialog(pool);
  };

  /** Create a single match between two participants in a pool */
  const createSingleMatch = async () => {
    if (!singleMatchDialogPool || !singleMatchP1 || !singleMatchP2 || singleMatchP1 === singleMatchP2) {
      alert({ title: 'Invalid selection', description: 'Pick two different participants.', variant: 'error' });
      return;
    }
    if (!singleMatchScheduledTime) {
      alert({ title: 'Missing time', description: 'Please enter a scheduled date and time (IST).', variant: 'error' });
      return;
    }
    setCreatingSingleMatch(true);
    try {
      const pool = singleMatchDialogPool;
      const items = isTeamCategory() ? getPoolTeams(pool) : getPoolPlayers(pool);
      const a = items.find((x) => x.id === singleMatchP1);
      const b = items.find((x) => x.id === singleMatchP2);
      if (!a || !b) return;
      const existingCount = matches.filter((m) => m.round === pool.name).length;
      await addDoc(tournamentMatchesRef(tournament.id), {
        tournamentId: tournament.id,
        round: pool.name || `Pool ${pool.id.slice(0, 6)}`,
        matchNumber: existingCount + 1,
        player1Id: a.id,
        player1Name: a.name,
        player2Id: b.id,
        player2Name: b.name,
        scheduledTime: fromISTLocal(singleMatchScheduledTime),
        venue: tournament.venue || 'TBD',
        status: 'scheduled',
        sets: [],
        matchFormat: (tournament as any).matchFormat || 'best-of-3',
        updatedAt: new Date(),
        createdBy: user.id,
      });
      invalidateTournament(tournament.id);
      setSingleMatchDialogPool(null);
      setSingleMatchP1('');
      setSingleMatchP2('');
      setSingleMatchScheduledTime('');
      alert({ title: 'Match created', description: `${a.name} vs ${b.name} added.`, variant: 'success' });
    } catch (err) {
      alert({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to create match.', variant: 'error' });
    } finally {
      setCreatingSingleMatch(false);
    }
  };

  const openEditPool = (pool: Pool) => {
    setEditingPool(pool);
    setEditingPoolQualifyCount(
      pool.qualifyCount ?? tournament.categoryQualifyCounts?.[pool.category] ?? 2,
    );
    if (isTeamCategory()) {
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
      const selectedItems = isTeamCategory() ? selectedTeamsForPool : selectedPlayersForPool;
      await updateDoc(doc(db, 'tournaments', tournament.id, 'pools', editingPool.id), {
        teams: selectedItems,
        qualifyCount: editingPoolQualifyCount,
        updatedAt: new Date(),
      });

      if (isTeamCategory()) {
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

      invalidateTournament(tournament.id);
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
      <div className="flex justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pool Assignment</h2>
          <p className="text-gray-600">Assign {isTeamCategory() ? 'teams' : 'players'} to pools/groups</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedCategory} onValueChange={(value) => {
            setSelectedCategory(value as CategoryType);
            syncCategoryQualifyCount(value as CategoryType);
          }}>
            <SelectTrigger className="w-44">
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
          <Button
            variant="outline"
            onClick={generateMatchesFromPools}
            disabled={!selectedCategory || getCategoryPools().length === 0}
          >
            <Swords className="h-4 w-4 mr-2" />
            Generate matches
          </Button>
          <Button onClick={autoAssignToPools} disabled={!selectedCategory || (isTeamCategory() ? unassignedTeams.length === 0 : getUnassignedPlayers().length === 0)}>
            <Shuffle className="h-4 w-4 mr-2" />
            Auto Assign {isTeamCategory() ? 'Teams' : 'Players'}
          </Button>
        </div>
      </div>

      {selectedCategory && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-600" />
                Knockout qualification
              </CardTitle>
              <CardDescription>
                How many {isTeamCategory() ? 'teams' : 'players'} advance from each pool to QF
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Category default</Label>
                  <Input
                    type="number"
                    min="1"
                    max="8"
                    className="h-9 w-24"
                    value={categoryQualifyCount}
                    onChange={e => setCategoryQualifyCount(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={saveCategoryQualifySettings}
                  disabled={savingQualifySettings}
                >
                  Save default
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={applyCategoryQualifyToAllPools}
                  disabled={savingQualifySettings || getCategoryPools().length === 0}
                >
                  Apply to all pools
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Manual Assignment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRight className="h-5 w-5" />
                Manual Assignment
              </CardTitle>
              <CardDescription>
                Assign individual {isTeamCategory() ? 'teams' : 'players'} to pools
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium mb-3">Unassigned {isTeamCategory() ? 'Teams' : 'Players'}</h3>
                  <div className="space-y-2">
                    {isTeamCategory() ? (
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
                    {(isTeamCategory() ? unassignedTeams.length === 0 : getUnassignedPlayers().length === 0) && (
                      <div className="text-center py-8 text-gray-500">
                        All {isTeamCategory() ? 'teams' : 'players'} have been assigned to pools
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
                              {pool.teams.length}/{pool.maxTeams} {isTeamCategory() ? 'teams' : 'players'}
                              {' · '}
                              Top {pool.qualifyCount ?? tournament.categoryQualifyCounts?.[pool.category] ?? 2} qualify
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
                          {isTeamCategory() ? 'Teams' : 'Players'}: {
                            isTeamCategory() 
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
                Current pool assignments and {isTeamCategory() ? 'team' : 'player'} distribution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryPools.map(pool => {
                  const poolTeams = isTeamCategory() ? getPoolTeams(pool) : [];
                  const poolPlayers = isTeamCategory() ? [] : getPoolPlayers(pool);
                  const items = isTeamCategory() ? poolTeams : poolPlayers;
                  
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
                          <div className="text-sm font-medium mb-1">{isTeamCategory() ? 'Teams' : 'Players'}:</div>
                          <div className="space-y-1">
                            {isTeamCategory() ? (
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
                                No {isTeamCategory() ? 'teams' : 'players'} assigned
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Per-pool match actions */}
                        {items.length >= 2 && (
                          <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={() => generateMatchesForPool(pool)}
                            >
                              <Swords className="h-3.5 w-3.5" />
                              Round-robin
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={() => {
                                setSingleMatchDialogPool(pool);
                                setSingleMatchP1('');
                                setSingleMatchP2('');
                                setSingleMatchScheduledTime(tournament.startDate ? toISTLocal(new Date(tournament.startDate)) : '');
                              }}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Single match
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Pool results / standings from completed matches */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Pool results
              </CardTitle>
              <CardDescription>
                Standings from completed matches. Start matches and enter scores in the tournament Matches tab.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {categoryPools.map(pool => {
                  const standings = getPoolStandings(pool);
                  return (
                    <div key={pool.id}>
                      <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <Award className="h-4 w-4 text-amber-500" />
                        {pool.name}
                      </h3>
                      {standings.length === 0 ? (
                        <p className="text-sm text-gray-500 py-2">No completed matches in this pool yet.</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10">#</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead className="text-center">Played</TableHead>
                              <TableHead className="text-center">W</TableHead>
                              <TableHead className="text-center">L</TableHead>
                              <TableHead className="text-center">Sets For</TableHead>
                              <TableHead className="text-center">Sets Agst</TableHead>
                              <TableHead className="text-center">Diff</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {standings.map((row, idx) => (
                              <TableRow key={row.id}>
                                <TableCell className="font-medium">{idx + 1}</TableCell>
                                <TableCell>{row.name}</TableCell>
                                <TableCell className="text-center">{row.played}</TableCell>
                                <TableCell className="text-center font-semibold text-green-600">{row.wins}</TableCell>
                                <TableCell className="text-center text-red-600">{row.losses}</TableCell>
                                <TableCell className="text-center">{row.setsFor}</TableCell>
                                <TableCell className="text-center">{row.setsAgainst}</TableCell>
                                <TableCell className="text-center">{row.setsFor - row.setsAgainst >= 0 ? `+${row.setsFor - row.setsAgainst}` : row.setsFor - row.setsAgainst}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
      
      {/* Single Match Dialog */}
      <Dialog open={!!singleMatchDialogPool} onOpenChange={(open) => { if (!open) { setSingleMatchDialogPool(null); setSingleMatchP1(''); setSingleMatchP2(''); setSingleMatchScheduledTime(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add single match — {singleMatchDialogPool?.name}</DialogTitle>
            <DialogDescription>Pick two {isTeamCategory() ? 'teams' : 'players'} to create one match.</DialogDescription>
          </DialogHeader>
          {singleMatchDialogPool && (() => {
            const items = isTeamCategory() ? getPoolTeams(singleMatchDialogPool) : getPoolPlayers(singleMatchDialogPool);
            return (
              <div className="space-y-4 py-2">
                <div className="space-y-1">
                  <Label>{isTeamCategory() ? 'Team' : 'Player'} 1</Label>
                  <Select value={singleMatchP1} onValueChange={setSingleMatchP1}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {items.map((x) => (
                        <SelectItem key={x.id} value={x.id} disabled={x.id === singleMatchP2}>{x.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{isTeamCategory() ? 'Team' : 'Player'} 2</Label>
                  <Select value={singleMatchP2} onValueChange={setSingleMatchP2}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {items.map((x) => (
                        <SelectItem key={x.id} value={x.id} disabled={x.id === singleMatchP1}>{x.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Scheduled Time (IST)</Label>
                  <Input
                    type="datetime-local"
                    step="60"
                    value={singleMatchScheduledTime}
                    onChange={(e) => setSingleMatchScheduledTime(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={() => setSingleMatchDialogPool(null)}>Cancel</Button>
                  <Button onClick={createSingleMatch} disabled={!singleMatchP1 || !singleMatchP2 || singleMatchP1 === singleMatchP2 || !singleMatchScheduledTime || creatingSingleMatch}>
                    {creatingSingleMatch ? 'Creating…' : 'Create match'}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Edit Pool Dialog */}
      <Dialog open={editPoolOpen} onOpenChange={setEditPoolOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Pool: {editingPool?.name}</DialogTitle>
            <DialogDescription>
              Select {isTeamCategory() ? 'teams' : 'players'} to assign to this pool. {isTeamCategory() ? 'Teams' : 'Players'} can only be assigned to one pool at a time.
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
                  <div className="text-lg font-semibold">{editingPool.maxTeams} {isTeamCategory() ? 'teams' : 'players'}</div>
                </div>
                <div className="col-span-2">
                  <Label className="text-sm font-medium">Qualifiers to knockout</Label>
                  <Input
                    type="number"
                    min="1"
                    max="8"
                    className="mt-1 w-24"
                    value={editingPoolQualifyCount}
                    onChange={e => setEditingPoolQualifyCount(parseInt(e.target.value) || 1)}
                  />
                  <p className="text-xs text-gray-500 mt-1">Overrides category default for this pool</p>
                </div>
              </div>

              {/* Team Selection */}
              <div>
                <Label className="text-base font-semibold mb-4 block">Select {isTeamCategory() ? 'Teams' : 'Players'}</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                  {isTeamCategory() ? (
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
                
                {(isTeamCategory() ? getCategoryTeams().length === 0 : getCategoryPlayers().length === 0) && (
                  <div className="text-center py-8 text-gray-500">
                    No {isTeamCategory() ? 'teams' : 'players'} available for this category
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

      {/* Generate Matches Dialog */}
      <Dialog open={genDialogOpen} onOpenChange={(open) => { if (!open) setGenDialogOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Generate round-robin matches
              {genDialogPool ? ` — ${genDialogPool.name}` : getCategoryPools().length > 0 ? ` — All pools (${getCategoryPools().length})` : ''}
            </DialogTitle>
            <DialogDescription>
              Set the start time and interval between consecutive matches. All times are in IST (India Standard Time, UTC+5:30).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Start Date &amp; Time (IST)</Label>
              <Input
                type="datetime-local"
                step="60"
                value={genForm.startDateTime}
                onChange={(e) => setGenForm(f => ({ ...f, startDateTime: e.target.value }))}
              />
              <p className="text-xs text-gray-500">First match will be scheduled at this time</p>
            </div>
            <div className="space-y-1">
              <Label>Interval between matches (minutes)</Label>
              <Input
                type="number"
                min="0"
                step="5"
                value={genForm.intervalMinutes}
                onChange={(e) => setGenForm(f => ({ ...f, intervalMinutes: e.target.value }))}
                placeholder="e.g. 30"
              />
              <p className="text-xs text-gray-500">Gap between consecutive match start times (0 = same time for all)</p>
            </div>
            <div className="space-y-1">
              <Label>Match Format</Label>
              <Select value={genForm.matchFormat} onValueChange={(v: 'single-set-11' | 'single-set' | 'best-of-3' | 'best-of-3-15pt' | 'single-set-30') => setGenForm(f => ({ ...f, matchFormat: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single-set-11">Single set (11pt)</SelectItem>
                  <SelectItem value="single-set">Single set (21pt)</SelectItem>
                  <SelectItem value="best-of-3">Best of 3 (21pt)</SelectItem>
                  <SelectItem value="best-of-3-15pt">Best of 3 (15pt)</SelectItem>
                  <SelectItem value="single-set-30">30pt Single set</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {genDialogPool ? (() => {
              const n = (isTeamCategory() ? getPoolTeams(genDialogPool) : getPoolPlayers(genDialogPool)).length;
              const pairs = n * (n - 1) / 2;
              return <p className="text-sm text-gray-600">Will create <strong>{pairs}</strong> round-robin match{pairs === 1 ? '' : 'es'} for <strong>{genDialogPool.name}</strong>.</p>;
            })() : (
              <p className="text-sm text-gray-600">
                Will create round-robin matches for <strong>{getCategoryPools().length}</strong> pool(s) in this category.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setGenDialogOpen(false)}>Cancel</Button>
              <Button onClick={runGenerateMatches} disabled={!genForm.startDateTime || generating}>
                {generating ? 'Generating…' : 'Generate'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {ConfirmDialogComponent}
      {AlertDialogComponent}
    </div>
  );
}
