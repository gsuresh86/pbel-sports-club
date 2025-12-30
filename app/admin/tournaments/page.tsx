'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { collection, getDocs, addDoc, updateDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Tournament, SportType, TournamentType, CategoryType } from '@/types';
import { ImageUpload } from '@/components/ui/image-upload';
import { useAlertDialog } from '@/components/ui/alert-dialog-component';
import { generateRegistrationLink } from '@/lib/utils';
import { Plus, Edit, Eye, Copy, Calendar, Users, Trophy, ExternalLink, Search, Filter, MapPin, Clock, DollarSign, Users2, Shuffle, Target, LayoutGrid, List } from 'lucide-react';
import Link from 'next/link';

const sports = [
  { value: 'badminton', label: 'Badminton', icon: '🏸' },
  { value: 'table-tennis', label: 'Table Tennis', icon: '🏓' },
  { value: 'volleyball', label: 'Volleyball', icon: '🏐' },
  { value: 'tennis', label: 'Tennis', icon: '🎾' },
  { value: 'basketball', label: 'Basketball', icon: '🏀' },
  { value: 'football', label: 'Football', icon: '⚽' },
  { value: 'cricket', label: 'Cricket', icon: '🏏' },
  { value: 'throw-ball', label: 'Throw Ball', icon: '🏐' },
  { value: 'other', label: 'Other Sport', icon: '🏆' }
];

export default function ManageTournamentsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { alert, AlertDialogComponent } = useAlertDialog();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [filteredTournaments, setFilteredTournaments] = useState<Tournament[]>([]);
  const [tournamentStats, setTournamentStats] = useState<{[key: string]: {registrations: number, players: number}}>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sportFilter, setSportFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
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
  });

  useEffect(() => {
    if (!authLoading && (!user || (user.role !== 'admin' && user.role !== 'tournament-admin' && user.role !== 'super-admin'))) {
      router.push('/login');
    } else if (user?.role === 'admin' || user?.role === 'tournament-admin' || user?.role === 'super-admin') {
      loadTournaments();
    }
  }, [user, authLoading, router]);

  // Filter tournaments based on search and filters
  useEffect(() => {
    let filtered = tournaments;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(tournament =>
        tournament.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tournament.sport.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tournament.venue.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(tournament => tournament.status === statusFilter);
    }

    // Sport filter
    if (sportFilter !== 'all') {
      filtered = filtered.filter(tournament => tournament.sport === sportFilter);
    }

    setFilteredTournaments(filtered);
  }, [tournaments, searchTerm, statusFilter, sportFilter]);

  const loadTournaments = async () => {
    try {
      const q = query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      let tournamentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        endDate: doc.data().endDate?.toDate(),
        registrationDeadline: doc.data().registrationDeadline?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Tournament[];

      // Filter tournaments based on user permissions
      if (user?.role === 'tournament-admin' && user.assignedTournaments) {
        tournamentsData = tournamentsData.filter(tournament => 
          user.assignedTournaments?.includes(tournament.id)
        );
      }

      setTournaments(tournamentsData);
      
      // Load tournament statistics
      await loadTournamentStats(tournamentsData);
    } catch (error) {
      console.error('Error loading tournaments:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTournamentStats = async (tournamentsData: Tournament[]) => {
    try {
      const stats: {[key: string]: {registrations: number, players: number}} = {};
      
      for (const tournament of tournamentsData) {
        // Get registrations count
        const registrationsSnapshot = await getDocs(collection(db, 'tournaments', tournament.id, 'registrations'));
        const registrationsCount = registrationsSnapshot.docs.length;
        
        // Get players count
        const playersSnapshot = await getDocs(collection(db, 'tournaments', tournament.id, 'players'));
        const playersCount = playersSnapshot.docs.length;
        
        stats[tournament.id] = {
          registrations: registrationsCount,
          players: playersCount
        };
      }
      
      setTournamentStats(stats);
    } catch (error) {
      console.error('Error loading tournament stats:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        currentParticipants: 0,
        rules: formData.rules,
        status: formData.status,
        registrationOpen: formData.registrationOpen,
        isPublic: formData.isPublic,
        updatedAt: new Date(),
        createdBy: user?.id,
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

      if (editingTournament) {
        await updateDoc(doc(db, 'tournaments', editingTournament.id), tournamentData);
      } else {
        const docRef = await addDoc(collection(db, 'tournaments'), {
          ...tournamentData,
          createdAt: new Date(),
        });
        // Registration link is now generated on-the-fly, no need to store it
        
        // Notify admins about new tournament
        try {
          const { notifyAdminsNewTournament } = await import('@/lib/notification-utils');
          await notifyAdminsNewTournament(formData.name, docRef.id);
        } catch (error) {
          console.error('Error sending notification:', error);
          // Don't fail the tournament creation if notification fails
        }
      }

      setDialogOpen(false);
      resetForm();
      loadTournaments();
    } catch (error) {
      console.error('Error saving tournament:', error);
      alert({
        title: 'Error',
        description: 'Failed to save tournament. Please try again.',
        variant: 'error'
      });
    }
  };

  const handleEdit = (tournament: Tournament) => {
    setEditingTournament(tournament);
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
      isPublic: (tournament as any).isPublic !== undefined ? (tournament as any).isPublic : true,
    });
    setDialogOpen(true);
  };

  const copyRegistrationLink = (link: string) => {
    navigator.clipboard.writeText(link);
    alert({
      title: 'Success',
      description: 'Registration link copied to clipboard!',
      variant: 'success'
    });
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
    });
    setEditingTournament(null);
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

  const getSportIcon = (sport: string) => {
    switch (sport) {
      case 'badminton': return '🏸';
      case 'table-tennis': return '🏓';
      case 'volleyball': return '🏐';
      case 'throw-ball': return '🏐';
      default: return '🏆';
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading || authLoading) {
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
    <AdminLayout moduleName="Tournaments">
      <div className="p-6">
   

        {/* Search and Filters - Compact Layout */}
        <div className="mb-6">
          <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center">
            {/* Search Input - More Compact */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search tournaments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9 focus-ring-thin"
              />
            </div>
            
            {/* Filter Dropdowns - Improved Layout */}
            <div className="flex gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-9 focus-ring-thin">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={sportFilter} onValueChange={setSportFilter}>
                <SelectTrigger className="w-36 h-9 focus-ring-thin">
                  <SelectValue placeholder="Sport" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sports</SelectItem>
                  <SelectItem value="badminton">Badminton</SelectItem>
                  <SelectItem value="table-tennis">Table Tennis</SelectItem>
                  <SelectItem value="volleyball">Volleyball</SelectItem>
                  <SelectItem value="throw-ball">Throw Ball</SelectItem>
                </SelectContent>
              </Select>
              
              {/* View Toggle */}
              <div className="flex items-center gap-1 border rounded-md p-1">
                <Button
                  variant={viewMode === 'card' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setViewMode('card')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setViewMode('table')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
              
              {(user?.role === 'admin' || user?.role === 'super-admin') && (
                <Button onClick={() => setDialogOpen(true)} className="h-9">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Tournament
                </Button>
              )}
            </div>
          </div>
          
          {/* Results count - Compact */}
          <div className="mt-2 text-sm text-gray-600">
            Showing {filteredTournaments.length} of {tournaments.length} tournaments
          </div>
        </div>

        {/* Tournaments View */}
        {viewMode === 'card' ? (
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {filteredTournaments.map((tournament) => (
            <Card key={tournament.id} className="hover:shadow-lg transition-all duration-200 hover:scale-[1.02]">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <span className="text-2xl">{getSportIcon(tournament.sport)}</span>
                      <span className="truncate">{tournament.name}</span>
                    </CardTitle>
                    <CardDescription className="mt-2 space-y-1">
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(tournament.startDate)} - {formatDate(tournament.endDate)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{tournament.venue}</span>
                      </div>
                    </CardDescription>
                  </div>
                </div>
                
                {/* Status Badges - Moved below title */}
                <div className="flex gap-2 mt-3">
                  <Badge className={`${getStatusColor(tournament.status)} text-xs`}>
                    {tournament.status}
                  </Badge>
                  {tournament.registrationOpen && (
                    <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                      Open
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-4">
                  {/* Key Stats - 2x2 Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <Users className="h-4 w-4 text-blue-500" />
                      <div>
                        <p className="text-xs text-gray-500">Registrations</p>
                        <p className="text-sm font-semibold">{tournamentStats[tournament.id]?.registrations || 0}/{tournament.maxParticipants || '∞'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <Trophy className="h-4 w-4 text-purple-500" />
                      <div>
                        <p className="text-xs text-gray-500">Players</p>
                        <p className="text-sm font-semibold">{tournamentStats[tournament.id]?.players || 0}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <Clock className="h-4 w-4 text-orange-500" />
                      <div>
                        <p className="text-xs text-gray-500">Deadline</p>
                        <p className="text-sm font-semibold">{formatDate(tournament.registrationDeadline)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <DollarSign className="h-4 w-4 text-green-500" />
                      <div>
                        <p className="text-xs text-gray-500">Entry Fee</p>
                        <p className="text-sm font-semibold">₹{tournament.entryFee || 'Free'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Registration Link */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-700">Registration Link</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={generateRegistrationLink(tournament.id)}
                        readOnly
                        className="text-xs h-8"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2"
                        onClick={() => copyRegistrationLink(generateRegistrationLink(tournament.id))}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1 text-xs"
                      onClick={() => router.push(`/admin/tournaments/${tournament.id}`)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Details
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1 text-xs"
                      onClick={() => window.open(generateRegistrationLink(tournament.id), '_blank')}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Open
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => handleEdit(tournament)}>
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  </div>
                  
                  {/* Management Buttons */}
                  <div className="grid grid-cols-3 gap-1">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-xs h-8"
                        onClick={() => router.push(`/admin/tournaments/${tournament.id}?tab=teams`)}
                      >
                        <Users2 className="h-3 w-3 mr-1" />
                        Teams
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-xs h-8"
                        onClick={() => router.push(`/admin/tournaments/${tournament.id}?tab=spin-wheel`)}
                      >
                        <Shuffle className="h-3 w-3 mr-1" />
                        Spin
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-xs h-8"
                        onClick={() => router.push(`/admin/tournaments/${tournament.id}?tab=pools`)}
                      >
                        <Target className="h-3 w-3 mr-1" />
                        Pools
                      </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            ))}
          </div>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tournament</TableHead>
                  <TableHead>Sport</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Venue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Participants</TableHead>
                  <TableHead>Registration</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTournaments.map((tournament) => (
                  <TableRow key={tournament.id} className="hover:bg-gray-50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getSportIcon(tournament.sport)}</span>
                        <div>
                          <div className="font-medium">{tournament.name}</div>
                          <div className="text-sm text-gray-500">{tournament.tournamentType}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {tournament.sport.replace('-', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{formatDate(tournament.startDate)}</div>
                        <div className="text-gray-500">to {formatDate(tournament.endDate)}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3 text-gray-400" />
                        <span>{tournament.venue}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(tournament.status)}>
                        {tournament.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-gray-400" />
                          <span>{tournamentStats[tournament.id]?.registrations || 0} registered</span>
                        </div>
                        {tournament.maxParticipants && (
                          <div className="text-gray-500">
                            / {tournament.maxParticipants} max
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={tournament.registrationOpen ? 'default' : 'secondary'}>
                        {tournament.registrationOpen ? 'Open' : 'Closed'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push(`/admin/tournaments/${tournament.id}`)}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(tournament)}
                          title="Edit Tournament"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            navigator.clipboard.writeText(generateRegistrationLink(tournament.id));
                            alert({
                              title: 'Copied!',
                              description: 'Registration link copied to clipboard',
                              variant: 'success'
                            });
                          }}
                          title="Copy Registration Link"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Empty States */}
        {filteredTournaments.length === 0 && tournaments.length > 0 && !loading && (
          <div className="text-center py-12">
            <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tournaments found</h3>
            <p className="text-gray-600 mb-4">Try adjusting your search or filter criteria</p>
            <Button variant="outline" onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
              setSportFilter('all');
            }}>
              Clear Filters
            </Button>
          </div>
        )}

        {tournaments.length === 0 && !loading && (
          <div className="text-center py-12">
            <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tournaments yet</h3>
            <p className="text-gray-600 mb-4">Create your first tournament to get started</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Tournament
            </Button>
          </div>
        )}
      </div>

      {/* Create/Edit Tournament Drawer */}
      <Drawer open={dialogOpen} onOpenChange={setDialogOpen}>
        <DrawerContent side="right" className="max-w-2xl">
          <DrawerHeader className="flex-shrink-0">
            <DrawerTitle>{editingTournament ? 'Edit Tournament' : 'Create Tournament'}</DrawerTitle>
            <DrawerDescription>
              {editingTournament ? 'Update tournament details and settings' : 'Create a new tournament'}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tournament Name - Full Width */}
            <div className="space-y-2">
              <Label htmlFor="name">Tournament Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            
            {/* Sport and Tournament Type - Second Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sport">Sport</Label>
                <Select value={formData.sport} onValueChange={(value: SportType) => {
                  const newFormData = { ...formData, sport: value };
                  // Auto-set tournament type to "team" for volleyball and throw-ball
                  if (value === 'volleyball' || value === 'throw-ball') {
                    newFormData.tournamentType = 'team';
                  }
                  setFormData(newFormData);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select sport" />
                  </SelectTrigger>
                  <SelectContent>
                    {sports.map((sport) => (
                      <SelectItem key={sport.value} value={sport.value}>
                        {sport.icon} {sport.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tournamentType">Tournament Type</Label>
                <Select 
                  value={formData.tournamentType} 
                  onValueChange={(value: TournamentType) => setFormData({ ...formData, tournamentType: value })}
                  disabled={formData.sport === 'volleyball' || formData.sport === 'throw-ball'}
                >
                  <SelectTrigger className={formData.sport === 'volleyball' || formData.sport === 'throw-ball' ? 'opacity-50' : ''}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="team">Team</SelectItem>
                  </SelectContent>
                </Select>
                
              </div>
            </div>
            
            {/* Categories */}
            <div className="space-y-2">
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

            {/* Dates, Registration, and Tournament Details - 2 Column Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <DrawerFooter className="flex-shrink-0">
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}>
                Cancel
              </Button>
              <Button type="submit" onClick={handleSubmit}>
                {editingTournament ? 'Update Tournament' : 'Create Tournament'}
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
      
      {AlertDialogComponent}
    </AdminLayout>
  );
}