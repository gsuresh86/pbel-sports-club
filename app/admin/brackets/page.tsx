'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { collection, getDocs, query, where, doc, setDoc, updateDoc, addDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Tournament, TournamentBracket, BracketRound, BracketMatch, BracketParticipant, Registration, CategoryType } from '@/types';
import { Trophy, Users, Plus, Edit, Trash2, Eye, Play, Target, Crown, Award } from 'lucide-react';

export default function ManageBracketsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [brackets, setBrackets] = useState<TournamentBracket[]>([]);
  const [participants, setParticipants] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTournament, setSelectedTournament] = useState<string>('');
  const [selectedBracket, setSelectedBracket] = useState<TournamentBracket | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showBracketDialog, setShowBracketDialog] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/login');
    } else if (user?.role === 'admin') {
      loadData();
    }
  }, [user, authLoading, router]);

  const loadData = async () => {
    try {
      const [tournamentsSnapshot, bracketsSnapshot] = await Promise.all([
        getDocs(collection(db, 'tournaments')),
        getDocs(collection(db, 'brackets')),
      ]);

      const tournamentsData = tournamentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        endDate: doc.data().endDate?.toDate(),
        registrationDeadline: doc.data().registrationDeadline?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Tournament[];

      const bracketsData = bracketsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        rounds: doc.data().rounds?.map((round: BracketRound) => ({
          ...round,
          matches: round.matches?.map((match: BracketMatch) => ({
            ...match,
            scheduledTime: match.scheduledTime,
          })),
        })),
      })) as TournamentBracket[];

      // Load participants from all tournaments' registrations subcollections
      const allParticipants: Registration[] = [];
      for (const tournament of tournamentsData) {
        try {
          const participantsSnapshot = await getDocs(collection(db, 'tournaments', tournament.id, 'registrations'));
          const tournamentParticipants = participantsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            tournamentId: tournament.id, // Add tournamentId for reference
            registeredAt: doc.data().registeredAt?.toDate(),
            approvedAt: doc.data().approvedAt?.toDate(),
            paymentVerifiedAt: doc.data().paymentVerifiedAt?.toDate(),
          })) as Registration[];
          allParticipants.push(...tournamentParticipants);
        } catch (error) {
          console.error(`Error loading participants for tournament ${tournament.id}:`, error);
        }
      }

      setTournaments(tournamentsData);
      setBrackets(bracketsData);
      setParticipants(allParticipants);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateBracket = async (tournamentId: string, category: CategoryType) => {
    try {
      const tournament = tournaments.find(t => t.id === tournamentId);
      const categoryParticipants = participants.filter(p => 
        p.tournamentId === tournamentId && 
        p.selectedCategory === category &&
        p.registrationStatus === 'approved'
      );

      if (categoryParticipants.length < 2) {
        alert('Need at least 2 participants to generate bracket');
        return;
      }

      // Calculate number of rounds needed
      const numParticipants = categoryParticipants.length;
      const numRounds = Math.ceil(Math.log2(numParticipants));
      const bracketSize = Math.pow(2, numRounds);

      // Create rounds
      const rounds: BracketRound[] = [];
      const roundNames = ['Final', 'Semifinals', 'Quarterfinals', 'Round of 16', 'Round of 32', 'Round of 64'];
      
      for (let i = 0; i < numRounds; i++) {
        const roundNumber = i + 1;
        const roundName = roundNames[i] || `Round ${roundNumber}`;
        const matchesInRound = bracketSize / Math.pow(2, i + 1);
        
        const matches: BracketMatch[] = [];
        for (let j = 0; j < matchesInRound; j++) {
          matches.push({
            id: `match-${roundNumber}-${j + 1}`,
            matchNumber: j + 1,
            status: 'pending',
          });
        }
        
        rounds.push({
          roundNumber,
          roundName,
          matches,
          isCompleted: false,
        });
      }

      // Create bracket participants with seeding
      const bracketParticipants: BracketParticipant[] = categoryParticipants.map((participant, index) => ({
        id: participant.id,
        name: participant.name,
        seed: index + 1,
        isEliminated: false,
      }));

      // Add byes if needed
      while (bracketParticipants.length < bracketSize) {
        bracketParticipants.push({
          id: `bye-${bracketParticipants.length + 1}`,
          name: 'Bye',
          seed: bracketParticipants.length + 1,
          isEliminated: false,
        });
      }

      // Populate first round matches
      const firstRound = rounds[rounds.length - 1];
      for (let i = 0; i < firstRound.matches.length; i++) {
        const player1Index = i * 2;
        const player2Index = i * 2 + 1;
        
        firstRound.matches[i].player1Id = bracketParticipants[player1Index]?.id;
        firstRound.matches[i].player1Name = bracketParticipants[player1Index]?.name;
        firstRound.matches[i].player1Seed = bracketParticipants[player1Index]?.seed;
        
        firstRound.matches[i].player2Id = bracketParticipants[player2Index]?.id;
        firstRound.matches[i].player2Name = bracketParticipants[player2Index]?.name;
        firstRound.matches[i].player2Seed = bracketParticipants[player2Index]?.seed;
        
        // If one player is a bye, mark as ready
        if (bracketParticipants[player1Index]?.name === 'Bye' || bracketParticipants[player2Index]?.name === 'Bye') {
          firstRound.matches[i].status = 'ready';
          firstRound.matches[i].winnerId = bracketParticipants[player1Index]?.name === 'Bye' ? 
            bracketParticipants[player2Index]?.id : bracketParticipants[player1Index]?.id;
          firstRound.matches[i].winnerName = bracketParticipants[player1Index]?.name === 'Bye' ? 
            bracketParticipants[player2Index]?.name : bracketParticipants[player1Index]?.name;
        }
      }

      const bracketData: TournamentBracket = {
        id: '',
        tournamentId,
        category,
        rounds,
        participants: bracketParticipants,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await addDoc(collection(db, 'brackets'), bracketData);
      setShowCreateDialog(false);
      loadData();
    } catch (error) {
      console.error('Error generating bracket:', error);
      alert('Failed to generate bracket');
    }
  };

  const updateMatchResult = async (bracketId: string, roundIndex: number, matchIndex: number, winnerId: string) => {
    try {
      const bracket = brackets.find(b => b.id === bracketId);
      if (!bracket) return;

      const updatedBrackets = [...brackets];
      const bracketIndex = updatedBrackets.findIndex(b => b.id === bracketId);
      const updatedRounds = [...bracket.rounds];
      const updatedMatches = [...updatedRounds[roundIndex].matches];
      
      updatedMatches[matchIndex].winnerId = winnerId;
      updatedMatches[matchIndex].winnerName = winnerId === updatedMatches[matchIndex].player1Id ? 
        updatedMatches[matchIndex].player1Name : updatedMatches[matchIndex].player2Name;
      updatedMatches[matchIndex].status = 'completed';
      
      updatedRounds[roundIndex].matches = updatedMatches;
      updatedRounds[roundIndex].isCompleted = updatedMatches.every(match => match.status === 'completed');
      
      updatedBrackets[bracketIndex].rounds = updatedRounds;
      updatedBrackets[bracketIndex].status = updatedRounds.every(round => round.isCompleted) ? 'completed' : 'active';
      updatedBrackets[bracketIndex].updatedAt = new Date();

      // Advance winner to next round
      if (roundIndex > 0) {
        const nextRound = updatedRounds[roundIndex - 1];
        const nextMatchIndex = Math.floor(matchIndex / 2);
        const isPlayer1 = matchIndex % 2 === 0;
        
        if (isPlayer1) {
          nextRound.matches[nextMatchIndex].player1Id = winnerId;
          nextRound.matches[nextMatchIndex].player1Name = updatedMatches[matchIndex].winnerName;
        } else {
          nextRound.matches[nextMatchIndex].player2Id = winnerId;
          nextRound.matches[nextMatchIndex].player2Name = updatedMatches[matchIndex].winnerName;
        }
        
        nextRound.matches[nextMatchIndex].status = 'ready';
      }

      await updateDoc(doc(db, 'brackets', bracketId), {
        rounds: updatedRounds,
        status: updatedBrackets[bracketIndex].status,
        updatedAt: new Date(),
      });

      setBrackets(updatedBrackets);
    } catch (error) {
      console.error('Error updating match result:', error);
      alert('Failed to update match result');
    }
  };

  const getTournament = (tournamentId: string) => {
    return tournaments.find(t => t.id === tournamentId);
  };

  const getCategoryDisplayName = (category: CategoryType) => {
    const categoryMap: Record<CategoryType, string> = {
      'girls-under-13': 'Girls Under 13',
      'boys-under-13': 'Boys Under 13',
      'girls-under-18': 'Girls Under 18',
      'boys-under-18': 'Boys Under 18',
      'mens-single': 'Mens Single',
      'womens-single': 'Womens Single',
      'mens-doubles': 'Mens Doubles',
      'mixed-doubles': 'Mixed Doubles',
      'mens-team': 'Mens Team',
      'womens-team': 'Womens Team',
      'kids-team-u13': 'Kids Team (U13)',
      'kids-team-u18': 'Kids Team (U18)',
    };
    return categoryMap[category] || category;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredBrackets = selectedTournament 
    ? brackets.filter(bracket => bracket.tournamentId === selectedTournament)
    : brackets;

  if (authLoading || loading || !user || user.role !== 'admin') {
    return null;
  }

  return (
    <AdminLayout moduleName="Tournament Brackets">
      <div className="p-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <Trophy className="h-8 w-8 text-yellow-500" />
              Tournament Brackets
            </h1>
            <p className="text-gray-600">Manage tournament brackets and match results</p>
          </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Generate Bracket
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Generate Tournament Bracket</DialogTitle>
                  <DialogDescription>
                    Select a tournament and category to generate a bracket
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="tournament">Tournament</Label>
                    <Select onValueChange={setSelectedTournament}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select tournament" />
                      </SelectTrigger>
                      <SelectContent>
                        {tournaments.map(tournament => (
                          <SelectItem key={tournament.id} value={tournament.id}>
                            {tournament.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedTournament && (
                    <div>
                      <Label htmlFor="category">Category</Label>
                      <Select onValueChange={(category: CategoryType) => {
                        generateBracket(selectedTournament, category);
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {getTournament(selectedTournament)?.categories?.map(category => (
                            <SelectItem key={category} value={category}>
                              {getCategoryDisplayName(category)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex gap-4 items-center">
                <div className="flex-1">
                  <Label htmlFor="tournament-filter">Filter by Tournament</Label>
                  <Select value={selectedTournament} onValueChange={setSelectedTournament}>
                    <SelectTrigger>
                      <SelectValue placeholder="All tournaments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Tournaments</SelectItem>
                      {tournaments.map(tournament => (
                        <SelectItem key={tournament.id} value={tournament.id}>
                          {tournament.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-sm text-gray-500">
                  {filteredBrackets.length} brackets found
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Brackets Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBrackets.map((bracket) => {
              const tournament = getTournament(bracket.tournamentId);
              const totalMatches = bracket.rounds.reduce((sum, round) => sum + round.matches.length, 0);
              const completedMatches = bracket.rounds.reduce((sum, round) => 
                sum + round.matches.filter(match => match.status === 'completed').length, 0);

              return (
                <Card key={bracket.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{tournament?.name}</CardTitle>
                        <p className="text-sm text-gray-600 mt-1">
                          {getCategoryDisplayName(bracket.category)}
                        </p>
                      </div>
                      <Badge className={getStatusColor(bracket.status)}>
                        {bracket.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-gray-600">Participants</div>
                          <div className="font-semibold">{bracket.participants.length}</div>
                        </div>
                        <div>
                          <div className="text-gray-600">Matches</div>
                          <div className="font-semibold">{completedMatches}/{totalMatches}</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm text-gray-600">Rounds</div>
                        <div className="space-y-1">
                          {bracket.rounds.map((round, index) => (
                            <div key={index} className="flex justify-between items-center text-sm">
                              <span>{round.roundName}</span>
                              <Badge variant="outline" className={round.isCompleted ? 'bg-green-50 text-green-700' : ''}>
                                {round.matches.filter(m => m.status === 'completed').length}/{round.matches.length}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedBracket(bracket);
                            setShowBracketDialog(true);
                          }}
                          className="flex-1"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View Bracket
                        </Button>
                        {bracket.status === 'active' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/admin/brackets/${bracket.id}`)}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* No Brackets */}
          {filteredBrackets.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Trophy className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">No Brackets Found</h3>
                <p className="text-gray-600">
                  {selectedTournament 
                    ? 'No brackets have been generated for this tournament yet.' 
                    : 'No tournament brackets have been generated yet.'}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Bracket Detail Dialog */}
          <Dialog open={showBracketDialog} onOpenChange={setShowBracketDialog}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {selectedBracket && getTournament(selectedBracket.tournamentId)?.name} - {selectedBracket && getCategoryDisplayName(selectedBracket.category)}
                </DialogTitle>
                <DialogDescription>
                  Tournament bracket with match results
                </DialogDescription>
              </DialogHeader>
              {selectedBracket && (
                <div className="space-y-6">
                  {selectedBracket.rounds.map((round, roundIndex) => (
                    <div key={roundIndex} className="border rounded-lg p-4">
                      <h3 className="text-lg font-semibold mb-4">{round.roundName}</h3>
                      <div className="grid gap-4">
                        {round.matches.map((match, matchIndex) => (
                          <div key={matchIndex} className="border rounded-lg p-4 bg-gray-50">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium">Match {match.matchNumber}</span>
                              <Badge className={match.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                                {match.status}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className={`p-3 rounded ${match.winnerId === match.player1Id ? 'bg-green-100 border-green-300' : 'bg-white'}`}>
                                <div className="font-medium">{match.player1Name || 'TBD'}</div>
                                {match.player1Seed && (
                                  <div className="text-sm text-gray-500">Seed #{match.player1Seed}</div>
                                )}
                              </div>
                              <div className={`p-3 rounded ${match.winnerId === match.player2Id ? 'bg-green-100 border-green-300' : 'bg-white'}`}>
                                <div className="font-medium">{match.player2Name || 'TBD'}</div>
                                {match.player2Seed && (
                                  <div className="text-sm text-gray-500">Seed #{match.player2Seed}</div>
                                )}
                              </div>
                            </div>
                            {match.status === 'ready' && match.winnerId && (
                              <div className="mt-2 text-center">
                                <Button
                                  size="sm"
                                  onClick={() => updateMatchResult(selectedBracket.id, roundIndex, matchIndex, match.winnerId!)}
                                >
                                  Confirm Winner: {match.winnerName}
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DialogContent>
          </Dialog>
      </div>
    </AdminLayout>
  );
}
