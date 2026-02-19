'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import {
  useTournament,
  useUpdateTournamentMutation,
} from '@/hooks/use-tournament-queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ImageUpload } from '@/components/ui/image-upload';
import { useAlertDialog } from '@/components/ui/alert-dialog-component';
import { Tournament, SportType, TournamentType, CategoryType } from '@/types';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';

const isAdminRole = (role: string) =>
  role === 'admin' || role === 'tournament-admin' || role === 'super-admin';

const toDateInputValue = (d: Date | string | undefined): string => {
  if (d == null) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
};

export default function EditTournamentPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const tournamentId = params.id as string;
  const { alert, AlertDialogComponent } = useAlertDialog();

  const queriesEnabled = !authLoading && !!user && isAdminRole(user.role) && !!tournamentId;
  const { data: tournamentData, isLoading: tournamentLoading } = useTournament(
    tournamentId,
    { enabled: queriesEnabled }
  );
  const updateTournamentMutation = useUpdateTournamentMutation();
  const tournament = tournamentData ?? null;

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
    isPublic: true,
    matchFormat: 'best-of-3' as 'single-set' | 'best-of-3',
    showTowerAndFlat: true,
    showEmergencyContact: true,
    showIsResident: true,
  });
  const [formPopulated, setFormPopulated] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || !isAdminRole(user.role))) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (authLoading || !queriesEnabled) return;
    if (!tournamentLoading && tournamentData === null) {
      router.push('/admin/tournaments');
      return;
    }
    if (
      tournament &&
      user?.role === 'tournament-admin' &&
      user.assignedTournaments &&
      !user.assignedTournaments.includes(tournamentId)
    ) {
      router.push('/admin/tournaments');
    }
  }, [authLoading, queriesEnabled, tournamentLoading, tournamentData, tournament, user, tournamentId, router]);

  // Populate form when tournament data loads
  useEffect(() => {
    if (tournament && !formPopulated) {
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
        matchFormat: tournament.matchFormat || 'best-of-3',
        showTowerAndFlat: tournament.showTowerAndFlat ?? true,
        showEmergencyContact: tournament.showEmergencyContact ?? true,
        showIsResident: tournament.showIsResident ?? true,
      });
      setFormPopulated(true);
    }
  }, [tournament, formPopulated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournament) return;

    try {
      const tournamentUpdateData: Partial<Tournament> = {
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
        showTowerAndFlat: formData.showTowerAndFlat,
        showEmergencyContact: formData.showEmergencyContact,
        showIsResident: formData.showIsResident,
        updatedAt: new Date(),
      };

      if (formData.maxParticipants && formData.maxParticipants.trim() !== '') {
        tournamentUpdateData.maxParticipants = parseInt(formData.maxParticipants);
      }
      if (formData.entryFee && formData.entryFee.trim() !== '') {
        tournamentUpdateData.entryFee = parseFloat(formData.entryFee);
      }
      if (formData.prizePool && formData.prizePool.trim() !== '') {
        tournamentUpdateData.prizePool = parseFloat(formData.prizePool);
      }
      if (formData.banner && formData.banner.trim() !== '') {
        tournamentUpdateData.banner = formData.banner;
      }

      await updateTournamentMutation.mutateAsync({
        tournamentId: tournament.id,
        data: { ...tournamentUpdateData, updatedAt: new Date() },
      });

      alert({
        title: 'Success',
        description: 'Tournament updated successfully!',
        variant: 'success'
      });
      router.push(`/admin/tournaments/${tournamentId}`);
    } catch (error) {
      console.error('Error updating tournament:', error);
      alert({
        title: 'Error',
        description: 'Failed to update tournament. Please try again.',
        variant: 'error'
      });
    }
  };

  if (authLoading || (queriesEnabled && tournamentLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 sm:h-32 sm:w-32 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600 sm:text-base">Loading tournament...</p>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return null;
  }

  return (
    <AdminLayout moduleName="Edit Tournament">
      <div className="min-w-0 px-4 py-4 sm:p-6 mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/admin/tournaments/${tournamentId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Edit Tournament</h1>
            <p className="text-sm text-gray-600">{tournament.name}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base sm:text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                <div className="space-y-2">
                  <Label htmlFor="venue">Venue</Label>
                  <Input
                    id="venue"
                    value={formData.venue}
                    onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                    required
                  />
                </div>
              </div>

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
            </CardContent>
          </Card>

          {/* Schedule & Capacity */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base sm:text-lg">Schedule & Capacity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                  <Label htmlFor="matchFormat">Match Format</Label>
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
            </CardContent>
          </Card>

          {/* Description & Rules */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base sm:text-lg">Description & Rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
          </Card>

          {/* Banner Image */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base sm:text-lg">Banner Image</CardTitle>
            </CardHeader>
            <CardContent>
              <ImageUpload
                label="Tournament Banner"
                value={formData.banner}
                onChange={(url) => setFormData({ ...formData, banner: url || '' })}
                aspectRatio="16/9"
                maxSize={5}
              />
            </CardContent>
          </Card>

          {/* Settings */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base sm:text-lg">Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
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

              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-semibold">Registration Form Fields</Label>
                  <p className="text-xs text-gray-500">Choose which optional fields appear on the public registration form</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="showTowerAndFlat"
                      checked={formData.showTowerAndFlat}
                      onCheckedChange={(checked) => setFormData({ ...formData, showTowerAndFlat: checked === true })}
                    />
                    <Label htmlFor="showTowerAndFlat">Tower & Flat Number</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="showEmergencyContact"
                      checked={formData.showEmergencyContact}
                      onCheckedChange={(checked) => setFormData({ ...formData, showEmergencyContact: checked === true })}
                    />
                    <Label htmlFor="showEmergencyContact">Emergency Contact</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="showIsResident"
                      checked={formData.showIsResident}
                      onCheckedChange={(checked) => setFormData({ ...formData, showIsResident: checked === true })}
                    />
                    <Label htmlFor="showIsResident">Resident Checkbox</Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pb-6">
            <Link href={`/admin/tournaments/${tournamentId}`}>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={updateTournamentMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {updateTournamentMutation.isPending ? 'Saving...' : 'Update Tournament'}
            </Button>
          </div>
        </form>

        {AlertDialogComponent}
      </div>
    </AdminLayout>
  );
}
