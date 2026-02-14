'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { doc, getDoc, collection, getDocs, query, where, orderBy, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Tournament, Registration, Match, SportType, TournamentType, CategoryType } from '@/types';
import { ImageUpload } from '@/components/ui/image-upload';
import { useAlertDialog } from '@/components/ui/alert-dialog-component';
import { generateRegistrationLink } from '@/lib/utils';
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
  ExternalLink,
  Users2,
  Shuffle,
  Play,
  Swords
} from 'lucide-react';
import Link from 'next/link';
import TeamManagement from '@/components/TeamManagement';
import SpinWheel from '@/components/SpinWheel';
import PoolAssignment from '@/components/PoolAssignment';

export default function TournamentDetailsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const tournamentId = params.id as string;
  const { alert, AlertDialogComponent } = useAlertDialog();
  
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<Registration[]>([]);
  const [filteredParticipants, setFilteredParticipants] = useState<Registration[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Filter states
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [genderFilter, setGenderFilter] = useState<string>('all');
  
  // Edit drawer states
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<Registration | null>(null);
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
    isPublic: true, // Tournament visibility for public
    matchFormat: 'best-of-3' as 'single-set' | 'best-of-3',
  });

  useEffect(() => {
    if (!authLoading && (!user || (user.role !== 'admin' && user.role !== 'tournament-admin' && user.role !== 'super-admin'))) {
      router.push('/login');
    } else if (user?.role === 'admin' || user?.role === 'tournament-admin' || user?.role === 'super-admin') {
      loadTournamentData();
    }
  }, [user, authLoading, router, tournamentId]);

  // Handle URL parameters for tab selection
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['overview', 'participants', 'matches', 'teams', 'spin-wheel', 'pools', 'results'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Filter participants based on selected filters
  useEffect(() => {
    let filtered = participants;

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(p => p.selectedCategory === categoryFilter);
    }

    if (levelFilter !== 'all') {
      filtered = filtered.filter(p => p.expertiseLevel === levelFilter);
    }

    if (genderFilter !== 'all') {
      filtered = filtered.filter(p => p.gender === genderFilter);
    }

    setFilteredParticipants(filtered);
  }, [participants, categoryFilter, levelFilter, genderFilter]);

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

      // Load registrations for this tournament from subcollection
      const registrationsSnapshot = await getDocs(collection(db, 'tournaments', tournamentId, 'registrations'));
      const registrationsData = registrationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        registeredAt: doc.data().registeredAt?.toDate(),
        approvedAt: doc.data().approvedAt?.toDate(),
        paymentVerifiedAt: doc.data().paymentVerifiedAt?.toDate(),
      })) as Registration[];

      setParticipants(registrationsData);

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

    } catch (error) {
      console.error('Error loading tournament data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toDateInputValue = (d: Date | string | undefined): string => {
    if (d == null) return '';
    const date = typeof d === 'string' ? new Date(d) : d;
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  };

  const handleEdit = () => {
    if (!tournament) return;
    
    setFormData({
      name: tournament.name,
      sport: tournament.sport,
      tournamentType: tournament.tournamentType || 'individual',
      categories: tournament.categories || [],
      startDate: toDateInputValue(tournament.startDate as Date),
      endDate: toDateInputValue(tournament.endDate as Date),
      venue: tournament.venue,
      description: tournament.description,
      registrationDeadline: toDateInputValue(tournament.registrationDeadline as Date),
      maxParticipants: tournament.maxParticipants?.toString() || '',
      entryFee: tournament.entryFee?.toString() || '',
      prizePool: tournament.prizePool?.toString() || '',
      rules: tournament.rules || '',
      status: tournament.status,
      registrationOpen: tournament.registrationOpen ?? true,
      banner: tournament.banner || '',
      isPublic: (tournament as any).isPublic !== undefined ? (tournament as any).isPublic : true,
      matchFormat: (tournament as any).matchFormat || 'best-of-3',
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
        isPublic: formData.isPublic,
        matchFormat: formData.matchFormat,
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
      alert({
        title: 'Success',
        description: 'Tournament updated successfully!',
        variant: 'success'
      });
    } catch (error) {
      console.error('Error updating tournament:', error);
      alert({
        title: 'Error',
        description: 'Failed to update tournament. Please try again.',
        variant: 'error'
      });
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
      isPublic: true,
      matchFormat: 'best-of-3',
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

  const openEditDrawer = (participant: Registration) => {
    setSelectedParticipant(participant);
    setEditDrawerOpen(true);
  };

  const exportParticipants = () => {
    const csvContent = [
      ['Name', 'Phone', 'Age', 'Gender', 'Tower/Flat', 'Level', 'Category', 'Status', 'Partner Name', 'Partner Phone'].join(','),
      ...filteredParticipants.map(p => [
        p.name,
        p.phone,
        p.age,
        p.gender,
        `${p.tower} ${p.flatNumber}`,
        p.expertiseLevel,
        p.selectedCategory,
        p.registrationStatus,
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
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 sm:h-32 sm:w-32 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600 sm:text-base">Loading tournament details...</p>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <AdminLayout moduleName="Tournament Details">
        <div className="px-4 py-6 sm:p-6">
          <div className="text-center py-8 sm:py-12">
            <AlertCircle className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-base font-medium text-gray-900 mb-2 sm:text-lg">Tournament not found</h3>
            <p className="text-sm text-gray-600 mb-4 sm:text-base">The tournament you&apos;re looking for doesn&apos;t exist or has been removed.</p>
            <Button onClick={() => router.push('/admin/tournaments')} className="w-full sm:w-auto">
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
      <div className="min-w-0 px-4 py-4 sm:p-6">
        {/* Header - stacked on mobile */}
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 truncate sm:text-3xl">{tournament.name}</h1>
              <p className="text-sm text-gray-600 mt-1 line-clamp-2 sm:line-clamp-none">{tournament.description}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-shrink-0">
              <Button variant="outline" size="sm" onClick={handleEdit} className="w-full sm:w-auto">
                <Edit className="h-4 w-4 mr-2" />
                Edit Tournament
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.open(generateRegistrationLink(tournament.id), '_blank')} className="w-full sm:w-auto">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Registration
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <Badge className={`${getStatusColor(tournament.status)} text-xs sm:text-sm px-2 py-0.5 sm:px-3 sm:py-1`}>
              {tournament.status}
            </Badge>
            {tournament.registrationOpen && (
              <Badge variant="outline" className="text-green-600 border-green-600 text-xs sm:text-sm">
                Registration Open
              </Badge>
            )}
            <div className="flex items-center gap-1 text-xs text-gray-600 sm:text-sm">
              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
              <span>{formatDate(tournament.startDate)} - {formatDate(tournament.endDate)}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-600 sm:text-sm">
              <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="truncate">{tournament.venue}</span>
            </div>
          </div>
        </div>

        {/* Key Statistics - 2 cols on mobile */}
        <div className="grid grid-cols-2 gap-3 mb-6 sm:mb-8 sm:gap-6 lg:grid-cols-4">
          <Card>
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-0">
                <Users className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500 flex-shrink-0" />
                <div className="min-w-0 ml-0 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Total Participants</p>
                  <p className="text-lg sm:text-2xl font-bold">{totalParticipants}/{tournament.maxParticipants || '∞'}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 truncate">
                    {tournament.maxParticipants ? `${Math.round((totalParticipants / tournament.maxParticipants) * 100)}% capacity` : 'Unlimited'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-0">
                <UserCheck className="h-6 w-6 sm:h-8 sm:w-8 text-green-500 flex-shrink-0" />
                <div className="min-w-0 ml-0 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Approved</p>
                  <p className="text-lg sm:text-2xl font-bold">{approvedParticipants}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 truncate">
                    {totalParticipants > 0 ? Math.round((approvedParticipants / totalParticipants) * 100) : 0}% approval
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-0">
                <Activity className="h-6 w-6 sm:h-8 sm:w-8 text-purple-500 flex-shrink-0" />
                <div className="min-w-0 ml-0 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Total Matches</p>
                  <p className="text-lg sm:text-2xl font-bold">{totalMatches}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 truncate">
                    {completedMatches} done, {liveMatches} live
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-0">
                <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-green-500 flex-shrink-0" />
                <div className="min-w-0 ml-0 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Revenue</p>
                  <p className="text-lg sm:text-2xl font-bold">₹{paidParticipants * (tournament.entryFee || 0)}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 truncate">
                    {paidParticipants} payments
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Tabs - horizontal scroll on mobile */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
            <TabsList className="inline-flex h-9 w-max min-w-full sm:min-w-0 sm:w-full sm:grid sm:grid-cols-7 flex-nowrap gap-0 p-1 rounded-lg bg-muted">
              <TabsTrigger value="overview" className="flex-shrink-0 px-3 text-xs sm:text-sm sm:flex-1">Overview</TabsTrigger>
              <TabsTrigger value="participants" className="flex-shrink-0 px-3 text-xs sm:text-sm sm:flex-1">Registrations</TabsTrigger>
              <TabsTrigger value="teams" className="flex-shrink-0 px-3 text-xs sm:text-sm sm:flex-1">Teams</TabsTrigger>
              <TabsTrigger value="pools" className="flex-shrink-0 px-3 text-xs sm:text-sm sm:flex-1">Pools</TabsTrigger>
              <TabsTrigger value="spin-wheel" className="flex-shrink-0 px-3 text-xs sm:text-sm sm:flex-1">Spin Wheel</TabsTrigger>
              <TabsTrigger value="matches" className="flex-shrink-0 px-3 text-xs sm:text-sm sm:flex-1">Matches</TabsTrigger>
              <TabsTrigger value="results" className="flex-shrink-0 px-3 text-xs sm:text-sm sm:flex-1">Results</TabsTrigger>
            </TabsList>
          </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
              {/* Tournament Information */}
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Trophy className="h-4 w-4 sm:h-5 sm:w-5" />
                    Tournament Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
                    Registration Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
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

          {/* Registrations Tab */}
          <TabsContent value="participants" className="space-y-4 sm:space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
              <div>
                <h3 className="text-base font-semibold sm:text-lg">Registrations ({filteredParticipants.length})</h3>
                <p className="text-xs text-gray-600 sm:text-sm">Manage tournament registrations</p>
              </div>
              <Button onClick={exportParticipants} size="sm" className="w-full sm:w-auto">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>

            {/* Filter Controls */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-sm sm:text-base">Filter Registrations</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Filter by category, level, and gender</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {/* Category Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="category-filter">Category</Label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {tournament?.categories?.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category === 'girls-under-13' ? 'Girls Under 13' :
                             category === 'boys-under-13' ? 'Boys Under 13' :
                             category === 'girls-under-18' ? 'Girls Under 18' :
                             category === 'boys-under-18' ? 'Boys Under 18' :
                             category === 'mens-single' ? 'Mens Single' :
                             category === 'womens-single' ? 'Womens Single' :
                             category === 'mens-doubles' ? 'Mens Doubles' :
                             category === 'mixed-doubles' ? 'Mixed Doubles' :
                             category === 'mens-team' ? 'Mens Team' :
                             category === 'womens-team' ? 'Womens Team' :
                             category === 'kids-team-u13' ? 'Kids Team (U13)' :
                             category === 'kids-team-u18' ? 'Kids Team (U18)' :
                             category === 'open-team' ? 'Open Team' : category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Level Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="level-filter">Expertise Level</Label>
                    <Select value={levelFilter} onValueChange={setLevelFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Levels</SelectItem>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                        <SelectItem value="expert">Expert</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Gender Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="gender-filter">Gender</Label>
                    <Select value={genderFilter} onValueChange={setGenderFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Genders</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Clear Filters Button */}
                <div className="mt-4">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      setCategoryFilter('all');
                      setLevelFilter('all');
                      setGenderFilter('all');
                    }}
                  >
                    Clear All Filters
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <Table className="min-w-[720px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">Name</TableHead>
                        <TableHead className="text-xs sm:text-sm">Phone</TableHead>
                        <TableHead className="text-xs sm:text-sm">Age</TableHead>
                        <TableHead className="text-xs sm:text-sm">Gender</TableHead>
                        <TableHead className="text-xs sm:text-sm">Tower/Flat</TableHead>
                        <TableHead className="text-xs sm:text-sm">Category</TableHead>
                        <TableHead className="text-xs sm:text-sm">Level</TableHead>
                        <TableHead className="text-xs sm:text-sm">Status</TableHead>
                        <TableHead className="text-xs sm:text-sm w-12">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(filteredParticipants || []).map((participant) => (
                        <TableRow key={participant.id}>
                          <TableCell className="font-medium text-xs sm:text-sm py-2">{participant.name}</TableCell>
                          <TableCell className="text-xs sm:text-sm py-2">{participant.phone}</TableCell>
                          <TableCell className="text-xs sm:text-sm py-2">{participant.age}</TableCell>
                          <TableCell className="capitalize text-xs sm:text-sm py-2">{participant.gender}</TableCell>
                          <TableCell className="text-xs sm:text-sm py-2">
                            <span className="whitespace-nowrap">{participant.tower} {participant.flatNumber}</span>
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge variant="outline" className="capitalize text-[10px] sm:text-xs">
                              {participant.selectedCategory.replace('-', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge variant="outline" className="capitalize text-[10px] sm:text-xs">
                              {participant.expertiseLevel}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge className={`text-[10px] sm:text-xs ${getRegistrationStatusColor(participant.registrationStatus)}`}>
                              {participant.registrationStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDrawer(participant)}
                              className="h-8 w-8 p-0 touch-manipulation"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {(filteredParticipants || []).length === 0 && (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {participants.length === 0 ? 'No registrations yet' : 'No registrations match the current filters'}
                    </h3>
                    <p className="text-gray-600">
                      {participants.length === 0 
                        ? 'Registrations will appear here once users register for this tournament.'
                        : 'Try adjusting your filter criteria to see more results.'
                      }
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Matches Tab */}
          <TabsContent value="matches" className="space-y-4 sm:space-y-6">
            <div>
              <h3 className="text-base font-semibold sm:text-lg">Matches ({totalMatches})</h3>
              <p className="text-xs text-gray-600 sm:text-sm">Start matches and enter scores below.</p>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <Table className="min-w-[680px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">Match #</TableHead>
                        <TableHead className="text-xs sm:text-sm">Round</TableHead>
                        <TableHead className="text-xs sm:text-sm">Player 1</TableHead>
                        <TableHead className="text-xs sm:text-sm">Player 2</TableHead>
                        <TableHead className="text-xs sm:text-sm">Score</TableHead>
                        <TableHead className="text-xs sm:text-sm">Status</TableHead>
                        <TableHead className="text-xs sm:text-sm">Time</TableHead>
                        <TableHead className="text-xs sm:text-sm">Venue</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm w-24">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(matches || []).map((match) => (
                        <TableRow key={match.id}>
                          <TableCell className="font-medium text-xs sm:text-sm py-2">#{match.matchNumber}</TableCell>
                          <TableCell className="text-xs sm:text-sm py-2">{match.round}</TableCell>
                          <TableCell className="text-xs sm:text-sm py-2 max-w-[80px] sm:max-w-none truncate">{match.player1Name}</TableCell>
                          <TableCell className="text-xs sm:text-sm py-2 max-w-[80px] sm:max-w-none truncate">{match.player2Name}</TableCell>
                          <TableCell className="text-xs sm:text-sm py-2">
                            {match.status === 'completed' ? (
                              <span className="font-semibold">
                                {match.player1Score ?? '-'}-{match.player2Score ?? '-'}
                              </span>
                            ) : match.status === 'live' && match.sets?.length ? (
                              <span className="text-green-600 text-xs sm:text-sm">
                                {match.sets.map(s => `${s.player1Score}-${s.player2Score}`).join(', ')}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge className={`text-[10px] sm:text-xs ${getMatchStatusColor(match.status)}`}>
                              {match.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm py-2 whitespace-nowrap">{formatDate(match.scheduledTime)}</TableCell>
                          <TableCell className="text-xs sm:text-sm py-2 max-w-[60px] sm:max-w-none truncate">{match.venue}</TableCell>
                          <TableCell className="text-right py-2">
                            <div className="flex flex-col gap-1 sm:flex-row sm:gap-2 sm:justify-end">
                              {match.status === 'scheduled' && (
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 text-xs touch-manipulation"
                                  onClick={async () => {
                                    try {
                                      await updateDoc(doc(db, 'matches', match.id), {
                                        status: 'live',
                                        actualStartTime: new Date(),
                                        updatedAt: new Date(),
                                      });
                                      await setDoc(doc(db, 'liveScores', match.id), {
                                        matchId: match.id,
                                        tournamentId: match.tournamentId,
                                        player1Name: match.player1Name,
                                        player2Name: match.player2Name,
                                        currentSet: 1,
                                        player1Sets: 0,
                                        player2Sets: 0,
                                        player1CurrentScore: 0,
                                        player2CurrentScore: 0,
                                        isLive: true,
                                        lastUpdated: new Date(),
                                      });
                                      await loadTournamentData();
                                    } catch (e) {
                                      console.error(e);
                                      alert({ title: 'Error', description: 'Failed to start match', variant: 'error' });
                                    }
                                  }}
                                >
                                  <Play className="h-4 w-4 sm:mr-1" />
                                  <span className="hidden sm:inline">Start</span>
                                </Button>
                              )}
                              <Link href={`/admin/matches/${match.id}`} className="inline-block">
                                <Button size="sm" variant="outline" className="w-full sm:w-auto text-xs touch-manipulation">
                                  <Swords className="h-4 w-4 sm:mr-1" />
                                  {match.status === 'scheduled' ? 'Score' : match.status === 'live' ? 'Update' : 'View'}
                                </Button>
                              </Link>
                            </div>
                          </TableCell>
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

          {/* Results Tab */}
          <TabsContent value="results" className="space-y-4 sm:space-y-6">
            <div>
              <h3 className="text-base font-semibold sm:text-lg">Results</h3>
              <p className="text-xs text-gray-600 sm:text-sm">Group standings: rank by points, then set difference, then point difference</p>
            </div>

            {(() => {
              const completed = matches?.filter(m => m.status === 'completed') ?? [];
              type RowStat = { name: string; played: number; won: number; lost: number; pts: number; gw: number; gl: number; gd: number; pw: number; pl: number; pd: number };
              const groupToStats = new Map<string, Map<string, RowStat>>();

              const ensureStat = (round: string, name: string): RowStat => {
                if (!groupToStats.has(round)) groupToStats.set(round, new Map());
                const map = groupToStats.get(round)!;
                if (!map.has(name)) map.set(name, { name, played: 0, won: 0, lost: 0, pts: 0, gw: 0, gl: 0, gd: 0, pw: 0, pl: 0, pd: 0 });
                return map.get(name)!;
              };

              completed.forEach((m) => {
                const round = (m.round || 'Standings').trim() || 'Standings';
                const p1 = m.player1Name || 'TBD';
                const p2 = m.player2Name || 'TBD';
                const s1 = m.player1Score ?? 0;
                const s2 = m.player2Score ?? 0;
                const sets = (m as Match).sets || [];
                const p1Points = sets.reduce((sum, set) => sum + (set.player1Score ?? 0), 0);
                const p2Points = sets.reduce((sum, set) => sum + (set.player2Score ?? 0), 0);

                [p1, p2].forEach((name) => {
                  const stat = ensureStat(round, name);
                  stat.played += 1;
                  if (name === p1) {
                    stat.gw += s1;
                    stat.gl += s2;
                    stat.pw += p1Points;
                    stat.pl += p2Points;
                    if (m.winner === name) { stat.won += 1; stat.pts += 2; } else stat.lost += 1;
                  } else {
                    stat.gw += s2;
                    stat.gl += s1;
                    stat.pw += p2Points;
                    stat.pl += p1Points;
                    if (m.winner === name) { stat.won += 1; stat.pts += 2; } else stat.lost += 1;
                  }
                  stat.gd = stat.gw - stat.gl;
                  stat.pd = stat.pw - stat.pl;
                });
              });

              const groups = Array.from(groupToStats.keys()).sort();
              const tournamentShort = tournament?.name ? tournament.name.replace(/\s+/g, ' ').trim().slice(0, 6) : '';

              if (groups.length === 0) {
                return (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No results yet</h3>
                      <p className="text-muted-foreground">Completed match results will show group standings here.</p>
                    </CardContent>
                  </Card>
                );
              }

              return (
                <div className="space-y-4 sm:space-y-6">
                  {groups.map((round) => {
                    const map = groupToStats.get(round)!;
                    const rows = Array.from(map.values()).sort(
                      (a, b) => b.pts - a.pts || b.gd - a.gd || b.pd - a.pd
                    );
                    return (
                      <Card key={round}>
                        <CardHeader className="p-4 pb-2 sm:p-6">
                          <CardTitle className="text-sm font-semibold sm:text-base">
                            {tournamentShort ? `${tournamentShort} - ${round}` : round}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="overflow-x-auto -mx-4 sm:mx-0">
                            <Table className="min-w-[520px]">
                              <TableHeader>
                                <TableRow className="bg-muted/60">
                                  <TableHead className="font-semibold text-xs sm:text-sm">TEAM</TableHead>
                                  <TableHead className="text-center w-10 sm:w-12 font-semibold text-xs sm:text-sm">MP</TableHead>
                                  <TableHead className="text-center w-8 sm:w-10 font-semibold text-xs sm:text-sm">W</TableHead>
                                  <TableHead className="text-center w-8 sm:w-10 font-semibold text-xs sm:text-sm">L</TableHead>
                                  <TableHead className="text-center w-10 sm:w-12 font-semibold text-xs sm:text-sm">PTS</TableHead>
                                  <TableHead className="text-center w-8 sm:w-10 font-semibold text-xs sm:text-sm">GW</TableHead>
                                  <TableHead className="text-center w-8 sm:w-10 font-semibold text-xs sm:text-sm">GL</TableHead>
                                  <TableHead className="text-center w-8 sm:w-10 font-semibold text-xs sm:text-sm">GD</TableHead>
                                  <TableHead className="text-center w-10 sm:w-12 font-semibold text-xs sm:text-sm">PW</TableHead>
                                  <TableHead className="text-center w-10 sm:w-12 font-semibold text-xs sm:text-sm">PL</TableHead>
                                  <TableHead className="text-center w-10 sm:w-12 font-semibold text-xs sm:text-sm">PD</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {rows.map((row) => (
                                  <TableRow key={row.name}>
                                    <TableCell className="font-medium text-primary text-xs sm:text-sm py-2">{row.name}</TableCell>
                                    <TableCell className="text-center text-xs sm:text-sm py-2">{row.played}</TableCell>
                                    <TableCell className="text-center font-semibold text-green-600 text-xs sm:text-sm py-2">{row.won}</TableCell>
                                    <TableCell className="text-center font-semibold text-red-600 text-xs sm:text-sm py-2">{row.lost}</TableCell>
                                    <TableCell className="text-center font-semibold text-amber-600 text-xs sm:text-sm py-2">{row.pts}</TableCell>
                                    <TableCell className="text-center text-purple-600 text-xs sm:text-sm py-2">{row.gw}</TableCell>
                                    <TableCell className="text-center text-orange-600 text-xs sm:text-sm py-2">{row.gl}</TableCell>
                                    <TableCell className="text-center text-xs sm:text-sm py-2">{row.gd >= 0 ? `+${row.gd}` : row.gd}</TableCell>
                                    <TableCell className="text-center text-xs sm:text-sm py-2">{row.pw}</TableCell>
                                    <TableCell className="text-center text-xs sm:text-sm py-2">{row.pl}</TableCell>
                                    <TableCell className={`text-center font-medium text-xs sm:text-sm py-2 ${row.pd >= 0 ? 'text-sky-600' : 'text-red-600'}`}>
                                      {row.pd >= 0 ? `+${row.pd}` : row.pd}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              );
            })()}
          </TabsContent>

          {/* Teams Tab */}
          <TabsContent value="teams" className="space-y-4 sm:space-y-6 min-w-0">
            <TeamManagement tournament={tournament} user={user!} />
          </TabsContent>

          {/* Spin Wheel Tab */}
          <TabsContent value="spin-wheel" className="space-y-4 sm:space-y-6 min-w-0">
            <SpinWheel tournament={tournament} user={user!} />
          </TabsContent>

          {/* Pools Tab */}
          <TabsContent value="pools" className="space-y-4 sm:space-y-6 min-w-0">
            <PoolAssignment tournament={tournament} user={user!} />
          </TabsContent>
        </Tabs>

        {/* Edit Tournament Dialog - using Dialog so native date inputs work (Vaul Drawer blocks date picker) */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0 sm:w-full">
            <DialogHeader className="flex-shrink-0 px-4 pt-4 pb-2 sm:px-6 sm:pt-6">
              <DialogTitle>Edit Tournament</DialogTitle>
              <DialogDescription>
                Update tournament details and settings
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-4 pb-2 sm:px-6">
              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6" id="edit-tournament-form">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                      'mens-team', 'womens-team', 'kids-team-u13', 'kids-team-u18', 'open-team'
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
                <div className="space-y-2">
                  <Label htmlFor="matchFormat">Match format</Label>
                  <Select value={formData.matchFormat} onValueChange={(value: 'single-set' | 'best-of-3') => setFormData({ ...formData, matchFormat: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single-set">Single set (1 set wins)</SelectItem>
                      <SelectItem value="best-of-3">Best of 3 (first to 2 sets)</SelectItem>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="registrationOpen"
                    checked={formData.registrationOpen}
                    onCheckedChange={(checked) => setFormData({ ...formData, registrationOpen: checked === true })}
                  />
                  <Label htmlFor="registrationOpen">Registration Open</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isPublic"
                    checked={formData.isPublic}
                    onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked === true })}
                  />
                  <Label htmlFor="isPublic">Tournament Visible to Public</Label>
                </div>
              </div>

              </form>
            </div>
            <DialogFooter className="flex-shrink-0 px-6 pb-6 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" form="edit-tournament-form">
                Update Tournament
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Registration Drawer */}
        <Drawer open={editDrawerOpen} onOpenChange={setEditDrawerOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Edit Registration Details</DrawerTitle>
              <DrawerDescription>
                Update registration information for {selectedParticipant?.name}
              </DrawerDescription>
            </DrawerHeader>
            
            {selectedParticipant && (
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Basic Information</h3>
                    
                    <div className="space-y-2">
                      <Label htmlFor="edit-name">Name</Label>
                      <Input
                        id="edit-name"
                        value={selectedParticipant.name}
                        onChange={(e) => setSelectedParticipant({
                          ...selectedParticipant,
                          name: e.target.value
                        })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-phone">Phone</Label>
                      <Input
                        id="edit-phone"
                        value={selectedParticipant.phone}
                        onChange={(e) => setSelectedParticipant({
                          ...selectedParticipant,
                          phone: e.target.value
                        })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-age">Age</Label>
                      <Input
                        id="edit-age"
                        type="number"
                        value={selectedParticipant.age}
                        onChange={(e) => setSelectedParticipant({
                          ...selectedParticipant,
                          age: parseInt(e.target.value) || 0
                        })}
                      />
                    </div>
                  </div>

                  {/* Tournament Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Tournament Information</h3>
                    
                    <div className="space-y-2">
                      <Label htmlFor="edit-gender">Gender</Label>
                      <Select
                        value={selectedParticipant.gender}
                        onValueChange={(value) => setSelectedParticipant({
                          ...selectedParticipant,
                          gender: value as 'male' | 'female' | 'other'
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-level">Expertise Level</Label>
                      <Select
                        value={selectedParticipant.expertiseLevel}
                        onValueChange={(value) => setSelectedParticipant({
                          ...selectedParticipant,
                          expertiseLevel: value as 'beginner' | 'intermediate' | 'advanced' | 'expert'
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                          <SelectItem value="expert">Expert</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-category">Category</Label>
                      <Select
                        value={selectedParticipant.selectedCategory}
                        onValueChange={(value) => setSelectedParticipant({
                          ...selectedParticipant,
                          selectedCategory: value as CategoryType
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {tournament?.categories?.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category === 'girls-under-13' ? 'Girls Under 13' :
                               category === 'boys-under-13' ? 'Boys Under 13' :
                               category === 'girls-under-18' ? 'Girls Under 18' :
                               category === 'boys-under-18' ? 'Boys Under 18' :
                               category === 'mens-single' ? 'Mens Single' :
                               category === 'womens-single' ? 'Womens Single' :
                               category === 'mens-doubles' ? 'Mens Doubles' :
                               category === 'mixed-doubles' ? 'Mixed Doubles' :
                               category === 'mens-team' ? 'Mens Team' :
                               category === 'womens-team' ? 'Womens Team' :
                               category === 'kids-team-u13' ? 'Kids Team (U13)' :
                               category === 'kids-team-u18' ? 'Kids Team (U18)' :
                               category === 'open-team' ? 'Open Team' : category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-status">Registration Status</Label>
                      <Select
                        value={selectedParticipant.registrationStatus}
                        onValueChange={(value) => setSelectedParticipant({
                          ...selectedParticipant,
                          registrationStatus: value as 'pending' | 'approved' | 'rejected'
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Address Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Address Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-tower">Tower</Label>
                      <Input
                        id="edit-tower"
                        value={selectedParticipant.tower}
                        onChange={(e) => setSelectedParticipant({
                          ...selectedParticipant,
                          tower: e.target.value
                        })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-flat">Flat Number</Label>
                      <Input
                        id="edit-flat"
                        value={selectedParticipant.flatNumber}
                        onChange={(e) => setSelectedParticipant({
                          ...selectedParticipant,
                          flatNumber: e.target.value
                        })}
                      />
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    Display format: {selectedParticipant.tower} {selectedParticipant.flatNumber}
                  </div>
                </div>

                {/* Partner Information (for team registrations) */}
                {(selectedParticipant.selectedCategory.includes('team') || selectedParticipant.selectedCategory === 'open-team') && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Partner Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-partner-name">Partner Name</Label>
                        <Input
                          id="edit-partner-name"
                          value={selectedParticipant.partnerName || ''}
                          onChange={(e) => setSelectedParticipant({
                            ...selectedParticipant,
                            partnerName: e.target.value
                          })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-partner-phone">Partner Phone</Label>
                        <Input
                          id="edit-partner-phone"
                          value={selectedParticipant.partnerPhone || ''}
                          onChange={(e) => setSelectedParticipant({
                            ...selectedParticipant,
                            partnerPhone: e.target.value
                          })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end space-x-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setEditDrawerOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      if (selectedParticipant) {
                        try {
                          // Filter out undefined values before updating
                          const updateData = Object.fromEntries(
                            Object.entries(selectedParticipant).filter(([_, value]) => value !== undefined)
                          );
                          
                          await updateDoc(doc(db, 'tournaments', tournamentId, 'registrations', selectedParticipant.id), {
                            ...updateData,
                            updatedAt: new Date()
                          });
                          
                          // Update local state
                          setParticipants(prev => 
                            prev.map(p => p.id === selectedParticipant.id ? selectedParticipant : p)
                          );
                          
                          setEditDrawerOpen(false);
                        } catch (error) {
                          console.error('Error updating registration:', error);
                        }
                      }
                    }}
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            )}
          </DrawerContent>
        </Drawer>
        
        {AlertDialogComponent}
      </div>
    </AdminLayout>
  );
}
