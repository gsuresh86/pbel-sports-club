'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc, onSnapshot, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tournament, TournamentBracket, BracketRound, BracketMatch, CategoryType } from '@/types';
import { Trophy, Crown, Target, ArrowLeft, CheckCircle, Users } from 'lucide-react';
import Link from 'next/link';

export default function PublicBracketPage() {
  const params = useParams();
  const tournamentId = params.id as string;
  const category = params.category as CategoryType;
  
  const [bracket, setBracket] = useState<TournamentBracket | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tournamentId && category) {
      loadBracket();
      setupBracketListener();
    }
  }, [tournamentId, category]);

  const loadBracket = async () => {
    try {
      // Find bracket for this tournament and category
      const bracketsSnapshot = await getDocs(collection(db, 'brackets'));
      const bracketDoc = bracketsSnapshot.docs.find(doc => {
        const data = doc.data();
        return data.tournamentId === tournamentId && data.category === category;
      });

      if (bracketDoc) {
        const bracketData = {
          id: bracketDoc.id,
          ...bracketDoc.data(),
          createdAt: bracketDoc.data().createdAt?.toDate(),
          updatedAt: bracketDoc.data().updatedAt?.toDate(),
          rounds: bracketDoc.data().rounds?.map((round: any) => ({
            ...round,
            matches: round.matches?.map((match: any) => ({
              ...match,
              scheduledTime: match.scheduledTime?.toDate(),
            })),
          })),
        } as TournamentBracket;
        setBracket(bracketData);
      }

      // Load tournament data
      const tournamentDoc = await getDoc(doc(db, 'tournaments', tournamentId));
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
    } catch (error) {
      console.error('Error loading bracket:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupBracketListener = () => {
    // Listen for bracket updates
    const bracketsRef = collection(db, 'brackets');
    return onSnapshot(bracketsRef, (snapshot) => {
      const bracketDoc = snapshot.docs.find(doc => {
        const data = doc.data();
        return data.tournamentId === tournamentId && data.category === category;
      });

      if (bracketDoc) {
        const bracketData = {
          id: bracketDoc.id,
          ...bracketDoc.data(),
          createdAt: bracketDoc.data().createdAt?.toDate(),
          updatedAt: bracketDoc.data().updatedAt?.toDate(),
          rounds: bracketDoc.data().rounds?.map((round: any) => ({
            ...round,
            matches: round.matches?.map((match: any) => ({
              ...match,
              scheduledTime: match.scheduledTime?.toDate(),
            })),
          })),
        } as TournamentBracket;
        setBracket(bracketData);
      }
    });
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

  const getSportIcon = (sport: string) => {
    switch (sport) {
      case 'badminton': return '🏸';
      case 'table-tennis': return '🏓';
      case 'volleyball': return '🏐';
      default: return '🏆';
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
          <p className="mt-4 text-gray-600">Loading bracket...</p>
        </div>
      </div>
    );
  }

  if (!bracket || !tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Bracket Not Found</h1>
          <Link href={`/tournament/${tournamentId}`}>
            <Button>Back to Tournament</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sport Banner */}
      <div className="relative h-64 w-full overflow-hidden">
        <img
          src={getSportBanner(tournament.sport)}
          alt={`${tournament.sport} tournament`}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="text-center text-white">
            <h1 className="text-4xl font-bold mb-2">{tournament.name}</h1>
            <p className="text-xl">{getCategoryDisplayName(category)} Bracket</p>
          </div>
        </div>
        <div className="absolute top-4 left-4">
          <Link href={`/tournament/${tournamentId}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Tournament
            </Button>
          </Link>
        </div>
        <div className="absolute top-4 right-4">
          <Badge className={getStatusColor(bracket.status)}>
            {bracket.status}
          </Badge>
        </div>
      </div>

      <div className="py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Tournament Info */}
          <Card className="mb-8">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">{getSportIcon(tournament.sport)}</span>
                    {getCategoryDisplayName(category)} Bracket
                  </CardTitle>
                  <p className="text-gray-600 mt-2">
                    {bracket.participants.length} participants • {bracket.rounds.length} rounds
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500 mb-1">Tournament Status</div>
                  <Badge className={getStatusColor(bracket.status)}>
                    {bracket.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
          </Card>

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
                            {match.status === 'live' && <Target className="h-4 w-4 text-red-500 animate-pulse" />}
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
                            className={`p-3 rounded-lg border-2 transition-colors ${
                              match.winnerId === match.player1Id ? 
                                'bg-green-100 border-green-300' : 
                                'bg-white border-gray-200'
                            }`}
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
                            className={`p-3 rounded-lg border-2 transition-colors ${
                              match.winnerId === match.player2Id ? 
                                'bg-green-100 border-green-300' : 
                                'bg-white border-gray-200'
                            }`}
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

                        {match.status === 'completed' && match.winnerName && (
                          <div className="mt-3 text-center">
                            <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                              <Crown className="h-4 w-4" />
                              Winner: {match.winnerName}
                            </div>
                          </div>
                        )}

                        {match.status === 'live' && (
                          <div className="mt-3 text-center">
                            <div className="inline-flex items-center gap-2 bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm animate-pulse">
                              <Target className="h-4 w-4" />
                              Match in Progress
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
                    {getCategoryDisplayName(category)} champion has been determined.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Participants List */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Participants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bracket.participants
                  .filter(p => p.name !== 'Bye')
                  .map((participant, index) => (
                    <div key={participant.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-medium">
                        {participant.seed}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{participant.name}</div>
                        <div className="text-sm text-gray-500">
                          {participant.isEliminated ? 'Eliminated' : 'Active'}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
