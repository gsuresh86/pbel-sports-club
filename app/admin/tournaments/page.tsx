'use client';

import React, { useState, useEffect, useRef } from 'react';
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
import { Tournament, SportType, TournamentType, CategoryType, PaymentAccount, TournamentContact } from '@/types';
import { ImageUpload } from '@/components/ui/image-upload';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { useAlertDialog } from '@/components/ui/alert-dialog-component';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { cloneTournament, deleteTournament } from '@/lib/tournament-api';
import {
  buildTournamentContactsPayload,
  generateRegistrationLink,
  getTournamentContacts,
  normalizeTournamentContactsForForm,
} from '@/lib/utils';
import { Plus, Edit, Eye, Copy, CopyPlus, Trash2, Loader2, Calendar, Users, Trophy, ExternalLink, Search, Filter, MapPin, Clock, DollarSign, Users2, Shuffle, Target, LayoutGrid, List, ScrollText, X, MessageCircle } from 'lucide-react';
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

// --------------- inline bold/italic renderer ---------------
// Handles ***bold italic***, **bold**, *italic*
function renderInline(text: string): React.ReactNode {
  const INLINE = /(\*{3}[^*]+\*{3}|\*{2}[^*]+\*{2}|\*[^*]+\*)/g;
  const parts = text.split(INLINE);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('***') && part.endsWith('***'))
          return <strong key={i}><em>{part.slice(3, -3)}</em></strong>;
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('*') && part.endsWith('*') && part.length >= 3)
          return <em key={i}>{part.slice(1, -1)}</em>;
        return part || null;
      })}
    </>
  );
}

// --------------- rules preview ---------------
function RulesPreview({ rules }: { rules: string }) {
  const lines = rules.split('\n');
  const elements: React.ReactNode[] = [];
  let bulletBuf: string[] = [];
  let numBuf: string[] = [];
  let numStart = 1;
  let key = 0;

  const flush = () => {
    if (bulletBuf.length) {
      elements.push(
        <ul key={key++} className="list-disc list-outside ml-5 space-y-0.5 my-1.5">
          {bulletBuf.map((t, i) => <li key={i} className="text-gray-700 text-sm">{renderInline(t)}</li>)}
        </ul>
      );
      bulletBuf = [];
    }
    if (numBuf.length) {
      elements.push(
        <ol key={key++} start={numStart} className="list-decimal list-outside ml-5 space-y-0.5 my-1.5">
          {numBuf.map((t, i) => <li key={i} className="text-gray-700 text-sm">{renderInline(t)}</li>)}
        </ol>
      );
      numBuf = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); elements.push(<div key={key++} className="h-2" />); continue; }
    if (line.startsWith('## ')) { flush(); elements.push(<h3 key={key++} className="text-sm font-semibold text-gray-800 mt-3 mb-1">{renderInline(line.slice(3))}</h3>); continue; }
    if (line.startsWith('# '))  { flush(); elements.push(<h2 key={key++} className="text-base font-bold text-gray-900 mt-4 mb-1 pb-1 border-b border-gray-200 first:mt-0">{renderInline(line.slice(2))}</h2>); continue; }
    const bm = line.match(/^[-•]\s+(.+)/);
    if (bm) { if (numBuf.length) flush(); bulletBuf.push(bm[1]); continue; }
    const nm = line.match(/^(\d+)[.)]\s+(.+)/);
    if (nm) { if (bulletBuf.length) flush(); if (!numBuf.length) numStart = parseInt(nm[1]); numBuf.push(nm[2]); continue; }
    flush();
    elements.push(<p key={key++} className="text-gray-700 text-sm leading-relaxed">{renderInline(line)}</p>);
  }
  flush();

  return <div className="space-y-0.5">{elements}</div>;
}

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
  const [rulesDrawerOpen, setRulesDrawerOpen] = useState(false);
  const [rulesEditingTournament, setRulesEditingTournament] = useState<Tournament | null>(null);
  const [rulesContent, setRulesContent] = useState('');
  const [rulesSaving, setRulesSaving] = useState(false);
  const rulesTextareaRef = useRef<HTMLTextAreaElement>(null);

  const wrapSelection = (marker: string) => {
    const el = rulesTextareaRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const selected = value.slice(s, e);
    const before = value.slice(0, s);
    const after = value.slice(e);

    let newValue: string;
    let newS: number;
    let newE: number;

    if (selected) {
      // Toggle off if already wrapped
      if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length > marker.length * 2) {
        const inner = selected.slice(marker.length, selected.length - marker.length);
        newValue = before + inner + after;
        newS = s;
        newE = s + inner.length;
      } else {
        newValue = before + marker + selected + marker + after;
        newS = s + marker.length;
        newE = e + marker.length;
      }
    } else {
      const placeholder = marker === '**' ? 'bold text' : marker === '***' ? 'bold italic' : 'italic text';
      newValue = before + marker + placeholder + marker + after;
      newS = s + marker.length;
      newE = s + marker.length + placeholder.length;
    }

    setRulesContent(newValue);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(newS, newE);
    });
  };
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
    matchFormat: 'best-of-3' as 'single-set' | 'best-of-3' | 'best-of-3-15pt' | 'single-set-30',
    showTowerAndFlat: true,
    showEmergencyContact: true,
    showIsResident: true,
    showTshirtSize: false,
    showVolunteerNomination: false,
    paymentQrCode: '',
    whatsappGroupLink: '',
    contacts: [
      { name: '', phone: '' },
      { name: '', phone: '' },
    ] as TournamentContact[],
    doublesFee: '700',
    repeatFee: '300',
    paymentAccounts: [] as PaymentAccount[],
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
        const registrationsSnapshot = await getDocs(collection(db, 'tournaments', tournament.id, 'registrations'));
        const registrationsCount = registrationsSnapshot.docs.length;

        // Count unique individuals — same logic as the detail page's uniquePlayers
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
        matchFormat: formData.matchFormat,
        showTowerAndFlat: formData.showTowerAndFlat,
        showEmergencyContact: formData.showEmergencyContact,
        showIsResident: formData.showIsResident,
        showTshirtSize: formData.showTshirtSize,
        showVolunteerNomination: formData.showVolunteerNomination,
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
      if (formData.paymentQrCode && formData.paymentQrCode.trim() !== '') {
        tournamentData.paymentQrCode = formData.paymentQrCode;
      } else {
        tournamentData.paymentQrCode = null as unknown as string;
      }
      if (formData.whatsappGroupLink && formData.whatsappGroupLink.trim() !== '') {
        tournamentData.whatsappGroupLink = formData.whatsappGroupLink.trim();
      } else {
        tournamentData.whatsappGroupLink = null as unknown as string;
      }
      const contactsPayload = buildTournamentContactsPayload(formData.contacts);
      if (contactsPayload) {
        tournamentData.contacts = contactsPayload;
      } else {
        tournamentData.contacts = null as unknown as TournamentContact[];
      }
      tournamentData.contactName = null as unknown as string;
      tournamentData.contactPhone = null as unknown as string;
      if (formData.doublesFee && formData.doublesFee.trim() !== '') {
        tournamentData.doublesFee = parseFloat(formData.doublesFee);
      }
      if (formData.repeatFee && formData.repeatFee.trim() !== '') {
        tournamentData.repeatFee = parseFloat(formData.repeatFee);
      }
      tournamentData.paymentAccounts = formData.paymentAccounts.filter(a => a.name.trim() && a.number.trim());

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
      matchFormat: tournament.matchFormat || 'best-of-3',
      showTowerAndFlat: tournament.showTowerAndFlat ?? true,
      showEmergencyContact: tournament.showEmergencyContact ?? true,
      showIsResident: tournament.showIsResident ?? true,
      showTshirtSize: tournament.showTshirtSize ?? false,
      showVolunteerNomination: tournament.showVolunteerNomination ?? false,
      paymentQrCode: tournament.paymentQrCode || '',
      whatsappGroupLink: tournament.whatsappGroupLink || '',
      contacts: normalizeTournamentContactsForForm(getTournamentContacts(tournament)),
      doublesFee: tournament.doublesFee?.toString() || '700',
      repeatFee: tournament.repeatFee?.toString() || '300',
      paymentAccounts: tournament.paymentAccounts || [],
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
      showTowerAndFlat: true,
      showEmergencyContact: true,
      showIsResident: true,
      showTshirtSize: false,
      showVolunteerNomination: false,
      paymentQrCode: '',
      whatsappGroupLink: '',
      contacts: [
        { name: '', phone: '' },
        { name: '', phone: '' },
      ],
      doublesFee: '700',
      repeatFee: '300',
      paymentAccounts: [],
    });
    setEditingTournament(null);
  };

  const handleOpenRules = (tournament: Tournament) => {
    setRulesEditingTournament(tournament);
    setRulesContent(tournament.rules || '');
    setRulesDrawerOpen(true);
  };

  const handleSaveRules = async () => {
    if (!rulesEditingTournament) return;
    setRulesSaving(true);
    try {
      await updateDoc(doc(db, 'tournaments', rulesEditingTournament.id), {
        rules: rulesContent,
        updatedAt: new Date(),
      });
      setTournaments(prev =>
        prev.map(t => t.id === rulesEditingTournament.id ? { ...t, rules: rulesContent } : t)
      );
      // Also keep the main edit form in sync if editing the same tournament
      if (editingTournament?.id === rulesEditingTournament.id) {
        setFormData(prev => ({ ...prev, rules: rulesContent }));
      }
      setRulesDrawerOpen(false);
      alert({ title: 'Saved', description: 'Tournament rules updated successfully.', variant: 'success' });
    } catch {
      alert({ title: 'Error', description: 'Failed to save rules. Please try again.', variant: 'error' });
    } finally {
      setRulesSaving(false);
    }
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
            <Card key={tournament.id} className="hover:shadow-lg transition-all duration-200 hover:scale-[1.02] overflow-hidden p-0 gap-0">
              {/* Banner */}
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

                {/* Status Badges */}
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
          <DrawerHeader className="flex-shrink-0 border-b">
            <DrawerTitle>{editingTournament ? 'Edit Tournament' : 'Create Tournament'}</DrawerTitle>
            <DrawerDescription>
              {editingTournament ? 'Update tournament details and settings' : 'Create a new tournament'}
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
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
                    <SelectItem value="mixed">Mixed</SelectItem>
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
                    'mens-single', 'womens-single', 'mens-doubles', 'womens-doubles', 'mixed-doubles', 'family-doubles',
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
                        {category.replace(/-/g, ' ')}
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
              <DatePickerInput
                id="startDate"
                label="Start Date"
                value={formData.startDate}
                onChange={(startDate) => setFormData({ ...formData, startDate })}
                required
              />
              <DatePickerInput
                id="endDate"
                label="End Date"
                value={formData.endDate}
                onChange={(endDate) => setFormData({ ...formData, endDate })}
                required
              />
              <DatePickerInput
                id="registrationDeadline"
                label="Registration Deadline"
                value={formData.registrationDeadline}
                onChange={(registrationDeadline) => setFormData({ ...formData, registrationDeadline })}
                required
              />
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
                <Select value={formData.matchFormat} onValueChange={(value: 'single-set' | 'best-of-3' | 'best-of-3-15pt' | 'single-set-30') => setFormData({ ...formData, matchFormat: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single-set">Single set (21pt)</SelectItem>
                    <SelectItem value="best-of-3">Best of 3 (first to 2 sets)</SelectItem>
                    <SelectItem value="best-of-3-15pt">Best of 3 (15pt)</SelectItem>
                    <SelectItem value="single-set-30">30pt Single set</SelectItem>
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
            
            {editingTournament && (
              <div className="space-y-2">
                <Label>Rules</Label>
                <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <ScrollText className="h-4 w-4 text-blue-500" />
                    <span>
                      {formData.rules.trim()
                        ? `${formData.rules.trim().split('\n').filter(Boolean).length} lines of rules`
                        : 'No rules added yet'}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                    onClick={() => {
                      if (editingTournament) {
                        setRulesEditingTournament({ ...editingTournament, rules: formData.rules });
                        setRulesContent(formData.rules);
                        setRulesDrawerOpen(true);
                      }
                    }}
                  >
                    <ScrollText className="h-3.5 w-3.5" />
                    Edit Rules
                  </Button>
                </div>
              </div>
            )}

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

            {/* Registration Form Fields Visibility */}
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
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showTshirtSize"
                    checked={formData.showTshirtSize}
                    onCheckedChange={(checked) => setFormData({ ...formData, showTshirtSize: checked === true })}
                  />
                  <Label htmlFor="showTshirtSize">T-Shirt Size</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="showVolunteerNomination"
                    checked={formData.showVolunteerNomination}
                    onCheckedChange={(checked) => setFormData({ ...formData, showVolunteerNomination: checked === true })}
                  />
                  <Label htmlFor="showVolunteerNomination">Volunteer Nomination</Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <ImageUpload
                label="Payment QR Code (optional)"
                value={formData.paymentQrCode}
                onChange={(url) => setFormData({ ...formData, paymentQrCode: url || '' })}
                aspectRatio="1/1"
                maxSize={2}
              />
              <p className="text-xs text-gray-500">
                Optional. If omitted, participants pay via phone/UPI accounts only.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="doublesFee">Doubles Fee (₹ per person)</Label>
                <Input
                  id="doublesFee"
                  type="number"
                  min="0"
                  placeholder="700"
                  value={formData.doublesFee}
                  onChange={(e) => setFormData({ ...formData, doublesFee: e.target.value })}
                />
                <p className="text-xs text-gray-500">Fee per player for doubles categories</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="repeatFee">Repeat Registration Fee (₹)</Label>
                <Input
                  id="repeatFee"
                  type="number"
                  min="0"
                  placeholder="300"
                  value={formData.repeatFee}
                  onChange={(e) => setFormData({ ...formData, repeatFee: e.target.value })}
                />
                <p className="text-xs text-gray-500">Discounted fee for an additional category</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                  Payment Accounts
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFormData({ ...formData, paymentAccounts: [...formData.paymentAccounts, { name: '', number: '' }] })}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Account
                </Button>
              </div>
              {formData.paymentAccounts.length === 0 && (
                <p className="text-xs text-gray-400 italic">No accounts added yet. Add UPI IDs or bank details that participants can pay to.</p>
              )}
              {formData.paymentAccounts.map((account, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    placeholder="Recipient name"
                    value={account.name}
                    onChange={(e) => {
                      const updated = formData.paymentAccounts.map((a, i) => i === idx ? { ...a, name: e.target.value } : a);
                      setFormData({ ...formData, paymentAccounts: updated });
                    }}
                    className="flex-1"
                  />
                  <Input
                    placeholder="UPI ID / phone / account no."
                    value={account.number}
                    onChange={(e) => {
                      const updated = formData.paymentAccounts.map((a, i) => i === idx ? { ...a, number: e.target.value } : a);
                      setFormData({ ...formData, paymentAccounts: updated });
                    }}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFormData({ ...formData, paymentAccounts: formData.paymentAccounts.filter((_, i) => i !== idx) })}
                    className="text-red-500 hover:text-red-700 flex-shrink-0 px-2"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-3 rounded-lg border border-gray-200 p-4">
              <div>
                <Label className="text-sm font-semibold">Point of Contact</Label>
                <p className="text-xs text-gray-500 mt-0.5">Up to two contacts shown on the public registration form</p>
              </div>
              {formData.contacts.map((contact, idx) => (
                <div key={idx} className="space-y-2 rounded-md border border-gray-100 bg-gray-50/50 p-3">
                  <p className="text-xs font-medium text-gray-700">Contact {idx + 1}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor={`contactName-${idx}`}>Name</Label>
                      <Input
                        id={`contactName-${idx}`}
                        placeholder="e.g. Tournament Coordinator"
                        value={contact.name}
                        onChange={(e) => {
                          const updated = formData.contacts.map((c, i) =>
                            i === idx ? { ...c, name: e.target.value } : c
                          );
                          setFormData({ ...formData, contacts: updated });
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`contactPhone-${idx}`}>Phone Number</Label>
                      <Input
                        id={`contactPhone-${idx}`}
                        type="tel"
                        placeholder="e.g. +91 98765 43210"
                        value={contact.phone}
                        onChange={(e) => {
                          const updated = formData.contacts.map((c, i) =>
                            i === idx ? { ...c, phone: e.target.value } : c
                          );
                          setFormData({ ...formData, contacts: updated });
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsappGroupLink" className="flex items-center gap-1.5">
                <MessageCircle className="h-4 w-4 text-green-600" />
                WhatsApp Group Link
              </Label>
              <Input
                id="whatsappGroupLink"
                type="url"
                placeholder="https://chat.whatsapp.com/..."
                value={formData.whatsappGroupLink}
                onChange={(e) => setFormData({ ...formData, whatsappGroupLink: e.target.value })}
              />
              <p className="text-xs text-gray-500">Participants will see this link on their registration confirmation screen</p>
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
      
      {/* Rules Sidebar Drawer */}
      <Drawer open={rulesDrawerOpen} onOpenChange={setRulesDrawerOpen}>
        <DrawerContent side="right" className="max-w-3xl">
          <DrawerHeader className="flex-shrink-0 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ScrollText className="h-5 w-5 text-blue-600" />
                <div>
                  <DrawerTitle>Edit Rules</DrawerTitle>
                  <DrawerDescription className="mt-0.5">
                    {rulesEditingTournament?.name}
                  </DrawerDescription>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setRulesDrawerOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DrawerHeader>

          <div className="flex-1 overflow-hidden flex flex-col lg:flex-row min-h-0">
            {/* Editor panel */}
            <div className="flex-1 flex flex-col min-h-0 border-r border-gray-100">
              {/* Toolbar */}
              <div className="flex items-center gap-1 px-3 py-2 bg-gray-50 border-b border-gray-100">
                <button
                  type="button"
                  title="Bold (Ctrl+B)"
                  onMouseDown={(e) => { e.preventDefault(); wrapSelection('**'); }}
                  className="w-7 h-7 rounded flex items-center justify-center text-sm font-bold text-gray-700 hover:bg-gray-200 transition-colors"
                >B</button>
                <button
                  type="button"
                  title="Italic (Ctrl+I)"
                  onMouseDown={(e) => { e.preventDefault(); wrapSelection('*'); }}
                  className="w-7 h-7 rounded flex items-center justify-center text-sm italic font-serif text-gray-700 hover:bg-gray-200 transition-colors"
                >I</button>
                <button
                  type="button"
                  title="Bold + Italic"
                  onMouseDown={(e) => { e.preventDefault(); wrapSelection('***'); }}
                  className="w-7 h-7 rounded flex items-center justify-center text-sm font-bold italic font-serif text-gray-700 hover:bg-gray-200 transition-colors"
                >BI</button>
                <div className="w-px h-4 bg-gray-300 mx-1" />
                <div className="flex items-center gap-2 text-xs text-gray-400 select-none">
                  <span><code className="bg-white px-1 rounded border border-gray-200 text-gray-600"># H1</code></span>
                  <span><code className="bg-white px-1 rounded border border-gray-200 text-gray-600">## H2</code></span>
                  <span><code className="bg-white px-1 rounded border border-gray-200 text-gray-600">1.</code> num</span>
                  <span><code className="bg-white px-1 rounded border border-gray-200 text-gray-600">-</code> bullet</span>
                </div>
              </div>
              {/* Textarea */}
              <div className="flex-1 p-4 overflow-auto">
                <Textarea
                  ref={rulesTextareaRef}
                  value={rulesContent}
                  onChange={(e) => setRulesContent(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); wrapSelection('**'); }
                    if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); wrapSelection('*'); }
                  }}
                  placeholder={`# General Rules\n\n1. All players must register before the deadline.\n2. Players must arrive **15 minutes** before their scheduled match.\n\n# Scoring Rules\n\n- Each set is played to 21 points.\n- A player must win by *2 clear points*.`}
                  className="font-mono text-sm resize-none h-full min-h-[320px] border-gray-200"
                />
              </div>
            </div>

            {/* Preview panel */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                <p className="text-xs font-medium text-gray-700">Live Preview</p>
              </div>
              <div className="flex-1 overflow-auto p-5">
                {rulesContent.trim() ? (
                  <RulesPreview rules={rulesContent} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 py-12">
                    <ScrollText className="h-10 w-10 mb-3 text-gray-200" />
                    <p className="text-sm">Start typing to see a preview</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DrawerFooter className="flex-shrink-0 border-t">
            <div className="flex justify-between items-center">
              {rulesEditingTournament && (
                <a
                  href={`/tournament/${rulesEditingTournament.id}/rules`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  View public rules page
                </a>
              )}
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" onClick={() => setRulesDrawerOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveRules} disabled={rulesSaving}>
                  {rulesSaving ? 'Saving…' : 'Save Rules'}
                </Button>
              </div>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {AlertDialogComponent}
      {ConfirmDialogComponent}
    </AdminLayout>
  );
}