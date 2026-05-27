'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { collection, getDocs, updateDoc, doc, query, where, addDoc, deleteField, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tournament, Registration, Player } from '@/types';
import { useAlertDialog } from '@/components/ui/alert-dialog-component';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { Search, Users, CheckCircle, XCircle, Clock, Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Eye, Pencil, Trash2 } from 'lucide-react';
import RegistrationReviewDrawer from '@/components/admin/RegistrationReviewDrawer';
import RegistrationEditDrawer, { RegistrationEditValues } from '@/components/admin/RegistrationEditDrawer';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { parsePaymentRecipient, getInitials } from '@/lib/utils';

const STICKY_HEAD = 'sticky top-0 z-30 bg-white shadow-[2px_0_6px_-2px_rgba(0,0,0,0.1)]';
const STICKY_HEAD_CORNER = 'sticky top-0 z-40 bg-white shadow-[2px_0_6px_-2px_rgba(0,0,0,0.1)]';
const STICKY_CELL = 'sticky z-20 bg-white shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)] group-hover:bg-white';
const STICKY_HEAD_RIGHT = 'sticky top-0 right-0 z-40 bg-white shadow-[-2px_0_6px_-2px_rgba(0,0,0,0.1)]';
const STICKY_CELL_RIGHT = 'sticky right-0 z-20 bg-white shadow-[-2px_0_6px_-2px_rgba(0,0,0,0.08)] group-hover:bg-white';

export default function ManageRegistrationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { alert, AlertDialogComponent } = useAlertDialog();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();
  const [registrations, setRegistrations] = useState<(Registration & { tournamentId: string; tournamentName: string })[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTournament, setSelectedTournament] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [updatingPaymentId, setUpdatingPaymentId] = useState<string | null>(null);
  const [reviewDrawerOpen, setReviewDrawerOpen] = useState(false);
  const [reviewParticipantId, setReviewParticipantId] = useState<string | null>(null);
  const [statusActionLoading, setStatusActionLoading] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editParticipantId, setEditParticipantId] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Import functionality state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<Record<string, string>[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [importPreview, setImportPreview] = useState<Record<string, unknown>[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'tournament' | 'mapping' | 'preview' | 'importing'>('upload');
  const [selectedImportTournament, setSelectedImportTournament] = useState<string>('');

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
          paymentVerifiedAt: doc.data().paymentVerifiedAt?.toDate(),
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

  const handlePaymentStatusChange = async (
    participantId: string,
    newPaymentStatus: Registration['paymentStatus']
  ) => {
    const participant = registrations.find(p => p.id === participantId);
    if (!participant?.tournamentId) {
      alert({
        title: 'Error',
        description: 'Participant or tournament not found.',
        variant: 'error',
      });
      return;
    }

    setUpdatingPaymentId(participantId);

    try {
      const updateData: Record<string, unknown> = {
        paymentStatus: newPaymentStatus,
      };

      if (newPaymentStatus === 'paid') {
        updateData.paymentVerifiedAt = new Date();
        updateData.paymentVerifiedBy = user?.id ?? null;
      } else {
        updateData.paymentVerifiedAt = deleteField();
        updateData.paymentVerifiedBy = deleteField();
      }

      const registrationRef = doc(
        db,
        'tournaments',
        participant.tournamentId,
        'registrations',
        participantId
      );
      await updateDoc(registrationRef, updateData);

      const playersSnapshot = await getDocs(
        query(
          collection(db, 'tournaments', participant.tournamentId, 'players'),
          where('registrationId', '==', participantId)
        )
      );

      await Promise.all(
        playersSnapshot.docs.map((playerDoc) => updateDoc(playerDoc.ref, updateData))
      );

      setRegistrations(prev =>
        prev.map(p => {
          if (p.id !== participantId) return p;
          const next = { ...p, paymentStatus: newPaymentStatus };
          if (newPaymentStatus === 'paid') {
            next.paymentVerifiedAt = new Date();
            next.paymentVerifiedBy = user?.id;
          } else {
            delete next.paymentVerifiedAt;
            delete next.paymentVerifiedBy;
          }
          return next;
        })
      );

      alert({
        title: 'Payment updated',
        description: `Payment status set to ${newPaymentStatus}.`,
        variant: 'success',
      });
    } catch (error) {
      console.error('Error updating payment status:', error);
      alert({
        title: 'Error',
        description: 'Failed to update payment status. Please try again.',
        variant: 'error',
      });
    } finally {
      setUpdatingPaymentId(null);
    }
  };

  const openReviewDrawer = (participantId: string) => {
    setReviewParticipantId(participantId);
    setReviewDrawerOpen(true);
  };

  const reviewParticipant = reviewParticipantId
    ? registrations.find((p) => p.id === reviewParticipantId) ?? null
    : null;

  const openEditDrawer = (participantId: string) => {
    setEditParticipantId(participantId);
    setEditDrawerOpen(true);
  };

  const editParticipant = editParticipantId
    ? registrations.find((p) => p.id === editParticipantId) ?? null
    : null;

  const editTournamentCategories = editParticipant
    ? tournaments.find((t) => t.id === editParticipant.tournamentId)?.categories ?? []
    : [];

  // Update the registration and keep linked player records in sync.
  const handleSaveEdit = async (participantId: string, values: RegistrationEditValues): Promise<boolean> => {
    const participant = registrations.find((p) => p.id === participantId);
    if (!participant?.tournamentId) {
      alert({ title: 'Error', description: 'Registration or tournament not found.', variant: 'error' });
      return false;
    }

    setEditSaving(true);
    try {
      // Cleaned values: optional fields become `undefined` when cleared.
      const opt = (value: string) => (value.trim() === '' ? undefined : value.trim());
      const cleaned: Record<string, unknown> = {
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        age: Number(values.age),
        gender: values.gender,
        tower: opt(values.tower),
        flatNumber: opt(values.flatNumber),
        emergencyContact: opt(values.emergencyContact),
        isResident: values.isResident,
        selectedCategory: values.selectedCategory,
        expertiseLevel: values.expertiseLevel,
        previousExperience: opt(values.previousExperience),
        tshirtSize: opt(values.tshirtSize),
        isVolunteer: values.isVolunteer,
        partnerName: opt(values.partnerName),
        partnerPhone: opt(values.partnerPhone),
        partnerEmail: opt(values.partnerEmail),
        partnerTower: opt(values.partnerTower),
        partnerFlatNumber: opt(values.partnerFlatNumber),
        partnerTshirtSize: opt(values.partnerTshirtSize),
        paymentReference: opt(values.paymentReference),
        paymentAmount: values.paymentAmount.trim() === '' ? undefined : Number(values.paymentAmount),
        paymentMethod: values.paymentMethod === '' ? undefined : values.paymentMethod,
      };

      // Fields also stored on linked player records.
      const playerKeys = [
        'name', 'email', 'phone', 'age', 'gender', 'tower', 'flatNumber', 'emergencyContact',
        'isResident', 'selectedCategory', 'expertiseLevel', 'previousExperience', 'partnerName',
        'paymentReference', 'paymentAmount', 'paymentMethod',
      ];

      // Firestore writes: `undefined` becomes deleteField() to remove the field.
      const toFirestore = (source: Record<string, unknown>) =>
        Object.fromEntries(
          Object.entries(source).map(([k, v]) => [k, v === undefined ? deleteField() : v]),
        );

      const registrationUpdate = toFirestore(cleaned);
      await updateDoc(
        doc(db, 'tournaments', participant.tournamentId, 'registrations', participantId),
        registrationUpdate,
      );

      const playerUpdate = toFirestore(
        Object.fromEntries(playerKeys.map((k) => [k, cleaned[k]])),
      );
      playerUpdate.updatedAt = new Date();

      const playersSnapshot = await getDocs(
        query(
          collection(db, 'tournaments', participant.tournamentId, 'players'),
          where('registrationId', '==', participantId),
        ),
      );
      await Promise.all(playersSnapshot.docs.map((playerDoc) => updateDoc(playerDoc.ref, playerUpdate)));

      // Update local state: apply set values, drop cleared (undefined) fields.
      setRegistrations((prev) =>
        prev.map((p) => {
          if (p.id !== participantId) return p;
          const next = { ...p } as Record<string, unknown>;
          for (const [key, value] of Object.entries(cleaned)) {
            if (value === undefined) delete next[key];
            else next[key] = value;
          }
          return next as unknown as typeof p;
        }),
      );

      alert({ title: 'Registration updated', description: 'Changes saved successfully.', variant: 'success' });
      return true;
    } catch (error) {
      console.error('Error updating registration:', error);
      alert({ title: 'Error', description: 'Failed to update registration. Please try again.', variant: 'error' });
      return false;
    } finally {
      setEditSaving(false);
    }
  };

  const requestDelete = (participantId: string) => {
    const participant = registrations.find((p) => p.id === participantId);
    if (!participant) return;
    confirm({
      title: 'Delete registration?',
      description: `This will permanently delete ${participant.name}'s registration for ${participant.tournamentName}. This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'destructive',
      onConfirm: () => {
        void handleDeleteRegistration(participantId);
      },
    });
  };

  const handleDeleteRegistration = async (participantId: string) => {
    const participant = registrations.find((p) => p.id === participantId);
    if (!participant?.tournamentId) {
      alert({ title: 'Error', description: 'Registration or tournament not found.', variant: 'error' });
      return;
    }

    setDeletingId(participantId);
    try {
      // Delete linked player records first, then the registration document.
      const playersSnapshot = await getDocs(
        query(
          collection(db, 'tournaments', participant.tournamentId, 'players'),
          where('registrationId', '==', participantId),
        ),
      );
      await Promise.all(playersSnapshot.docs.map((playerDoc) => deleteDoc(playerDoc.ref)));

      await deleteDoc(doc(db, 'tournaments', participant.tournamentId, 'registrations', participantId));

      // Keep the tournament participant count accurate for approved registrations.
      if (participant.registrationStatus === 'approved') {
        const tournament = tournaments.find((t) => t.id === participant.tournamentId);
        if (tournament && typeof tournament.currentParticipants === 'number') {
          await updateDoc(doc(db, 'tournaments', tournament.id), {
            currentParticipants: Math.max(0, tournament.currentParticipants - 1),
          });
          setTournaments((prev) =>
            prev.map((t) =>
              t.id === tournament.id
                ? { ...t, currentParticipants: Math.max(0, t.currentParticipants - 1) }
                : t,
            ),
          );
        }
      }

      setRegistrations((prev) => prev.filter((p) => p.id !== participantId));

      // Close drawers if they were showing the deleted registration.
      if (reviewParticipantId === participantId) {
        setReviewDrawerOpen(false);
        setReviewParticipantId(null);
      }
      if (editParticipantId === participantId) {
        setEditDrawerOpen(false);
        setEditParticipantId(null);
      }

      alert({ title: 'Registration deleted', description: 'The registration was removed.', variant: 'success' });
    } catch (error) {
      console.error('Error deleting registration:', error);
      alert({ title: 'Error', description: 'Failed to delete registration. Please try again.', variant: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleReviewApprove = async (participantId: string) => {
    setStatusActionLoading(true);
    try {
      const ok = await handleStatusChange(participantId, 'approved');
      if (ok) {
        setReviewDrawerOpen(false);
        setReviewParticipantId(null);
      }
    } finally {
      setStatusActionLoading(false);
    }
  };

  const handleReviewReject = async (participantId: string) => {
    setStatusActionLoading(true);
    try {
      const ok = await handleStatusChange(participantId, 'rejected');
      if (ok) {
        setReviewDrawerOpen(false);
        setReviewParticipantId(null);
      }
    } finally {
      setStatusActionLoading(false);
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
      alert({
        title: 'Error',
        description: 'Failed to update participant status. Please try again.',
        variant: 'error'
      });
      return false;
    }
    return true;
  };

  // Categories available for the category filter, scoped to the selected tournament.
  const availableCategories = Array.from(
    new Set(
      registrations
        .filter(p => selectedTournament === 'all' || p.tournamentId === selectedTournament)
        .map(p => p.selectedCategory)
        .filter(Boolean),
    ),
  ).sort();

  const filteredParticipants = registrations.filter(participant => {
    const matchesTournament = selectedTournament === 'all' || participant.tournamentId === selectedTournament;
    const matchesSearch = searchTerm === '' ||
      participant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      participant.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      participant.phone.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || participant.registrationStatus === statusFilter;
    const matchesCategory = categoryFilter === 'all' || participant.selectedCategory === categoryFilter;

    return matchesTournament && matchesSearch && matchesStatus && matchesCategory;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
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
          p.tower || '',
          p.flatNumber || '',
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

  const downloadTemplate = () => {
    const templateData = [
      ['Name', 'Email', 'Phone', 'Age', 'Gender', 'Tower', 'Flat Number', 'Emergency Contact', 'Expertise Level', 'Category', 'Partner Name', 'Partner Phone', 'Partner Email', 'Partner Tower', 'Partner Flat Number', 'Payment Reference', 'Payment Method', 'Payment Amount'],
      ['John Doe', 'john@example.com', '9876543210', '25', 'male', 'A', '101', '9876543211', 'intermediate', 'mens-single', '', '', '', '', '', 'PAY123456', 'qr_code', '500'],
      ['Jane Smith', 'jane@example.com', '9876543212', '23', 'female', 'B', '202', '9876543213', 'advanced', 'womens-single', '', '', '', '', '', 'PAY123457', 'cash', '500'],
      ['Mike Johnson', 'mike@example.com', '9876543214', '28', 'male', 'C', '303', '9876543215', 'expert', 'mens-doubles', 'Tom Wilson', '9876543216', 'tom@example.com', 'C', '304', 'PAY123458', 'bank_transfer', '1000']
    ];

    const csvContent = templateData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'registration-template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Import functionality
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportStep('tournament');

    // Parse file based on extension
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      
      if (file.name.endsWith('.csv')) {
        Papa.parse(content, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const data = results.data as Record<string, string>[];
            setImportData(data);
            initializeFieldMapping(results.meta.fields || []);
          },
          error: (error: Error) => {
            console.error('CSV parsing error:', error);
            setImportErrors([`Error parsing CSV: ${error.message}`]);
          }
        });
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        try {
          const workbook = XLSX.read(content, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length > 0) {
            const headers = jsonData[0] as string[];
            const data = jsonData.slice(1).map((row) => {
              const obj: Record<string, string> = {};
              const rowArray = row as unknown[];
              headers.forEach((header, index) => {
                obj[header] = String(rowArray[index] || '');
              });
              return obj;
            });
            
            setImportData(data);
            initializeFieldMapping(headers);
          }
        } catch (error) {
          console.error('Excel parsing error:', error);
          setImportErrors([`Error parsing Excel file: ${error}`]);
        }
      }
    };

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  };

  const initializeFieldMapping = (headers: string[]) => {
    const defaultMapping: Record<string, string> = {};
    
    // Auto-map common field names
    headers.forEach(header => {
      const lowerHeader = header.toLowerCase().trim();
      if (lowerHeader.includes('name') && !lowerHeader.includes('partner')) {
        defaultMapping[header] = 'name';
      } else if (lowerHeader.includes('email') && !lowerHeader.includes('partner')) {
        defaultMapping[header] = 'email';
      } else if (lowerHeader.includes('phone') && !lowerHeader.includes('partner')) {
        defaultMapping[header] = 'phone';
      } else if (lowerHeader.includes('age')) {
        defaultMapping[header] = 'age';
      } else if (lowerHeader.includes('gender')) {
        defaultMapping[header] = 'gender';
      } else if (lowerHeader.includes('tower')) {
        defaultMapping[header] = 'tower';
      } else if (lowerHeader.includes('flat')) {
        defaultMapping[header] = 'flatNumber';
      } else if (lowerHeader.includes('emergency')) {
        defaultMapping[header] = 'emergencyContact';
      } else if (lowerHeader.includes('level') || lowerHeader.includes('expertise')) {
        defaultMapping[header] = 'expertiseLevel';
      } else if (lowerHeader.includes('category')) {
        defaultMapping[header] = 'selectedCategory';
      } else if (lowerHeader.includes('partner') && lowerHeader.includes('name')) {
        defaultMapping[header] = 'partnerName';
      } else if (lowerHeader.includes('partner') && lowerHeader.includes('phone')) {
        defaultMapping[header] = 'partnerPhone';
      } else if (lowerHeader.includes('partner') && lowerHeader.includes('email')) {
        defaultMapping[header] = 'partnerEmail';
      } else if (lowerHeader.includes('partner') && lowerHeader.includes('tower')) {
        defaultMapping[header] = 'partnerTower';
      } else if (lowerHeader.includes('partner') && lowerHeader.includes('flat')) {
        defaultMapping[header] = 'partnerFlatNumber';
      } else if (lowerHeader.includes('payment') && lowerHeader.includes('reference')) {
        defaultMapping[header] = 'paymentReference';
      } else if (lowerHeader.includes('payment') && lowerHeader.includes('method')) {
        defaultMapping[header] = 'paymentMethod';
      } else if (lowerHeader.includes('payment') && lowerHeader.includes('amount')) {
        defaultMapping[header] = 'paymentAmount';
      }
    });

    setFieldMapping(defaultMapping);
  };

  const validateImportData = () => {
    const errors: string[] = [];
    const preview: Record<string, unknown>[] = [];

    importData.forEach((row, index) => {
      const mappedRow: Record<string, unknown> = {};
      let hasErrors = false;

      // Required fields validation
      const requiredFields = ['name', 'email', 'phone', 'age', 'gender', 'expertiseLevel', 'selectedCategory'];
      
      requiredFields.forEach(field => {
        const mappedField = Object.keys(fieldMapping).find(key => fieldMapping[key] === field);
        if (mappedField && fieldMapping[mappedField] !== 'skip' && row[mappedField]) {
          mappedRow[field] = row[mappedField];
        } else {
          errors.push(`Row ${index + 1}: Missing required field "${field}"`);
          hasErrors = true;
        }
      });

      // Data type validation
      if (mappedRow.age && isNaN(Number(mappedRow.age))) {
        errors.push(`Row ${index + 1}: Age must be a number`);
        hasErrors = true;
      }

      if (mappedRow.email && typeof mappedRow.email === 'string' && !mappedRow.email.includes('@')) {
        errors.push(`Row ${index + 1}: Invalid email format`);
        hasErrors = true;
      }

      // Gender validation
      if (mappedRow.gender && typeof mappedRow.gender === 'string' && !['male', 'female', 'other'].includes(mappedRow.gender.toLowerCase())) {
        errors.push(`Row ${index + 1}: Gender must be male, female, or other`);
        hasErrors = true;
      }

      // Expertise level validation
      if (mappedRow.expertiseLevel && typeof mappedRow.expertiseLevel === 'string' && !['beginner', 'intermediate', 'advanced', 'expert'].includes(mappedRow.expertiseLevel.toLowerCase())) {
        errors.push(`Row ${index + 1}: Expertise level must be beginner, intermediate, advanced, or expert`);
        hasErrors = true;
      }

      // Add tournament ID
      mappedRow.tournamentId = selectedImportTournament;
      mappedRow.registrationStatus = 'pending';
      mappedRow.paymentStatus = 'pending';
      mappedRow.registeredAt = new Date();
      mappedRow.registrationCode = `IMP-${Date.now()}-${index}`;

      preview.push({
        ...mappedRow,
        isValid: !hasErrors,
        rowIndex: index + 1
      });
    });

    setImportErrors(errors);
    setImportPreview(preview);
    setImportStep('preview');
  };

  const executeImport = async () => {
    setImporting(true);
    setImportStep('importing');
    
    try {
      const validRows = importPreview.filter(row => row.isValid);
      let successCount = 0;
      let errorCount = 0;

      for (const row of validRows) {
        try {
          const registrationData = {
            ...row,
            age: parseInt(String(row.age)),
            gender: String(row.gender).toLowerCase(),
            expertiseLevel: String(row.expertiseLevel).toLowerCase(),
            isResident: true, // Default to true for imported registrations
            registeredAt: new Date(),
          };

          await addDoc(collection(db, 'tournaments', String(row.tournamentId), 'registrations'), registrationData);
          successCount++;
        } catch (error) {
          console.error(`Error importing row ${row.rowIndex}:`, error);
          errorCount++;
        }
      }

      // Refresh registrations
      await loadRegistrations();
      
      // Close modal and reset state
      setShowImportModal(false);
      setImportFile(null);
      setImportData([]);
      setFieldMapping({});
      setImportPreview([]);
      setImportErrors([]);
      setSelectedImportTournament('');
      setImportStep('upload');

      alert({
        title: 'Import Completed',
        description: `${successCount} registrations imported successfully. ${errorCount} failed.`,
        variant: successCount > 0 ? 'success' : 'warning'
      });
    } catch (error) {
      console.error('Import error:', error);
      alert({
        title: 'Import Failed',
        description: 'Import failed. Please try again.',
        variant: 'error'
      });
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setShowImportModal(false);
    setImportFile(null);
    setImportData([]);
    setFieldMapping({});
    setImportPreview([]);
    setImportErrors([]);
    setSelectedImportTournament('');
    setImportStep('upload');
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
      <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 min-w-0 max-w-full flex-col overflow-hidden p-4">
        <div className="mb-4 shrink-0 grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
            <Users className="h-4 w-4 shrink-0 text-blue-600" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-blue-700">Total</p>
              <p className="text-lg font-semibold leading-tight text-blue-900">{registrations.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
            <Clock className="h-4 w-4 shrink-0 text-amber-600" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-amber-700">Pending</p>
              <p className="text-lg font-semibold leading-tight text-amber-900">
                {registrations.filter(p => p.registrationStatus === 'pending').length}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-green-100 bg-green-50 px-3 py-2">
            <CheckCircle className="h-4 w-4 shrink-0 text-green-600" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-green-700">Approved</p>
              <p className="text-lg font-semibold leading-tight text-green-900">
                {registrations.filter(p => p.registrationStatus === 'approved').length}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2">
            <XCircle className="h-4 w-4 shrink-0 text-red-600" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-red-700">Rejected</p>
              <p className="text-lg font-semibold leading-tight text-red-900">
                {registrations.filter(p => p.registrationStatus === 'rejected').length}
              </p>
            </div>
          </div>
        </div>

        {/* Registrations Table */}
        <Card className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden py-3">
          <CardHeader className="shrink-0 pb-0">
            <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1">
              <CardTitle className="shrink-0 whitespace-nowrap text-base">
                Registrations ({filteredParticipants.length})
              </CardTitle>
              <Select value={selectedTournament} onValueChange={setSelectedTournament}>
                <SelectTrigger className="h-9 w-[min(200px,28vw)] shrink-0" aria-label="Filter by tournament">
                  <SelectValue placeholder="Tournament" />
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
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[130px] shrink-0" aria-label="Filter by status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-9 w-[min(180px,28vw)] shrink-0 capitalize" aria-label="Filter by category">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {availableCategories.map(category => (
                    <SelectItem key={category} value={category} className="capitalize">
                      {category.replace(/-/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search name, email, phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-9 pl-9"
                  aria-label="Search registrations"
                />
              </div>
              <Button onClick={exportParticipants} variant="outline" size="sm" className="h-9 shrink-0 whitespace-nowrap">
                <Download className="h-4 w-4 mr-1.5" />
                Export
              </Button>
              <Button onClick={() => setShowImportModal(true)} variant="outline" size="sm" className="h-9 shrink-0 whitespace-nowrap">
                <Upload className="h-4 w-4 mr-1.5" />
                Import
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden pt-1 pb-4">
            {filteredParticipants.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-center">
                <div>
                  <Users className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                  <h3 className="mb-2 text-lg font-medium text-gray-900">No registrations found</h3>
                  <p className="text-gray-600">Try adjusting your filters or search terms</p>
                </div>
              </div>
            ) : (
            <div className="registrations-table-scroll min-h-0 flex-1 rounded-md border">
              <table className="w-max min-w-full caption-bottom text-sm [&_td]:py-1 [&_th]:h-9">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={`${STICKY_HEAD_CORNER} left-0 w-14`}>Photo</TableHead>
                    <TableHead className={`${STICKY_HEAD_CORNER} left-14 min-w-[140px]`}>Name</TableHead>
                    <TableHead className={STICKY_HEAD}>Email</TableHead>
                    <TableHead className={STICKY_HEAD}>Phone</TableHead>
                    <TableHead className={STICKY_HEAD}>Age</TableHead>
                    <TableHead className={STICKY_HEAD}>Gender</TableHead>
                    <TableHead className={STICKY_HEAD}>Tower/Flat</TableHead>
                    <TableHead className={STICKY_HEAD}>Level</TableHead>
                    <TableHead className={STICKY_HEAD}>Category</TableHead>
                    <TableHead className={STICKY_HEAD}>Status</TableHead>
                    <TableHead className={STICKY_HEAD}>Payment</TableHead>
                    <TableHead className={`${STICKY_HEAD} min-w-[100px]`}>Ref No</TableHead>
                    <TableHead className={`${STICKY_HEAD} min-w-[90px]`}>Paid Amount</TableHead>
                    <TableHead className={`${STICKY_HEAD} min-w-[120px]`}>Paid To</TableHead>
                    <TableHead className={STICKY_HEAD}>Registration Date</TableHead>
                    <TableHead className={`${STICKY_HEAD_RIGHT} min-w-[150px]`}>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredParticipants.map((participant) => {
                    const paymentRecipient = parsePaymentRecipient(participant.selectedPaymentAccount);

                    return (
                      <TableRow key={participant.id} className="group">
                        <TableCell className={`${STICKY_CELL} left-0 w-14`}>
                          {participant.profilePhotoUrl ? (
                            <div className="relative h-8 w-8 overflow-hidden rounded-full bg-gray-100">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={participant.profilePhotoUrl}
                                alt={participant.name}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-muted-foreground">
                              {getInitials(participant.name) || '—'}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className={`${STICKY_CELL} left-14 min-w-[140px] max-w-[180px] font-medium`}>
                          <span className="block truncate" title={participant.name}>{participant.name}</span>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={participant.email}>{participant.email}</TableCell>
                        <TableCell>{participant.phone}</TableCell>
                        <TableCell>{participant.age}</TableCell>
                        <TableCell className="capitalize">{participant.gender}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {participant.tower || participant.flatNumber
                            ? [participant.tower, participant.flatNumber].filter(Boolean).join(' ')
                            : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize shrink-0">
                            {participant.expertiseLevel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize shrink-0">
                            {participant.selectedCategory?.replace(/-/g, ' ') || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${getStatusColor(participant.registrationStatus)} shrink-0 capitalize`}>
                            <span className="inline-flex items-center gap-1">
                              {getStatusIcon(participant.registrationStatus)}
                              {participant.registrationStatus}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={participant.paymentStatus || 'pending'}
                            onValueChange={(value) =>
                              handlePaymentStatusChange(
                                participant.id,
                                value as Registration['paymentStatus']
                              )
                            }
                            disabled={updatingPaymentId === participant.id}
                          >
                            <SelectTrigger className="h-8 w-[88px] shrink-0 capitalize">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="paid">Paid</SelectItem>
                              <SelectItem value="refunded">Refunded</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="min-w-[100px] max-w-[140px]">
                          {participant.paymentReference ? (
                            <span className="block truncate font-mono text-xs" title={participant.paymentReference}>
                              {participant.paymentReference}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="min-w-[90px] tabular-nums">
                          {participant.paymentAmount != null ? (
                            <span>₹{participant.paymentAmount.toLocaleString('en-IN')}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="min-w-[120px] max-w-[160px]">
                          {paymentRecipient?.name ? (
                            <span
                              className="block truncate font-medium"
                              title={
                                paymentRecipient.number
                                  ? `${paymentRecipient.name} (${paymentRecipient.number})`
                                  : paymentRecipient.name
                              }
                            >
                              {paymentRecipient.name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>{new Date(participant.registeredAt).toLocaleDateString()}</TableCell>
                        <TableCell className={`${STICKY_CELL_RIGHT} min-w-[150px]`}>
                          <div className="flex flex-nowrap items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openReviewDrawer(participant.id)}
                              className="h-8 shrink-0 px-2"
                              title="View registration"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditDrawer(participant.id)}
                              className="h-8 shrink-0 px-2"
                              title="Edit registration"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {participant.registrationStatus === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleStatusChange(participant.id, 'approved')}
                                  className="h-8 shrink-0 px-2 text-green-600 hover:text-green-700"
                                  title="Approve"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleStatusChange(participant.id, 'rejected')}
                                  className="h-8 shrink-0 px-2 text-red-600 hover:text-red-700"
                                  title="Reject"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {participant.registrationStatus === 'approved' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStatusChange(participant.id, 'rejected')}
                                className="h-8 shrink-0 px-2 text-red-600 hover:text-red-700"
                                title="Reject"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            )}
                            {participant.registrationStatus === 'rejected' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStatusChange(participant.id, 'approved')}
                                className="h-8 shrink-0 px-2 text-green-600 hover:text-green-700"
                                title="Approve"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => requestDelete(participant.id)}
                              disabled={deletingId === participant.id}
                              className="h-8 shrink-0 px-2 text-red-600 hover:text-red-700"
                              title="Delete registration"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </table>
            </div>
            )}
          </CardContent>
        </Card>

        {/* Import Modal */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Import Registrations</h2>
                <Button variant="outline" onClick={resetImport}>
                  ✕
                </Button>
              </div>

              {/* Step 1: File Upload */}
              {importStep === 'upload' && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Upload CSV or Excel File</h3>
                    <p className="text-gray-600 mb-4">
                      Select a CSV or Excel file containing registration data
                    </p>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Choose File
                    </label>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Expected CSV/Excel Format:</h4>
                    <div className="text-sm text-blue-800 mb-3">
                      <p><strong>Required columns:</strong> Name, Email, Phone, Age, Gender, Expertise Level, Category</p>
                      <p><strong>Optional columns:</strong> Tower, Flat Number, Emergency Contact, Partner Name, Partner Phone, Partner Email, Partner Tower, Partner Flat Number, Payment Reference, Payment Method, Payment Amount</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={downloadTemplate}>
                      <Download className="h-4 w-4 mr-2" />
                      Download Template CSV
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Tournament Selection */}
              {importStep === 'tournament' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Select Tournament</h3>
                  <p className="text-gray-600">Choose which tournament these registrations will be imported to:</p>
                  
                  <div className="space-y-2">
                    <Label htmlFor="import-tournament">Tournament</Label>
                    <Select value={selectedImportTournament} onValueChange={setSelectedImportTournament}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a tournament..." />
                      </SelectTrigger>
                      <SelectContent>
                        {tournaments.map(tournament => (
                          <SelectItem key={tournament.id} value={tournament.id}>
                            {tournament.name} ({tournament.sport})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setImportStep('upload')}>
                      Back
                    </Button>
                    <Button 
                      onClick={() => setImportStep('mapping')}
                      disabled={!selectedImportTournament}
                    >
                      Continue to Field Mapping
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Field Mapping */}
              {importStep === 'mapping' && importData.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Map CSV Columns to Registration Fields</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.keys(importData[0] || {}).map((header) => (
                      <div key={header} className="space-y-2">
                        <Label htmlFor={`mapping-${header}`}>{header}</Label>
                        <Select
                          value={fieldMapping[header] || 'skip'}
                          onValueChange={(value) => setFieldMapping(prev => ({ ...prev, [header]: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select field..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="skip">Skip this column</SelectItem>
                            <SelectItem value="name">Name (Required)</SelectItem>
                            <SelectItem value="email">Email (Required)</SelectItem>
                            <SelectItem value="phone">Phone (Required)</SelectItem>
                            <SelectItem value="age">Age (Required)</SelectItem>
                            <SelectItem value="gender">Gender (Required)</SelectItem>
                            <SelectItem value="tower">Tower</SelectItem>
                            <SelectItem value="flatNumber">Flat Number</SelectItem>
                            <SelectItem value="emergencyContact">Emergency Contact</SelectItem>
                            <SelectItem value="expertiseLevel">Expertise Level (Required)</SelectItem>
                            <SelectItem value="selectedCategory">Category (Required)</SelectItem>
                            <SelectItem value="partnerName">Partner Name</SelectItem>
                            <SelectItem value="partnerPhone">Partner Phone</SelectItem>
                            <SelectItem value="partnerEmail">Partner Email</SelectItem>
                            <SelectItem value="partnerTower">Partner Tower</SelectItem>
                            <SelectItem value="partnerFlatNumber">Partner Flat Number</SelectItem>
                            <SelectItem value="paymentReference">Payment Reference</SelectItem>
                            <SelectItem value="paymentMethod">Payment Method</SelectItem>
                            <SelectItem value="paymentAmount">Payment Amount</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setImportStep('tournament')}>
                      Back
                    </Button>
                    <Button onClick={validateImportData}>
                      Preview Import
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 4: Preview */}
              {importStep === 'preview' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Import Preview</h3>
                  
                  {importErrors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center mb-2">
                        <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                        <h4 className="font-medium text-red-900">Validation Errors</h4>
                      </div>
                      <ul className="text-sm text-red-800 space-y-1">
                        {importErrors.slice(0, 10).map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                        {importErrors.length > 10 && (
                          <li>• ... and {importErrors.length - 10} more errors</li>
                        )}
                      </ul>
                    </div>
                  )}

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <strong>{importPreview.filter(p => p.isValid).length}</strong> valid registrations will be imported
                      {importPreview.filter(p => !p.isValid).length > 0 && (
                        <span className="text-red-600">
                          , <strong>{importPreview.filter(p => !p.isValid).length}</strong> will be skipped due to errors
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="max-h-60 overflow-y-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Row</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Age</TableHead>
                          <TableHead>Gender</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importPreview.slice(0, 20).map((row, index) => (
                          <TableRow key={index}>
                            <TableCell>{String(row.rowIndex)}</TableCell>
                            <TableCell>{String(row.name)}</TableCell>
                            <TableCell>{String(row.email)}</TableCell>
                            <TableCell>{String(row.phone)}</TableCell>
                            <TableCell>{String(row.age)}</TableCell>
                            <TableCell>{String(row.gender)}</TableCell>
                            <TableCell>
                              {row.isValid ? (
                                <Badge className="bg-green-100 text-green-800">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Valid
                                </Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-800">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Error
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {importPreview.length > 20 && (
                      <div className="p-2 text-center text-sm text-gray-500">
                        Showing first 20 rows of {importPreview.length} total
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setImportStep('mapping')}>
                      Back to Mapping
                    </Button>
                    <Button 
                      onClick={executeImport}
                      disabled={importPreview.filter(p => p.isValid).length === 0}
                    >
                      Import {importPreview.filter(p => p.isValid).length} Registrations
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 5: Importing */}
              {importStep === 'importing' && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <h3 className="text-lg font-medium mb-2">Importing Registrations...</h3>
                  <p className="text-gray-600">Please wait while we process your data</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <RegistrationReviewDrawer
        open={reviewDrawerOpen}
        onOpenChange={(open) => {
          setReviewDrawerOpen(open);
          if (!open) setReviewParticipantId(null);
        }}
        participant={reviewParticipant}
        onApprove={handleReviewApprove}
        onReject={handleReviewReject}
        onEdit={(id) => {
          setReviewDrawerOpen(false);
          setReviewParticipantId(null);
          openEditDrawer(id);
        }}
        onDelete={requestDelete}
        actionLoading={statusActionLoading}
      />

      <RegistrationEditDrawer
        open={editDrawerOpen}
        onOpenChange={(open) => {
          setEditDrawerOpen(open);
          if (!open) setEditParticipantId(null);
        }}
        participant={editParticipant}
        availableCategories={editTournamentCategories}
        onSave={handleSaveEdit}
        saving={editSaving}
      />

      {AlertDialogComponent}
      {ConfirmDialogComponent}
    </AdminLayout>
  );
}
