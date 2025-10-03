'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { doc, getDoc, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tournament, Participant, Match, TournamentBracket, BracketRound, BracketMatch } from '@/types';
import { 
  ArrowLeft, 
  Calendar, 
  MapPin, 
  Users, 
  Trophy, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Download,
  BarChart3,
  UserCheck,
  UserX,
  Target,
  Award,
  Activity,
  TrendingUp,
  Eye,
  Edit,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';

export default function TournamentDetailsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const tournamentId = params.id as string;
  
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [brackets, setBrackets] = useState<TournamentBracket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/login');
    } else if (user?.role === 'admin') {
      loadTournamentData();
    }
  }, [user, authLoading, router, tournamentId]);

  const loadTournamentData = async () => {
    try {
      // Load tournament details
      const tournamentDoc = await getDoc(doc(db, 'tournaments', tournamentId));
      if (!tournamentDoc.exists()) {
        router.push('/admin/tournaments');
        return;
      }

      const tournamentData = {
        id: tournamentDoc.id,
        ...tournamentDoc.data(),
        startDate: tournamentDoc.data()?.startDate?.toDate(),
        endDate: tournamentDoc.data()?.endDate?.toDate(),
        registrationDeadline: tournamentDoc.data()?.registrationDeadline?.toDate(),
        createdAt: tournamentDoc.data()?.createdAt?.toDate(),
        updatedAt: tournamentDoc.data()?.updatedAt?.toDate(),
      } as Tournament;

      setTournament(tournamentData);

      // Load participants for this tournament
      const participantsQuery = query(
        collection(db, 'participants'),
        where('tournamentId', '==', tournamentId),
        orderBy('registeredAt', 'desc')
      );
      const participantsSnapshot = await getDocs(participantsQuery);
      const participantsData = participantsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        registeredAt: doc.data().registeredAt?.toDate(),
        approvedAt: doc.data().approvedAt?.toDate(),
        paymentVerifiedAt: doc.data().paymentVerifiedAt?.toDate(),
      })) as Participant[];

      setParticipants(participantsData);

      // Load matches for this tournament
      const matchesQuery = query(
        collection(db, 'matches'),
        where('tournamentId', '==', tournamentId),
        orderBy('scheduledTime', 'asc')
      );
      const matchesSnapshot = await getDocs(matchesQuery);
      const matchesData = matchesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        scheduledTime: doc.data().scheduledTime?.toDate(),
        actualStartTime: doc.data().actualStartTime?.toDate(),
        actualEndTime: doc.data().actualEndTime?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Match[];

      setMatches(matchesData);

      // Load brackets for this tournament
      const bracketsQuery = query(
        collection(db, 'brackets'),
        where('tournamentId', '==', tournamentId)
      );
      const bracketsSnapshot = await getDocs(bracketsQuery);
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

      setBrackets(bracketsData);

    } catch (error) {
      console.error('Error loading tournament data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ongoing': return 'bg-green-100 text-green-800 border-green-200';
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRegistrationStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'refunded': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getMatchStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'live': return 'bg-red-100 text-red-800';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      case 'postponed': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const exportParticipants = () => {
    const csvContent = [
      ['Name', 'Email', 'Phone', 'Age', 'Gender', 'Tower', 'Flat Number', 'Level', 'Category', 'Status', 'Payment Status', 'Registration Date', 'Partner Name', 'Partner Phone'].join(','),
      ...participants.map(p => [
        p.name,
        p.email,
        p.phone,
        p.age,
        p.gender,
        p.tower,
        p.flatNumber,
        p.expertiseLevel,
        p.selectedCategory,
        p.registrationStatus,
        p.paymentStatus,
        new Date(p.registeredAt).toLocaleDateString(),
        p.partnerName || '',
        p.partnerPhone || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tournament?.name}-participants-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
          <p className="mt-4 text-gray-600">Loading tournament details...</p>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <AdminLayout moduleName="Tournament Details">
        <div className="p-6">
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Tournament not found</h3>
            <p className="text-gray-600 mb-4">The tournament you&apos;re looking for doesn&apos;t exist or has been removed.</p>
            <Button onClick={() => router.push('/admin/tournaments')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Tournaments
            </Button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // Calculate statistics
  const totalParticipants = participants?.length || 0;
  const approvedParticipants = participants?.filter(p => p.registrationStatus === 'approved').length || 0;
  const pendingParticipants = participants?.filter(p => p.registrationStatus === 'pending').length || 0;
  const rejectedParticipants = participants?.filter(p => p.registrationStatus === 'rejected').length || 0;
  const paidParticipants = participants?.filter(p => p.paymentStatus === 'paid').length || 0;
  const totalMatches = matches?.length || 0;
  const completedMatches = matches?.filter(m => m.status === 'completed').length || 0;
  const liveMatches = matches?.filter(m => m.status === 'live').length || 0;
  const scheduledMatches = matches?.filter(m => m.status === 'scheduled').length || 0;

  return (
    <AdminLayout moduleName="Tournament Details">
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => router.push('/admin/tournaments')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Tournaments
            </Button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">{tournament.name}</h1>
              <p className="text-gray-600 mt-1">{tournament.description}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Edit Tournament
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.open(tournament.publicRegistrationLink, '_blank')}>
                <ExternalLink className="h-4 w-4 mr-2" />
                View Registration
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Badge className={`${getStatusColor(tournament.status)} text-sm px-3 py-1`}>
              {tournament.status}
            </Badge>
            {tournament.registrationOpen && (
              <Badge variant="outline" className="text-green-600 border-green-600">
                Registration Open
              </Badge>
            )}
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(tournament.startDate)} - {formatDate(tournament.endDate)}</span>
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <MapPin className="h-4 w-4" />
              <span>{tournament.venue}</span>
            </div>
          </div>
        </div>

        {/* Key Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Participants</p>
                  <p className="text-2xl font-bold">{totalParticipants}/{tournament.maxParticipants}</p>
                  <p className="text-xs text-gray-500">
                    {Math.round((totalParticipants / tournament.maxParticipants) * 100)}% capacity
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <UserCheck className="h-8 w-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Approved</p>
                  <p className="text-2xl font-bold">{approvedParticipants}</p>
                  <p className="text-xs text-gray-500">
                    {totalParticipants > 0 ? Math.round((approvedParticipants / totalParticipants) * 100) : 0}% approval rate
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Activity className="h-8 w-8 text-purple-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Matches</p>
                  <p className="text-2xl font-bold">{totalMatches}</p>
                  <p className="text-xs text-gray-500">
                    {completedMatches} completed, {liveMatches} live
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Revenue</p>
                  <p className="text-2xl font-bold">₹{paidParticipants * (tournament.entryFee || 0)}</p>
                  <p className="text-xs text-gray-500">
                    {paidParticipants} payments received
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="participants">Participants</TabsTrigger>
            <TabsTrigger value="matches">Matches</TabsTrigger>
            <TabsTrigger value="brackets">Brackets</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Tournament Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5" />
                    Tournament Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Sport</p>
                      <p className="text-lg font-semibold capitalize">{tournament.sport.replace('-', ' ')}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Type</p>
                      <p className="text-lg font-semibold capitalize">{tournament.tournamentType}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Entry Fee</p>
                      <p className="text-lg font-semibold">
                        {tournament.entryFee ? `₹${tournament.entryFee}` : 'Free'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Prize Pool</p>
                      <p className="text-lg font-semibold">
                        {tournament.prizePool ? `₹${tournament.prizePool}` : 'Not specified'}
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2">Categories</p>
                    <div className="flex flex-wrap gap-2">
                      {(tournament.categories || []).map((category) => (
                        <Badge key={category} variant="outline" className="capitalize">
                          {category.replace('-', ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2">Rules</p>
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                      {tournament.rules || 'No specific rules mentioned.'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Registration Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Registration Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Approved</span>
                      </div>
                      <span className="font-semibold">{approvedParticipants}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        {/* Replace UserClock with a valid icon, e.g., Clock */}
                        <Clock className="h-4 w-4 text-yellow-500" />
                        <span className="text-sm">Pending</span>
                      </div>
                      <span className="font-semibold">{pendingParticipants}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <UserX className="h-4 w-4 text-red-500" />
                        <span className="text-sm">Rejected</span>
                      </div>
                      <span className="font-semibold">{rejectedParticipants}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Registration Progress</span>
                      <span className="text-sm text-gray-600">
                        {totalParticipants}/{tournament.maxParticipants}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min((totalParticipants / tournament.maxParticipants) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Approval Rate</span>
                      <span className="text-sm text-gray-600">
                        {totalParticipants > 0 ? Math.round((approvedParticipants / totalParticipants) * 100) : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${totalParticipants > 0 ? (approvedParticipants / totalParticipants) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Participants Tab */}
          <TabsContent value="participants" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Participants ({totalParticipants})</h3>
                <p className="text-sm text-gray-600">Manage tournament registrations</p>
              </div>
              <Button onClick={exportParticipants}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Age</TableHead>
                        <TableHead>Gender</TableHead>
                        <TableHead>Tower/Flat</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Registered</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(participants || []).map((participant) => (
                        <TableRow key={participant.id}>
                          <TableCell className="font-medium">{participant.name}</TableCell>
                          <TableCell>{participant.email}</TableCell>
                          <TableCell>{participant.phone}</TableCell>
                          <TableCell>{participant.age}</TableCell>
                          <TableCell className="capitalize">{participant.gender}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p><strong>Tower {participant.tower}</strong></p>
                              <p className="text-gray-500">Flat {participant.flatNumber}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize text-xs">
                              {participant.selectedCategory.replace('-', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize text-xs">
                              {participant.expertiseLevel}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getRegistrationStatusColor(participant.registrationStatus)}>
                              {participant.registrationStatus}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Badge className={getPaymentStatusColor(participant.paymentStatus)}>
                                {participant.paymentStatus}
                              </Badge>
                              {participant.paymentAmount && (
                                <div className="text-xs text-gray-500">
                                  ₹{participant.paymentAmount}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{formatDate(participant.registeredAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {(participants || []).length === 0 && (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No participants yet</h3>
                    <p className="text-gray-600">Participants will appear here once they register for this tournament.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Matches Tab */}
          <TabsContent value="matches" className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold">Matches ({totalMatches})</h3>
              <p className="text-sm text-gray-600">Tournament match schedule and results</p>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Match #</TableHead>
                        <TableHead>Round</TableHead>
                        <TableHead>Player 1</TableHead>
                        <TableHead>Player 2</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Scheduled Time</TableHead>
                        <TableHead>Venue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(matches || []).map((match) => (
                        <TableRow key={match.id}>
                          <TableCell className="font-medium">#{match.matchNumber}</TableCell>
                          <TableCell>{match.round}</TableCell>
                          <TableCell>{match.player1Name}</TableCell>
                          <TableCell>{match.player2Name}</TableCell>
                          <TableCell>
                            {match.status === 'completed' ? (
                              <span className="font-semibold">
                                {match.player1Score} - {match.player2Score}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={getMatchStatusColor(match.status)}>
                              {match.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(match.scheduledTime)}</TableCell>
                          <TableCell>{match.venue}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {(matches || []).length === 0 && (
                  <div className="text-center py-8">
                    <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No matches scheduled</h3>
                    <p className="text-gray-600">Matches will appear here once the tournament bracket is generated.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Brackets Tab */}
          <TabsContent value="brackets" className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold">Tournament Brackets ({(brackets || []).length})</h3>
              <p className="text-sm text-gray-600">View tournament brackets by category</p>
            </div>

            <div className="grid gap-6">
              {(brackets || []).map((bracket) => (
                <Card key={bracket.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="capitalize">{bracket.category.replace('-', ' ')}</span>
                      <Badge variant="outline" className={getStatusColor(bracket.status)}>
                        {bracket.status}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      {bracket.participants.length} participants • {bracket.rounds.length} rounds
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {bracket.rounds.map((round, index) => (
                        <div key={index} className="border rounded-lg p-4">
                          <h4 className="font-semibold mb-2">{round.roundName}</h4>
                          <div className="grid gap-2">
                            {round.matches.map((match) => (
                              <div key={match.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                <div className="flex items-center gap-4">
                                  <span className="text-sm font-medium">Match #{match.matchNumber}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm">{match.player1Name || 'TBD'}</span>
                                    <span className="text-gray-400">vs</span>
                                    <span className="text-sm">{match.player2Name || 'TBD'}</span>
                                  </div>
                                </div>
                                <Badge variant="outline" className={getMatchStatusColor(match.status)}>
                                  {match.status}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {(brackets || []).length === 0 && (
              <div className="text-center py-8">
                <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No brackets generated</h3>
                <p className="text-gray-600">Brackets will appear here once they are generated for the tournament.</p>
              </div>
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold">Tournament Analytics</h3>
              <p className="text-sm text-gray-600">Detailed insights and statistics</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Registration Trends */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Registration Trends
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Registration Deadline</span>
                      <span className="font-semibold">{formatDate(tournament.registrationDeadline)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Days Remaining</span>
                      <span className="font-semibold">
                        {Math.max(0, Math.ceil((tournament.registrationDeadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Capacity Utilization</span>
                      <span className="font-semibold">
                        {Math.round((totalParticipants / tournament.maxParticipants) * 100)}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Analytics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Payment Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Total Revenue</span>
                      <span className="font-semibold">₹{paidParticipants * (tournament.entryFee || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Payment Rate</span>
                      <span className="font-semibold">
                        {totalParticipants > 0 ? Math.round((paidParticipants / totalParticipants) * 100) : 0}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Pending Payments</span>
                      <span className="font-semibold">{totalParticipants - paidParticipants}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Category Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Category Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(tournament.categories || []).map((category) => {
                      const categoryParticipants = participants.filter(p => p.selectedCategory === category).length;
                      return (
                        <div key={category} className="flex justify-between items-center">
                          <span className="text-sm capitalize">{category.replace('-', ' ')}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{categoryParticipants}</span>
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${totalParticipants > 0 ? (categoryParticipants / totalParticipants) * 100 : 0}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Expertise Level Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Skill Level Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {['beginner', 'intermediate', 'advanced', 'expert'].map((level) => {
                      const levelParticipants = participants.filter(p => p.expertiseLevel === level).length;
                      return (
                        <div key={level} className="flex justify-between items-center">
                          <span className="text-sm capitalize">{level}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{levelParticipants}</span>
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-green-600 h-2 rounded-full"
                                style={{ width: `${totalParticipants > 0 ? (levelParticipants / totalParticipants) * 100 : 0}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
