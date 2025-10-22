'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PublicLayout } from '@/components/PublicLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tournament, Match, Registration, Team, Pool } from '@/types';
import { Calendar, MapPin, Users, Trophy, Clock, Target, ExternalLink, UserCheck, Shield, Users2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function TournamentDetailPage() {
  const params = useParams();
  const tournamentId = params.id as string;
  const { user } = useAuth();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [participants, setParticipants] = useState<Registration[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [tournamentStats, setTournamentStats] = useState<{registrations: number, players: number, teams: number, pools: number}>({registrations: 0, players: 0, teams: 0, pools: 0});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'matches' | 'teams' | 'pools'>('overview');

  useEffect(() => {
    if (tournamentId) {
      loadTournament();
      loadMatches();
      loadParticipants();
      loadTeams();
      loadPools();
      loadTournamentStats();
    }
  }, [tournamentId]);

  const loadTournament = async () => {
    try {
      const docRef = doc(db, 'tournaments', tournamentId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTournament({
          id: docSnap.id,
          ...data,
          startDate: data.startDate?.toDate(),
          endDate: data.endDate?.toDate(),
          registrationDeadline: data.registrationDeadline?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as Tournament);
      }
    } catch (error) {
      console.error('Error loading tournament:', error);
    }
  };

  const loadMatches = async () => {
    try {
      const q = query(
        collection(db, 'matches'), 
        where('tournamentId', '==', tournamentId),
        orderBy('scheduledTime', 'asc')
      );
      const snapshot = await getDocs(q);
      const matchesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        scheduledTime: doc.data().scheduledTime?.toDate(),
        actualStartTime: doc.data().actualStartTime?.toDate(),
        actualEndTime: doc.data().actualEndTime?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Match[];
      setMatches(matchesData);
    } catch (error) {
      console.error('Error loading matches:', error);
    }
  };

  const loadParticipants = async () => {
    try {
      const q = query(
        collection(db, 'tournaments', tournamentId, 'registrations'), 
        orderBy('registeredAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const participantsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        registeredAt: doc.data().registeredAt?.toDate(),
        approvedAt: doc.data().approvedAt?.toDate(),
      })) as Registration[];
      setParticipants(participantsData);
      console.log('Debug - Loaded participants:', participantsData.length, participantsData);
    } catch (error) {
      console.error('Error loading participants:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTeams = async () => {
    try {
      const q = query(
        collection(db, 'tournaments', tournamentId, 'teams'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const teamsData = snapshot.docs.map(doc => ({
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
      const q = query(
        collection(db, 'tournaments', tournamentId, 'pools'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const poolsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Pool[];
      setPools(poolsData);
      console.log('Debug - Loaded pools:', poolsData.length, poolsData);
    } catch (error) {
      console.error('Error loading pools:', error);
    }
  };

  const loadTournamentStats = async () => {
    try {
      const registrationsSnapshot = await getDocs(collection(db, 'tournaments', tournamentId, 'registrations'));
      const registrationsCount = registrationsSnapshot.docs.length;
      
      const playersSnapshot = await getDocs(collection(db, 'tournaments', tournamentId, 'players'));
      const playersCount = playersSnapshot.docs.length;
      
      setTournamentStats({
        registrations: registrationsCount,
        players: playersCount,
        teams: 0,
        pools: 0
      });
    } catch (error) {
      console.error('Error loading tournament stats:', error);
    }
  };

  const updateStats = () => {
    setTournamentStats(prev => ({
      ...prev,
      teams: teams.length,
      pools: pools.length
    }));
  };

  useEffect(() => {
    updateStats();
  }, [teams, pools]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-100 text-blue-800';
      case 'ongoing': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getMatchStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'live': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'postponed': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSportBanner = (sport: string) => {
    switch (sport) {
      case 'badminton':
        return 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=400&q=80';
      case 'table-tennis':
        return 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=400&q=80';
      case 'volleyball':
        return 'https://images.unsplash.com/photo-1612872087720-b8768760e99a?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=400&q=80';
      default:
        return 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=400&q=80';
    }
  };

  const getSportIcon = (sport: string) => {
    switch (sport) {
      case 'badminton': return '🏸';
      case 'table-tennis': return '🏓';
      case 'volleyball': return '🏐';
      default: return '🏆';
    }
  };

  const isRegistrationOpen = () => {
    if (!tournament) return false;
    return tournament.registrationOpen && 
           new Date() <= tournament.registrationDeadline;
  };

  if (loading) {
    return (
      <PublicLayout>
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
          <p className="mt-4 text-gray-600">Loading tournament details...</p>
        </div>
      </div>
      </PublicLayout>
    );
  }

  if (!tournament) {
    return (
      <PublicLayout>
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Tournament Not Found</h1>
          <Link href="/tournaments">
            <Button>Back to Tournaments</Button>
          </Link>
        </div>
      </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="backdrop-blur-sm">
      {/* Tournament Banner */}
      <div className="relative h-64 w-full overflow-hidden">
        <img
          src={tournament.banner || getSportBanner(tournament.sport)}
          alt={`${tournament.name} tournament banner`}
          className="w-full h-full object-cover"
        />
          <div className="absolute inset-0 bg-opacity-40 flex items-center justify-center">
          <div className="text-center text-white">
            <h1 className="text-4xl font-bold mb-2">{tournament.name}</h1>
            <p className="text-xl capitalize">{tournament.sport} Tournament</p>
          </div>
        </div>
      </div>
      
      <div className="py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Tournament Header */}
            <Card className="mb-8 bg-white/90">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="flex items-center gap-3 text-3xl">
                  <span className="text-4xl">{getSportIcon(tournament.sport)}</span>
                  {tournament.name}
                </CardTitle>
                <CardDescription className="mt-4">
                  <div className="flex items-center gap-6 text-sm">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {new Date(tournament.startDate).toLocaleDateString()} - {new Date(tournament.endDate).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {tournament.venue}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {tournamentStats.registrations} registrations
                    </span>
                  </div>
                </CardDescription>
              </div>
              <div className="flex flex-col gap-2">
                <Badge className={getStatusColor(tournament.status)}>
                  {tournament.status}
                </Badge>
                {isRegistrationOpen() && (
                  <Badge className="bg-green-100 text-green-800">
                    Registration Open
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
              <div>
                <h3 className="font-semibold mb-3">Tournament Information</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Sport:</strong> {tournament.sport}</p>
                  <p><strong>Type:</strong> {tournament.tournamentType || 'individual'}</p>
                  <p><strong>Available Categories:</strong> {tournament.categories?.join(', ') || 'None'}</p>
                  <p><strong>Registration Deadline:</strong> {new Date(tournament.registrationDeadline).toLocaleDateString()}</p>
                  {tournament.entryFee && <p><strong>Entry Fee:</strong> ₹{tournament.entryFee}</p>}
                  {tournament.prizePool && <p><strong>Prize Pool:</strong> ₹{tournament.prizePool}</p>}
                    <p><strong>Teams:</strong> {tournamentStats.teams}</p>
                    <p><strong>Pools:</strong> {tournamentStats.pools}</p>
                  </div>
                </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('matches')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'matches'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Matches ({matches.length})
            </button>
            <button
                  onClick={() => setActiveTab('teams')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'teams'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Teams ({teams.length})
                </button>
                <button
                  onClick={() => setActiveTab('pools')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'pools'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
                  Pools ({pools.length})
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid md:grid-cols-2 gap-6">
                <Card className="bg-white/90">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Tournament Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total Matches:</span>
                    <span className="font-semibold">{matches.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Completed Matches:</span>
                    <span className="font-semibold">{matches.filter(m => m.status === 'completed').length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Live Matches:</span>
                    <span className="font-semibold text-green-600">{matches.filter(m => m.status === 'live').length}</span>
                  </div>
                      <div className="flex justify-between">
                        <span>Teams:</span>
                        <span className="font-semibold">{teams.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Pools:</span>
                        <span className="font-semibold">{pools.length}</span>
                      </div>
                  <div className="flex justify-between">
                    <span>Registered Participants:</span>
                    <span className="font-semibold">{participants.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

                <Card className="bg-white/90">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Upcoming Matches
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {matches.filter(m => m.status === 'scheduled').slice(0, 3).map(match => (
                    <div key={match.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{match.player1Name} vs {match.player2Name}</p>
                        <p className="text-sm text-gray-600">{match.round}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">{new Date(match.scheduledTime).toLocaleDateString()}</p>
                        <p className="text-sm text-gray-600">{new Date(match.scheduledTime).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))}
                  {matches.filter(m => m.status === 'scheduled').length === 0 && (
                    <p className="text-gray-500 text-center py-4">No upcoming matches</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'matches' && (
              <Card className="bg-white/90">
            <CardHeader>
              <CardTitle>All Matches</CardTitle>
              <CardDescription>Tournament match schedule and results</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Match</TableHead>
                      <TableHead>Players</TableHead>
                      <TableHead>Scheduled Time</TableHead>
                      <TableHead>Venue</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matches.map((match) => (
                      <TableRow key={match.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{match.round} - Match {match.matchNumber}</p>
                            {match.court && <p className="text-sm text-gray-500">{match.court}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p><strong>{match.player1Name}</strong> vs <strong>{match.player2Name}</strong></p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{new Date(match.scheduledTime).toLocaleDateString()}</p>
                            <p className="text-gray-500">{new Date(match.scheduledTime).toLocaleTimeString()}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{match.venue}</p>
                            {match.referee && <p className="text-gray-500">Ref: {match.referee}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getMatchStatusColor(match.status)}>
                            {match.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {match.status === 'completed' && match.winner ? (
                            <div className="text-sm">
                              <p className="font-semibold text-green-600">Winner: {match.winner}</p>
                              {match.sets && match.sets.length > 0 && (
                                <p className="text-gray-500">
                                  {match.sets.map(set => `${set.player1Score}-${set.player2Score}`).join(', ')}
                                </p>
                              )}
                            </div>
                          ) : match.status === 'live' ? (
                            <Link href={`/tournament/${tournament.id}/live/${match.id}`}>
                              <Button size="sm" variant="outline">
                                <Target className="h-4 w-4 mr-1" />
                                Live Score
                              </Button>
                            </Link>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {matches.length === 0 && (
                <div className="text-center py-8">
                  <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No matches scheduled</h3>
                  <p className="text-gray-600">Matches will appear here once they are scheduled</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

            {activeTab === 'teams' && (
              <Card className="bg-white/90">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Teams
                  </CardTitle>
                  <CardDescription>Tournament teams and their players</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {teams.map((team) => (
                      <Card key={team.id} className="bg-white">
            <CardHeader>
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg">{team.name}</CardTitle>
                              <CardDescription className="capitalize">
                                {team.category.replace(/-/g, ' ')} • {team.status}
                              </CardDescription>
                            </div>
                            <Badge variant="outline" className="capitalize">
                              {team.category.replace(/-/g, ' ')}
                            </Badge>
                          </div>
            </CardHeader>
            <CardContent>
                          <div className="space-y-3">
                            <div>
                              <h4 className="font-medium text-sm text-gray-700 mb-2">Team Players:</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {team.players.map((playerId, index) => {
                                  const player = participants.find(p => p.id === playerId);
                                  return (
                                    <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                        <span className="text-sm font-medium text-blue-600">{index + 1}</span>
                                      </div>
                                      <div>
                                        <p className="font-medium text-sm">{player?.name || `Player ${index + 1}`}</p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            {team.captainId && (
                              <div className="pt-2 border-t">
                                <p className="text-sm text-gray-600">
                                  <strong>Captain:</strong> {participants.find(p => p.id === team.captainId)?.name || 'Unknown'}
                                </p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    
                    {teams.length === 0 && (
                      <div className="text-center py-8">
                        <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No teams created yet</h3>
                        <p className="text-gray-600">Teams will appear here once they are created by tournament organizers</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'pools' && (
              <Card className="bg-white/90">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users2 className="h-5 w-5" />
                    Pools
                  </CardTitle>
                  <CardDescription>Tournament pools and group standings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {pools.map((pool) => (
                      <Card key={pool.id} className="bg-white">
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg">{pool.name}</CardTitle>
                              <CardDescription className="capitalize">
                                {pool.category.replace(/-/g, ' ')} • Max {pool.maxTeams} {(() => {
                                  const isKidsCategory = pool.category.includes('under-13') || pool.category.includes('under-18');
                                  const isTeamCategory = (pool.category.includes('team') || pool.category.includes('doubles')) && !isKidsCategory;
                                  return isTeamCategory ? 'teams' : 'players';
                                })()}
                              </CardDescription>
                            </div>
                          <Badge variant="secondary" className="capitalize">
                              {pool.status}
                          </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div>
                              <h4 className="font-medium text-sm text-gray-700 mb-2">
                                {(() => {
                                  const isKidsCategory = pool.category.includes('kids-team-u13') || pool.category.includes('kids-team-u18');
                                  const isTeamCategory = (pool.category.includes('team') || pool.category.includes('doubles')) && !isKidsCategory;
                                  return isTeamCategory ? 'Teams in Pool:' : 'Players in Pool:';
                                })()}
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {pool.teams.map((itemId, index) => {
                                  // Check if this is a team category or individual player category
                                  // Kids categories should be treated as individual player categories
                                  const isKidsCategory = pool.category.includes('kids-team-u13') || pool.category.includes('kids-team-u18');
                                  const isTeamCategory = (pool.category.includes('team') || pool.category.includes('doubles')) && !isKidsCategory;
                                  
                                  console.log('Debug Pool:', pool.name, 'Category:', pool.category, 'IsKidsCategory:', isKidsCategory, 'IsTeamCategory:', isTeamCategory, 'ItemId:', itemId);
                                  
                                  if (isTeamCategory) {
                                    // For team categories, show team information
                                    const team = teams.find(t => t.id === itemId);
                                   
                                    console.log('Found team:', team);
                                    return (
                                      <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                          <span className="text-sm font-medium text-green-600">{index + 1}</span>
                                        </div>
                                        <div>
                                          <p className="font-medium text-sm">{team?.name || `Team ${index + 1}`}</p>
                                          {team && (
                                            <p className="text-xs text-gray-500">
                                              {team.players.length} players • {team.status}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  } else {
                                    // For individual player categories (including kids), show player information
                                    const player = participants.find(p => p.id === itemId);
                                    console.log('Found player:', player);
                                    return (
                                      <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                          <span className="text-sm font-medium text-blue-600">{index + 1}</span>
                                        </div>
                                        <div>
                                          <p className="font-medium text-sm">{player?.name || `Player ${index + 1}`}</p>
                                          {player && (
                                            <p className="text-xs text-gray-500">
                                              {player.selectedCategory}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  }
                                })}
                              </div>
                            </div>
                            {pool.teams.length === 0 && (
                              <p className="text-sm text-gray-500 italic">
                                No {(() => {
                                  const isKidsCategory = pool.category.includes('under-13') || pool.category.includes('under-18');
                                  const isTeamCategory = (pool.category.includes('team') || pool.category.includes('doubles')) && !isKidsCategory;
                                  return isTeamCategory ? 'teams' : 'players';
                                })()} assigned to this pool yet
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    
                    {pools.length === 0 && (
                <div className="text-center py-8">
                        <Users2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No pools created yet</h3>
                        <p className="text-gray-600">Pools will appear here once they are created by tournament organizers</p>
                </div>
              )}
                  </div>
            </CardContent>
          </Card>
        )}
        </div>
      </div>
    </div>
    </PublicLayout>
  );
}