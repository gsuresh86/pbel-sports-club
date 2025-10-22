'use client';

import { useState, useEffect } from 'react';
import { PublicLayout } from '@/components/PublicLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Match, Tournament } from '@/types';

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
        getDocs(query(collection(db, 'matches'), orderBy('scheduledTime', 'asc'))),
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
        return 'bg-blue-500';
      case 'cancelled':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTournamentName = (tournamentId: string) => {
    return tournaments.find(t => t.id === tournamentId)?.name || 'Unknown Tournament';
  };

  const getTournamentSport = (tournamentId: string) => {
    return tournaments.find(t => t.id === tournamentId)?.sport || '';
  };

  const filteredMatches = selectedSport === 'all'
    ? matches
    : matches.filter(m => getTournamentSport(m.tournamentId) === selectedSport);

  if (loading) {
    return (
      <PublicLayout>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-lg">Loading schedules...</p>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className=" backdrop-blur-sm py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">Match Schedules</h1>

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
                  <p className="text-gray-500">No matches scheduled yet.</p>
                </CardContent>
              </Card>
            ) : (
              filteredMatches.map((match) => (
                <Card key={match.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-xl mb-2">
                          {getTournamentName(match.tournamentId)}
                        </CardTitle>
                        <p className="text-sm text-gray-500">
                          {match.round} - Match #{match.matchNumber}
                        </p>
                      </div>
                      <Badge className={getStatusColor(match.status)}>
                        {match.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-3 gap-6">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Players</p>
                        <p className="font-semibold">{match.player1Name}</p>
                        <p className="text-gray-400 my-1">vs</p>
                        <p className="font-semibold">{match.player2Name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Date & Time</p>
                        <p className="font-medium">{formatDate(match.scheduledTime)}</p>
                        <p className="text-gray-600">{formatTime(match.scheduledTime)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Venue</p>
                        <p className="font-medium">{match.venue}</p>
                        {match.status === 'completed' && match.winner && (
                          <p className="text-green-600 mt-2 font-semibold">
                            Winner: {match.winner}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
