'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { collection, getDocs, updateDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tournament, Registration, Player } from '@/types';
import { Search, Users, CheckCircle, XCircle, Clock, Download, Filter } from 'lucide-react';

export default function ManageRegistrationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [registrations, setRegistrations] = useState<(Registration & { tournamentId: string; tournamentName: string })[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTournament, setSelectedTournament] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (!authLoading && (!user || (user.role !== 'admin' && user.role !== 'super-admin' && user.role !== 'tournament-admin'))) {
      router.push('/login');
    } else if (user?.role === 'admin' || user?.role === 'super-admin' || user?.role === 'tournament-admin') {
      loadData();
    }
  }, [user, authLoading, router]);

  const loadData = async () => {
    setLoading(true);
    await loadTournaments();
    // loadRegistrations will be called after tournaments are loaded
  };

  useEffect(() => {
    if (tournaments.length > 0) {
      loadRegistrations();
    }
  }, [tournaments]);

  const loadTournaments = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'tournaments'));
      let tournamentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        endDate: doc.data().endDate?.toDate(),
        registrationDeadline: doc.data().registrationDeadline?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Tournament[];

      // Filter tournaments based on user role
      if (user?.role === 'tournament-admin' && user.assignedTournaments) {
        tournamentsData = tournamentsData.filter(tournament => 
          user.assignedTournaments?.includes(tournament.id)
        );
      }

      setTournaments(tournamentsData);
    } catch (error) {
      console.error('Error loading tournaments:', error);
    }
  };

  const loadRegistrations = async () => {
    try {
      const allRegistrations: (Registration & { tournamentId: string; tournamentName: string })[] = [];
      
      // Load registrations from all tournaments' subcollections
      for (const tournament of tournaments) {
        const registrationsSnapshot = await getDocs(collection(db, 'tournaments', tournament.id, 'registrations'));
        const tournamentRegistrations = registrationsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          tournamentId: tournament.id, // Add tournamentId for reference
          tournamentName: tournament.name, // Add tournament name for display
          registeredAt: doc.data().registeredAt?.toDate(),
          approvedAt: doc.data().approvedAt?.toDate(),
        })) as (Registration & { tournamentId: string; tournamentName: string })[];
        
        allRegistrations.push(...tournamentRegistrations);
      }
      
      // Sort by registration date
      allRegistrations.sort((a, b) => (b.registeredAt?.getTime() || 0) - (a.registeredAt?.getTime() || 0));
      
      setRegistrations(allRegistrations);
    } catch (error) {
      console.error('Error loading registrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (participantId: string, newStatus: 'approved' | 'rejected') => {
    try {
      const updateData: Partial<Registration> = {
        registrationStatus: newStatus,
      };

      if (newStatus === 'approved') {
        updateData.approvedAt = new Date();
        updateData.approvedBy = user?.id;
      }

      const participant = registrations.find(p => p.id === participantId);
      if (!participant || !participant.tournamentId) {
        throw new Error('Participant or tournament ID not found');
      }

      await updateDoc(doc(db, 'tournaments', participant.tournamentId, 'registrations', participantId), updateData);
      
      // Update local state
      setRegistrations(prev => prev.map(p => 
        p.id === participantId 
          ? { ...p, registrationStatus: newStatus, approvedAt: newStatus === 'approved' ? new Date() : undefined, approvedBy: newStatus === 'approved' ? user?.id : undefined }
          : p
      ));

      // Update tournament participant count
      const participantForCount = registrations.find(p => p.id === participantId);
      if (participantForCount && newStatus === 'approved') {
        const tournament = tournaments.find(t => t.id === participantForCount.tournamentId);
        if (tournament) {
          await updateDoc(doc(db, 'tournaments', tournament.id), {
            currentParticipants: tournament.currentParticipants + 1
          });
        }
      }
    } catch (error) {
      console.error('Error updating participant status:', error);
      alert('Failed to update participant status');
    }
  };

  const filteredParticipants = registrations.filter(participant => {
    const tournament = tournaments.find(t => t.id === participant.tournamentId);
    const matchesTournament = selectedTournament === 'all' || participant.tournamentId === selectedTournament;
    const matchesSearch = searchTerm === '' || 
      participant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      participant.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      participant.phone.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || participant.registrationStatus === statusFilter;
    
    return matchesTournament && matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
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
      case 'failed': return 'bg-red-100 text-red-800';
      case 'refunded': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="h-4 w-4" />;
      case 'rejected': return <XCircle className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      default: return null;
    }
  };

  const exportParticipants = () => {
    const csvContent = [
      ['Name', 'Email', 'Phone', 'Age', 'Gender', 'Tower', 'Flat Number', 'Level', 'Tournament', 'Status', 'Registration Date', 'Partner Name', 'Partner Phone'].join(','),
      ...filteredParticipants.map(p => {
        const tournament = tournaments.find(t => t.id === p.tournamentId);
        return [
          p.name,
          p.email,
          p.phone,
          p.age,
          p.gender,
          p.tower,
          p.flatNumber,
          p.expertiseLevel,
          tournament?.name || 'Unknown',
          p.registrationStatus,
          new Date(p.registeredAt).toLocaleDateString(),
          p.partnerName || '',
          p.partnerPhone || ''
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `participants-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
          <p className="mt-4 text-gray-600">Loading registrations...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout moduleName="Registrations">
      <div className="p-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Registration Management</h1>
          <p className="text-gray-600">Manage tournament registrations and approvals</p>
        </div>

        {/* Filters and Search */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters & Search
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="tournament">Tournament</Label>
                <Select value={selectedTournament} onValueChange={setSelectedTournament}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tournaments</SelectItem>
                    {tournaments.map(tournament => (
                      <SelectItem key={tournament.id} value={tournament.id}>
                        {tournament.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="search"
                    placeholder="Search by name, email, or phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex items-end">
                <Button onClick={exportParticipants} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Registrations</p>
                  <p className="text-2xl font-bold">{registrations.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-yellow-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold">{registrations.filter(p => p.registrationStatus === 'pending').length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Approved</p>
                  <p className="text-2xl font-bold">{registrations.filter(p => p.registrationStatus === 'approved').length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <XCircle className="h-8 w-8 text-red-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Rejected</p>
                  <p className="text-2xl font-bold">{registrations.filter(p => p.registrationStatus === 'rejected').length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Registrations Table */}
        <Card>
          <CardHeader>
            <CardTitle>Registrations ({filteredParticipants.length})</CardTitle>
            <CardDescription>
              Manage registration approvals and tournament access permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                    <TableHead>Level</TableHead>
                    <TableHead>Tournament</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Registration Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredParticipants.map((participant) => {
                    const tournament = tournaments.find(t => t.id === participant.tournamentId);
                    return (
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
                          <Badge variant="outline" className="capitalize">
                            {participant.expertiseLevel}
                          </Badge>
                        </TableCell>
                        <TableCell>{tournament?.name || 'Unknown'}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(participant.registrationStatus)}>
                            <span className="flex items-center gap-1">
                              {getStatusIcon(participant.registrationStatus)}
                              {participant.registrationStatus}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge className={getPaymentStatusColor(participant.paymentStatus)}>
                              {participant.paymentStatus}
                            </Badge>
                            {participant.paymentReference && (
                              <div className="text-xs text-gray-500">
                                Ref: {participant.paymentReference}
                              </div>
                            )}
                            {participant.paymentMethod && (
                              <div className="text-xs text-gray-500">
                                {participant.paymentMethod.replace('_', ' ')}
                              </div>
                            )}
                            {participant.paymentAmount && (
                              <div className="text-xs text-gray-500">
                                ₹{participant.paymentAmount}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{new Date(participant.registeredAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {participant.registrationStatus === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleStatusChange(participant.id, 'approved')}
                                  className="text-green-600 hover:text-green-700"
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleStatusChange(participant.id, 'rejected')}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Reject
                                </Button>
                              </>
                            )}
                            {participant.registrationStatus === 'approved' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStatusChange(participant.id, 'rejected')}
                                className="text-red-600 hover:text-red-700"
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            )}
                            {participant.registrationStatus === 'rejected' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStatusChange(participant.id, 'approved')}
                                className="text-green-600 hover:text-green-700"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {filteredParticipants.length === 0 && (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No registrations found</h3>
                <p className="text-gray-600">Try adjusting your filters or search terms</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
