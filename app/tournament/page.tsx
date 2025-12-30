'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PublicLayout } from '@/components/PublicLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tournament, Match, Registration } from '@/types';
import { Search, Calendar, MapPin, Users, Trophy, Clock, Target, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournamentStats, setTournamentStats] = useState<{[key: string]: {registrations: number, players: number}}>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sportFilter, setSportFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadTournaments();
  }, []);

  const loadTournaments = async () => {
    try {
      const q = query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const tournamentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        endDate: doc.data().endDate?.toDate(),
        registrationDeadline: doc.data().registrationDeadline?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Tournament[];
      
      // Filter tournaments: only show public tournaments (isPublic !== false)
      // Treat undefined/null as true for backward compatibility
      const publicTournaments = tournamentsData.filter(tournament => {
        return tournament.isPublic !== false; // Show if isPublic is true or undefined
      });
      
      setTournaments(publicTournaments);
      
      // Load tournament statistics
      await loadTournamentStats(tournamentsData);
    } catch (error) {
      console.error('Error loading tournaments:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTournamentStats = async (tournamentsData: Tournament[]) => {
    const stats: {[key: string]: {registrations: number, players: number}} = {};
    
    for (const tournament of tournamentsData) {
      try {
        // Load registrations
        const registrationsQuery = query(
          collection(db, 'registrations'),
          where('tournamentId', '==', tournament.id)
        );
        const registrationsSnapshot = await getDocs(registrationsQuery);
        const registrations = registrationsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Registration[];

        // Count unique players (some registrations might be for doubles)
        const uniquePlayers = new Set(registrations.map(r => r.email)).size;
        
        stats[tournament.id] = {
          registrations: registrations.length,
          players: uniquePlayers
        };
      } catch (error) {
        console.error(`Error loading stats for tournament ${tournament.id}:`, error);
        stats[tournament.id] = { registrations: 0, players: 0 };
      }
    }
    
    setTournamentStats(stats);
  };

  const getSportIcon = (sport: string) => {
    const icons: {[key: string]: string} = {
      'badminton': '🏸',
      'table-tennis': '🏓',
      'volleyball': '🏐',
      'tennis': '🎾',
      'basketball': '🏀',
      'football': '⚽',
    };
    return icons[sport] || '🏆';
  };

  const getStatusColor = (status: string) => {
    const colors: {[key: string]: string} = {
      'upcoming': 'bg-blue-100 text-blue-800',
      'ongoing': 'bg-green-100 text-green-800',
      'completed': 'bg-gray-100 text-gray-800',
      'cancelled': 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  const filteredTournaments = tournaments.filter(tournament => {
    const matchesSearch = tournament.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tournament.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tournament.venue.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSport = sportFilter === 'all' || tournament.sport === sportFilter;
    const matchesStatus = statusFilter === 'all' || tournament.status === statusFilter;
    
    return matchesSearch && matchesSport && matchesStatus;
  });

  const sports = Array.from(new Set(tournaments.map(t => t.sport)));

  if (loading) {
    return (
      <PublicLayout>
        <div className="min-h-screen backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="min-h-screen backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Tournament Listings
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Discover and join exciting sports tournaments. Find your perfect competition and showcase your skills.
            </p>
          </div>

          {/* Filters */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 mb-8 shadow-lg border border-white/20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search tournaments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white/70 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              
              <Select value={sportFilter} onValueChange={setSportFilter}>
                <SelectTrigger className="bg-white/70 border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="Filter by sport" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sports</SelectItem>
                  {sports.map(sport => (
                    <SelectItem key={sport} value={sport}>
                      {getSportIcon(sport)} {sport.charAt(0).toUpperCase() + sport.slice(1).replace('-', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-white/70 border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tournaments Grid */}
          {filteredTournaments.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No tournaments found</h3>
              <p className="text-gray-500">
                {searchTerm || sportFilter !== 'all' || statusFilter !== 'all' 
                  ? 'Try adjusting your search filters'
                  : 'Check back later for new tournaments'
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTournaments.map((tournament) => (
                <Card key={tournament.id} className="bg-white/80 backdrop-blur-sm border-white/20 hover:shadow-xl transition-all duration-300 hover:scale-105">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="text-3xl">{getSportIcon(tournament.sport)}</div>
                        <div>
                          <CardTitle className="text-lg font-bold text-gray-900 line-clamp-2">
                            {tournament.name}
                          </CardTitle>
                          <CardDescription className="text-sm text-gray-600 capitalize">
                            {tournament.sport.replace('-', ' ')}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge className={`${getStatusColor(tournament.status)} capitalize`}>
                        {tournament.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {tournament.description}
                    </p>
                    
                    <div className="space-y-2">
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="h-4 w-4 mr-2 text-blue-500" />
                        <span>{formatDate(tournament.startDate)} - {formatDate(tournament.endDate)}</span>
                      </div>
                      
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin className="h-4 w-4 mr-2 text-green-500" />
                        <span>{tournament.venue}</span>
                      </div>
                      
                      <div className="flex items-center text-sm text-gray-600">
                        <Users className="h-4 w-4 mr-2 text-purple-500" />
                        <span>
                          {tournamentStats[tournament.id]?.players || 0} players registered
                        </span>
                      </div>
                      
                      <div className="flex items-center text-sm text-gray-600">
                        <Trophy className="h-4 w-4 mr-2 text-yellow-500" />
                        <span>₹{tournament.entryFee} entry fee</span>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2 pt-2">
                      <Link href={`/tournament/${tournament.id}`} className="flex-1">
                        <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                      </Link>
                      
                      {tournament.status === 'upcoming' && (
                        <Link href={`/tournament/${tournament.id}/register`}>
                          <Button variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
                            Register
                          </Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
