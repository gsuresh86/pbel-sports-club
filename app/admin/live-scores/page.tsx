'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { collection, getDocs, query, where, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Match, Tournament } from '@/types';

export default function UpdateLiveScoresPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [liveMatches, setLiveMatches] = useState<Match[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/login');
    } else if (user?.role === 'admin') {
      loadData();
    }
  }, [user, authLoading, router]);

  const loadData = async () => {
    try {
      const [matchesSnapshot, tournamentsSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'matches'), where('status', '==', 'live'))),
        getDocs(collection(db, 'tournaments')),
      ]);

      const matchesData = matchesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        scheduledTime: doc.data().scheduledTime?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Match[];

      const tournamentsData = tournamentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        endDate: doc.data().endDate?.toDate(),
        registrationDeadline: doc.data().registrationDeadline?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Tournament[];

      setLiveMatches(matchesData);
      setTournaments(tournamentsData);

      // Initialize scores state
      const initialScores: Record<string, any> = {};
      matchesData.forEach(match => {
        initialScores[match.id] = {
          currentSet: 1,
          player1Sets: 0,
          player2Sets: 0,
          player1CurrentScore: 0,
          player2CurrentScore: 0,
        };
      });
      setScores(initialScores);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScoreUpdate = async (matchId: string) => {
    try {
      const scoreData = {
        ...scores[matchId],
        matchId,
        lastUpdated: new Date(),
      };

      await setDoc(doc(db, 'liveScores', matchId), scoreData);
      alert('Score updated successfully!');
    } catch (error) {
      console.error('Error updating score:', error);
      alert('Failed to update score');
    }
  };

  const handleMatchComplete = async (matchId: string) => {
    if (confirm('Mark this match as completed?')) {
      try {
        const score = scores[matchId];
        const match = liveMatches.find(m => m.id === matchId);

        await updateDoc(doc(db, 'matches', matchId), {
          status: 'completed',
          player1Score: score.player1Sets,
          player2Score: score.player2Sets,
          winner: score.player1Sets > score.player2Sets ? match?.player1 : match?.player2,
          updatedAt: new Date(),
        });

        loadData();
      } catch (error) {
        console.error('Error completing match:', error);
        alert('Failed to complete match');
      }
    }
  };

  const getTournament = (tournamentId: string) => {
    return tournaments.find(t => t.id === tournamentId);
  };

  if (authLoading || loading || !user || user.role !== 'admin') {
    return null;
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">Update Live Scores</h1>

          <div className="space-y-6">
            {liveMatches.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-gray-500">No live matches at the moment.</p>
                </CardContent>
              </Card>
            ) : (
              liveMatches.map((match) => {
                const tournament = getTournament(match.tournamentId);
                const score = scores[match.id] || {};

                return (
                  <Card key={match.id}>
                    <CardHeader>
                      <CardTitle>
                        {tournament?.name} - {match.round} (Match #{match.matchNumber})
                      </CardTitle>
                      <p className="text-sm text-gray-500">{match.venue}</p>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold">{match.player1}</h3>
                          <div className="space-y-2">
                            <Label>Sets Won</Label>
                            <Input
                              type="number"
                              min="0"
                              value={score.player1Sets || 0}
                              onChange={(e) => setScores({
                                ...scores,
                                [match.id]: {
                                  ...score,
                                  player1Sets: parseInt(e.target.value) || 0,
                                },
                              })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Current Set Score</Label>
                            <Input
                              type="number"
                              min="0"
                              value={score.player1CurrentScore || 0}
                              onChange={(e) => setScores({
                                ...scores,
                                [match.id]: {
                                  ...score,
                                  player1CurrentScore: parseInt(e.target.value) || 0,
                                },
                              })}
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold">{match.player2}</h3>
                          <div className="space-y-2">
                            <Label>Sets Won</Label>
                            <Input
                              type="number"
                              min="0"
                              value={score.player2Sets || 0}
                              onChange={(e) => setScores({
                                ...scores,
                                [match.id]: {
                                  ...score,
                                  player2Sets: parseInt(e.target.value) || 0,
                                },
                              })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Current Set Score</Label>
                            <Input
                              type="number"
                              min="0"
                              value={score.player2CurrentScore || 0}
                              onChange={(e) => setScores({
                                ...scores,
                                [match.id]: {
                                  ...score,
                                  player2CurrentScore: parseInt(e.target.value) || 0,
                                },
                              })}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Current Set Number</Label>
                        <Input
                          type="number"
                          min="1"
                          value={score.currentSet || 1}
                          onChange={(e) => setScores({
                            ...scores,
                            [match.id]: {
                              ...score,
                              currentSet: parseInt(e.target.value) || 1,
                            },
                          })}
                        />
                      </div>

                      <div className="flex gap-4">
                        <Button onClick={() => handleScoreUpdate(match.id)} className="flex-1">
                          Update Score
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleMatchComplete(match.id)}
                          className="flex-1"
                        >
                          Complete Match
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </main>
    </>
  );
}
