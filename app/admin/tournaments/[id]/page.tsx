'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { doc, updateDoc, setDoc, deleteDoc, collection, getDocs, query, where, arrayUnion, arrayRemove } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import Image from 'next/image';
import {
  useTournament,
  useTournamentRegistrations,
  useTournamentMatches,
  useInvalidateTournament,
} from '@/hooks/use-tournament-queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tournament, Registration, Match, CategoryType, User } from '@/types';
import { useAlertDialog } from '@/components/ui/alert-dialog-component';
import { generateRegistrationLink, parsePaymentRecipient, dedupeByNamePhone } from '@/lib/utils';
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
  Swords,
  UserPlus,
  X,
  PieChart,
  HandHeart,
  Home,
  TrendingDown,
  Shirt,
  IndianRupee,
  ChevronDown,
  Camera,
  Loader2,
  Check,
  Trash2,
} from 'lucide-react';

const TSHIRT_SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const;
import Link from 'next/link';
import TeamManagement from '@/components/TeamManagement';
import SpinWheel from '@/components/SpinWheel';
import PoolAssignment from '@/components/PoolAssignment';
import VolunteersListDrawer from '@/components/admin/VolunteersListDrawer';
import { cn } from '@/lib/utils';

const isAdminRole = (role: string) =>
  role === 'admin' || role === 'tournament-admin' || role === 'super-admin';

function normalizePlayerName(name: string) {
  return name.trim().toLowerCase();
}

function formatCategoryLabel(category: string) {
  return category.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Underline tab-bar styling for the detail tabs (overrides the default segmented/pill look)
const TAB_TRIGGER_CLASS =
  '-mb-px flex-shrink-0 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-2 text-xs font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-primary data-[state=active]:shadow-none sm:flex-1 sm:text-sm';

type UniquePlayerRow = {
  name: string;
  phone: string;
  tshirtSize: string;
  expertiseLevel: string;
  profilePhotoUrl: string;
  categories: CategoryType[];
  registrationRefs: Array<{ id: string; role: 'primary' | 'partner' }>;
};

export default function TournamentDetailsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const tournamentId = params.id as string;
  const { alert, AlertDialogComponent } = useAlertDialog();
  const queriesEnabled = !authLoading && !!user && isAdminRole(user.role) && !!tournamentId;

  const { data: tournamentData, isLoading: tournamentLoading } = useTournament(
    tournamentId,
    { enabled: queriesEnabled }
  );
  const { data: registrationsData = [], isLoading: registrationsLoading } =
    useTournamentRegistrations(tournamentId, { enabled: queriesEnabled });
  const { data: matchesData = [], isLoading: matchesLoading } = useTournamentMatches(
    tournamentId,
    { enabled: queriesEnabled }
  );
  const invalidateTournament = useInvalidateTournament();

  const tournament = tournamentData ?? null;
  const participants = registrationsData;
  const matches = matchesData;
  const loading =
    authLoading ||
    (queriesEnabled && (tournamentLoading || registrationsLoading || matchesLoading));

  const [activeTab, setActiveTab] = useState('overview');

  // Filter states
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [genderFilter, setGenderFilter] = useState<string>('all');

  // Players tab search + filter
  const [playerSearch, setPlayerSearch] = useState('');
  const [playerCategoryFilter, setPlayerCategoryFilter] = useState<string>('all');

  // Tournament admin management
  const [tournamentAdmins, setTournamentAdmins] = useState<User[]>([]);
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const isFullAdmin = user?.role === 'admin' || user?.role === 'super-admin';

  useEffect(() => {
    if (!isFullAdmin) return;
    getDocs(query(collection(db, 'users'), where('role', '==', 'tournament-admin'))).then(snap => {
      setTournamentAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
    });
  }, [isFullAdmin]);

  const refreshAdmins = () => {
    getDocs(query(collection(db, 'users'), where('role', '==', 'tournament-admin'))).then(snap => {
      setTournamentAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
    });
  };

  const addAdminToTournament = async (userId: string) => {
    await updateDoc(doc(db, 'users', userId), { assignedTournaments: arrayUnion(tournamentId), updatedAt: new Date() });
    refreshAdmins();
  };

  const removeAdminFromTournament = async (userId: string) => {
    await updateDoc(doc(db, 'users', userId), { assignedTournaments: arrayRemove(tournamentId), updatedAt: new Date() });
    refreshAdmins();
  };

  const assignedAdmins = tournamentAdmins.filter(u => u.assignedTournaments?.includes(tournamentId));
  const unassignedAdmins = tournamentAdmins.filter(u => !u.assignedTournaments?.includes(tournamentId));

  // Overview & analytics computation
  const analytics = useMemo(() => {
    // Category breakdown
    const catMap = new Map<string, { total: number; approved: number; pending: number; rejected: number }>();
    participants.forEach(p => {
      if (!catMap.has(p.selectedCategory)) catMap.set(p.selectedCategory, { total: 0, approved: 0, pending: 0, rejected: 0 });
      const e = catMap.get(p.selectedCategory)!;
      e.total++;
      e[p.registrationStatus as 'approved' | 'pending' | 'rejected']++;
    });
    const categories = Array.from(catMap.entries()).sort((a, b) => b[1].total - a[1].total);

    // Gender
    const gender = { male: 0, female: 0, other: 0 };
    participants.forEach(p => { gender[p.gender as keyof typeof gender] = (gender[p.gender as keyof typeof gender] || 0) + 1; });

    // Expertise level
    const level = { beginner: 0, intermediate: 0, advanced: 0, expert: 0 };
    participants.forEach(p => { level[p.expertiseLevel as keyof typeof level] = (level[p.expertiseLevel as keyof typeof level] || 0) + 1; });

    // Payment
    const paid = participants.filter(p => p.paymentStatus === 'paid');
    const totalRevenue = paid.reduce((sum, p) => sum + (p.paymentAmount ?? 0), 0);
    const pendingPayment = participants.filter(p => p.paymentStatus === 'pending').length;
    const pendingRegistrations = participants.filter(p => p.registrationStatus === 'pending');
    const pendingRegistrationCount = pendingRegistrations.length;
    const expectedFromPendingRegistrations = pendingRegistrations.reduce(
      (sum, p) => sum + (p.paymentAmount ?? 0),
      0
    );

    // Misc — dedupe volunteers by unique name + phone (a person may register in multiple categories)
    const volunteers = dedupeByNamePhone(participants.filter((p) => p.isVolunteer === true))
      .sort((a, b) => a.name.localeCompare(b.name));
    const volunteerCount = volunteers.length;
    const residentCount = participants.filter(p => p.isResident === true).length;
    const nonResidentCount = participants.filter(p => p.isResident === false).length;

    // Daily registration timeline
    const dateMap = new Map<string, number>();
    participants.forEach(p => {
      const d = new Date(p.registeredAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      dateMap.set(d, (dateMap.get(d) ?? 0) + 1);
    });
    const timeline = Array.from(dateMap.entries());

    // T-shirt sizes — deduplicated by player name so multi-category registrants are counted once
    const tshirtMap = new Map<string, number>();
    const seenTshirtNames = new Set<string>();
    const addTshirtSize = (name: string, size?: string) => {
      const nameKey = name.trim().toLowerCase();
      if (!nameKey || seenTshirtNames.has(nameKey)) return;
      seenTshirtNames.add(nameKey);
      const key = size?.trim() || 'Not specified';
      tshirtMap.set(key, (tshirtMap.get(key) ?? 0) + 1);
    };
    participants.forEach((p) => {
      addTshirtSize(p.name, p.tshirtSize);
      if (p.partnerName?.trim()) addTshirtSize(p.partnerName, p.partnerTshirtSize);
    });
    const tshirtSizes = Array.from(tshirtMap.entries()).sort(([a], [b]) => {
      if (a === 'Not specified') return 1;
      if (b === 'Not specified') return -1;
      const orderA = TSHIRT_SIZE_ORDER.indexOf(a as (typeof TSHIRT_SIZE_ORDER)[number]);
      const orderB = TSHIRT_SIZE_ORDER.indexOf(b as (typeof TSHIRT_SIZE_ORDER)[number]);
      if (orderA === -1 && orderB === -1) return a.localeCompare(b);
      if (orderA === -1) return 1;
      if (orderB === -1) return -1;
      return orderA - orderB;
    });
    const totalTshirts = tshirtSizes.reduce((sum, [, count]) => sum + count, 0);

    return {
      categories,
      gender,
      level,
      totalRevenue,
      paidCount: paid.length,
      pendingPayment,
      pendingRegistrationCount,
      expectedFromPendingRegistrations,
      volunteerCount,
      volunteers,
      residentCount,
      nonResidentCount,
      timeline,
      tshirtSizes,
      totalTshirts,
    };
  }, [participants]);

  const revenueByReceiver = useMemo(() => {
    const map = new Map<string, { name: string; number: string; amount: number; count: number }>();

    (tournament?.paymentAccounts ?? []).forEach((account) => {
      const key = `${account.name}||${account.number}`;
      map.set(key, { name: account.name, number: account.number, amount: 0, count: 0 });
    });

    participants
      .filter((p) => p.paymentStatus === 'paid')
      .forEach((p) => {
        const recipient = parsePaymentRecipient(p.selectedPaymentAccount);
        const key = p.selectedPaymentAccount?.trim() || '__unassigned__';
        const name = recipient?.name || 'Unassigned';
        const number = recipient?.number || '';
        const entry = map.get(key) ?? { name, number, amount: 0, count: 0 };
        entry.amount += p.paymentAmount ?? 0;
        entry.count += 1;
        map.set(key, entry);
      });

    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [participants, tournament?.paymentAccounts]);

  const volunteersList = useMemo(
    () =>
      dedupeByNamePhone(participants.filter((p) => p.isVolunteer === true))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [participants]
  );

  const filteredParticipants = useMemo(() => {
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
    return filtered;
  }, [participants, categoryFilter, levelFilter, genderFilter]);

  const uniquePlayers = useMemo(() => {
    const map = new Map<string, UniquePlayerRow>();

    const upsert = (
      rawName: string,
      phone: string | undefined,
      tshirtSize: string | undefined,
      expertiseLevel: string | undefined,
      profilePhotoUrl: string | undefined,
      category: CategoryType,
      registrationRef: { id: string; role: 'primary' | 'partner' }
    ) => {
      const name = rawName.trim();
      if (!name) return;
      const key = normalizePlayerName(name);
      const existing = map.get(key);
      if (existing) {
        if (phone?.trim() && !existing.phone) existing.phone = phone.trim();
        if (tshirtSize?.trim() && !existing.tshirtSize) existing.tshirtSize = tshirtSize.trim();
        if (expertiseLevel?.trim() && !existing.expertiseLevel) existing.expertiseLevel = expertiseLevel.trim();
        if (profilePhotoUrl?.trim() && !existing.profilePhotoUrl) existing.profilePhotoUrl = profilePhotoUrl.trim();
        if (!existing.categories.includes(category)) existing.categories.push(category);
        existing.registrationRefs.push(registrationRef);
      } else {
        map.set(key, {
          name,
          phone: phone?.trim() ?? '',
          tshirtSize: tshirtSize?.trim() ?? '',
          expertiseLevel: expertiseLevel?.trim() ?? '',
          profilePhotoUrl: profilePhotoUrl?.trim() ?? '',
          categories: [category],
          registrationRefs: [registrationRef],
        });
      }
    };

    participants.forEach((p) => {
      upsert(p.name, p.phone, p.tshirtSize, p.expertiseLevel, p.profilePhotoUrl, p.selectedCategory, { id: p.id, role: 'primary' });
      if (p.partnerName?.trim()) {
        upsert(p.partnerName, p.partnerPhone, p.partnerTshirtSize, undefined, p.partnerProfilePhotoUrl, p.selectedCategory, { id: p.id, role: 'partner' });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [participants]);
  
  // Edit match dialog
  const [editMatchOpen, setEditMatchOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [editMatchForm, setEditMatchForm] = useState({
    round: '',
    matchNumber: '',
    player1Id: '',
    player2Id: '',
    scheduledTime: '',
    venue: '',
    court: '',
    referee: '',
    status: 'scheduled' as Match['status'],
    notes: '',
    matchFormat: 'best-of-3' as 'single-set' | 'best-of-3',
  });
  const [savingMatch, setSavingMatch] = useState(false);

  const openEditMatch = (match: Match) => {
    setEditingMatch(match);
    setEditMatchForm({
      round: match.round,
      matchNumber: String(match.matchNumber),
      player1Id: match.player1Id,
      player2Id: match.player2Id,
      scheduledTime: new Date(match.scheduledTime).toISOString().slice(0, 16),
      venue: match.venue,
      court: match.court ?? '',
      referee: match.referee ?? '',
      status: match.status,
      notes: match.notes ?? '',
      matchFormat: (match as any).matchFormat ?? 'best-of-3',
    });
    setEditMatchOpen(true);
  };

  const saveEditMatch = async () => {
    if (!editingMatch) return;
    const p1 = participants.find(p => p.id === editMatchForm.player1Id);
    const p2 = participants.find(p => p.id === editMatchForm.player2Id);
    if (!p1 || !p2) { alert({ title: 'Error', description: 'Select valid players', variant: 'error' }); return; }
    setSavingMatch(true);
    try {
      await updateDoc(doc(db, 'matches', editingMatch.id), {
        round: editMatchForm.round,
        matchNumber: parseInt(editMatchForm.matchNumber),
        player1Id: p1.id,
        player1Name: p1.name,
        player2Id: p2.id,
        player2Name: p2.name,
        scheduledTime: new Date(editMatchForm.scheduledTime),
        venue: editMatchForm.venue,
        court: editMatchForm.court || null,
        referee: editMatchForm.referee || null,
        status: editMatchForm.status,
        notes: editMatchForm.notes || null,
        matchFormat: editMatchForm.matchFormat,
        updatedAt: new Date(),
      });
      invalidateTournament(tournamentId);
      setEditMatchOpen(false);
    } catch (e) {
      console.error(e);
      alert({ title: 'Error', description: 'Failed to save match', variant: 'error' });
    } finally {
      setSavingMatch(false);
    }
  };

  // Edit drawer states
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<Registration | null>(null);
  const [volunteersDrawerOpen, setVolunteersDrawerOpen] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(true);

  // Players tab inline edit
  const [editingPlayerKey, setEditingPlayerKey] = useState<string | null>(null);
  const [playerEdits, setPlayerEdits] = useState<{ tshirtSize: string; expertiseLevel: string; profilePhotoUrl: string | null }>({ tshirtSize: '', expertiseLevel: '', profilePhotoUrl: null });
  const [savingPlayer, setSavingPlayer] = useState(false);
  const [uploadingPlayerPhoto, setUploadingPlayerPhoto] = useState(false);
  const playerPhotoInputRef = useRef<HTMLInputElement>(null);

  const startEditPlayer = (player: UniquePlayerRow) => {
    setEditingPlayerKey(normalizePlayerName(player.name));
    setPlayerEdits({ tshirtSize: player.tshirtSize, expertiseLevel: player.expertiseLevel, profilePhotoUrl: player.profilePhotoUrl || null });
  };

  const cancelEditPlayer = () => {
    setEditingPlayerKey(null);
    setSavingPlayer(false);
  };

  const handlePlayerPhotoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setUploadingPlayerPhoto(true);
    try {
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
      const path = `participant-profiles/${tournamentId}/inline-${timestamp}-${safeName}`;
      const snap = await uploadBytes(storageRef(storage, path), file);
      const url = await getDownloadURL(snap.ref);
      setPlayerEdits(prev => ({ ...prev, profilePhotoUrl: url }));
    } catch (err) {
      console.error('Photo upload failed:', err);
    } finally {
      setUploadingPlayerPhoto(false);
      if (playerPhotoInputRef.current) playerPhotoInputRef.current.value = '';
    }
  };

  const savePlayerEdits = async (player: UniquePlayerRow) => {
    setSavingPlayer(true);
    try {
      await Promise.all(
        player.registrationRefs.map(({ id, role }) => {
          const fields: Record<string, unknown> = { updatedAt: new Date() };
          if (role === 'primary') {
            fields.expertiseLevel = playerEdits.expertiseLevel;
            if (playerEdits.tshirtSize) fields.tshirtSize = playerEdits.tshirtSize;
            if (playerEdits.profilePhotoUrl !== null) fields.profilePhotoUrl = playerEdits.profilePhotoUrl;
          } else {
            if (playerEdits.tshirtSize) fields.partnerTshirtSize = playerEdits.tshirtSize;
            if (playerEdits.profilePhotoUrl !== null) fields.partnerProfilePhotoUrl = playerEdits.profilePhotoUrl;
          }
          return updateDoc(doc(db, 'tournaments', tournamentId, 'registrations', id), fields);
        })
      );
      invalidateTournament(tournamentId);
      setEditingPlayerKey(null);
    } catch (err) {
      console.error('Error saving player edits:', err);
    } finally {
      setSavingPlayer(false);
    }
  };

  const exportPlayersCsv = (players: UniquePlayerRow[]) => {
    const rows = [
      ['Name', 'Phone', 'T-Shirt Size', 'Level', 'Categories'],
      ...players.map((p) => [
        p.name,
        p.phone,
        p.tshirtSize,
        p.expertiseLevel,
        p.categories.map(formatCategoryLabel).join('; '),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = (tournament?.name ?? 'tournament').replace(/\s+/g, '-').toLowerCase().slice(0, 30);
    a.href = url;
    a.download = `players-${slug}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!authLoading && (!user || !isAdminRole(user.role))) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Redirect if tournament not found or tournament-admin without access
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

  // Handle URL parameters for tab selection
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'analytics') {
      setActiveTab('overview');
      return;
    }
    if (tab && ['overview', 'participants', 'players', 'matches', 'teams', 'spin-wheel', 'pools', 'results'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

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

  const handleDeleteMatch = async (matchId: string) => {
    if (!confirm('Delete this match? This cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'matches', matchId));
      invalidateTournament(tournamentId);
    } catch (e) {
      console.error(e);
      alert({ title: 'Error', description: 'Failed to delete match', variant: 'error' });
    }
  };

  const exportParticipants = () => {
    const showTower = tournament?.showTowerAndFlat ?? true;
    const headers = [
      'Name', 'Phone', 'Age', 'Gender',
      ...(showTower ? ['Tower/Flat'] : []),
      'Level', 'Category', 'Status', 'Partner Name', 'Partner Phone'
    ];
    const csvContent = [
      headers.join(','),
      ...filteredParticipants.map(p => [
        p.name,
        p.phone,
        p.age,
        p.gender,
        ...(showTower ? [`${p.tower || ''} ${p.flatNumber || ''}`] : []),
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
              <Link href={`/admin/tournaments/${tournamentId}/edit`}>
                <Button variant="outline" size="sm" className="w-full sm:w-auto">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Tournament
                </Button>
              </Link>
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

        {/* Detailed Tabs - horizontal scroll on mobile */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
            <TabsList className="inline-flex h-auto w-max min-w-full sm:min-w-0 sm:w-full sm:grid sm:grid-cols-8 flex-nowrap gap-0 p-0 rounded-none bg-transparent border-b border-border">
              <TabsTrigger value="overview" className={TAB_TRIGGER_CLASS}>Overview</TabsTrigger>
              <TabsTrigger value="participants" className={TAB_TRIGGER_CLASS}>Registrations</TabsTrigger>
              <TabsTrigger value="players" className={TAB_TRIGGER_CLASS}>Players</TabsTrigger>
              <TabsTrigger value="teams" className={TAB_TRIGGER_CLASS}>Teams</TabsTrigger>
              <TabsTrigger value="pools" className={TAB_TRIGGER_CLASS}>Pools</TabsTrigger>
              <TabsTrigger value="spin-wheel" className={TAB_TRIGGER_CLASS}>Spin Wheel</TabsTrigger>
              <TabsTrigger value="matches" className={TAB_TRIGGER_CLASS}>Matches</TabsTrigger>
              <TabsTrigger value="results" className={TAB_TRIGGER_CLASS}>Results</TabsTrigger>
            </TabsList>
          </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-3">
            {/* KPI row */}
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-8 sm:gap-2">
              {[
                { label: 'Participants', value: `${totalParticipants}/${tournament.maxParticipants || '∞'}`, icon: Users, color: 'text-blue-500', sub: tournament.maxParticipants ? `${Math.round((totalParticipants / tournament.maxParticipants) * 100)}% cap` : 'Unlimited' },
                { label: 'Approved', value: String(approvedParticipants), icon: UserCheck, color: 'text-green-500', sub: totalParticipants > 0 ? `${Math.round((approvedParticipants / totalParticipants) * 100)}%` : '0%' },
                { label: 'Pending', value: String(pendingParticipants), icon: Clock, color: 'text-amber-500', sub: 'registration' },
                { label: 'Rejected', value: String(rejectedParticipants), icon: UserX, color: 'text-red-500', sub: 'registration' },
                { label: 'Revenue', value: `₹${analytics.totalRevenue.toLocaleString('en-IN')}`, icon: DollarSign, color: 'text-green-600', sub: `${analytics.paidCount} paid` },
                { label: 'Expected', value: `₹${analytics.expectedFromPendingRegistrations.toLocaleString('en-IN')}`, icon: TrendingUp, color: 'text-amber-600', sub: `${analytics.pendingRegistrationCount} pending`, highlight: true },
                { label: 'Pay pending', value: String(analytics.pendingPayment), icon: Clock, color: 'text-orange-500', sub: 'payment' },
                { label: 'Matches', value: String(totalMatches), icon: Activity, color: 'text-purple-500', sub: `${completedMatches} done · ${liveMatches} live` },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md border px-2 py-1.5 sm:px-2.5 sm:py-2',
                    kpi.highlight ? 'border-amber-200 bg-amber-50/80' : 'bg-card'
                  )}
                >
                  <kpi.icon className={cn('h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4', kpi.color)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] leading-none text-muted-foreground truncate">{kpi.label}</p>
                    <p className="truncate text-xs sm:text-sm font-semibold leading-tight tabular-nums">{kpi.value}</p>
                    <p className="truncate text-[10px] leading-tight text-muted-foreground">{kpi.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Collections by recipient + community quick stats */}
            <Card className="py-4">
              <CardContent className="px-4 sm:px-5">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                  <button
                    type="button"
                    onClick={() => setCollectionsOpen((o) => !o)}
                    aria-expanded={collectionsOpen}
                    className="flex shrink-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    <IndianRupee className="h-4 w-4" /> Collections by recipient
                    <ChevronDown className={`h-4 w-4 transition-transform ${collectionsOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {collectionsOpen && (
                    revenueByReceiver.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {revenueByReceiver.map((receiver) => (
                          <span
                            key={`${receiver.name}-${receiver.number}`}
                            className="inline-flex items-center gap-1.5 rounded-md border bg-muted/30 px-3 py-1.5 text-sm"
                            title={receiver.number || undefined}
                          >
                            <span className="font-medium">{receiver.name}</span>
                            <span className="tabular-nums">
                              <span className="font-semibold">₹{receiver.amount.toLocaleString('en-IN')}</span>
                              <span className="text-muted-foreground"> · {receiver.count} paid</span>
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">No payments collected yet.</span>
                    )
                  )}
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums">{paidParticipants} of {totalParticipants} paid</span>
                    <button
                      type="button"
                      onClick={() => analytics.volunteerCount > 0 && setVolunteersDrawerOpen(true)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm',
                        analytics.volunteerCount > 0
                          ? 'bg-pink-50 border-pink-200 hover:bg-pink-100 cursor-pointer'
                          : 'bg-card text-muted-foreground'
                      )}
                    >
                      <HandHeart className="h-4 w-4 text-pink-500" />
                      <span className="font-medium">{analytics.volunteerCount}</span> volunteers
                    </button>
                    <span className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm">
                      <Home className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">{analytics.residentCount}</span> residents
                      <span className="text-muted-foreground">· {analytics.nonResidentCount} other</span>
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
            {/* Manage Tournament Admins — visible to admin/super-admin only */}
            {isFullAdmin && (
              <Card>
                <CardHeader className="p-4 sm:p-6 pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <Users2 className="h-4 w-4 sm:h-5 sm:w-5" />
                      Tournament Admins
                    </CardTitle>
                    {unassignedAdmins.length > 0 && (
                      <Button size="sm" variant="outline" onClick={() => setAdminDialogOpen(true)}>
                        <UserPlus className="h-4 w-4 mr-1" />
                        Add Admin
                      </Button>
                    )}
                  </div>
                  <CardDescription>Users who can manage this tournament</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                  {assignedAdmins.length === 0 ? (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                      No admins assigned yet.{' '}
                      {unassignedAdmins.length > 0 && (
                        <button className="underline text-primary" onClick={() => setAdminDialogOpen(true)}>Add one</button>
                      )}
                      {unassignedAdmins.length === 0 && 'Create tournament-admin users first.'}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {assignedAdmins.map(u => (
                        <div key={u.id} className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-3 py-1.5 text-sm">
                          <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center text-blue-800 font-semibold text-xs flex-shrink-0">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-blue-900 leading-tight truncate max-w-[120px]">{u.name}</p>
                            <p className="text-[10px] text-blue-600 truncate max-w-[120px]">{u.email}</p>
                          </div>
                          <button
                            onClick={() => removeAdminFromTournament(u.id)}
                            className="ml-1 text-blue-400 hover:text-red-500 transition-colors flex-shrink-0"
                            title="Remove"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Insights (merged analytics) */}
            {participants.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No registration insights yet</h3>
                  <p className="text-muted-foreground text-sm">Charts and breakdowns will appear once registrations come in.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {/* Gender, Level, Category & T-shirt sizes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Card>
                    <CardHeader className="px-3 py-2.5 sm:px-4 sm:py-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Trophy className="h-4 w-4" />
                        By Category
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {participants.length} registrations across {analytics.categories.length} categor{analytics.categories.length === 1 ? 'y' : 'ies'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 pt-0 sm:px-4 sm:pb-4">
                      {analytics.categories.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No category data yet.</p>
                      ) : (() => {
                          const maxTotal = Math.max(...analytics.categories.map(([, c]) => c.total));
                          const CHART_H = 140;
                          const abbrev = (cat: string) =>
                            cat.replace('girls-under', 'G-U').replace('boys-under', 'B-U')
                               .replace('womens-', 'W-').replace('mens-', 'M-')
                               .replace('mixed-doubles', 'Mixed').replace('open-team', 'Open')
                               .replace('kids-team-u', 'Kids-U').replace('-', ' ');
                          return (
                            <>
                              <div className="overflow-x-auto">
                                <div className="flex items-end gap-2 min-w-max pb-1" style={{ height: CHART_H + 32 }}>
                                  {analytics.categories.map(([cat, counts]) => {
                                    const colH = maxTotal ? Math.round((counts.total / maxTotal) * CHART_H) : 4;
                                    const approvedH = counts.total ? Math.round((counts.approved / counts.total) * colH) : 0;
                                    const pendingH = counts.total ? Math.round((counts.pending / counts.total) * colH) : 0;
                                    const rejectedH = colH - approvedH - pendingH;
                                    const label = cat.replace(/-/g, ' ');
                                    return (
                                      <div key={cat} className="flex flex-col items-center gap-1 w-14 flex-shrink-0" title={label}>
                                        <span className="text-[11px] font-semibold text-gray-700 tabular-nums">{counts.total}</span>
                                        <div className="w-10 flex flex-col-reverse overflow-hidden rounded-t" style={{ height: colH, minHeight: 4 }}>
                                          <div className="w-full bg-green-500 transition-all" style={{ height: approvedH }} />
                                          <div className="w-full bg-amber-400 transition-all" style={{ height: pendingH }} />
                                          <div className="w-full bg-red-400 transition-all" style={{ height: rejectedH }} />
                                        </div>
                                        <span className="text-[9px] text-muted-foreground text-center leading-tight capitalize w-full truncate">{abbrev(cat)}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground mt-1">
                                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-green-500" />approved</span>
                                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-400" />pending</span>
                                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-400" />rejected</span>
                              </div>
                            </>
                          );
                        })()
                      }
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="px-3 py-2.5 sm:px-4 sm:py-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Shirt className="h-4 w-4" />
                        T-Shirt Sizes
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {analytics.totalTshirts} shirts total (players + partners)
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 pt-0 sm:px-4 sm:pb-4 space-y-1.5">
                      {analytics.tshirtSizes.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No t-shirt size data yet.</p>
                      ) : (
                        analytics.tshirtSizes.map(([size, count]) => {
                          const pct = analytics.totalTshirts
                            ? Math.round((count / analytics.totalTshirts) * 100)
                            : 0;
                          const barColors: Record<string, string> = {
                            XS: 'bg-slate-400',
                            S: 'bg-sky-400',
                            M: 'bg-teal-500',
                            L: 'bg-indigo-500',
                            XL: 'bg-violet-500',
                            XXL: 'bg-fuchsia-500',
                            XXXL: 'bg-rose-500',
                          };
                          const barColor =
                            barColors[size] ??
                            (size === 'Not specified' ? 'bg-gray-400' : 'bg-amber-500');
                          return (
                            <div key={size} className="flex items-center gap-3">
                              <span className="text-sm w-24 flex-shrink-0 text-gray-600 truncate" title={size}>
                                {size}
                              </span>
                              <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                                <div
                                  className={`h-full ${barColor} transition-all`}
                                  style={{ width: `${pct}%` }}
                                />
                                <span className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-semibold text-gray-700">
                                  {count}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                            </div>
                          );
                        })
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Gender split + expertise level — compact, side by side */}
                <div className="grid grid-cols-2 gap-3">
                  <Card className="py-0">
                    <CardHeader className="px-3 py-2.5">
                      <CardTitle className="text-sm flex items-center gap-1.5"><PieChart className="h-3.5 w-3.5" />Gender Split</CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 pt-0 space-y-1">
                      {(['male', 'female', 'other'] as const).map(g => {
                        const count = analytics.gender[g];
                        const pct = participants.length ? Math.round((count / participants.length) * 100) : 0;
                        const colors = { male: 'bg-blue-500', female: 'bg-pink-500', other: 'bg-purple-400' };
                        return (
                          <div key={g} className="flex items-center gap-2">
                            <span className="text-xs capitalize w-12 flex-shrink-0 text-gray-600">{g}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-5 relative overflow-hidden">
                              <div className={`h-full ${colors[g]} transition-all`} style={{ width: `${pct}%` }} />
                              <span className="absolute inset-0 flex items-center justify-end pr-1.5 text-[11px] font-semibold text-gray-700">{count}</span>
                            </div>
                            <span className="text-[11px] text-muted-foreground w-7 text-right tabular-nums">{pct}%</span>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>

                  <Card className="py-0">
                    <CardHeader className="px-3 py-2.5">
                      <CardTitle className="text-sm flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" />Expertise Level</CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 pt-0 space-y-1">
                      {(['beginner', 'intermediate', 'advanced', 'expert'] as const).map(l => {
                        const count = analytics.level[l];
                        const pct = participants.length ? Math.round((count / participants.length) * 100) : 0;
                        const colors = { beginner: 'bg-emerald-400', intermediate: 'bg-blue-400', advanced: 'bg-violet-500', expert: 'bg-orange-500' };
                        return (
                          <div key={l} className="flex items-center gap-2">
                            <span className="text-xs capitalize w-16 flex-shrink-0 text-gray-600 truncate" title={l}>{l}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-5 relative overflow-hidden">
                              <div className={`h-full ${colors[l]} transition-all`} style={{ width: `${pct}%` }} />
                              <span className="absolute inset-0 flex items-center justify-end pr-1.5 text-[11px] font-semibold text-gray-700">{count}</span>
                            </div>
                            <span className="text-[11px] text-muted-foreground w-7 text-right tabular-nums">{pct}%</span>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                </div>

                {/* Daily registration timeline */}
                {analytics.timeline.length > 1 && (
                  <Card>
                    <CardHeader className="px-3 py-2.5 sm:px-4 sm:py-3">
                      <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" />Daily Registrations</CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 pt-0 sm:px-4 sm:pb-4">
                      <div className="overflow-x-auto">
                        <div className="flex items-end gap-2 min-w-max h-24 px-0.5">
                          {(() => {
                            const maxDay = Math.max(...analytics.timeline.map(([, c]) => c));
                            return analytics.timeline.map(([date, count]) => (
                              <div key={date} className="flex flex-col items-center gap-1 w-10">
                                <span className="text-xs font-semibold text-gray-700">{count}</span>
                                <div
                                  className="w-8 bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                                  style={{ height: `${maxDay ? (count / maxDay) * 72 : 4}px`, minHeight: '4px' }}
                                  title={`${date}: ${count} registrations`}
                                />
                                <span className="text-[9px] text-muted-foreground text-center leading-tight">{date}</span>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          {/* Registrations Tab */}
          <TabsContent value="participants" className="flex h-[calc(100dvh-14rem)] min-h-[280px] flex-col gap-3 overflow-hidden">
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold sm:text-lg">Registrations ({filteredParticipants.length})</h3>
                <p className="text-xs text-gray-600 sm:text-sm">Manage tournament registrations</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-8 w-36 text-xs">
                    <SelectValue placeholder="All Categories" />
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
                <Select value={levelFilter} onValueChange={setLevelFilter}>
                  <SelectTrigger className="h-8 w-32 text-xs">
                    <SelectValue placeholder="All Levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                    <SelectItem value="expert">Expert</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={genderFilter} onValueChange={setGenderFilter}>
                  <SelectTrigger className="h-8 w-28 text-xs">
                    <SelectValue placeholder="All Genders" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Genders</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {(categoryFilter !== 'all' || levelFilter !== 'all' || genderFilter !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => { setCategoryFilter('all'); setLevelFilter('all'); setGenderFilter('all'); }}
                  >
                    Clear
                  </Button>
                )}
                <Button onClick={exportParticipants} size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>

            <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                {(filteredParticipants || []).length === 0 ? (
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
                  <Table className="min-w-[720px] [&_[data-slot=table-container]]:overflow-visible [&_[data-slot=table-container]]:w-max">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">Name</TableHead>
                        <TableHead className="text-xs sm:text-sm">Phone</TableHead>
                        <TableHead className="text-xs sm:text-sm">Age</TableHead>
                        <TableHead className="text-xs sm:text-sm">Gender</TableHead>
                        {(tournament?.showTowerAndFlat ?? true) && (
                          <TableHead className="text-xs sm:text-sm">Tower/Flat</TableHead>
                        )}
                        <TableHead className="text-xs sm:text-sm">Category</TableHead>
                        <TableHead className="text-xs sm:text-sm">Level</TableHead>
                        <TableHead className="text-xs sm:text-sm">Status</TableHead>
                        <TableHead className="text-xs sm:text-sm">Paid To</TableHead>
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
                          {(tournament?.showTowerAndFlat ?? true) && (
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
                            <Badge variant="outline" className="capitalize text-[10px] sm:text-xs">
                              {participant.expertiseLevel}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge className={`text-[10px] sm:text-xs ${getRegistrationStatusColor(participant.registrationStatus)}`}>
                              {participant.registrationStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm py-2 max-w-[140px]">
                            {(() => {
                              const recipient = parsePaymentRecipient(participant.selectedPaymentAccount);
                              if (!recipient?.name) {
                                return <span className="text-muted-foreground">—</span>;
                              }
                              return (
                                <span
                                  className="block truncate font-medium"
                                  title={
                                    recipient.number
                                      ? `${recipient.name} (${recipient.number})`
                                      : recipient.name
                                  }
                                >
                                  {recipient.name}
                                </span>
                              );
                            })()}
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
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Players Tab — one row per unique person */}
          <TabsContent value="players" className="flex h-[calc(100dvh-14rem)] min-h-[280px] flex-col gap-3 overflow-hidden">
            {(() => {
              const allPlayerCategories = Array.from(
                new Set(uniquePlayers.flatMap((p) => p.categories))
              ).sort();
              const filteredPlayers = uniquePlayers.filter((p) => {
                const matchesSearch = !playerSearch ||
                  p.name.toLowerCase().includes(playerSearch.toLowerCase()) ||
                  p.phone.includes(playerSearch);
                const matchesCategory = playerCategoryFilter === 'all' ||
                  p.categories.includes(playerCategoryFilter as CategoryType);
                return matchesSearch && matchesCategory;
              });
              return (
                <>
                  <div className="flex shrink-0 flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <h3 className="text-base font-semibold sm:text-lg">
                        Players ({(playerSearch || playerCategoryFilter !== 'all') ? `${filteredPlayers.length} of ${uniquePlayers.length}` : uniquePlayers.length})
                      </h3>
                      <p className="text-xs text-gray-600 sm:text-sm">
                        Unique players — click <Edit className="inline h-3 w-3" /> to edit level, T-shirt size or photo
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Category filter */}
                      <Select value={playerCategoryFilter} onValueChange={setPlayerCategoryFilter}>
                        <SelectTrigger className="h-8 w-36 text-xs">
                          <SelectValue placeholder="All categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all" className="text-xs">All categories</SelectItem>
                          {allPlayerCategories.map((cat) => (
                            <SelectItem key={cat} value={cat} className="text-xs capitalize">{formatCategoryLabel(cat)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {/* Search */}
                      <div className="relative w-44 sm:w-52">
                        <Input
                          placeholder="Search players…"
                          value={playerSearch}
                          onChange={(e) => setPlayerSearch(e.target.value)}
                          className="h-8 pr-8 text-xs"
                        />
                        {playerSearch && (
                          <button
                            type="button"
                            onClick={() => setPlayerSearch('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {/* Export CSV */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => exportPlayersCsv(filteredPlayers)}
                        disabled={filteredPlayers.length === 0}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Export CSV
                      </Button>
                    </div>
                  </div>

                  {/* hidden file input for inline photo upload */}
                  <input
                    ref={playerPhotoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePlayerPhotoUpload(f); }}
                  />

                  <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                      {uniquePlayers.length === 0 ? (
                        <div className="flex flex-1 items-center justify-center p-8 text-center">
                          <div>
                            <Users className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                            <h3 className="mb-2 text-lg font-medium text-gray-900">No players yet</h3>
                            <p className="text-gray-600">
                              Players will appear here once registrations are submitted.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="registrations-table-scroll min-h-0 flex-1 overflow-auto sm:mx-0">
                          <Table className="min-w-[700px] [&_[data-slot=table-container]]:overflow-visible [&_[data-slot=table-container]]:w-max">
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-10 text-xs sm:text-sm"></TableHead>
                                <TableHead className="text-xs sm:text-sm">Name</TableHead>
                                <TableHead className="text-xs sm:text-sm">Phone</TableHead>
                                <TableHead className="text-xs sm:text-sm">T-Shirt Size</TableHead>
                                <TableHead className="text-xs sm:text-sm">Level</TableHead>
                                <TableHead className="text-xs sm:text-sm">Categories</TableHead>
                                <TableHead className="w-20 text-xs sm:text-sm">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredPlayers.map((player) => {
                          const key = normalizePlayerName(player.name);
                          const isEditing = editingPlayerKey === key;
                          const initials = player.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
                          const photoUrl = isEditing ? playerEdits.profilePhotoUrl : player.profilePhotoUrl;
                          return (
                            <TableRow key={key} className={isEditing ? 'bg-blue-50' : undefined}>
                              {/* Avatar cell */}
                              <TableCell className="py-1.5 pr-0">
                                {isEditing ? (
                                  <button
                                    type="button"
                                    onClick={() => playerPhotoInputRef.current?.click()}
                                    disabled={uploadingPlayerPhoto}
                                    className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    title="Upload profile photo"
                                  >
                                    {photoUrl ? (
                                      <Image src={photoUrl} alt={player.name} width={36} height={36} className="h-full w-full object-cover rounded-full" />
                                    ) : (
                                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-800 text-white text-xs font-bold">{initials}</div>
                                    )}
                                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                                      {uploadingPlayerPhoto ? <Loader2 className="h-3.5 w-3.5 animate-spin text-white" /> : <Camera className="h-3.5 w-3.5 text-white" />}
                                    </div>
                                  </button>
                                ) : photoUrl ? (
                                  <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-full">
                                    <Image src={photoUrl} alt={player.name} width={36} height={36} className="h-full w-full object-cover rounded-full" />
                                  </div>
                                ) : (
                                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-800 text-white text-xs font-bold flex-shrink-0">{initials}</div>
                                )}
                              </TableCell>

                              <TableCell className="py-1.5 text-xs font-medium sm:text-sm">{player.name}</TableCell>
                              <TableCell className="py-1.5 text-xs sm:text-sm">{player.phone || '—'}</TableCell>

                              {/* T-shirt size — inline edit */}
                              <TableCell className="py-1.5">
                                {isEditing ? (
                                  <Select value={playerEdits.tshirtSize} onValueChange={(v) => setPlayerEdits(prev => ({ ...prev, tshirtSize: v }))}>
                                    <SelectTrigger className="h-7 w-24 text-xs">
                                      <SelectValue placeholder="Size" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {['XS','S','M','L','XL','XXL','XXXL'].map(s => (
                                        <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <span className="text-xs sm:text-sm">{player.tshirtSize || '—'}</span>
                                )}
                              </TableCell>

                              {/* Level — inline edit */}
                              <TableCell className="py-1.5">
                                {isEditing ? (
                                  <Select value={playerEdits.expertiseLevel} onValueChange={(v) => setPlayerEdits(prev => ({ ...prev, expertiseLevel: v }))}>
                                    <SelectTrigger className="h-7 w-28 text-xs">
                                      <SelectValue placeholder="Level" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {['beginner','intermediate','advanced','expert'].map(l => (
                                        <SelectItem key={l} value={l} className="text-xs capitalize">{l}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Badge variant="outline" className="capitalize text-[10px] sm:text-xs">{player.expertiseLevel || '—'}</Badge>
                                )}
                              </TableCell>

                              <TableCell className="py-1.5">
                                <div className="flex flex-wrap gap-1">
                                  {player.categories.map((cat) => (
                                    <Badge key={cat} variant="outline" className="text-[10px] capitalize sm:text-xs">{formatCategoryLabel(cat)}</Badge>
                                  ))}
                                </div>
                              </TableCell>

                              {/* Actions */}
                              <TableCell className="py-1.5">
                                {isEditing ? (
                                  <div className="flex items-center gap-1">
                                    <Button size="sm" className="h-7 w-7 p-0" onClick={() => savePlayerEdits(player)} disabled={savingPlayer || uploadingPlayerPhoto} title="Save">
                                      {savingPlayer ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={cancelEditPlayer} disabled={savingPlayer} title="Cancel">
                                      <X className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Button variant="ghost" size="sm" onClick={() => startEditPlayer(player)} className="h-7 w-7 p-0 touch-manipulation" title="Edit">
                                    <Edit className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              );
            })()}
          </TabsContent>

          {/* Matches Tab */}
          <TabsContent value="matches" className="space-y-4 sm:space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold sm:text-lg">Matches ({totalMatches})</h3>
                <p className="text-xs text-gray-600 sm:text-sm">Start matches and enter scores below.</p>
              </div>
              {totalMatches > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-shrink-0 text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 hover:border-red-300"
                  onClick={async () => {
                    if (!confirm(`Delete all ${totalMatches} match${totalMatches === 1 ? '' : 'es'} for this tournament? This cannot be undone.`)) return;
                    try {
                      await Promise.all((matches ?? []).map(m => deleteDoc(doc(db, 'matches', m.id))));
                      invalidateTournament(tournamentId);
                    } catch (e) {
                      console.error(e);
                      alert({ title: 'Error', description: 'Failed to clear matches', variant: 'error' });
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear All
                </Button>
              )}
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
                        <TableHead className="text-right text-xs sm:text-sm w-24">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...(matches || [])].sort((a, b) => a.matchNumber - b.matchNumber).map((match) => (
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
                                      invalidateTournament(tournamentId);
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
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs touch-manipulation"
                                onClick={() => openEditMatch(match)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs touch-manipulation text-red-400 hover:text-red-600 hover:bg-red-50"
                                onClick={() => handleDeleteMatch(match.id)}
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

        {/* Edit Match Dialog */}
        <Dialog open={editMatchOpen} onOpenChange={setEditMatchOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Match</DialogTitle>
              <DialogDescription>Update match details</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Round</Label>
                  <Input value={editMatchForm.round} onChange={e => setEditMatchForm(f => ({ ...f, round: e.target.value }))} placeholder="e.g. Quarter Final" />
                </div>
                <div className="space-y-1">
                  <Label>Match #</Label>
                  <Input type="number" value={editMatchForm.matchNumber} onChange={e => setEditMatchForm(f => ({ ...f, matchNumber: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Player 1</Label>
                  <Select value={editMatchForm.player1Id} onValueChange={v => setEditMatchForm(f => ({ ...f, player1Id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select player" /></SelectTrigger>
                    <SelectContent>
                      {participants.filter(p => p.registrationStatus === 'approved').map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Player 2</Label>
                  <Select value={editMatchForm.player2Id} onValueChange={v => setEditMatchForm(f => ({ ...f, player2Id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select player" /></SelectTrigger>
                    <SelectContent>
                      {participants.filter(p => p.registrationStatus === 'approved').map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Scheduled Time</Label>
                  <Input type="datetime-local" value={editMatchForm.scheduledTime} onChange={e => setEditMatchForm(f => ({ ...f, scheduledTime: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select value={editMatchForm.status} onValueChange={(v: Match['status']) => setEditMatchForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Venue</Label>
                  <Input value={editMatchForm.venue} onChange={e => setEditMatchForm(f => ({ ...f, venue: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Court</Label>
                  <Input value={editMatchForm.court} onChange={e => setEditMatchForm(f => ({ ...f, court: e.target.value }))} placeholder="e.g. Court 1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Referee</Label>
                  <Input value={editMatchForm.referee} onChange={e => setEditMatchForm(f => ({ ...f, referee: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Match Format</Label>
                  <Select value={editMatchForm.matchFormat} onValueChange={(v: 'single-set' | 'best-of-3') => setEditMatchForm(f => ({ ...f, matchFormat: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single-set">Single set</SelectItem>
                      <SelectItem value="best-of-3">Best of 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Input value={editMatchForm.notes} onChange={e => setEditMatchForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditMatchOpen(false)}>Cancel</Button>
                <Button onClick={saveEditMatch} disabled={savingMatch}>
                  {savingMatch ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Admin Dialog */}
        {isFullAdmin && (
          <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Tournament Admin</DialogTitle>
                <DialogDescription>Select a user to give access to this tournament.</DialogDescription>
              </DialogHeader>
              {unassignedAdmins.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">All tournament-admin users are already assigned.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto py-2">
                  {unassignedAdmins.map(u => (
                    <button
                      key={u.id}
                      onClick={async () => { await addAdminToTournament(u.id); setAdminDialogOpen(false); }}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-semibold text-sm flex-shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{u.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      <UserPlus className="h-4 w-4 text-muted-foreground ml-auto flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}

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
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
                {(tournament?.showTowerAndFlat ?? true) && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Address Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-tower">Tower</Label>
                        <Input
                          id="edit-tower"
                          value={selectedParticipant.tower || ''}
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
                          value={selectedParticipant.flatNumber || ''}
                          onChange={(e) => setSelectedParticipant({
                            ...selectedParticipant,
                            flatNumber: e.target.value
                          })}
                        />
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      Display format: {selectedParticipant.tower || ''} {selectedParticipant.flatNumber || ''}
                    </div>
                  </div>
                )}

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
                          
                          invalidateTournament(tournamentId);
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

        <VolunteersListDrawer
          open={volunteersDrawerOpen}
          onOpenChange={setVolunteersDrawerOpen}
          volunteers={volunteersList}
          tournamentName={tournament.name}
        />
        
        {AlertDialogComponent}
      </div>
    </AdminLayout>
  );
}
