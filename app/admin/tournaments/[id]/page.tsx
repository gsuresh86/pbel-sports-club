'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { doc, getDoc, collection, getDocs, query, where, orderBy, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Tournament, Participant, Match, TournamentBracket, BracketRound, BracketMatch, SportType, TournamentType, CategoryType } from '@/types';
import { ImageUpload } from '@/components/ui/image-upload';
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    sport: 'badminton' as SportType,
    tournamentType: 'individual' as TournamentType,
    categories: [] as CategoryType[],
    startDate: '',
    endDate: '',
    venue: '',
    description: '',
    registrationDeadline: '',
    maxParticipants: '',
    entryFee: '',
    prizePool: '',
    rules: '',
    status: 'upcoming' as 'upcoming' | 'ongoing' | 'completed' | 'cancelled',
    registrationOpen: true,
    banner: '',
  });

  useEffect(() => {
    if (!authLoading && (!user || (user.role !== 'admin' && user.role !== 'tournament-admin' && user.role !== 'super-admin'))) {
      router.push('/login');
    } else if (user?.role === 'admin' || user?.role === 'tournament-admin' || user?.role === 'super-admin') {
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

      // Check if user has permission to access this tournament
      if (user?.role === 'tournament-admin' && user.assignedTournaments) {
        if (!user.assignedTournaments.includes(tournamentId)) {
          router.push('/admin/tournaments');
          return;
        }
      }

      setTournament(tournamentData);

      // Load participants for this tournament from subcollection
      const participantsSnapshot = await getDocs(collection(db, 'tournaments', tournamentId, 'participants'));
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

  const handleEdit = () => {
    if (!tournament) return;
    
    setFormData({
      name: tournament.name,
      sport: tournament.sport,
      tournamentType: tournament.tournamentType || 'individual',
      categories: tournament.categories || [],
      startDate: new Date(tournament.startDate).toISOString().split('T')[0],
      endDate: new Date(tournament.endDate).toISOString().split('T')[0],
      venue: tournament.venue,
      description: tournament.description,
      registrationDeadline: new Date(tournament.registrationDeadline).toISOString().split('T')[0],
      maxParticipants: tournament.maxParticipants?.toString() || '',
      entryFee: tournament.entryFee?.toString() || '',
      prizePool: tournament.prizePool?.toString() || '',
      rules: tournament.rules || '',
      status: tournament.status,
      registrationOpen: tournament.registrationOpen ?? true,
      banner: tournament.banner || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournament) return;
    
    try {
      const tournamentData: Partial<Tournament> = {
        name: formData.name,
        sport: formData.sport,
        tournamentType: formData.tournamentType,
        categories: formData.categories,
        startDate: new Date(formData.startDate),
        endDate: new Date(formData.endDate),
        venue: formData.venue,
        description: formData.description,
        registrationDeadline: new Date(formData.registrationDeadline),
        rules: formData.rules,
        status: formData.status,
        registrationOpen: formData.registrationOpen,
        updatedAt: new Date(),
      };

      // Only add optional fields if they have values
      if (formData.maxParticipants && formData.maxParticipants.trim() !== '') {
        tournamentData.maxParticipants = parseInt(formData.maxParticipants);
      }
      if (formData.entryFee && formData.entryFee.trim() !== '') {
        tournamentData.entryFee = parseFloat(formData.entryFee);
      }
      if (formData.prizePool && formData.prizePool.trim() !== '') {
        tournamentData.prizePool = parseFloat(formData.prizePool);
      }
      if (formData.banner && formData.banner.trim() !== '') {
        tournamentData.banner = formData.banner;
      }

      await updateDoc(doc(db, 'tournaments', tournament.id), tournamentData);
      
      // Reload tournament data
      await loadTournamentData();
      
      setDialogOpen(false);
      alert('Tournament updated successfully!');
    } catch (error) {
      console.error('Error updating tournament:', error);
      alert('Failed to update tournament');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      sport: 'badminton',
      tournamentType: 'individual',
      categories: [],
      startDate: '',
      endDate: '',
      venue: '',
      description: '',
      registrationDeadline: '',
      maxParticipants: '',
      entryFee: '',
      prizePool: '',
      rules: '',
      status: 'upcoming',
      registrationOpen: true,
      banner: '',
    });
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
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">{tournament.name}</h1>
              <p className="text-gray-600 mt-1">{tournament.description}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleEdit}>
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
                  <p className="text-2xl font-bold">{totalParticipants}/{tournament.maxParticipants || '∞'}</p>
                  <p className="text-xs text-gray-500">
                    {tournament.maxParticipants ? `${Math.round((totalParticipants / tournament.maxParticipants) * 100)}% capacity` : 'Unlimited capacity'}
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
                        {totalParticipants}/{tournament.maxParticipants || '∞'}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${tournament.maxParticipants ? Math.min((totalParticipants / tournament.maxParticipants) * 100, 100) : 0}%` }}
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
                        {tournament.maxParticipants ? `${Math.round((totalParticipants / tournament.maxParticipants) * 100)}%` : 'N/A'}
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

        {/* Edit Tournament Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Tournament</DialogTitle>
              <DialogDescription>
                Update tournament details and settings
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Tournament Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sport">Sport</Label>
                  <Select value={formData.sport} onValueChange={(value: SportType) => setFormData({ ...formData, sport: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="badminton">Badminton</SelectItem>
                      <SelectItem value="table-tennis">Table Tennis</SelectItem>
                      <SelectItem value="volleyball">Volleyball</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tournamentType">Tournament Type</Label>
                  <Select value={formData.tournamentType} onValueChange={(value: TournamentType) => setFormData({ ...formData, tournamentType: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Individual</SelectItem>
                      <SelectItem value="team">Team</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Categories</Label>
                  <p className="text-sm text-gray-600">Select tournament categories</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto border rounded-lg p-3">
                    {[
                      'girls-under-13', 'boys-under-13', 'girls-under-18', 'boys-under-18',
                      'mens-single', 'womens-single', 'mens-doubles', 'mixed-doubles',
                      'mens-team', 'womens-team', 'kids-team-u13', 'kids-team-u18'
                    ].map((category) => (
                      <div key={category} className="flex items-center space-x-2">
                        <Checkbox
                          id={`category-${category}`}
                          checked={formData.categories.includes(category as CategoryType)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFormData({
                                ...formData,
                                categories: [...formData.categories, category as CategoryType]
                              });
                            } else {
                              setFormData({
                                ...formData,
                                categories: formData.categories.filter(cat => cat !== category)
                              });
                            }
                          }}
                        />
                        <Label htmlFor={`category-${category}`} className="text-sm capitalize">
                          {category.replace('-', ' ')}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="venue">Venue</Label>
                  <Input
                    id="venue"
                    value={formData.venue}
                    onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registrationDeadline">Registration Deadline</Label>
                  <Input
                    id="registrationDeadline"
                    type="date"
                    value={formData.registrationDeadline}
                    onChange={(e) => setFormData({ ...formData, registrationDeadline: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxParticipants">Max Participants</Label>
                  <Input
                    id="maxParticipants"
                    type="number"
                    value={formData.maxParticipants}
                    onChange={(e) => setFormData({ ...formData, maxParticipants: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="entryFee">Entry Fee (₹)</Label>
                  <Input
                    id="entryFee"
                    type="number"
                    value={formData.entryFee}
                    onChange={(e) => setFormData({ ...formData, entryFee: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prizePool">Prize Pool (₹)</Label>
                  <Input
                    id="prizePool"
                    type="number"
                    value={formData.prizePool}
                    onChange={(e) => setFormData({ ...formData, prizePool: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value: 'upcoming' | 'ongoing' | 'completed' | 'cancelled') => setFormData({ ...formData, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="ongoing">Ongoing</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="rules">Rules</Label>
                <Textarea
                  id="rules"
                  value={formData.rules}
                  onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
                  rows={4}
                />
              </div>
              
              <div className="space-y-2">
                <ImageUpload
                  label="Tournament Banner"
                  value={formData.banner}
                  onChange={(url) => setFormData({ ...formData, banner: url || '' })}
                  aspectRatio="16/9"
                  maxSize={5}
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="registrationOpen"
                  checked={formData.registrationOpen}
                  onChange={(e) => setFormData({ ...formData, registrationOpen: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="registrationOpen">Registration Open</Label>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Update Tournament
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
