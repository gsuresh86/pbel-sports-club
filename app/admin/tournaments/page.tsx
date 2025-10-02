'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tournament, SportType, TournamentType, CategoryType } from '@/types';
import { Plus, Edit, Trash2, Eye, Copy, Calendar, Users, Trophy, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function ManageTournamentsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
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
  });

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/login');
    } else if (user?.role === 'admin') {
      loadTournaments();
    }
  }, [user, authLoading, router]);

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

  const generateRegistrationLink = (tournamentId: string) => {
    return `${window.location.origin}/tournament/${tournamentId}/register`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const tournamentData = {
        name: formData.name,
        sport: formData.sport,
        tournamentType: formData.tournamentType,
        categories: formData.categories,
        startDate: new Date(formData.startDate),
        endDate: new Date(formData.endDate),
        venue: formData.venue,
        description: formData.description,
        registrationDeadline: new Date(formData.registrationDeadline),
        maxParticipants: parseInt(formData.maxParticipants),
        currentParticipants: 0,
        entryFee: formData.entryFee ? parseFloat(formData.entryFee) : undefined,
        prizePool: formData.prizePool ? parseFloat(formData.prizePool) : undefined,
        rules: formData.rules,
        status: formData.status,
        registrationOpen: formData.registrationOpen,
        updatedAt: new Date(),
        createdBy: user?.id,
      };

      if (editingTournament) {
        await updateDoc(doc(db, 'tournaments', editingTournament.id), tournamentData);
      } else {
        const docRef = await addDoc(collection(db, 'tournaments'), {
          ...tournamentData,
          createdAt: new Date(),
        });
        // Generate registration link after creation
        const registrationLink = generateRegistrationLink(docRef.id);
        await updateDoc(docRef, { publicRegistrationLink: registrationLink });
      }

      setDialogOpen(false);
      resetForm();
      loadTournaments();
    } catch (error) {
      console.error('Error saving tournament:', error);
      alert('Failed to save tournament');
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
      maxParticipants: tournament.maxParticipants.toString(),
      entryFee: tournament.entryFee?.toString() || '',
      prizePool: tournament.prizePool?.toString() || '',
      rules: tournament.rules || '',
      status: tournament.status,
      registrationOpen: tournament.registrationOpen,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this tournament?')) {
      try {
        await deleteDoc(doc(db, 'tournaments', id));
        loadTournaments();
      } catch (error) {
        console.error('Error deleting tournament:', error);
        alert('Failed to delete tournament');
      }
    }
  };

  const copyRegistrationLink = (link: string) => {
    navigator.clipboard.writeText(link);
    alert('Registration link copied to clipboard!');
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
    });
    setEditingTournament(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-100 text-blue-800';
      case 'ongoing': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tournament Management</h1>
            <p className="text-gray-600 mt-2">Create and manage tournaments</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create Tournament
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingTournament ? 'Edit Tournament' : 'Create New Tournament'}
                </DialogTitle>
                <DialogDescription>
                  {editingTournament ? 'Update tournament details' : 'Fill in the tournament information'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Tournament Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="sport">Sport *</Label>
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
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tournamentType">Tournament Type *</Label>
                    <Select value={formData.tournamentType} onValueChange={(value: TournamentType) => setFormData({ ...formData, tournamentType: value, categories: [] })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">Individual</SelectItem>
                        <SelectItem value="team">Team</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="categories">Categories *</Label>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {formData.tournamentType === 'individual' ? (
                        // Individual categories
                        ['girls-under-13', 'boys-under-13', 'girls-under-18', 'boys-under-18', 'mens-single', 'womens-single', 'mens-doubles', 'mixed-doubles'].map((cat) => (
                          <div key={cat} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={cat}
                              checked={formData.categories.includes(cat as CategoryType)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({ ...formData, categories: [...formData.categories, cat as CategoryType] });
                                } else {
                                  setFormData({ ...formData, categories: formData.categories.filter(c => c !== cat) });
                                }
                              }}
                              className="rounded"
                            />
                            <Label htmlFor={cat} className="text-sm">
                              {cat === 'girls-under-13' ? 'Girls Under 13' :
                               cat === 'boys-under-13' ? 'Boys Under 13' :
                               cat === 'girls-under-18' ? 'Girls Under 18' :
                               cat === 'boys-under-18' ? 'Boys Under 18' :
                               cat === 'mens-single' ? 'Mens Single' :
                               cat === 'womens-single' ? 'Womens Single' :
                               cat === 'mens-doubles' ? 'Mens Doubles' :
                               cat === 'mixed-doubles' ? 'Mixed Doubles' : cat}
                            </Label>
                          </div>
                        ))
                      ) : (
                        // Team categories
                        ['mens-team', 'womens-team', 'kids-team-u13', 'kids-team-u18'].map((cat) => (
                          <div key={cat} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={cat}
                              checked={formData.categories.includes(cat as CategoryType)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({ ...formData, categories: [...formData.categories, cat as CategoryType] });
                                } else {
                                  setFormData({ ...formData, categories: formData.categories.filter(c => c !== cat) });
                                }
                              }}
                              className="rounded"
                            />
                            <Label htmlFor={cat} className="text-sm">
                              {cat === 'mens-team' ? 'Mens Team' :
                               cat === 'womens-team' ? 'Womens Team' :
                               cat === 'kids-team-u13' ? 'Kids Team (U13)' :
                               cat === 'kids-team-u18' ? 'Kids Team (U18)' : cat}
                            </Label>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="maxParticipants">Max Participants *</Label>
                    <Input
                      id="maxParticipants"
                      type="number"
                      value={formData.maxParticipants}
                      onChange={(e) => setFormData({ ...formData, maxParticipants: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startDate">Start Date *</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">End Date *</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      required
                    />
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
                    <Label htmlFor="registrationDeadline">Registration Deadline *</Label>
                    <Input
                      id="registrationDeadline"
                      type="date"
                      value={formData.registrationDeadline}
                      onChange={(e) => setFormData({ ...formData, registrationDeadline: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="entryFee">Entry Fee (₹)</Label>
                    <Input
                      id="entryFee"
                      type="number"
                      step="0.01"
                      value={formData.entryFee}
                      onChange={(e) => setFormData({ ...formData, entryFee: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="prizePool">Prize Pool (₹)</Label>
                    <Input
                      id="prizePool"
                      type="number"
                      step="0.01"
                      value={formData.prizePool}
                      onChange={(e) => setFormData({ ...formData, prizePool: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="rules">Rules & Regulations</Label>
                  <Textarea
                    id="rules"
                    value={formData.rules}
                    onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
                    rows={4}
                    placeholder="Enter tournament rules and regulations..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(value: any) => setFormData({ ...formData, status: value })}>
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
                  <div className="flex items-center space-x-2 mt-6">
                    <input
                      type="checkbox"
                      id="registrationOpen"
                      checked={formData.registrationOpen}
                      onChange={(e) => setFormData({ ...formData, registrationOpen: e.target.checked })}
                      className="rounded"
                    />
                    <Label htmlFor="registrationOpen">Registration Open</Label>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingTournament ? 'Update Tournament' : 'Create Tournament'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6">
          {tournaments.map((tournament) => (
            <Card key={tournament.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-yellow-500" />
                      {tournament.name}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(tournament.startDate).toLocaleDateString()} - {new Date(tournament.endDate).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {tournament.currentParticipants || 0} participants
                        </span>
                      </div>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(tournament.status)}>
                      {tournament.status}
                    </Badge>
                    {tournament.registrationOpen && (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        Registration Open
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-2">Tournament Details</h4>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p><strong>Sport:</strong> {tournament.sport}</p>
                      <p><strong>Type:</strong> {tournament.tournamentType || 'individual'}</p>
                      <p><strong>Categories:</strong> {tournament.categories?.join(', ') || 'None'}</p>
                      <p><strong>Venue:</strong> {tournament.venue}</p>
                      <p><strong>Registration Deadline:</strong> {new Date(tournament.registrationDeadline).toLocaleDateString()}</p>
                      {tournament.entryFee && <p><strong>Entry Fee:</strong> ₹{tournament.entryFee}</p>}
                      {tournament.prizePool && <p><strong>Prize Pool:</strong> ₹{tournament.prizePool}</p>}
                      <p><strong>Current Participants:</strong> {tournament.currentParticipants || 0}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Registration Link</h4>
                    <div className="flex items-center gap-2">
                      <Input
                        value={tournament.publicRegistrationLink || generateRegistrationLink(tournament.id)}
                        readOnly
                        className="text-sm"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyRegistrationLink(tournament.publicRegistrationLink || generateRegistrationLink(tournament.id))}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                
                {tournament.description && (
                  <div className="mt-4">
                    <h4 className="font-semibold mb-2">Description</h4>
                    <p className="text-sm text-gray-600">{tournament.description}</p>
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-6">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => window.open(tournament.publicRegistrationLink || generateRegistrationLink(tournament.id), '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open Link
                  </Button>
                  <Link href={`/admin/tournaments/${tournament.id}`}>
                    <Button size="sm" variant="outline">
                      <Eye className="h-4 w-4 mr-1" />
                      View Details
                    </Button>
                  </Link>
                  <Button size="sm" variant="outline" onClick={() => handleEdit(tournament)}>
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(tournament.id)}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

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
    </div>
  );
}