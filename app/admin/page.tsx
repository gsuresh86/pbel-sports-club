'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Users, Target, Play, Award, Settings, TrendingUp, Calendar, Activity } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { Tournament, Registration, Player, Match } from '@/types';

interface RecentActivity {
  type: 'tournament' | 'registration';
  message: string;
  time: Date;
  color: 'green' | 'blue' | 'red' | 'gray';
}

interface DashboardMatch {
  id: string;
  status: string;
  scheduledTime?: Date;
  createdAt?: Date;
}

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  // State for dashboard data
  const [stats, setStats] = useState({
    totalTournaments: 0,
    activeTournaments: 0,
    totalRegistrations: 0,
    pendingRegistrations: 0,
    totalPlayers: 0,
    liveMatches: 0,
    completedMatches: 0,
    recentActivity: [] as RecentActivity[]
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Fetch dashboard statistics
  const fetchDashboardStats = async () => {
    try {
      setLoadingStats(true);
      
      // Fetch tournaments
      const tournamentsSnapshot = await getDocs(collection(db, 'tournaments'));
      const tournaments = tournamentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        endDate: doc.data().endDate?.toDate(),
        registrationDeadline: doc.data().registrationDeadline?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as Tournament[];

      const now = new Date();
      const activeTournaments = tournaments.filter(t => 
        t.startDate && t.endDate && 
        t.startDate <= now && now <= t.endDate
      );

      // Fetch registrations from all tournaments
      let totalRegistrations = 0;
      let pendingRegistrations = 0;
      let totalPlayers = 0;
      
      for (const tournament of tournaments) {
        // Get registrations
        const registrationsSnapshot = await getDocs(collection(db, 'tournaments', tournament.id, 'registrations'));
        const registrations = registrationsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          registeredAt: doc.data().registeredAt?.toDate(),
        })) as Registration[];
        
        totalRegistrations += registrations.length;
        pendingRegistrations += registrations.filter(r => r.registrationStatus === 'pending').length;
        
        // Get players
        const playersSnapshot = await getDocs(collection(db, 'tournaments', tournament.id, 'players'));
        totalPlayers += playersSnapshot.docs.length;
      }

      // Fetch matches
      const matchesSnapshot = await getDocs(collection(db, 'matches'));
      const matches = matchesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        scheduledTime: doc.data().scheduledTime?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as DashboardMatch[];

      const liveMatches = matches.filter(m => m.status === 'live').length;
      const completedMatches = matches.filter(m => m.status === 'completed').length;

      // Generate recent activity
      const allRegistrations: Registration[] = [];
      for (const tournament of tournaments) {
        const registrationsSnapshot = await getDocs(collection(db, 'tournaments', tournament.id, 'registrations'));
        const tournamentRegistrations = registrationsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          registeredAt: doc.data().registeredAt?.toDate(),
        })) as Registration[];
        allRegistrations.push(...tournamentRegistrations);
      }

      const recentActivity: RecentActivity[] = [
        ...tournaments.slice(0, 3).map(t => ({
          type: 'tournament' as const,
          message: `Tournament "${t.name}" created`,
          time: t.createdAt,
          color: 'green' as const
        })),
        ...allRegistrations.slice(0, 2).map(r => ({
          type: 'registration' as const,
          message: `New registration from ${r.name}`,
          time: r.registeredAt,
          color: 'blue' as const
        }))
      ].sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 5);

      setStats({
        totalTournaments: tournaments.length,
        activeTournaments: activeTournaments.length,
        totalRegistrations,
        pendingRegistrations,
        totalPlayers,
        liveMatches,
        completedMatches,
        recentActivity
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    console.log('Admin page - loading:', loading, 'user:', user);
    if (!loading && (!user || (user.role !== 'admin' && user.role !== 'super-admin' && user.role !== 'tournament-admin'))) {
      console.log('Redirecting to login - user:', user ? `${user.name} (${user.role})` : 'null');
      router.push('/login');
    } else if (!loading && user) {
      fetchDashboardStats();
    }
  }, [user, loading, router]);

  if (loading || !user || (user.role !== 'admin' && user.role !== 'super-admin' && user.role !== 'tournament-admin')) {
    return null;
  }

  const adminCards = [
    {
      title: 'Manage Tournaments',
      description: 'Create, edit, and manage tournaments',
      icon: '🏆',
      href: '/admin/tournaments',
      roles: ['admin', 'super-admin', 'tournament-admin']
    },
    {
      title: 'Manage Registrations',
      description: 'View and manage tournament registrations',
      icon: '👥',
      href: '/admin/participants',
      roles: ['admin', 'super-admin', 'tournament-admin']
    },
    {
      title: 'Manage Matches',
      description: 'Schedule and update match details',
      icon: '🎯',
      href: '/admin/matches',
      roles: ['admin', 'super-admin']
    },
    {
      title: 'Update Live Scores',
      description: 'Real-time score updates for ongoing matches',
      icon: '🔴',
      href: '/admin/live-scores',
      roles: ['admin', 'super-admin']
    },
    {
      title: 'Tournament Brackets',
      description: 'Generate and manage tournament brackets',
      icon: '🏆',
      href: '/admin/brackets',
      roles: ['admin', 'super-admin']
    },
    {
      title: 'Announce Winners',
      description: 'Declare tournament winners and prizes',
      icon: '🏅',
      href: '/admin/winners',
      roles: ['admin', 'super-admin']
    },
    {
      title: 'System Settings',
      description: 'Configure system settings and preferences',
      icon: '⚙️',
      href: '/admin/settings',
      roles: ['admin', 'super-admin']
    },
  ];

  return (
    <AdminLayout moduleName="Dashboard">
      <div className="p-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back, {user?.name || 'Admin'}!</h1>
          <p className="text-gray-600">Here&apos;s what&apos;s happening with your tournaments today.</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Tournaments</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {loadingStats ? '...' : stats.totalTournaments}
                  </p>
                  <p className="text-xs text-gray-500">
                    {stats.activeTournaments} active
                  </p>
                </div>
                <Trophy className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Registrations</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {loadingStats ? '...' : stats.totalRegistrations}
                  </p>
                  <p className="text-xs text-gray-500">
                    {stats.pendingRegistrations} pending
                  </p>
                </div>
                <Users className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Players</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {loadingStats ? '...' : stats.totalPlayers}
                  </p>
                  <p className="text-xs text-gray-500">
                    From registrations
                  </p>
                </div>
                <Award className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Live Matches</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {loadingStats ? '...' : stats.liveMatches}
                  </p>
                  <p className="text-xs text-gray-500">
                    {stats.completedMatches} completed
                  </p>
                </div>
                <Play className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {adminCards
              .filter(card => !card.roles || card.roles.includes(user?.role || 'public'))
              .map((card) => (
              <Link key={card.href} href={card.href}>
                <Card className="hover:shadow-lg transition-all cursor-pointer h-full">
                  <CardHeader>
                    <div className="text-5xl mb-4">{card.icon}</div>
                    <CardTitle>{card.title}</CardTitle>
                    <CardDescription>{card.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Recent Activity</h2>
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {loadingStats ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-2">Loading activity...</p>
                  </div>
                ) : stats.recentActivity.length > 0 ? (
                  stats.recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className={`w-2 h-2 rounded-full ${
                        activity.color === 'green' ? 'bg-green-500' :
                        activity.color === 'blue' ? 'bg-blue-500' :
                        activity.color === 'red' ? 'bg-red-500' : 'bg-gray-500'
                      }`}></div>
                      <div>
                        <p className="text-sm font-medium">{activity.message}</p>
                        <p className="text-xs text-gray-500">
                          {activity.time ? new Date(activity.time).toLocaleString() : 'Recently'}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4">
                    <Activity className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No recent activity</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
