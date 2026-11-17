'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfileSidebar } from '@/contexts/ProfileSidebarContext';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
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
import {
  LayoutDashboard,
  Trophy,
  Settings,
  Menu,
  X,
  LogOut,
  User as UserIcon,
  UserPlus,
  MessageSquareQuote,
  Activity,
} from 'lucide-react';
import { NotificationDropdown } from '@/components/NotificationDropdown';
import { AdminGlobalSearch } from '@/components/admin/AdminGlobalSearch';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  canAccessTournamentConsole,
  canReviewTestimonials,
  canSubmitTestimonials,
} from '@/lib/permissions';
import type { User, UserRole } from '@/types';

interface AdminLayoutProps {
  children: React.ReactNode;
  moduleName?: string;
}

type AdminMenuItem = {
  title: string;
  href: string;
  icon: typeof LayoutDashboard;
  description: string;
  roles?: UserRole[];
  visible?: (user: User | null | undefined) => boolean;
};

function isAdminMenuItemVisible(user: User | null | undefined, item: AdminMenuItem): boolean {
  if (item.visible) return item.visible(user);
  if (!item.roles) return true;
  return !!user?.role && item.roles.includes(user.role);
}

const adminMenuItems: AdminMenuItem[] = [
  {
    title: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
    description: 'Overview and statistics',
    roles: ['admin', 'super-admin'],
  },
  {
    title: 'Tournaments',
    href: '/admin/tournaments',
    icon: Trophy,
    description: 'Create and manage tournaments',
    visible: (u) => canAccessTournamentConsole(u ?? null),
  },
  {
    title: 'User Management',
    href: '/admin/users',
    icon: UserIcon,
    description: 'Manage admin users and permissions',
    roles: ['admin', 'super-admin'],
  },
  {
    title: 'User Activity',
    href: '/admin/user-activity',
    icon: Activity,
    description: 'Track user actions and engagement',
    roles: ['super-admin'],
  },
  {
    title: 'Leads',
    href: '/admin/leads',
    icon: UserPlus,
    description: 'Review and manage tournament leads',
    roles: ['admin', 'super-admin'],
  },
  {
    title: 'Testimonials',
    href: '/admin/testimonials',
    icon: MessageSquareQuote,
    description: 'Manage testimonials for the public site',
    visible: (u) => canReviewTestimonials(u) || canSubmitTestimonials(u),
  },
  {
    title: 'Settings',
    href: '/admin/settings',
    icon: Settings,
    description: 'Manage sports, categories, and system settings',
    roles: ['admin', 'super-admin'],
  },
];

export default function AdminLayout({ children, moduleName }: AdminLayoutProps) {
  const { user, signOut } = useAuth();
  const { openProfile } = useProfileSidebar();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getCurrentModuleName = () => {
    if (moduleName) return moduleName;

    const currentItem = adminMenuItems.find((item) => item.href === pathname);
    return currentItem?.title || 'Admin Panel';
  };

  const isActiveRoute = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-dvh bg-background text-foreground flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex-shrink-0 lg:w-56 flex flex-col pt-[env(safe-area-inset-top)] ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-14 px-4 border-b border-border">
          <Link href="/" className="flex items-center gap-2 min-w-0">
            <Image src="/logo.png" alt="TourneyCraft logo" width={32} height={32} />
            <span className="text-lg font-bold text-foreground truncate">TourneyCraft</span>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {adminMenuItems
            .filter((item) => isAdminMenuItemVisible(user, item))
            .map((item) => {
              const Icon = item.icon;
              const isActive = isActiveRoute(item.href);

              return (
                <Button
                  key={item.href}
                  variant={isActive ? 'default' : 'ghost'}
                  className={`w-full justify-start h-10 px-3 ${
                    isActive
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                  onClick={() => {
                    router.push(item.href);
                    setSidebarOpen(false);
                  }}
                >
                  <Icon className="h-5 w-5 mr-3" />
                  <span className="font-medium">{item.title}</span>
                </Button>
              );
            })}
        </nav>

        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-muted">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.profilePhotoUrl} />
              <AvatarFallback>
                {user?.name?.charAt(0) || user?.email?.charAt(0) || 'A'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">
                {user?.name || 'Admin User'}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge
                  className={`text-[10px] px-1.5 py-0 h-4 font-semibold ${
                    user?.role === 'super-admin'
                      ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800'
                      : user?.role === 'admin'
                        ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800'
                        : 'bg-muted text-muted-foreground border-border'
                  }`}
                  variant="outline"
                >
                  {user?.role ?? 'loading…'}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="sticky top-0 z-30 bg-card/95 backdrop-blur-sm border-b border-border pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between h-14 px-4">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <h1 className="text-lg font-semibold text-foreground truncate">
                {getCurrentModuleName()}
              </h1>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <AdminGlobalSearch user={user} />
              <ThemeToggle />
              {user?.id && <NotificationDropdown userId={user.id} />}

              {mounted && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user?.profilePhotoUrl} />
                        <AvatarFallback>
                          {user?.name?.charAt(0) || user?.email?.charAt(0) || 'A'}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {user?.name || 'Admin User'}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user?.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={openProfile} className="cursor-pointer">
                      <UserIcon className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {!mounted && (
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {user?.name?.charAt(0) || user?.email?.charAt(0) || 'A'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              )}
            </div>
          </div>
        </div>

        <main className="flex-1 overflow-auto bg-background">{children}</main>
      </div>
    </div>
  );
}
