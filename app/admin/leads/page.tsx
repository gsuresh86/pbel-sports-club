'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { 
  collection, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  addDoc,
  where,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Tournament, TournamentType, CategoryType, User, SportType } from '@/types';
import { useAlertDialog } from '@/components/ui/alert-dialog-component';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { 
  Search, 
  CheckCircle,
  XCircle,
  Mail,
  Phone,
  Calendar,
  Trophy,
  Trash2,
  Eye,
  Clock
} from 'lucide-react';

interface Lead {
  id: string;
  sport: string;
  tournamentName?: string;
  startDate?: Date | null;
  endDate?: Date | null;
  name: string;
  email: string;
  phone: string;
  tournamentId?: string;
  registeredAt: Date;
  status: 'pending' | 'approved' | 'declined';
  declinedReason?: string;
  approvedAt?: Date;
  declinedAt?: Date;
}

export default function LeadsManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { alert, AlertDialogComponent } = useAlertDialog();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [newTournamentId, setNewTournamentId] = useState<string | null>(null);
  const [newTournamentName, setNewTournamentName] = useState<string>('');
  const [matchedUsers, setMatchedUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [newUserPassword, setNewUserPassword] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sportFilter, setSportFilter] = useState<string>('all');
  const [tournamentFormData, setTournamentFormData] = useState({
    name: '',
    sport: '',
    tournamentType: 'individual' as TournamentType,
    categories: [] as CategoryType[],
    startDate: '',
    endDate: '',
    registrationDeadline: '',
    venue: '',
    description: '',
    maxParticipants: '',
    entryFee: '',
    prizePool: '',
    rules: '',
    status: 'upcoming' as const,
    registrationOpen: true,
  });
  const [declineReason, setDeclineReason] = useState('');

  useEffect(() => {
    if (!authLoading && (!user || (user.role !== 'admin' && user.role !== 'super-admin' && user.role !== 'tournament-admin'))) {
      router.push('/login');
    } else if (user && (user.role === 'admin' || user.role === 'super-admin' || user.role === 'tournament-admin')) {
      loadData();
    }
  }, [user, authLoading, router]);

  // Filter leads based on search and filters
  useEffect(() => {
    let filtered = leads;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(lead =>
        lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.tournamentName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(lead => lead.status === statusFilter);
    }

    // Sport filter
    if (sportFilter !== 'all') {
      filtered = filtered.filter(lead => lead.sport === sportFilter);
    }

    setFilteredLeads(filtered);
  }, [leads, searchTerm, statusFilter, sportFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load leads
      const leadsQuery = query(collection(db, 'tournamentLeads'), orderBy('registeredAt', 'desc'));
      const leadsSnapshot = await getDocs(leadsQuery);
      const leadsData = leadsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        registeredAt: doc.data().registeredAt?.toDate() || new Date(),
        startDate: doc.data().startDate?.toDate() || null,
        endDate: doc.data().endDate?.toDate() || null,
        approvedAt: doc.data().approvedAt?.toDate() || null,
        declinedAt: doc.data().declinedAt?.toDate() || null,
      })) as Lead[];

      setLeads(leadsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMatchedUsers = async (email: string) => {
    try {
      const usersQuery = query(
        collection(db, 'users'),
        where('email', '==', email.trim().toLowerCase())
      );
      const snapshot = await getDocs(usersQuery);
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as User[];
      setMatchedUsers(usersData);
      if (usersData.length > 0) {
        setSelectedUserId(usersData[0].id);
      } else {
        setSelectedUserId('new');
      }
    } catch (error) {
      console.error('Error loading matched users:', error);
      setMatchedUsers([]);
      setSelectedUserId('new');
    }
  };

  const handleApprove = (lead: Lead) => {
    setSelectedLead(lead);
    // Pre-fill tournament form with lead data
    setTournamentFormData({
      name: lead.tournamentName || `${lead.sport.charAt(0).toUpperCase() + lead.sport.slice(1)} Tournament`,
      sport: lead.sport as SportType,
      tournamentType: 'individual',
      categories: [],
      startDate: lead.startDate ? new Date(lead.startDate).toISOString().split('T')[0] : '',
      endDate: lead.endDate ? new Date(lead.endDate).toISOString().split('T')[0] : '',
      registrationDeadline: lead.startDate ? new Date(new Date(lead.startDate).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : '',
      venue: '',
      description: `Tournament requested by ${lead.name}`,
      maxParticipants: '',
      entryFee: '',
      prizePool: '',
      rules: '',
      status: 'upcoming',
      registrationOpen: true,
    });
    setApproveDialogOpen(true);
  };

  const handleDecline = (lead: Lead) => {
    setSelectedLead(lead);
    setDeclineReason('');
    setDeclineDialogOpen(true);
  };

  const handleApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedLead) return;

    try {
      // Create tournament
      const tournamentData: Partial<Tournament> = {
        name: tournamentFormData.name,
        sport: tournamentFormData.sport as SportType,
        tournamentType: tournamentFormData.tournamentType,
        categories: tournamentFormData.categories,
        startDate: new Date(tournamentFormData.startDate),
        endDate: new Date(tournamentFormData.endDate),
        venue: tournamentFormData.venue || 'TBD',
        description: tournamentFormData.description,
        registrationDeadline: new Date(tournamentFormData.registrationDeadline),
        currentParticipants: 0,
        rules: tournamentFormData.rules || 'Standard tournament rules apply.',
        status: tournamentFormData.status,
        registrationOpen: tournamentFormData.registrationOpen,
        updatedAt: new Date(),
        createdBy: user?.id || '',
      };

      // Add optional fields
      if (tournamentFormData.maxParticipants && tournamentFormData.maxParticipants.trim() !== '') {
        tournamentData.maxParticipants = parseInt(tournamentFormData.maxParticipants);
      }
      if (tournamentFormData.entryFee && tournamentFormData.entryFee.trim() !== '') {
        tournamentData.entryFee = parseFloat(tournamentFormData.entryFee);
      }
      if (tournamentFormData.prizePool && tournamentFormData.prizePool.trim() !== '') {
        tournamentData.prizePool = parseFloat(tournamentFormData.prizePool);
      }

      const tournamentRef = await addDoc(collection(db, 'tournaments'), {
        ...tournamentData,
        createdAt: new Date(),
      });

      // Update lead status to approved and link to tournament
      await updateDoc(doc(db, 'tournamentLeads', selectedLead.id), {
        status: 'approved',
        tournamentId: tournamentRef.id,
        approvedAt: new Date(),
        approvedBy: user?.id,
      });

      setNewTournamentId(tournamentRef.id);
      setNewTournamentName(tournamentFormData.name);

      // Load any existing users matching the lead email for easy assignment
      await loadMatchedUsers(selectedLead.email);

      alert({
        title: 'Tournament Created',
        description: 'Tournament created successfully! Now assign a user to manage this tournament.',
        variant: 'success'
      });
      setApproveDialogOpen(false);
      setAssignDialogOpen(true);
      loadData();
    } catch (error: unknown) {
      console.error('Error creating tournament:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create tournament';
      alert({
        title: 'Error',
        description: errorMessage,
        variant: 'error'
      });
    }
  };

  const handleDeclineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedLead) return;

    try {
      await updateDoc(doc(db, 'tournamentLeads', selectedLead.id), {
        status: 'declined',
        declinedReason: declineReason,
        declinedAt: new Date(),
        declinedBy: user?.id,
      });

      alert({
        title: 'Lead Declined',
        description: 'Lead declined successfully',
        variant: 'success'
      });
      setDeclineDialogOpen(false);
      setSelectedLead(null);
      setDeclineReason('');
      loadData();
    } catch (error) {
      console.error('Error declining lead:', error);
      alert({
        title: 'Error',
        description: 'Failed to decline lead',
        variant: 'error'
      });
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedLead || !newTournamentId) return;

    try {
      let assignedUserId: string | null = null;

      if (selectedUserId && selectedUserId !== 'new') {
        // Assign existing user by updating their assignedTournaments
        const userRef = doc(db, 'users', selectedUserId);
        await updateDoc(userRef, {
          assignedTournaments: arrayUnion(newTournamentId),
          updatedAt: new Date(),
        });
        assignedUserId = selectedUserId;
      } else {
        // Create new tournament-admin user from lead
        if (!newUserPassword || newUserPassword.trim().length < 6) {
          alert({
            title: 'Invalid Password',
            description: 'Password must be at least 6 characters long for the new user',
            variant: 'error'
          });
          return;
        }

        const response = await fetch('/api/create-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: selectedLead.email,
            password: newUserPassword,
            name: selectedLead.name,
            role: 'tournament-admin',
            assignedTournaments: [newTournamentId],
            isActive: true,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to create user');
        }

        assignedUserId = result.userId as string;
      }

      if (assignedUserId) {
        // Update lead with assigned admin reference
        await updateDoc(doc(db, 'tournamentLeads', selectedLead.id), {
          assignedAdminUserId: assignedUserId,
          updatedAt: new Date(),
        });
      }

      alert({
        title: 'Success',
        description: 'User assignment updated successfully',
        variant: 'success'
      });
      setAssignDialogOpen(false);
      setSelectedLead(null);
      setNewTournamentId(null);
      setNewTournamentName('');
      setMatchedUsers([]);
      setSelectedUserId('');
      setNewUserPassword('');
      loadData();
    } catch (error: unknown) {
      console.error('Error assigning user to tournament:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to assign user';
      alert({
        title: 'Error',
        description: errorMessage,
        variant: 'error'
      });
    }
  };

  const handleDelete = async (leadId: string) => {
    confirm({
      title: 'Delete Lead',
      description: 'Are you sure you want to delete this lead? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'tournamentLeads', leadId));
          alert({
            title: 'Success',
            description: 'Lead deleted successfully',
            variant: 'success'
          });
          loadData();
        } catch (error) {
          console.error('Error deleting lead:', error);
          alert({
            title: 'Error',
            description: 'Failed to delete lead',
            variant: 'error'
          });
        }
      }
    });
  };

  const getStatusColor = (status: Lead['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'declined':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSportIcon = (sport: string) => {
    const icons: Record<string, string> = {
      'badminton': '🏸',
      'table-tennis': '🏓',
      'volleyball': '🏐',
      'tennis': '🎾',
      'basketball': '🏀',
      'football': '⚽',
      'cricket': '🏏',
      'other': '🏆'
    };
    return icons[sport] || '🏆';
  };

  if (authLoading || loading) {
    return (
      <AdminLayout moduleName="Leads Management">
        <div className="p-6 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading leads...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!user || (user.role !== 'admin' && user.role !== 'super-admin' && user.role !== 'tournament-admin')) {
    return null;
  }

  const uniqueSports = Array.from(new Set(leads.map(lead => lead.sport))).filter(Boolean);

  return (
    <AdminLayout moduleName="Leads Management">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Tournament Leads</h1>
          <p className="text-gray-600">Review and approve/decline tournament registration requests</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Leads</p>
                  <p className="text-2xl font-bold text-gray-900">{leads.length}</p>
                </div>
                <Trophy className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {leads.filter(l => l.status === 'pending').length}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Approved</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {leads.filter(l => l.status === 'approved').length}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Declined</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {leads.filter(l => l.status === 'declined').length}
                  </p>
                </div>
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by name, email, phone, or tournament name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full lg:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sportFilter} onValueChange={setSportFilter}>
                <SelectTrigger className="w-full lg:w-[180px]">
                  <SelectValue placeholder="Filter by sport" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sports</SelectItem>
                  {uniqueSports.map(sport => (
                    <SelectItem key={sport} value={sport}>
                      {getSportIcon(sport)} {sport.charAt(0).toUpperCase() + sport.slice(1).replace('-', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Leads Table */}
        <Card>
          <CardHeader>
            <CardTitle>Leads ({filteredLeads.length})</CardTitle>
            <CardDescription>Review and manage tournament registration requests</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredLeads.length === 0 ? (
              <div className="text-center py-12">
                <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No leads found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Requester</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Tournament Details</TableHead>
                      <TableHead>Sport</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">{lead.name}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-3 w-3 text-gray-400" />
                              <span>{lead.email}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Phone className="h-3 w-3 text-gray-400" />
                              <span>{lead.phone}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-sm">
                              {lead.tournamentName || 'No tournament name provided'}
                            </div>
                            {lead.tournamentId && (
                              <Badge variant="outline" className="text-xs">
                                Tournament Created
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getSportIcon(lead.sport)} {lead.sport.charAt(0).toUpperCase() + lead.sport.slice(1).replace('-', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {lead.startDate && lead.endDate ? (
                            <div className="text-sm space-y-1">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>{new Date(lead.startDate).toLocaleDateString()}</span>
                              </div>
                              <div className="text-gray-600">to {new Date(lead.endDate).toLocaleDateString()}</div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">Not specified</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="h-3 w-3" />
                            <span>{new Date(lead.registeredAt).toLocaleDateString()}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(lead.status)}>
                            {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {lead.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleApprove(lead)}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleDecline(lead)}
                                  variant="destructive"
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Decline
                                </Button>
                              </>
                            )}
                            {lead.status === 'approved' && lead.tournamentId && (
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Tournament Created
                              </Badge>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(lead.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Approve Dialog - Create Tournament */}
        <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Approve Lead & Create Tournament</DialogTitle>
              <DialogDescription>
                Create a tournament based on the lead request from {selectedLead?.name}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleApproveSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tournamentName">Tournament Name *</Label>
                  <Input
                    id="tournamentName"
                    value={tournamentFormData.name}
                    onChange={(e) => setTournamentFormData({ ...tournamentFormData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="sport">Sport *</Label>
                  <Select
                    value={tournamentFormData.sport}
                    onValueChange={(value) => setTournamentFormData({ ...tournamentFormData, sport: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="badminton">Badminton</SelectItem>
                      <SelectItem value="table-tennis">Table Tennis</SelectItem>
                      <SelectItem value="volleyball">Volleyball</SelectItem>
                      <SelectItem value="tennis">Tennis</SelectItem>
                      <SelectItem value="basketball">Basketball</SelectItem>
                      <SelectItem value="football">Football</SelectItem>
                      <SelectItem value="cricket">Cricket</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={tournamentFormData.startDate}
                    onChange={(e) => setTournamentFormData({ ...tournamentFormData, startDate: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date *</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={tournamentFormData.endDate}
                    onChange={(e) => setTournamentFormData({ ...tournamentFormData, endDate: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="registrationDeadline">Registration Deadline *</Label>
                  <Input
                    id="registrationDeadline"
                    type="date"
                    value={tournamentFormData.registrationDeadline}
                    onChange={(e) => setTournamentFormData({ ...tournamentFormData, registrationDeadline: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="venue">Venue</Label>
                  <Input
                    id="venue"
                    value={tournamentFormData.venue}
                    onChange={(e) => setTournamentFormData({ ...tournamentFormData, venue: e.target.value })}
                    placeholder="Tournament venue"
                  />
                </div>
                <div>
                  <Label htmlFor="maxParticipants">Max Participants</Label>
                  <Input
                    id="maxParticipants"
                    type="number"
                    value={tournamentFormData.maxParticipants}
                    onChange={(e) => setTournamentFormData({ ...tournamentFormData, maxParticipants: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="entryFee">Entry Fee (₹)</Label>
                  <Input
                    id="entryFee"
                    type="number"
                    value={tournamentFormData.entryFee}
                    onChange={(e) => setTournamentFormData({ ...tournamentFormData, entryFee: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <Label htmlFor="prizePool">Prize Pool (₹)</Label>
                  <Input
                    id="prizePool"
                    type="number"
                    value={tournamentFormData.prizePool}
                    onChange={(e) => setTournamentFormData({ ...tournamentFormData, prizePool: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={tournamentFormData.description}
                  onChange={(e) => setTournamentFormData({ ...tournamentFormData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="rules">Rules</Label>
                <Textarea
                  id="rules"
                  value={tournamentFormData.rules}
                  onChange={(e) => setTournamentFormData({ ...tournamentFormData, rules: e.target.value })}
                  rows={3}
                  placeholder="Tournament rules and regulations"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setApproveDialogOpen(false);
                    setSelectedLead(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Create Tournament & Approve
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Decline Dialog */}
        <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Decline Lead</DialogTitle>
              <DialogDescription>
                Provide a reason for declining the tournament request from {selectedLead?.name}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleDeclineSubmit} className="space-y-4">
              <div>
                <Label htmlFor="declineReason">Reason for Decline</Label>
                <Textarea
                  id="declineReason"
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  rows={4}
                  placeholder="Enter reason for declining this tournament request..."
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDeclineDialogOpen(false);
                    setSelectedLead(null);
                    setDeclineReason('');
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="destructive">
                  <XCircle className="h-4 w-4 mr-2" />
                  Decline Lead
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Assign User Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Assign User to Tournament</DialogTitle>
              <DialogDescription>
                Assign an existing user or create a new tournament admin for&nbsp;
                <span className="font-semibold">{newTournamentName || 'this tournament'}</span>
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700">
                <p className="font-semibold mb-1">Lead Details</p>
                <p>Name: {selectedLead?.name}</p>
                <p>Email: {selectedLead?.email}</p>
                <p>Phone: {selectedLead?.phone}</p>
              </div>

              {matchedUsers.length > 0 && (
                <div className="space-y-2">
                  <Label>Existing Users with this Email</Label>
                  <div className="space-y-2 border rounded-md p-3 max-h-40 overflow-y-auto">
                    {matchedUsers.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="assignUser"
                          value={u.id}
                          checked={selectedUserId === u.id}
                          onChange={() => setSelectedUserId(u.id)}
                        />
                        <span className="font-medium">{u.name}</span>
                        <span className="text-gray-500">({u.email})</span>
                        {u.role && (
                          <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                            {u.role}
                          </span>
                        )}
                      </label>
                    ))}
                    <label className="flex items-center gap-2 text-sm cursor-pointer mt-2">
                      <input
                        type="radio"
                        name="assignUser"
                        value="new"
                        checked={selectedUserId === 'new'}
                        onChange={() => setSelectedUserId('new')}
                      />
                      <span>Create new tournament admin user from this lead</span>
                    </label>
                  </div>
                </div>
              )}

              {(matchedUsers.length === 0 || selectedUserId === 'new') && (
                <div className="space-y-2">
                  <Label htmlFor="newUserPassword">New User Password *</Label>
                  <Input
                    id="newUserPassword"
                    type="password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    minLength={6}
                    required={matchedUsers.length === 0 || selectedUserId === 'new'}
                  />
                  <p className="text-xs text-gray-500">
                    A new user with role <span className="font-semibold">tournament-admin</span> will be created
                    using the lead&apos;s name and email, and assigned to this tournament.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setAssignDialogOpen(false);
                    setSelectedLead(null);
                    setNewTournamentId(null);
                    setNewTournamentName('');
                    setMatchedUsers([]);
                    setSelectedUserId('');
                    setNewUserPassword('');
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  Save Assignment
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Alert and Confirm Dialogs */}
        {AlertDialogComponent}
        {ConfirmDialogComponent}
      </div>
    </AdminLayout>
  );
}
