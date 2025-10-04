'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tournament, Match, Participant } from '@/types';
import { Search, Calendar, MapPin, Users, Trophy, Clock, Target, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
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
      setTournaments(tournamentsData);
    } catch (error) {
      console.error('Error loading tournaments:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTournaments = tournaments.filter(tournament => {
    const matchesSearch = searchTerm === '' || 
      tournament.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tournament.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tournament.venue.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSport = sportFilter === 'all' || tournament.sport === sportFilter;
    const matchesStatus = statusFilter === 'all' || tournament.status === statusFilter;
    
    return matchesSearch && matchesSport && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-100 text-blue-800';
      case 'ongoing': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSportBanner = (sport: string) => {
    switch (sport) {
      case 'badminton':
        return 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200&q=80';
      case 'table-tennis':
        return 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200&q=80';
      case 'volleyball':
        return 'https://images.unsplash.com/photo-1612872087720-b8768760e99a?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200&q=80';
      default:
        return 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200&q=80';
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

  const isRegistrationOpen = (tournament: Tournament) => {
    return tournament.registrationOpen && 
           new Date() <= tournament.registrationDeadline;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
          <p className="mt-4 text-gray-600">Loading tournaments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Tournaments</h1>
          <p className="text-xl text-gray-600">Discover and join exciting sports tournaments</p>
        </div>

        {/* Filters */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="grid md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search tournaments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div>
                <Select value={sportFilter} onValueChange={setSportFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Sports" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sports</SelectItem>
                    <SelectItem value="badminton">Badminton</SelectItem>
                    <SelectItem value="table-tennis">Table Tennis</SelectItem>
                    <SelectItem value="volleyball">Volleyball</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="ongoing">Ongoing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-gray-600 flex items-center">
                {filteredTournaments.length} tournament{filteredTournaments.length !== 1 ? 's' : ''} found
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tournaments Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTournaments.map((tournament) => (
            <Card key={tournament.id} className="hover:shadow-lg transition-shadow overflow-hidden">
              {/* Tournament Banner */}
              <div className="relative h-32 w-full overflow-hidden">
                <img
                  src={tournament.banner || getSportBanner(tournament.sport)}
                  alt={`${tournament.name} tournament banner`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                  <span className="text-3xl">{getSportIcon(tournament.sport)}</span>
                </div>
              </div>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-2xl">{getSportIcon(tournament.sport)}</span>
                      {tournament.name}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(tournament.startDate).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {tournament.venue}
                        </span>
                      </div>
                    </CardDescription>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Badge className={getStatusColor(tournament.status)}>
                      {tournament.status}
                    </Badge>
                    {isRegistrationOpen(tournament) && (
                      <Badge className="bg-green-100 text-green-800">
                        Registration Open
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {tournament.description}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p><strong>Sport:</strong> {tournament.sport}</p>
                      <p><strong>Type:</strong> {tournament.tournamentType || 'individual'}</p>
                      <p><strong>Categories:</strong> {tournament.categories?.join(', ') || 'None'}</p>
                      <p><strong>Participants:</strong> {tournament.currentParticipants || 0}</p>
                    </div>
                    <div>
                      <p><strong>Deadline:</strong> {new Date(tournament.registrationDeadline).toLocaleDateString()}</p>
                      {tournament.entryFee && <p><strong>Entry Fee:</strong> ₹{tournament.entryFee}</p>}
                    </div>
                  </div>

                  {tournament.prizePool && (
                    <div className="bg-yellow-50 p-3 rounded-lg">
                      <p className="text-sm font-semibold text-yellow-800">
                        <Trophy className="h-4 w-4 inline mr-1" />
                        Prize Pool: ₹{tournament.prizePool}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Link href={`/tournament/${tournament.id}`} className="flex-1">
                      <Button variant="outline" className="w-full">
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                    </Link>
                    {isRegistrationOpen(tournament) && (
                      <Link href={`/tournament/${tournament.id}/register`} className="flex-1">
                        <Button className="w-full">
                          Register Now
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredTournaments.length === 0 && (
          <div className="text-center py-12">
            <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tournaments found</h3>
            <p className="text-gray-600">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
