'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12">
            <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
            <p className="text-gray-600">Welcome back, {user.name}</p>
          </div>

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
      </main>
    </>
  );
}
