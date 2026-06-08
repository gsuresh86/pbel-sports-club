'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useTournament, useTournaments } from '@/hooks/use-tournament-queries';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationDropdown } from '@/components/NotificationDropdown';
import { cn } from '@/lib/utils';
import {
  Trophy,
  Menu,
  X,
  ChevronDown,
  ArrowLeft,
  LayoutDashboard,
  Users,
  Users2,
  BarChart3,
  Target,
  Shuffle,
  Award,
  LogOut,
  User,
  Settings,
  AlertCircle,
} from 'lucide-react';

const isAdminRole = (role: string) =>
  role === 'admin' || role === 'tournament-admin' || role === 'super-admin';

const NAV_ITEMS = [
  { label: 'Overview', href: 'overview', icon: LayoutDashboard },
  { label: 'Registrations', href: 'participants', icon: Users },
  { label: 'Players', href: 'players', icon: User },
  { label: 'Teams', href: 'teams', icon: Users2 },
  { label: 'Pools', href: 'pools', icon: BarChart3 },
  { label: 'Spin Wheel', href: 'spin-wheel', icon: Shuffle },
  { label: 'Matches', href: 'matches', icon: Target },
  { label: 'Results', href: 'results', icon: Award },
];

function getStatusColor(status: string) {
  switch (status) {
    case 'upcoming': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'ongoing': return 'bg-green-100 text-green-800 border-green-200';
    case 'completed': return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

export default function TournamentSidebarLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const tournamentId = params.id as string;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const queriesEnabled = !authLoading && !!user && isAdminRole(user.role) && !!tournamentId;
  const { data: tournamentData, isLoading: tournamentLoading } = useTournament(tournamentId, { enabled: queriesEnabled });
  const tournament = tournamentData ?? null;

  const assignedIds = user?.role === 'tournament-admin' ? (user.assignedTournaments ?? undefined) : undefined;
  const { data: tournaments = [] } = useTournaments({ assignedIds, enabled: queriesEnabled });

  const loading = authLoading || (queriesEnabled && tournamentLoading);

  useEffect(() => {
    if (!authLoading && (!user || !isAdminRole(user.role))) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (authLoading || !queriesEnabled || tournamentLoading) return;
    if (tournamentData === null) {
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

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch {}
  };

  // Keep the same sub-route when switching tournaments
  const currentSub = pathname.split('/').pop() ?? 'overview';
  const switchTournament = (newId: string) => {
    router.push(`/admin/tournaments/${newId}/${currentSub}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-gray-900 mx-auto" />
          <p className="mt-4 text-sm text-gray-600">Loading tournament...</p>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Tournament not found</h3>
          <p className="text-sm text-gray-600 mb-4">
            The tournament you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
          <Button onClick={() => router.push('/admin/tournaments')}>Back to Tournaments</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        'fixed inset-y-0 left-0 z-50 w-56 bg-white shadow-lg flex flex-col flex-shrink-0',
        'transform transition-transform duration-300 ease-in-out',
        'lg:translate-x-0 lg:static lg:inset-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-blue-600" />
            <span className="text-base font-bold text-gray-900">Sports Club</span>
          </div>
          <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Back link */}
        <div className="px-3 pt-3">
          <Link
            href="/admin/tournaments"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 px-2 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            All Tournaments
          </Link>
        </div>

        {/* Tournament nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 pb-1 pt-3">
            Tournament
          </p>
          {NAV_ITEMS.map((item) => {
            const href = `/admin/tournaments/${tournamentId}/${item.href}`;
            const isActive = pathname === href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900',
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-gray-200">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
            <Avatar className="h-8 w-8">
              <AvatarImage src="" />
              <AvatarFallback>{user?.name?.charAt(0) || user?.email?.charAt(0) || 'A'}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">{user?.name || 'Admin'}</div>
              <div className="text-xs text-gray-500 truncate">{user?.email}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between h-14 px-4 gap-3">
            {/* Left: hamburger + tournament picker */}
            <div className="flex items-center gap-2 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden flex-shrink-0"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2 h-10 px-3 max-w-xs sm:max-w-md min-w-0"
                  >
                    <Trophy className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <span className="font-semibold text-gray-900 truncate">{tournament.name}</span>
                    <Badge
                      className={cn('text-xs px-1.5 py-0 hidden sm:inline-flex flex-shrink-0', getStatusColor(tournament.status))}
                    >
                      {tournament.status}
                    </Badge>
                    <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-80" align="start">
                  <DropdownMenuLabel>Switch Tournament</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {tournaments.map((t) => (
                    <DropdownMenuItem
                      key={t.id}
                      onClick={() => switchTournament(t.id)}
                      className={cn('flex items-center gap-2 cursor-pointer', t.id === tournamentId && 'bg-blue-50')}
                    >
                      <Trophy className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{t.name}</div>
                        <div className="text-xs text-gray-500 truncate">{t.venue}</div>
                      </div>
                      <Badge className={cn('text-xs px-1.5 py-0 flex-shrink-0', getStatusColor(t.status))}>
                        {t.status}
                      </Badge>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push('/admin/tournaments')} className="cursor-pointer">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    All Tournaments
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Right: notifications + profile */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {user?.id && <NotificationDropdown userId={user.id} />}
              {mounted && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src="" />
                        <AvatarFallback>{user?.name?.charAt(0) || user?.email?.charAt(0) || 'A'}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user?.name || 'Admin User'}</p>
                        <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {!mounted && (
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src="" />
                    <AvatarFallback>{user?.name?.charAt(0) || user?.email?.charAt(0) || 'A'}</AvatarFallback>
                  </Avatar>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto px-4 py-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
