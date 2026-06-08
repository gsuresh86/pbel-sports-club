'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  useTournament,
  useTournamentRegistrations,
  useInvalidateTournament,
} from '@/hooks/use-tournament-queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Registration, CategoryType } from '@/types';
import { parsePaymentRecipient } from '@/lib/utils';
import { Download, Edit, Users } from 'lucide-react';
import VolunteersListDrawer from '@/components/admin/VolunteersListDrawer';
import { dedupeByNamePhone } from '@/lib/utils';

const isAdminRole = (role: string) =>
  role === 'admin' || role === 'tournament-admin' || role === 'super-admin';

function getRegistrationStatusColor(status: string) {
  switch (status) {
    case 'approved': return 'bg-green-100 text-green-800';
    case 'rejected': return 'bg-red-100 text-red-800';
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function formatCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    'girls-under-13': 'Girls Under 13',
    'boys-under-13': 'Boys Under 13',
    'girls-under-18': 'Girls Under 18',
    'boys-under-18': 'Boys Under 18',
    'mens-single': 'Mens Single',
    'womens-single': 'Womens Single',
    'mens-doubles': 'Mens Doubles',
    'mixed-doubles': 'Mixed Doubles',
    'mens-team': 'Mens Team',
    'womens-team': 'Womens Team',
    'kids-team-u13': 'Kids Team (U13)',
    'kids-team-u18': 'Kids Team (U18)',
    'open-team': 'Open Team',
  };
  return labels[category] ?? category;
}

export default function ParticipantsPage() {
  const { user } = useAuth();
  const params = useParams();
  const tournamentId = params.id as string;
  const queriesEnabled = !!user && isAdminRole(user.role) && !!tournamentId;

  const { data: tournamentData } = useTournament(tournamentId, { enabled: queriesEnabled });
  const { data: registrationsData = [] } = useTournamentRegistrations(tournamentId, { enabled: queriesEnabled });
  const invalidateTournament = useInvalidateTournament();

  const tournament = tournamentData ?? null;
  const participants = registrationsData;

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<Registration | null>(null);
  const [volunteersDrawerOpen, setVolunteersDrawerOpen] = useState(false);

  const filteredParticipants = useMemo(() => {
    let filtered = participants;
    if (categoryFilter !== 'all') filtered = filtered.filter((p) => p.selectedCategory === categoryFilter);
    if (levelFilter !== 'all') filtered = filtered.filter((p) => p.expertiseLevel === levelFilter);
    if (genderFilter !== 'all') filtered = filtered.filter((p) => p.gender === genderFilter);
    return filtered;
  }, [participants, categoryFilter, levelFilter, genderFilter]);

  const volunteersList = useMemo(
    () => dedupeByNamePhone(participants.filter((p) => p.isVolunteer === true)).sort((a, b) => a.name.localeCompare(b.name)),
    [participants],
  );

  const exportParticipants = () => {
    const showTower = tournament?.showTowerAndFlat ?? true;
    const headers = ['Name', 'Phone', 'Age', 'Gender', ...(showTower ? ['Tower/Flat'] : []), 'Level', 'Category', 'Status', 'Partner Name', 'Partner Phone'];
    const csvContent = [
      headers.join(','),
      ...filteredParticipants.map((p) => [
        p.name, p.phone, p.age, p.gender,
        ...(showTower ? [`${p.tower || ''} ${p.flatNumber || ''}`] : []),
        p.expertiseLevel, p.selectedCategory, p.registrationStatus, p.partnerName || '', p.partnerPhone || '',
      ].join(',')),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tournament?.name}-participants-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!tournament) return null;

  return (
    <div className="flex h-[calc(100dvh-14rem)] min-h-[280px] flex-col gap-3 overflow-hidden">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold sm:text-lg">Registrations ({filteredParticipants.length})</h3>
          <p className="text-xs text-gray-600 sm:text-sm">Manage tournament registrations</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="All Categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {tournament.categories?.map((cat) => (
                <SelectItem key={cat} value={cat}>{formatCategoryLabel(cat)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="All Levels" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="beginner">Beginner</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
              <SelectItem value="expert">Expert</SelectItem>
            </SelectContent>
          </Select>
          <Select value={genderFilter} onValueChange={setGenderFilter}>
            <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="All Genders" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Genders</SelectItem>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          {(categoryFilter !== 'all' || levelFilter !== 'all' || genderFilter !== 'all') && (
            <Button
              variant="ghost" size="sm"
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => { setCategoryFilter('all'); setLevelFilter('all'); setGenderFilter('all'); }}
            >
              Clear
            </Button>
          )}
          <Button onClick={exportParticipants} size="sm">
            <Download className="h-4 w-4 mr-2" />Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          {filteredParticipants.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <div>
                <Users className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                <h3 className="mb-2 text-lg font-medium text-gray-900">
                  {participants.length === 0 ? 'No registrations yet' : 'No registrations match the current filters'}
                </h3>
                <p className="text-gray-600">
                  {participants.length === 0
                    ? 'Registrations will appear here once users register for this tournament.'
                    : 'Try adjusting your filter criteria to see more results.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="registrations-table-scroll min-h-0 flex-1 overflow-auto sm:mx-0">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm">Name</TableHead>
                    <TableHead className="text-xs sm:text-sm">Phone</TableHead>
                    <TableHead className="text-xs sm:text-sm">Age</TableHead>
                    <TableHead className="text-xs sm:text-sm">Gender</TableHead>
                    {(tournament.showTowerAndFlat ?? true) && <TableHead className="text-xs sm:text-sm">Tower/Flat</TableHead>}
                    <TableHead className="text-xs sm:text-sm">Category</TableHead>
                    <TableHead className="text-xs sm:text-sm">Level</TableHead>
                    <TableHead className="text-xs sm:text-sm">Status</TableHead>
                    <TableHead className="text-xs sm:text-sm">Paid To</TableHead>
                    <TableHead className="text-xs sm:text-sm w-12">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredParticipants.map((participant) => (
                    <TableRow key={participant.id}>
                      <TableCell className="font-medium text-xs sm:text-sm py-2">{participant.name}</TableCell>
                      <TableCell className="text-xs sm:text-sm py-2">{participant.phone}</TableCell>
                      <TableCell className="text-xs sm:text-sm py-2">{participant.age}</TableCell>
                      <TableCell className="capitalize text-xs sm:text-sm py-2">{participant.gender}</TableCell>
                      {(tournament.showTowerAndFlat ?? true) && (
                        <TableCell className="text-xs sm:text-sm py-2">
                          <span className="whitespace-nowrap">{participant.tower || ''} {participant.flatNumber || ''}</span>
                        </TableCell>
                      )}
                      <TableCell className="py-2">
                        <Badge variant="outline" className="capitalize text-[10px] sm:text-xs">
                          {participant.selectedCategory.replace('-', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant="outline" className="capitalize text-[10px] sm:text-xs">{participant.expertiseLevel}</Badge>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge className={`text-[10px] sm:text-xs ${getRegistrationStatusColor(participant.registrationStatus)}`}>
                          {participant.registrationStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm py-2 max-w-[140px]">
                        {(() => {
                          const recipient = parsePaymentRecipient(participant.selectedPaymentAccount);
                          if (!recipient?.name) return <span className="text-muted-foreground">—</span>;
                          return (
                            <span className="block truncate font-medium" title={recipient.number ? `${recipient.name} (${recipient.number})` : recipient.name}>
                              {recipient.name}
                            </span>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="py-2">
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => { setSelectedParticipant(participant); setEditDrawerOpen(true); }}
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
          )}
        </CardContent>
      </Card>

      {/* Edit Registration Drawer */}
      <Drawer open={editDrawerOpen} onOpenChange={setEditDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Edit Registration Details</DrawerTitle>
            <DrawerDescription>Update registration information for {selectedParticipant?.name}</DrawerDescription>
          </DrawerHeader>
          {selectedParticipant && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Basic Information</h3>
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Name</Label>
                    <Input id="edit-name" value={selectedParticipant.name} onChange={(e) => setSelectedParticipant({ ...selectedParticipant, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-phone">Phone</Label>
                    <Input id="edit-phone" value={selectedParticipant.phone} onChange={(e) => setSelectedParticipant({ ...selectedParticipant, phone: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-age">Age</Label>
                    <Input id="edit-age" type="number" value={selectedParticipant.age} onChange={(e) => setSelectedParticipant({ ...selectedParticipant, age: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Tournament Information</h3>
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select value={selectedParticipant.gender} onValueChange={(v) => setSelectedParticipant({ ...selectedParticipant, gender: v as 'male' | 'female' | 'other' })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Expertise Level</Label>
                    <Select value={selectedParticipant.expertiseLevel} onValueChange={(v) => setSelectedParticipant({ ...selectedParticipant, expertiseLevel: v as 'beginner' | 'intermediate' | 'advanced' | 'expert' })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                        <SelectItem value="expert">Expert</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={selectedParticipant.selectedCategory} onValueChange={(v) => setSelectedParticipant({ ...selectedParticipant, selectedCategory: v as CategoryType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {tournament.categories?.map((cat) => (
                          <SelectItem key={cat} value={cat}>{formatCategoryLabel(cat)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Registration Status</Label>
                    <Select value={selectedParticipant.registrationStatus} onValueChange={(v) => setSelectedParticipant({ ...selectedParticipant, registrationStatus: v as 'pending' | 'approved' | 'rejected' })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {(tournament.showTowerAndFlat ?? true) && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Address Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-tower">Tower</Label>
                      <Input id="edit-tower" value={selectedParticipant.tower || ''} onChange={(e) => setSelectedParticipant({ ...selectedParticipant, tower: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-flat">Flat Number</Label>
                      <Input id="edit-flat" value={selectedParticipant.flatNumber || ''} onChange={(e) => setSelectedParticipant({ ...selectedParticipant, flatNumber: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}

              {(selectedParticipant.selectedCategory.includes('team') || selectedParticipant.selectedCategory === 'open-team') && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Partner Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Partner Name</Label>
                      <Input value={selectedParticipant.partnerName || ''} onChange={(e) => setSelectedParticipant({ ...selectedParticipant, partnerName: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Partner Phone</Label>
                      <Input value={selectedParticipant.partnerPhone || ''} onChange={(e) => setSelectedParticipant({ ...selectedParticipant, partnerPhone: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setEditDrawerOpen(false)}>Cancel</Button>
                <Button
                  onClick={async () => {
                    try {
                      const updateData = Object.fromEntries(
                        Object.entries(selectedParticipant).filter(([, value]) => value !== undefined),
                      );
                      await updateDoc(doc(db, 'tournaments', tournamentId, 'registrations', selectedParticipant.id), {
                        ...updateData,
                        updatedAt: new Date(),
                      });
                      invalidateTournament(tournamentId);
                      setEditDrawerOpen(false);
                    } catch (error) {
                      console.error('Error updating registration:', error);
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

      <VolunteersListDrawer
        open={volunteersDrawerOpen}
        onOpenChange={setVolunteersDrawerOpen}
        volunteers={volunteersList}
        tournamentName={tournament.name}
      />
    </div>
  );
}
