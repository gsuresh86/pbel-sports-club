'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tournament } from '@/types';
import { useAlertDialog } from '@/components/ui/alert-dialog-component';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { cloneTournament, deleteTournament } from '@/lib/tournament-api';
import { generateRegistrationLink } from '@/lib/utils';
import { canAccessTournamentConsole, isSystemAdmin } from '@/lib/permissions';
import { TournamentFormDrawer } from '@/components/admin/TournamentFormDrawer';
import { Plus, Edit, Eye, Copy, CopyPlus, Trash2, Loader2, Calendar, Users, Trophy, ExternalLink, Search, Filter, MapPin, Clock, DollarSign, LayoutGrid, List } from 'lucide-react';

export default function ManageTournamentsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { alert, AlertDialogComponent } = useAlertDialog();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [operationTournamentId, setOperationTournamentId] = useState<string | null>(null);
  const [filteredTournaments, setFilteredTournaments] = useState<Tournament[]>([]);
  const [tournamentStats, setTournamentStats] = useState<{[key: string]: {registrations: number, players: number}}>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sportFilter, setSportFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const openedEditFromUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!authLoading && !canAccessTournamentConsole(user)) {
      router.push('/login');
    } else if (user && canAccessTournamentConsole(user)) {
      loadTournaments();
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    let filtered = tournaments;

    if (searchTerm) {
      filtered = filtered.filter(tournament =>
        tournament.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tournament.sport.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tournament.venue.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(tournament => tournament.status === statusFilter);
    }

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

      if (user && !isSystemAdmin(user.role)) {
        const assignedIds = user.assignedTournaments ?? [];
        tournamentsData = tournamentsData.filter(tournament =>
          assignedIds.includes(tournament.id)
        );
      }

      setTournaments(tournamentsData);
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
        const registrationsSnapshot = await getDocs(collection(db, 'tournaments', tournament.id, 'registrations'));
        const registrationsCount = registrationsSnapshot.docs.length;

        const seen = new Set<string>();
        for (const d of registrationsSnapshot.docs) {
          const data = d.data();
          const name = typeof data.name === 'string' ? data.name.trim().toLowerCase() : '';
          const partner = typeof data.partnerName === 'string' ? data.partnerName.trim().toLowerCase() : '';
          if (name) seen.add(name);
          if (partner) seen.add(partner);
        }

        stats[tournament.id] = {
          registrations: registrationsCount,
          players: seen.size,
        };
      }

      setTournamentStats(stats);
    } catch (error) {
      console.error('Error loading tournament stats:', error);
    }
  };

  const handleEdit = useCallback((tournament: Tournament) => {
    setEditingTournament(tournament);
    setDialogOpen(true);
  }, []);

  const handleCreate = () => {
    setEditingTournament(null);
    setDialogOpen(true);
  };

  const handleDrawerOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingTournament(null);
  };

  // The tournament console links here with ?edit=<id>. Reuse this drawer so
  // every edit entry point has the same fields and behavior.
  useEffect(() => {
    const editId = new URLSearchParams(window.location.search).get('edit');
    if (!editId || openedEditFromUrlRef.current === editId) return;

    const tournament = tournaments.find((item) => item.id === editId);
    if (!tournament) return;

    openedEditFromUrlRef.current = editId;
    handleEdit(tournament);
    window.history.replaceState(window.history.state, '', '/admin/tournaments');
  }, [handleEdit, tournaments]);

  const copyRegistrationLink = (link: string) => {
    navigator.clipboard.writeText(link);
    alert({
      title: 'Success',
      description: 'Registration link copied to clipboard!',
      variant: 'success'
    });
  };

  const isFullAdmin = user?.role === 'admin' || user?.role === 'super-admin';

  const handleCloneTournament = (tournament: Tournament) => {
    confirm({
      title: 'Clone Tournament',
      description: `Create a full copy of "${tournament.name}" including registrations, teams, pools, matches, brackets, and winners? The copy will be set to upcoming with registration closed.`,
      confirmText: 'Clone',
      onConfirm: async () => {
        setOperationTournamentId(tournament.id);
        try {
          const newId = await cloneTournament(tournament.id, user!.id, {
            newName: `${tournament.name} (Copy)`,
          });
          await loadTournaments();
          alert({
            title: 'Tournament Cloned',
            description: `"${tournament.name} (Copy)" was created with all data.`,
            variant: 'success',
          });
          router.push(`/admin/tournaments/${newId}/overview`);
        } catch (error) {
          console.error('Error cloning tournament:', error);
          alert({
            title: 'Clone Failed',
            description: 'Failed to clone tournament. Please try again.',
            variant: 'error',
          });
        } finally {
          setOperationTournamentId(null);
        }
      },
    });
  };

  const handleDeleteTournament = (tournament: Tournament) => {
    confirm({
      title: 'Delete Tournament',
      description: `Permanently delete "${tournament.name}" and all related data (registrations, teams, pools, matches, brackets, winners)? This cannot be undone.`,
      confirmText: 'Delete',
      variant: 'destructive',
      onConfirm: async () => {
        setOperationTournamentId(tournament.id);
        try {
          await deleteTournament(tournament.id);
          await loadTournaments();
          alert({
            title: 'Tournament Deleted',
            description: `"${tournament.name}" and all related data have been removed.`,
            variant: 'success',
          });
        } catch (error) {
          console.error('Error deleting tournament:', error);
          alert({
            title: 'Delete Failed',
            description: 'Failed to delete tournament. Please try again.',
            variant: 'error',
          });
        } finally {
          setOperationTournamentId(null);
        }
      },
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
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search tournaments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9 focus-ring-thin"
              />
            </div>

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
                <Button onClick={handleCreate} className="h-9">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Tournament
                </Button>
              )}
            </div>
          </div>

          <div className="mt-2 text-sm text-gray-600">
            Showing {filteredTournaments.length} of {tournaments.length} tournaments
          </div>
        </div>

        {viewMode === 'card' ? (
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {filteredTournaments.map((tournament) => (
            <Card key={tournament.id} className="hover:shadow-lg transition-all duration-200 hover:scale-[1.02] overflow-hidden p-0 gap-0">
              {tournament.banner ? (
                <div className="w-full h-36 overflow-hidden">
                  <img src={tournament.banner} alt={tournament.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-full h-36 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  <span className="text-5xl opacity-40">{getSportIcon(tournament.sport)}</span>
                </div>
              )}

              <CardHeader className="pt-4 pb-3">
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
              <CardContent className="pt-0 pb-5">
                <div className="space-y-4">
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
                        <p className="text-xs text-gray-500">Unique Players</p>
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

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs"
                      onClick={() => router.push(`/admin/tournaments/${tournament.id}/overview`)}
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
                  {isFullAdmin && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs"
                        disabled={operationTournamentId === tournament.id}
                        onClick={() => handleCloneTournament(tournament)}
                      >
                        {operationTournamentId === tournament.id ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <CopyPlus className="h-3 w-3 mr-1" />
                        )}
                        Clone
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        disabled={operationTournamentId === tournament.id}
                        onClick={() => handleDeleteTournament(tournament)}
                      >
                        {operationTournamentId === tournament.id ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3 mr-1" />
                        )}
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            ))}
          </div>
        ) : (
          <Card className="rounded-none">
            <div className="overflow-auto max-h-[calc(100dvh-18rem)]">
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
                          onClick={() => router.push(`/admin/tournaments/${tournament.id}/overview`)}
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
                        {isFullAdmin && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={operationTournamentId === tournament.id}
                              onClick={() => handleCloneTournament(tournament)}
                              title="Clone Tournament"
                            >
                              {operationTournamentId === tournament.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CopyPlus className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              disabled={operationTournamentId === tournament.id}
                              onClick={() => handleDeleteTournament(tournament)}
                              title="Delete Tournament"
                            >
                              {operationTournamentId === tournament.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </Card>
        )}

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
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Tournament
            </Button>
          </div>
        )}
      </div>

      <TournamentFormDrawer
        open={dialogOpen}
        onOpenChange={handleDrawerOpenChange}
        tournament={editingTournament}
        onSaved={() => loadTournaments()}
      />

      {AlertDialogComponent}
      {ConfirmDialogComponent}
    </AdminLayout>
  );
}
