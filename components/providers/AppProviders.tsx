'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { ProfileSidebarProvider } from '@/contexts/ProfileSidebarContext';
import { QueryProvider } from '@/components/providers/QueryProvider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <QueryProvider>
        <ProfileSidebarProvider>
          {children}
        </ProfileSidebarProvider>
      </QueryProvider>
    </AuthProvider>
  );
}
