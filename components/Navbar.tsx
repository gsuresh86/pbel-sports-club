'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavbarProps {
  hideAuth?: boolean;
}

export function Navbar({ hideAuth = false }: NavbarProps) {
  const { user, signOut } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#020617]/95 border-b border-slate-700 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-2">
              <Image
                src="/logo.png"
                alt="Manchplay Logo"
                width={40}
                height={40}
                className="drop-shadow-lg"
              />
              <span className="text-2xl font-bold text-white drop-shadow-lg">
                Manchplay
              </span>
            </Link>
            <div className="hidden md:flex space-x-4">
              <Link href="/tournament" className="text-slate-100 hover:text-yellow-400 transition-colors duration-300">
                Tournaments
              </Link>
              <Link href="/schedules" className="text-slate-100 hover:text-yellow-400 transition-colors duration-300">
                Schedules
              </Link>
              <Link href="/winners" className="text-slate-100 hover:text-yellow-400 transition-colors duration-300">
                Winners
              </Link>
            </div>
          </div>

          {!hideAuth && (
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  {user.role === 'admin' && (
                    <Link href="/admin">
                      <Button variant="outline" className="text-white border-white/30 hover:bg-white/10 hover:text-white">
                        Admin Dashboard
                      </Button>
                    </Link>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
                        {user.name}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => signOut()}>
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <Link href="/login">
                  <Button className="bg-white/20 text-white border border-white/30 hover:bg-white/30 hover:text-white backdrop-blur-sm">
                    Login
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
