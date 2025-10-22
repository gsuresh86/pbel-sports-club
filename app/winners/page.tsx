'use client';

import { useState, useEffect } from 'react';
import { PublicLayout } from '@/components/PublicLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Winner, Tournament } from '@/types';

export default function WinnersPage() {
  const [winners, setWinners] = useState<Winner[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [winnersSnapshot, tournamentsSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'winners'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'tournaments')),
      ]);

      const winnersData = winnersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as Winner[];

      const tournamentsData = tournamentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        endDate: doc.data().endDate?.toDate(),
        registrationDeadline: doc.data().registrationDeadline?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Tournament[];

      setWinners(winnersData);
      setTournaments(tournamentsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTournament = (tournamentId: string) => {
    return tournaments.find(t => t.id === tournamentId);
  };

  const getPositionBadge = (position: number) => {
    switch (position) {
      case 1:
        return <Badge className="bg-yellow-500">🥇 Champion</Badge>;
      case 2:
        return <Badge className="bg-gray-400">🥈 Runner-up</Badge>;
      case 3:
        return <Badge className="bg-orange-600">🥉 Third Place</Badge>;
      default:
        return <Badge>{position}</Badge>;
    }
  };

  const groupedWinners = winners.reduce((acc, winner) => {
    const tournamentId = winner.tournamentId;
    if (!acc[tournamentId]) {
      acc[tournamentId] = [];
    }
    acc[tournamentId].push(winner);
    return acc;
  }, {} as Record<string, Winner[]>);

  const filteredTournamentIds = selectedSport === 'all'
    ? Object.keys(groupedWinners)
    : Object.keys(groupedWinners).filter(id => getTournament(id)?.sport === selectedSport);

  if (loading) {
    return (
      <PublicLayout>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-lg">Loading winners...</p>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="bg-yellow-50/90 backdrop-blur-sm py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-4">🏆 Hall of Champions</h1>
            <p className="text-xl text-gray-600">
              Celebrating excellence in sports
            </p>
          </div>

          <Tabs defaultValue="all" className="mb-8" onValueChange={setSelectedSport}>
            <TabsList>
              <TabsTrigger value="all">All Sports</TabsTrigger>
              <TabsTrigger value="badminton">Badminton</TabsTrigger>
              <TabsTrigger value="table-tennis">Table Tennis</TabsTrigger>
              <TabsTrigger value="volleyball">Volleyball</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-8">
            {filteredTournamentIds.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-gray-500">No winners announced yet.</p>
                </CardContent>
              </Card>
            ) : (
              filteredTournamentIds.map((tournamentId) => {
                const tournament = getTournament(tournamentId);
                const tournamentWinners = groupedWinners[tournamentId].sort(
                  (a, b) => a.position - b.position
                );

                return (
                  <Card key={tournamentId} className="overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                      <CardTitle className="text-2xl">
                        {tournament?.name || 'Tournament'}
                      </CardTitle>
                      <p className="text-blue-100">
                        {tournament?.sport} • {tournament?.endDate && new Date(tournament.endDate).getFullYear()}
                      </p>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="grid md:grid-cols-3 gap-6">
                        {tournamentWinners.map((winner) => (
                          <div
                            key={winner.id}
                            className={`text-center p-6 rounded-lg ${
                              winner.position === 1
                                ? 'bg-yellow-50 border-2 border-yellow-400'
                                : winner.position === 2
                                ? 'bg-gray-50 border-2 border-gray-400'
                                : 'bg-orange-50 border-2 border-orange-400'
                            }`}
                          >
                            <div className="mb-4">{getPositionBadge(winner.position)}</div>
                            <h3 className="text-2xl font-bold mb-2">
                              {winner.participantName}
                            </h3>
                            {winner.prize && (
                              <p className="text-gray-600">Prize: {winner.prize}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
