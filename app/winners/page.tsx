'use client';

import { useState, useEffect } from 'react';
import { PublicLayout } from '@/components/PublicLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Winner, Tournament } from '@/types';
import { Reveal } from '@/components/public/Reveal';

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

      const winnersData = winnersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as Winner[];

      const tournamentsData = tournamentsSnapshot.docs.map((doc) => ({
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

  const getTournament = (tournamentId: string) => tournaments.find((t) => t.id === tournamentId);

  const getPositionBadge = (position: number) => {
    switch (position) {
      case 1:
        return <Badge className="bg-yellow-500 text-slate-950">Champion</Badge>;
      case 2:
        return <Badge className="bg-slate-400 text-white">Runner-up</Badge>;
      case 3:
        return <Badge className="bg-orange-600 text-white">Third Place</Badge>;
      default:
        return <Badge>{position}</Badge>;
    }
  };

  const groupedWinners = winners.reduce(
    (acc, winner) => {
      const tournamentId = winner.tournamentId;
      if (!acc[tournamentId]) acc[tournamentId] = [];
      acc[tournamentId].push(winner);
      return acc;
    },
    {} as Record<string, Winner[]>,
  );

  const filteredTournamentIds =
    selectedSport === 'all'
      ? Object.keys(groupedWinners)
      : Object.keys(groupedWinners).filter(
          (id) => getTournament(id)?.sport === selectedSport,
        );

  if (loading) {
    return (
      <PublicLayout>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-lg text-muted-foreground">Loading winners...</p>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <Reveal className="text-center mb-12">
            <p className="text-xs text-amber-600 dark:text-amber-400 font-bold uppercase tracking-widest mb-2">
              Results
            </p>
            <h1 className="text-5xl font-bold text-foreground mb-4">Hall of Champions</h1>
            <p className="text-xl text-muted-foreground">Celebrating excellence in sports</p>
          </Reveal>

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
                  <p className="text-muted-foreground">No winners announced yet.</p>
                </CardContent>
              </Card>
            ) : (
              filteredTournamentIds.map((tournamentId, i) => {
                const tournament = getTournament(tournamentId);
                const tournamentWinners = groupedWinners[tournamentId].sort(
                  (a, b) => a.position - b.position,
                );

                return (
                  <Reveal key={tournamentId} delay={Math.min(i * 60, 240)}>
                    <Card className="overflow-hidden border-border">
                      <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white dark:from-slate-800 dark:to-slate-950">
                        <CardTitle className="text-2xl">
                          {tournament?.name || 'Tournament'}
                        </CardTitle>
                        <p className="text-slate-300">
                          {tournament?.sport} •{' '}
                          {tournament?.endDate &&
                            new Date(tournament.endDate).getFullYear()}
                        </p>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <div className="grid md:grid-cols-3 gap-6">
                          {tournamentWinners.map((winner) => (
                            <div
                              key={winner.id}
                              className={`text-center p-6 rounded-lg border-2 ${
                                winner.position === 1
                                  ? 'bg-amber-500/10 border-amber-500'
                                  : winner.position === 2
                                    ? 'bg-muted border-border'
                                    : 'bg-orange-500/10 border-orange-500/60'
                              }`}
                            >
                              <div className="mb-4">{getPositionBadge(winner.position)}</div>
                              <h3 className="text-2xl font-bold text-foreground mb-2">
                                {winner.participantName}
                              </h3>
                              {winner.prize && (
                                <p className="text-muted-foreground">Prize: {winner.prize}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </Reveal>
                );
              })
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
