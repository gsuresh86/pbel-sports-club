'use client';

import { useState, useEffect } from 'react';
import { PublicLayout } from '@/components/PublicLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { allMatchesOrderedQuery } from '@/lib/firestore-paths';
import { Match, Tournament } from '@/types';
import { Reveal } from '@/components/public/Reveal';

export default function SchedulesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [matchesSnapshot, tournamentsSnapshot] = await Promise.all([
        getDocs(allMatchesOrderedQuery()),
        getDocs(collection(db, 'tournaments')),
      ]);

      const matchesData = (
        matchesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          scheduledTime: doc.data().scheduledTime?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        })) as Match[]
      ).filter((m) => m.status !== 'not-scheduled');

      const tournamentsData = tournamentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        endDate: doc.data().endDate?.toDate(),
        registrationDeadline: doc.data().registrationDeadline?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Tournament[];

      setMatches(matchesData);
      setTournaments(tournamentsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live':
        return 'bg-red-500';
      case 'completed':
        return 'bg-green-500';
      case 'scheduled':
        return 'bg-sky-500';
      case 'cancelled':
        return 'bg-muted-foreground';
      default:
        return 'bg-muted-foreground';
    }
  };

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  const formatTime = (date: Date) =>
    new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

  const getTournamentName = (tournamentId: string) =>
    tournaments.find((t) => t.id === tournamentId)?.name || 'Unknown Tournament';

  const getTournamentSport = (tournamentId: string) =>
    tournaments.find((t) => t.id === tournamentId)?.sport || '';

  const filteredMatches =
    selectedSport === 'all'
      ? matches
      : matches.filter((m) => getTournamentSport(m.tournamentId) === selectedSport);

  if (loading) {
    return (
      <PublicLayout>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-lg text-muted-foreground">Loading schedules...</p>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <Reveal className="mb-8">
            <p className="text-xs text-amber-600 dark:text-amber-400 font-bold uppercase tracking-widest mb-2">
              Fixtures
            </p>
            <h1 className="text-4xl font-bold text-foreground mb-2">Match Schedules</h1>
            <p className="text-muted-foreground">
              Upcoming and completed matches across TourneyCraft events.
            </p>
          </Reveal>

          <Tabs defaultValue="all" className="mb-8" onValueChange={setSelectedSport}>
            <TabsList>
              <TabsTrigger value="all">All Sports</TabsTrigger>
              <TabsTrigger value="badminton">Badminton</TabsTrigger>
              <TabsTrigger value="table-tennis">Table Tennis</TabsTrigger>
              <TabsTrigger value="volleyball">Volleyball</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-6">
            {filteredMatches.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No matches scheduled yet.</p>
                </CardContent>
              </Card>
            ) : (
              filteredMatches.map((match, i) => (
                <Reveal key={match.id} delay={Math.min(i * 40, 240)}>
                  <Card className="hover:shadow-lg transition-shadow border-border">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-xl mb-2">
                            {getTournamentName(match.tournamentId)}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {match.round} - Match #{match.matchNumber}
                          </p>
                        </div>
                        <Badge className={getStatusColor(match.status)}>{match.status}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-3 gap-6">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Players</p>
                          <p className="font-semibold text-foreground">{match.player1Name}</p>
                          <p className="text-muted-foreground my-1">vs</p>
                          <p className="font-semibold text-foreground">{match.player2Name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Date & Time</p>
                          <p className="font-medium text-foreground">
                            {formatDate(match.scheduledTime)}
                          </p>
                          <p className="text-muted-foreground">
                            {formatTime(match.scheduledTime)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Venue</p>
                          <p className="font-medium text-foreground">{match.venue}</p>
                          {match.status === 'completed' && match.winner && (
                            <p className="text-green-600 dark:text-green-400 mt-2 font-semibold">
                              Winner: {match.winner}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Reveal>
              ))
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
