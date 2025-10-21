'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { collection, getDocs, updateDoc, doc, query, where, orderBy, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tournament, Registration, Player } from '@/types';
import { Search, Users, CheckCircle, XCircle, Clock, Download, Filter, Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export default function ManageRegistrationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [registrations, setRegistrations] = useState<(Registration & { tournamentId: string; tournamentName: string })[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTournament, setSelectedTournament] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
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
      const requiredFields = ['name', 'email', 'phone', 'age', 'gender', 'tower', 'flatNumber', 'emergencyContact', 'expertiseLevel', 'selectedCategory'];
      
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

      alert(`Import completed! ${successCount} registrations imported successfully. ${errorCount} failed.`);
    } catch (error) {
      console.error('Import error:', error);
      alert('Import failed. Please try again.');
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
              <div className="flex items-end gap-2">
                <Button onClick={exportParticipants} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Button onClick={() => setShowImportModal(true)} className="flex-1">
                  <Upload className="h-4 w-4 mr-2" />
                  Import CSV/Excel
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
                    <TableHead>Category</TableHead>
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
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {participant.selectedCategory?.replace(/-/g, ' ') || 'N/A'}
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
                      <p><strong>Required columns:</strong> Name, Email, Phone, Age, Gender, Tower, Flat Number, Emergency Contact, Expertise Level, Category</p>
                      <p><strong>Optional columns:</strong> Partner Name, Partner Phone, Partner Email, Partner Tower, Partner Flat Number, Payment Reference, Payment Method, Payment Amount</p>
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
                            <SelectItem value="tower">Tower (Required)</SelectItem>
                            <SelectItem value="flatNumber">Flat Number (Required)</SelectItem>
                            <SelectItem value="emergencyContact">Emergency Contact (Required)</SelectItem>
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
    </AdminLayout>
  );
}
