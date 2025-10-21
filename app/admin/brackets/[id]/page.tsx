'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Tournament, TournamentBracket, BracketRound, BracketMatch, CategoryType } from '@/types';
import { Trophy, Users, Play, Target, Crown, Award, ArrowLeft, CheckCircle } from 'lucide-react';

export default function BracketDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const bracketId = params.id as string;
  
  const [bracket, setBracket] = useState<TournamentBracket | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<{roundIndex: number, matchIndex: number, match: BracketMatch} | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/login');
    } else if (user?.role === 'admin' && bracketId) {
      loadBracket();
      setupBracketListener();
    }
  }, [user, authLoading, router, bracketId]);

  const loadBracket = async () => {
    try {
      const bracketDoc = await getDoc(doc(db, 'brackets', bracketId));
      if (bracketDoc.exists()) {
        const bracketData = {
          id: bracketDoc.id,
          ...bracketDoc.data(),
          createdAt: bracketDoc.data().createdAt?.toDate(),
          updatedAt: bracketDoc.data().updatedAt?.toDate(),
          rounds: bracketDoc.data().rounds?.map((round: BracketRound) => ({
            ...round,
            matches: round.matches?.map((match: BracketMatch) => ({
              ...match,
              scheduledTime: match.scheduledTime,
            })),
          })),
        } as TournamentBracket;
        setBracket(bracketData);

        // Load tournament data
        const tournamentDoc = await getDoc(doc(db, 'tournaments', bracketData.tournamentId));
        if (tournamentDoc.exists()) {
          const tournamentData = {
            id: tournamentDoc.id,
            ...tournamentDoc.data(),
            startDate: tournamentDoc.data().startDate?.toDate(),
            endDate: tournamentDoc.data().endDate?.toDate(),
            registrationDeadline: tournamentDoc.data().registrationDeadline?.toDate(),
            createdAt: tournamentDoc.data().createdAt?.toDate(),
            updatedAt: tournamentDoc.data().updatedAt?.toDate(),
          } as Tournament;
          setTournament(tournamentData);
        }
      }
    } catch (error) {
      console.error('Error loading bracket:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupBracketListener = () => {
    const bracketRef = doc(db, 'brackets', bracketId);
    return onSnapshot(bracketRef, (doc) => {
      if (doc.exists()) {
        const bracketData = {
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
        } as TournamentBracket;
        setBracket(bracketData);
      }
    });
  };

  const updateMatchResult = async (roundIndex: number, matchIndex: number, winnerId: string) => {
    if (!bracket) return;

    try {
      const updatedRounds = [...bracket.rounds];
      const updatedMatches = [...updatedRounds[roundIndex].matches];
      
      updatedMatches[matchIndex].winnerId = winnerId;
      updatedMatches[matchIndex].winnerName = winnerId === updatedMatches[matchIndex].player1Id ? 
        updatedMatches[matchIndex].player1Name : updatedMatches[matchIndex].player2Name;
      updatedMatches[matchIndex].status = 'completed';
      
      updatedRounds[roundIndex].matches = updatedMatches;
      updatedRounds[roundIndex].isCompleted = updatedMatches.every(match => match.status === 'completed');
      
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

      const isCompleted = updatedRounds.every(round => round.isCompleted);

      await updateDoc(doc(db, 'brackets', bracketId), {
        rounds: updatedRounds,
        status: isCompleted ? 'completed' : 'active',
        updatedAt: new Date(),
      });

      setSelectedMatch(null);
    } catch (error) {
      console.error('Error updating match result:', error);
      alert('Failed to update match result');
    }
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
      'open-team': 'Open Team',
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

  if (authLoading || loading || !user || user.role !== 'admin') {
    return null;
  }

  if (!bracket || !tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Bracket Not Found</h1>
          <Button onClick={() => router.push('/admin/brackets')}>
            Back to Brackets
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout moduleName="Bracket Details">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            onClick={() => router.push('/admin/brackets')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Brackets
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Trophy className="h-8 w-8 text-yellow-500" />
              {tournament.name}
            </h1>
            <p className="text-gray-600 mt-1">
              {getCategoryDisplayName(bracket.category)} • {bracket.participants.length} participants
            </p>
          </div>
          <div className="ml-auto">
            <Badge className={getStatusColor(bracket.status)}>
              {bracket.status}
            </Badge>
          </div>
        </div>

          {/* Bracket Visualization */}
          <div className="space-y-8">
            {bracket.rounds.map((round, roundIndex) => (
              <Card key={roundIndex}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {round.isCompleted && <CheckCircle className="h-5 w-5 text-green-500" />}
                    {round.roundName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    {round.matches.map((match, matchIndex) => (
                      <div 
                        key={matchIndex} 
                        className={`border rounded-lg p-4 transition-colors ${
                          match.status === 'completed' ? 'bg-green-50 border-green-200' : 
                          match.status === 'live' ? 'bg-red-50 border-red-200' : 
                          match.status === 'ready' ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-3">
                          <span className="font-medium">Match {match.matchNumber}</span>
                          <div className="flex items-center gap-2">
                            {match.status === 'completed' && <Crown className="h-4 w-4 text-yellow-500" />}
                            <Badge className={
                              match.status === 'completed' ? 'bg-green-100 text-green-800' :
                              match.status === 'live' ? 'bg-red-100 text-red-800' :
                              match.status === 'ready' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }>
                              {match.status}
                            </Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          {/* Player 1 */}
                          <div 
                            className={`p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                              match.winnerId === match.player1Id ? 
                                'bg-green-100 border-green-300' : 
                                match.status === 'ready' ? 'bg-blue-100 border-blue-300 hover:bg-blue-200' :
                                'bg-white border-gray-200 hover:bg-gray-50'
                            }`}
                            onClick={() => {
                              if (match.status === 'ready' && match.player1Id && match.player1Name !== 'Bye') {
                                setSelectedMatch({ roundIndex, matchIndex, match });
                              }
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">{match.player1Name || 'TBD'}</div>
                                {match.player1Seed && (
                                  <div className="text-sm text-gray-500">Seed #{match.player1Seed}</div>
                                )}
                              </div>
                              {match.winnerId === match.player1Id && (
                                <Crown className="h-5 w-5 text-yellow-500" />
                              )}
                            </div>
                          </div>

                          {/* Player 2 */}
                          <div 
                            className={`p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                              match.winnerId === match.player2Id ? 
                                'bg-green-100 border-green-300' : 
                                match.status === 'ready' ? 'bg-blue-100 border-blue-300 hover:bg-blue-200' :
                                'bg-white border-gray-200 hover:bg-gray-50'
                            }`}
                            onClick={() => {
                              if (match.status === 'ready' && match.player2Id && match.player2Name !== 'Bye') {
                                setSelectedMatch({ roundIndex, matchIndex, match });
                              }
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">{match.player2Name || 'TBD'}</div>
                                {match.player2Seed && (
                                  <div className="text-sm text-gray-500">Seed #{match.player2Seed}</div>
                                )}
                              </div>
                              {match.winnerId === match.player2Id && (
                                <Crown className="h-5 w-5 text-yellow-500" />
                              )}
                            </div>
                          </div>
                        </div>

                        {match.status === 'ready' && (
                          <div className="mt-3 text-center">
                            <p className="text-sm text-blue-600">
                              Click on a player to select winner
                            </p>
                          </div>
                        )}

                        {match.status === 'completed' && match.winnerName && (
                          <div className="mt-3 text-center">
                            <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                              <Crown className="h-4 w-4" />
                              Winner: {match.winnerName}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Winner Announcement */}
          {bracket.status === 'completed' && (
            <Card className="mt-8 border-green-200 bg-green-50">
              <CardContent className="p-6">
                <div className="text-center">
                  <Crown className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-green-800 mb-2">Tournament Complete!</h2>
                  <p className="text-green-700">
                    {getCategoryDisplayName(bracket.category)} champion has been determined.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Match Result Dialog */}
          <Dialog open={!!selectedMatch} onOpenChange={() => setSelectedMatch(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Select Match Winner</DialogTitle>
                <DialogDescription>
                  Choose the winner for Match {selectedMatch?.match.matchNumber}
                </DialogDescription>
              </DialogHeader>
              {selectedMatch && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      onClick={() => updateMatchResult(
                        selectedMatch.roundIndex, 
                        selectedMatch.matchIndex, 
                        selectedMatch.match.player1Id!
                      )}
                      className="h-20 flex flex-col items-center justify-center"
                    >
                      <div className="font-medium">{selectedMatch.match.player1Name}</div>
                      {selectedMatch.match.player1Seed && (
                        <div className="text-sm opacity-75">Seed #{selectedMatch.match.player1Seed}</div>
                      )}
                    </Button>
                    <Button
                      onClick={() => updateMatchResult(
                        selectedMatch.roundIndex, 
                        selectedMatch.matchIndex, 
                        selectedMatch.match.player2Id!
                      )}
                      className="h-20 flex flex-col items-center justify-center"
                    >
                      <div className="font-medium">{selectedMatch.match.player2Name}</div>
                      {selectedMatch.match.player2Seed && (
                        <div className="text-sm opacity-75">Seed #{selectedMatch.match.player2Seed}</div>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
      </div>
    </AdminLayout>
  );
}
