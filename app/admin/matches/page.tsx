'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy } from 'firebase/firestore';
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
import { Tournament, Match, Registration, MatchSet } from '@/types';
import { Plus, Edit, Trash2, Play, Pause, Trophy, Calendar, Clock, Users, Target } from 'lucide-react';
import Link from 'next/link';

export default function ManageMatchesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [participants, setParticipants] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [selectedTournament, setSelectedTournament] = useState<string>('all');
  const [formData, setFormData] = useState({
    tournamentId: '',
    round: '',
    matchNumber: '',
    player1Id: '',
    player2Id: '',
    scheduledTime: '',
    venue: '',
    court: '',
    referee: '',
    status: 'scheduled' as 'scheduled' | 'live' | 'completed' | 'cancelled' | 'postponed',
    notes: '',
  });

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/login');
    } else if (user?.role === 'admin') {
      loadTournaments();
      loadMatches();
    }
  }, [user, authLoading, router]);

  const loadTournaments = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'tournaments'));
      const tournamentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        endDate: doc.data().endDate?.toDate(),
        registrationDeadline: doc.data().registrationDeadline?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Tournament[];
      console.log('Tournaments loaded:', tournamentsData);
      setTournaments(tournamentsData);
      
      // Load participants after tournaments are loaded
      await loadParticipants();
    } catch (error) {
      console.error('Error loading tournaments:', error);
    }
  };

  const loadParticipants = async () => {
    try {
      const allParticipants: Registration[] = [];
      console.log('Starting to load participants for tournaments:', tournaments);
      console.log('Tournaments array length:', tournaments.length);
      
      if (tournaments.length === 0) {
        console.log('No tournaments available, skipping participant loading');
        setParticipants([]);
        return;
      }
      
      // Load participants from all tournaments' registrations subcollections
      for (const tournament of tournaments) {
        console.log(`Processing tournament: ${tournament.id} - ${tournament.name}`);
        try {
          // For debugging, let's also check what registration statuses exist
          const allRegistrationsSnapshot = await getDocs(collection(db, 'tournaments', tournament.id, 'registrations'));
          console.log(`All registrations for tournament ${tournament.id}:`, allRegistrationsSnapshot.docs.map(doc => ({ id: doc.id, status: doc.data().registrationStatus, name: doc.data().name })));
          
          // Include both approved and pending participants for match creation
          const q = query(
            collection(db, 'tournaments', tournament.id, 'registrations'), 
            where('registrationStatus', 'in', ['approved', 'pending'])
          );
          const snapshot = await getDocs(q);
          console.log(`Query results for tournament ${tournament.id}:`, snapshot.docs.length, 'documents');
          console.log(`Query docs:`, snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() })));
          const tournamentParticipants = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            tournamentId: tournament.id, // Add tournamentId for reference
            registeredAt: doc.data().registeredAt?.toDate(),
            approvedAt: doc.data().approvedAt?.toDate(),
          })) as Registration[];
          console.log(`Participants for tournament ${tournament.id}:`, tournamentParticipants);
          console.log(`Adding ${tournamentParticipants.length} participants to allParticipants`);
          allParticipants.push(...tournamentParticipants);
          console.log(`Total participants so far: ${allParticipants.length}`);
        } catch (error) {
          console.error(`Error loading participants for tournament ${tournament.id}:`, error);
          console.error('Error details:', error instanceof Error ? error.message : String(error), error instanceof Error ? (error as Error & { code?: string }).code : undefined);
        }
      }
      
      console.log('Total participants loaded:', allParticipants);
      setParticipants(allParticipants);
    } catch (error) {
      console.error('Error loading participants:', error);
    }
  };

  const loadMatches = async () => {
    try {
      const q = query(collection(db, 'matches'), orderBy('scheduledTime', 'asc'));
      const snapshot = await getDocs(q);
      const matchesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        scheduledTime: doc.data().scheduledTime?.toDate(),
        actualStartTime: doc.data().actualStartTime?.toDate(),
        actualEndTime: doc.data().actualEndTime?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Match[];
      setMatches(matchesData);
    } catch (error) {
      console.error('Error loading matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const player1 = participants.find(p => p.id === formData.player1Id);
      const player2 = participants.find(p => p.id === formData.player2Id);

      if (!player1 || !player2) {
        alert('Please select valid players');
        return;
      }

      const matchData = {
        tournamentId: formData.tournamentId,
        round: formData.round,
        matchNumber: parseInt(formData.matchNumber),
        player1Id: formData.player1Id,
        player1Name: player1.name,
        player2Id: formData.player2Id,
        player2Name: player2.name,
        scheduledTime: new Date(formData.scheduledTime),
        venue: formData.venue,
        court: formData.court || undefined,
        referee: formData.referee || undefined,
        status: formData.status,
        notes: formData.notes || undefined,
        sets: [],
        updatedAt: new Date(),
        createdBy: user?.id,
      };

      if (editingMatch) {
        await updateDoc(doc(db, 'matches', editingMatch.id), matchData);
      } else {
        await addDoc(collection(db, 'matches'), {
          ...matchData,
          createdAt: new Date(),
        });
      }

      setDialogOpen(false);
      resetForm();
      loadMatches();
    } catch (error) {
      console.error('Error saving match:', error);
      alert('Failed to save match');
    }
  };

  const handleEdit = (match: Match) => {
    setEditingMatch(match);
    setFormData({
      tournamentId: match.tournamentId,
      round: match.round,
      matchNumber: match.matchNumber.toString(),
      player1Id: match.player1Id,
      player2Id: match.player2Id,
      scheduledTime: new Date(match.scheduledTime).toISOString().slice(0, 16),
      venue: match.venue,
      court: match.court || '',
      referee: match.referee || '',
      status: match.status,
      notes: match.notes || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this match?')) {
      try {
        await deleteDoc(doc(db, 'matches', id));
        loadMatches();
      } catch (error) {
        console.error('Error deleting match:', error);
        alert('Failed to delete match');
      }
    }
  };

  const handleStatusChange = async (matchId: string, newStatus: 'scheduled' | 'live' | 'completed' | 'cancelled' | 'postponed') => {
    try {
      const updateData: Partial<Match> = {
        status: newStatus,
        updatedAt: new Date(),
      };

      if (newStatus === 'live') {
        updateData.actualStartTime = new Date();
      } else if (newStatus === 'completed') {
        updateData.actualEndTime = new Date();
      }

      await updateDoc(doc(db, 'matches', matchId), updateData);
      loadMatches();
    } catch (error) {
      console.error('Error updating match status:', error);
      alert('Failed to update match status');
    }
  };

  const resetForm = () => {
    setFormData({
      tournamentId: '',
      round: '',
      matchNumber: '',
      player1Id: '',
      player2Id: '',
      scheduledTime: '',
      venue: '',
      court: '',
      referee: '',
      status: 'scheduled',
      notes: '',
    });
    setEditingMatch(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'live': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'postponed': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return <Calendar className="h-4 w-4" />;
      case 'live': return <Play className="h-4 w-4" />;
      case 'completed': return <Trophy className="h-4 w-4" />;
      case 'cancelled': return <Trash2 className="h-4 w-4" />;
      case 'postponed': return <Pause className="h-4 w-4" />;
      default: return null;
    }
  };

  const filteredMatches = matches.filter(match => 
    selectedTournament === 'all' || match.tournamentId === selectedTournament
  );

  const tournamentParticipants = (tournamentId: string) => {
    const filtered = participants.filter(p => p.tournamentId === tournamentId);
    console.log('Tournament participants for', tournamentId, ':', filtered);
    console.log('All participants:', participants);
    return filtered;
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
          <p className="mt-4 text-gray-600">Loading matches...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout moduleName="Matches">
      <div className="p-6">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Match Management</h1>
            <p className="text-gray-600 mt-2">Create and manage tournament matches</p>
            <div className="mt-2 text-sm text-gray-500">
              <p>Tournaments: {tournaments.length} | Participants: {participants.length}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={async () => {
                if (tournaments.length > 0) {
                  const tournament = tournaments[0];
                  console.log('Creating test registration for tournament:', tournament.id);
                  try {
                    await addDoc(collection(db, 'tournaments', tournament.id, 'registrations'), {
                      name: 'Test Player',
                      email: 'test@example.com',
                      phone: '1234567890',
                      age: 25,
                      gender: 'male',
                      tower: 'A',
                      flatNumber: '101',
                      emergencyContact: '9876543210',
                      expertiseLevel: 'intermediate',
                      isResident: true,
                      selectedCategory: 'mens-single',
                      registrationStatus: 'approved',
                      paymentStatus: 'paid',
                      registrationCode: 'TEST001',
                      registeredAt: new Date(),
                    });
                    console.log('Test registration created successfully');
                    // Reload participants
                    await loadParticipants();
                  } catch (error) {
                    console.error('Error creating test registration:', error);
                  }
                } else {
                  console.log('No tournaments available to create test registration');
                }
              }}
            >
              Create Test Registration
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create Match
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingMatch ? 'Edit Match' : 'Create New Match'}
                </DialogTitle>
                <DialogDescription>
                  {editingMatch ? 'Update match details' : 'Fill in the match information'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tournamentId">Tournament *</Label>
                    <Select value={formData.tournamentId} onValueChange={(value) => {
                      console.log('Tournament selected:', value);
                      setFormData({ ...formData, tournamentId: value });
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select tournament" />
                      </SelectTrigger>
                      <SelectContent>
                        {tournaments.map(tournament => (
                          <SelectItem key={tournament.id} value={tournament.id}>
                            {tournament.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="round">Round *</Label>
                    <Input
                      id="round"
                      value={formData.round}
                      onChange={(e) => setFormData({ ...formData, round: e.target.value })}
                      placeholder="e.g., Quarter Final, Semi Final"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="matchNumber">Match Number *</Label>
                    <Input
                      id="matchNumber"
                      type="number"
                      value={formData.matchNumber}
                      onChange={(e) => setFormData({ ...formData, matchNumber: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="scheduledTime">Scheduled Time *</Label>
                    <Input
                      id="scheduledTime"
                      type="datetime-local"
                      value={formData.scheduledTime}
                      onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="player1Id">Player 1 *</Label>
                    <Select value={formData.player1Id} onValueChange={(value) => setFormData({ ...formData, player1Id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select player 1" />
                      </SelectTrigger>
                      <SelectContent>
                        {formData.tournamentId && (() => {
                          const availableParticipants = tournamentParticipants(formData.tournamentId);
                          console.log('Available participants for Player 1 dropdown:', availableParticipants);
                          return availableParticipants.map(participant => (
                            <SelectItem key={participant.id} value={participant.id}>
                              {participant.name}
                            </SelectItem>
                          ));
                        })()}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="player2Id">Player 2 *</Label>
                    <Select value={formData.player2Id} onValueChange={(value) => setFormData({ ...formData, player2Id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select player 2" />
                      </SelectTrigger>
                      <SelectContent>
                        {formData.tournamentId && (() => {
                          const availableParticipants = tournamentParticipants(formData.tournamentId);
                          console.log('Available participants for Player 2 dropdown:', availableParticipants);
                          return availableParticipants.map(participant => (
                            <SelectItem key={participant.id} value={participant.id}>
                              {participant.name}
                            </SelectItem>
                          ));
                        })()}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="venue">Venue *</Label>
                    <Input
                      id="venue"
                      value={formData.venue}
                      onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="court">Court</Label>
                    <Input
                      id="court"
                      value={formData.court}
                      onChange={(e) => setFormData({ ...formData, court: e.target.value })}
                      placeholder="e.g., Court 1, Court A"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="referee">Referee</Label>
                    <Input
                      id="referee"
                      value={formData.referee}
                      onChange={(e) => setFormData({ ...formData, referee: e.target.value })}
                      placeholder="Referee name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(value: 'scheduled' | 'live' | 'completed' | 'cancelled' | 'postponed') => setFormData({ ...formData, status: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="live">Live</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="postponed">Postponed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    placeholder="Additional notes about the match..."
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingMatch ? 'Update Match' : 'Create Match'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Debug Info */}
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="text-sm font-medium text-yellow-800 mb-2">Debug Information</h3>
          <div className="text-xs text-yellow-700">
            <p><strong>Tournaments:</strong> {tournaments.length}</p>
            <p><strong>Participants:</strong> {participants.length}</p>
            <p><strong>Selected Tournament:</strong> {formData.tournamentId || 'None'}</p>
            {formData.tournamentId && (
              <p><strong>Participants for Selected Tournament:</strong> {tournamentParticipants(formData.tournamentId).length}</p>
            )}
          </div>
        </div>

        {/* Tournament Filter */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Label htmlFor="tournamentFilter">Filter by Tournament:</Label>
              <Select value={selectedTournament} onValueChange={setSelectedTournament}>
                <SelectTrigger className="w-64">
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
          </CardContent>
        </Card>

        {/* Matches Table */}
        <Card>
          <CardHeader>
            <CardTitle>Matches ({filteredMatches.length})</CardTitle>
            <CardDescription>
              Manage tournament matches and their status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Match</TableHead>
                    <TableHead>Tournament</TableHead>
                    <TableHead>Players</TableHead>
                    <TableHead>Scheduled Time</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMatches.map((match) => {
                    const tournament = tournaments.find(t => t.id === match.tournamentId);
                    return (
                      <TableRow key={match.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{match.round} - Match {match.matchNumber}</p>
                            {match.court && <p className="text-sm text-gray-500">{match.court}</p>}
                          </div>
                        </TableCell>
                        <TableCell>{tournament?.name || 'Unknown'}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p><strong>{match.player1Name}</strong> vs <strong>{match.player2Name}</strong></p>
                            {match.winner && (
                              <p className="text-green-600">Winner: {match.winner}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{new Date(match.scheduledTime).toLocaleDateString()}</p>
                            <p className="text-gray-500">{new Date(match.scheduledTime).toLocaleTimeString()}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{match.venue}</p>
                            {match.referee && <p className="text-gray-500">Ref: {match.referee}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(match.status)}>
                            <span className="flex items-center gap-1">
                              {getStatusIcon(match.status)}
                              {match.status}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(match)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            {match.status === 'scheduled' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStatusChange(match.id, 'live')}
                                className="text-green-600 hover:text-green-700"
                              >
                                <Play className="h-4 w-4 mr-1" />
                                Start
                              </Button>
                            )}
                            {match.status === 'live' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStatusChange(match.id, 'completed')}
                                className="text-blue-600 hover:text-blue-700"
                              >
                                <Trophy className="h-4 w-4 mr-1" />
                                Complete
                              </Button>
                            )}
                            <Link href={`/admin/matches/${match.id}`}>
                              <Button size="sm" variant="outline">
                                <Target className="h-4 w-4 mr-1" />
                                Score
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(match.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {filteredMatches.length === 0 && (
              <div className="text-center py-8">
                <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No matches found</h3>
                <p className="text-gray-600 mb-4">Create your first match to get started</p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Match
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
    </AdminLayout>
  );
}
