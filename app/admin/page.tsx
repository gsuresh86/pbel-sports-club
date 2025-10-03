'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Users, Target, Play, Award, Settings, TrendingUp, Calendar, Activity } from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('Admin page - loading:', loading, 'user:', user);
    if (!loading && (!user || user.role !== 'admin')) {
      console.log('Redirecting to login - user:', user ? `${user.name} (${user.role})` : 'null');
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user || user.role !== 'admin') {
    return null;
  }

  const adminCards = [
    {
      title: 'Manage Tournaments',
      description: 'Create, edit, and manage tournaments',
      icon: '🏆',
      href: '/admin/tournaments',
    },
    {
      title: 'Manage Participants',
      description: 'View and manage registered participants',
      icon: '👥',
      href: '/admin/participants',
    },
    {
      title: 'Manage Matches',
      description: 'Schedule and update match details',
      icon: '🎯',
      href: '/admin/matches',
    },
    {
      title: 'Update Live Scores',
      description: 'Real-time score updates for ongoing matches',
      icon: '🔴',
      href: '/admin/live-scores',
    },
    {
      title: 'Tournament Brackets',
      description: 'Generate and manage tournament brackets',
      icon: '🏆',
      href: '/admin/brackets',
    },
    {
      title: 'Announce Winners',
      description: 'Declare tournament winners and prizes',
      icon: '🏅',
      href: '/admin/winners',
    },
    {
      title: 'System Settings',
      description: 'Configure system settings and preferences',
      icon: '⚙️',
      href: '/admin/settings',
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
                  <p className="text-sm font-medium text-gray-600">Active Tournaments</p>
                  <p className="text-2xl font-bold text-gray-900">5</p>
                </div>
                <Trophy className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Participants</p>
                  <p className="text-2xl font-bold text-gray-900">127</p>
                </div>
                <Users className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Live Matches</p>
                  <p className="text-2xl font-bold text-gray-900">3</p>
                </div>
                <Play className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Completed Matches</p>
                  <p className="text-2xl font-bold text-gray-900">42</p>
                </div>
                <Target className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {adminCards.map((card) => (
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
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div>
                    <p className="text-sm font-medium">New tournament created</p>
                    <p className="text-xs text-gray-500">PBEL Badminton Championship - 2 minutes ago</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div>
                    <p className="text-sm font-medium">15 new participants registered</p>
                    <p className="text-xs text-gray-500">Mixed Doubles category - 1 hour ago</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <div>
                    <p className="text-sm font-medium">Live match started</p>
                    <p className="text-xs text-gray-500">John vs Sarah - Quarterfinals - 2 hours ago</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
