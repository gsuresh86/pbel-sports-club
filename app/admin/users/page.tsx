'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where, setDoc, getDoc } from 'firebase/firestore';
import { updatePassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { User, Tournament, UserRole } from '@/types';
import { useAlertDialog } from '@/components/ui/alert-dialog-component';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Users, 
  UserPlus, 
  Shield, 
  Settings, 
  Search, 
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';

export default function UserManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { alert, AlertDialogComponent } = useAlertDialog();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();
  const [users, setUsers] = useState<User[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'tournament-admin' as UserRole,
    assignedTournaments: [] as string[],
    isActive: true,
  });

  const isFullAdmin = user?.role === 'admin' || user?.role === 'super-admin';
  const canManageUsers = isFullAdmin || user?.role === 'tournament-admin';
  // Tournaments this user is allowed to assign (full admins get all)
  const assignableTournaments = isFullAdmin
    ? tournaments
    : tournaments.filter(t => (user?.assignedTournaments || []).includes(t.id));

  useEffect(() => {
    if (!authLoading && !canManageUsers) {
      router.push('/login');
      return;
    }
    if (!authLoading && user?.role === 'tournament-admin') {
      const firstTournament = user.assignedTournaments?.[0];
      router.push(
        firstTournament
          ? `/admin/tournaments/${firstTournament}/users`
          : '/admin/tournaments'
      );
      return;
    }
    if (canManageUsers) {
      loadData();
    }
  }, [user, authLoading, router, canManageUsers]);

  // Filter users based on search and filters
  useEffect(() => {
    let filtered = users;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, roleFilter]);

  const loadData = async () => {
    try {
      // Load users — full admins see everyone; tournament-admins see only referees
      const usersQuery = isFullAdmin
        ? query(collection(db, 'users'), orderBy('createdAt', 'desc'))
        : query(collection(db, 'users'), where('role', '==', 'referee'));
      const usersSnapshot = await getDocs(usersQuery);
      let usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as User[];
      // The referee-only query can't orderBy createdAt without a composite index,
      // so sort newest-first on the client instead.
      if (!isFullAdmin) {
        usersData = usersData.sort(
          (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
        );
      }

      // Load tournaments
      const tournamentsQuery = query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'));
      const tournamentsSnapshot = await getDocs(tournamentsQuery);
      const tournamentsData = tournamentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        endDate: doc.data().endDate?.toDate(),
        registrationDeadline: doc.data().registrationDeadline?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Tournament[];

      setUsers(usersData);
      setTournaments(tournamentsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form data
    if (!formData.name.trim()) {
      alert({
        title: 'Validation Error',
        description: 'Name is required',
        variant: 'error'
      });
      return;
    }
    if (!formData.email.trim()) {
      alert({
        title: 'Validation Error',
        description: 'Email is required',
        variant: 'error'
      });
      return;
    }
    if (!formData.role) {
      alert({
        title: 'Validation Error',
        description: 'Role is required',
        variant: 'error'
      });
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      alert({
        title: 'Validation Error',
        description: 'Please enter a valid email address',
        variant: 'error'
      });
      return;
    }
    
    try {
      console.log('Creating user with data:', formData);
      console.log('Current admin user:', user);
      console.log('Auth loading state:', authLoading);
      
      // Check if current user may manage users
      if (!user || !canManageUsers) {
        alert({
          title: 'Permission Denied',
          description: 'You do not have permission to manage users',
          variant: 'error'
        });
        return;
      }
      
      // Check if user is authenticated
      if (!auth.currentUser) {
        alert({
          title: 'Authentication Required',
          description: 'You must be logged in to create users',
          variant: 'error'
        });
        return;
      }
      
      console.log('Current Firebase Auth user:', auth.currentUser.uid);
      console.log('Current user role from context:', user.role);
      console.log('Current user ID from context:', user.id);
      
      // Let's also try to read the user document directly to see what's in Firestore
      try {
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        console.log('User document exists:', userDocSnap.exists());
        if (userDocSnap.exists()) {
          console.log('User document data:', userDocSnap.data());
        } else {
          console.log('User document does not exist in Firestore!');
        }
      } catch (docError) {
        console.error('Error reading user document:', docError);
      }
      
      // Tournament-admins may only manage referees, scoped to their own tournaments.
      let effectiveRole: UserRole = formData.role;
      let effectiveTournaments = formData.assignedTournaments;
      if (!isFullAdmin) {
        effectiveRole = 'referee';
        const allowed = user.assignedTournaments || [];
        const within = formData.assignedTournaments.filter(id => allowed.includes(id));
        if (editingUser) {
          // Preserve any assignments to tournaments outside this admin's control.
          const outside = (editingUser.assignedTournaments || []).filter(id => !allowed.includes(id));
          effectiveTournaments = Array.from(new Set([...outside, ...within]));
        } else {
          effectiveTournaments = within;
        }
      }

      const userData = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        role: effectiveRole,
        assignedTournaments: effectiveTournaments,
        isActive: formData.isActive,
        updatedAt: new Date(),
        createdBy: user?.id,
      };

      if (editingUser) {
        const { getAuthHeaders } = await import('@/lib/client-auth-headers');
        const response = await fetch(`/api/users/${editingUser.id}`, {
          method: 'PATCH',
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            name: userData.name,
            role: userData.role,
            assignedTournaments: userData.assignedTournaments,
            isActive: userData.isActive,
            ...(formData.password?.trim() ? { password: formData.password.trim() } : {}),
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result.error || 'Failed to update user');
        }
      } else {
        // Create new user with password
        if (!formData.password || formData.password.trim() === '') {
          alert({
            title: 'Validation Error',
            description: 'Password is required for new users',
            variant: 'error'
          });
          return;
        }

        if (formData.password.length < 6) {
          alert({
            title: 'Validation Error',
            description: 'Password must be at least 6 characters long',
            variant: 'error'
          });
          return;
        }

        console.log('Creating user via API...');
        
        // Create user via API route to avoid authentication state conflicts
        const { getAuthHeaders } = await import('@/lib/client-auth-headers');
        const response = await fetch('/api/create-user', {
          method: 'POST',
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            name: formData.name,
            role: effectiveRole,
            assignedTournaments: effectiveTournaments,
            isActive: formData.isActive,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to create user');
        }

        console.log('User created successfully via API:', result.userId);
      }

      console.log('User operation completed successfully');
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error: unknown) {
      console.error('Error saving user:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      
      if (error && typeof error === 'object' && 'code' in error) {
        const firebaseError = error as { code: string; message: string };
        console.error('Firebase error code:', firebaseError.code);
        console.error('Firebase error message:', firebaseError.message);
        
        if (firebaseError.code === 'auth/email-already-in-use') {
          alert({
            title: 'Error',
            description: 'Email is already in use',
            variant: 'error'
          });
        } else if (firebaseError.code === 'auth/weak-password') {
          alert({
            title: 'Error',
            description: 'Password should be at least 6 characters',
            variant: 'error'
          });
        } else if (firebaseError.code === 'auth/invalid-email') {
          alert({
            title: 'Error',
            description: 'Invalid email address',
            variant: 'error'
          });
        } else if (firebaseError.code === 'permission-denied') {
          alert({
            title: 'Permission Denied',
            description: 'Permission denied. Please check if you have admin privileges.',
            variant: 'error'
          });
        } else {
          alert({
            title: 'Error',
            description: `Failed to save user: ${firebaseError.message}`,
            variant: 'error'
          });
        }
      } else {
        alert({
          title: 'Error',
          description: 'Failed to save user. Please check the console for details.',
          variant: 'error'
        });
      }
    }
  };

  const handleEdit = (user: User) => {
    if (!isFullAdmin && user.role !== 'referee') {
      alert({
        title: 'Permission Denied',
        description: 'You can only edit referee accounts',
        variant: 'error'
      });
      return;
    }
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '', // Always initialize password as empty string
      role: user.role,
      assignedTournaments: user.assignedTournaments || [],
      isActive: user.isActive !== false,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    confirm({
      title: 'Delete User',
      description: 'Are you sure you want to delete this user? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          const { getAuthHeaders } = await import('@/lib/client-auth-headers');
          const response = await fetch(`/api/users/${id}`, {
            method: 'DELETE',
            headers: await getAuthHeaders(),
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(result.error || 'Failed to delete user');
          }
          alert({
            title: 'Success',
            description: 'User deleted successfully',
            variant: 'success'
          });
          loadData();
        } catch (error) {
          console.error('Error deleting user:', error);
          alert({
            title: 'Error',
            description: error instanceof Error ? error.message : 'Failed to delete user',
            variant: 'error'
          });
        }
      }
    });
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { getAuthHeaders } = await import('@/lib/client-auth-headers');
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update user status');
      }
      loadData();
    } catch (error) {
      console.error('Error updating user status:', error);
      alert({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update user status',
        variant: 'error'
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: isFullAdmin ? 'tournament-admin' : 'referee',
      assignedTournaments: [],
      isActive: true,
    });
    setEditingUser(null);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
      case 'super-admin':
        return 'bg-rose-50 text-rose-700 border-rose-100';
      case 'tournament-admin':
        return 'bg-sky-50 text-sky-700 border-sky-100';
      case 'referee':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'public':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="h-4 w-4" />;
      case 'tournament-admin': return <Settings className="h-4 w-4" />;
      case 'public': return <Users className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
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
      <div className="min-h-screen flex items-center justify-center bg-[#f4f5f7]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800 mx-auto" />
          <p className="mt-4 text-slate-500 text-sm">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout moduleName="User Management">
      <div className="min-h-full bg-[#f4f5f7] p-6 lg:p-8">
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-2xl border-slate-200 bg-slate-50 shadow-none gap-0 py-3">
            <CardContent className="px-5">
              <p className="text-sm text-slate-500">Total Users</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{users.length}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-rose-100 bg-rose-50 shadow-none gap-0 py-3">
            <CardContent className="px-5">
              <p className="text-sm text-rose-700/80">Admins</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                {users.filter(u => u.role === 'admin' || u.role === 'super-admin').length}
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-sky-100 bg-sky-50 shadow-none gap-0 py-3">
            <CardContent className="px-5">
              <p className="text-sm text-sky-700/80">Tournament Admins</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                {users.filter(u => u.role === 'tournament-admin').length}
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-emerald-100 bg-emerald-50 shadow-none gap-0 py-3">
            <CardContent className="px-5">
              <p className="text-sm text-emerald-700/80">Active Users</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                {users.filter(u => u.isActive !== false).length}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-none gap-0 py-0 overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">All Users</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Showing {filteredUsers.length} of {users.length}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search by name or email"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-9 w-full sm:w-64 rounded-xl border-slate-200 bg-white pl-9 text-sm focus-ring-thin"
                />
              </div>

              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="h-9 w-full sm:w-44 rounded-xl border-slate-200 focus-ring-thin">
                  <Filter className="h-3 w-3 mr-1 text-slate-400" />
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="tournament-admin">Tournament Admin</SelectItem>
                  <SelectItem value="referee">Referee</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>

              <Button
                onClick={() => { resetForm(); setDialogOpen(true); }}
                className="h-9 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                {isFullAdmin ? 'Add User' : 'Add Referee'}
              </Button>
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="py-16 text-center">
              {users.length === 0 ? (
                <>
                  <Users className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                  <h3 className="text-base font-semibold text-slate-900">No users yet</h3>
                  <p className="mt-1 text-sm text-slate-500 mb-4">
                    Create your first user to get started
                  </p>
                  <Button
                    onClick={() => { resetForm(); setDialogOpen(true); }}
                    className="rounded-xl bg-slate-900 hover:bg-slate-800"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    {isFullAdmin ? 'Add User' : 'Add Referee'}
                  </Button>
                </>
              ) : (
                <>
                  <Search className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                  <h3 className="text-base font-semibold text-slate-900">No users found</h3>
                  <p className="mt-1 text-sm text-slate-500 mb-4">
                    Try adjusting your search or filters
                  </p>
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      setSearchTerm('');
                      setRoleFilter('all');
                    }}
                  >
                    Clear Filters
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-slate-100 bg-slate-50/60">
                    <TableHead className="h-11 pl-5 text-xs font-medium text-slate-400">
                      Name
                    </TableHead>
                    <TableHead className="h-11 text-xs font-medium text-slate-400">
                      Email
                    </TableHead>
                    <TableHead className="h-11 text-xs font-medium text-slate-400">
                      Role
                    </TableHead>
                    <TableHead className="h-11 text-xs font-medium text-slate-400">
                      Assigned Tournaments
                    </TableHead>
                    <TableHead className="h-11 text-xs font-medium text-slate-400">
                      Status
                    </TableHead>
                    <TableHead className="h-11 text-xs font-medium text-slate-400">
                      Created
                    </TableHead>
                    <TableHead className="h-11 pr-5 text-right text-xs font-medium text-slate-400">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user, index) => (
                    <TableRow
                      key={user.id}
                      className={`border-slate-50 ${
                        index % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                      } hover:bg-slate-50`}
                    >
                      <TableCell className="pl-5 py-3.5">
                        <div className="font-medium text-slate-900">{user.name}</div>
                      </TableCell>
                      <TableCell className="py-3.5 text-sm text-slate-700">
                        {user.email}
                      </TableCell>
                      <TableCell className="py-3.5">
                        <Badge className={`rounded-full border capitalize ${getRoleColor(user.role)}`}>
                          <span className="flex items-center gap-1">
                            {getRoleIcon(user.role)}
                            {user.role.replace('-', ' ')}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3.5">
                        {user.assignedTournaments && user.assignedTournaments.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {user.assignedTournaments.map((tournamentId) => {
                              const tournament = tournaments.find(t => t.id === tournamentId);
                              return (
                                <Badge
                                  key={tournamentId}
                                  variant="outline"
                                  className="rounded-full border-slate-200 text-xs font-normal text-slate-600"
                                >
                                  {tournament?.name || 'Unknown Tournament'}
                                </Badge>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">No tournaments assigned</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3.5">
                        <Badge
                          className={`rounded-full border ${
                            user.isActive !== false
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : 'bg-rose-50 text-rose-700 border-rose-100'
                          }`}
                        >
                          {user.isActive !== false ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3.5 text-sm text-slate-600">
                        {formatDate(user.createdAt)}
                      </TableCell>
                      <TableCell className="pr-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900"
                            onClick={() => toggleUserStatus(user.id, user.isActive !== false)}
                            title={user.isActive !== false ? 'Deactivate user' : 'Activate user'}
                          >
                            {user.isActive !== false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900"
                            onClick={() => handleEdit(user)}
                            title="Edit User"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {(user.role !== 'admin' && user.role !== 'super-admin') && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                              onClick={() => handleDelete(user.id)}
                              title="Delete User"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        {/* Add/Edit User Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[95vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
              <DialogDescription>
                {editingUser ? 'Update user details and tournament access' : 'Create a new user account with tournament access'}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto pr-2">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingUser ? "Leave empty to keep current password" : "Enter password"}
                    required={!editingUser}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={formData.role} onValueChange={(value: UserRole) => setFormData({ ...formData, role: value })} disabled={!isFullAdmin}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {isFullAdmin && <SelectItem value="admin">Admin (Full Access)</SelectItem>}
                      {isFullAdmin && <SelectItem value="tournament-admin">Tournament Admin (Limited Access)</SelectItem>}
                      <SelectItem value="referee">Referee (Matches & Scoring Only)</SelectItem>
                      {isFullAdmin && <SelectItem value="public">Public User</SelectItem>}
                    </SelectContent>
                  </Select>
                  {!isFullAdmin && (
                    <p className="text-xs text-gray-500">Tournament admins can only create referees.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isActive"
                      checked={formData.isActive}
                      onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked as boolean })}
                    />
                    <Label htmlFor="isActive">Active User</Label>
                  </div>
                </div>
              </div>

              {(formData.role === 'tournament-admin' || formData.role === 'referee') && (
                <div className="space-y-3">
                  <div>
                    <Label>Assigned Tournaments</Label>
                    <p className="text-sm text-gray-600 mt-1">
                      {formData.role === 'referee'
                        ? 'Select tournaments this referee can score matches for'
                        : 'Select tournaments this user can manage'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Select
                      value=""
                      onValueChange={(tournamentId) => {
                        if (tournamentId && !formData.assignedTournaments.includes(tournamentId)) {
                          setFormData({
                            ...formData,
                            assignedTournaments: [...formData.assignedTournaments, tournamentId]
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="w-full h-9">
                        <SelectValue placeholder="Add a tournament..." />
                      </SelectTrigger>
                      <SelectContent>
                        {assignableTournaments
                          .filter(tournament => !formData.assignedTournaments.includes(tournament.id))
                          .map((tournament) => (
                            <SelectItem key={tournament.id} value={tournament.id}>
                              {tournament.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    
                    {formData.assignedTournaments.length > 0 && (
                      <div className="space-y-2">
                        <div className="space-y-1">
                          {formData.assignedTournaments.map((tournamentId) => {
                            const tournament = tournaments.find(t => t.id === tournamentId);
                            return (
                              <div key={tournamentId} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                                <span className="text-sm">{tournament?.name || 'Unknown Tournament'}</span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setFormData({
                                      ...formData,
                                      assignedTournaments: formData.assignedTournaments.filter(id => id !== tournamentId)
                                    });
                                  }}
                                  className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                                >
                                  <XCircle className="h-3 w-3" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {assignableTournaments.length === 0 && (
                      <p className="text-sm text-gray-500">
                        {isFullAdmin
                          ? 'No tournaments available. Create tournaments first.'
                          : 'You have no assigned tournaments yet. Ask an admin to assign you to one.'}
                      </p>
                    )}
                  </div>
                </div>
              )}

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingUser ? 'Update User' : 'Create User'}
                  </Button>
                </div>
              </form>
            </div>
          </DialogContent>
        </Dialog>

        {/* Alert and Confirm Dialogs */}
        {AlertDialogComponent}
        {ConfirmDialogComponent}
      </div>
    </AdminLayout>
  );
}
