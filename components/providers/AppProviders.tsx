'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { ProfileSidebarProvider } from '@/contexts/ProfileSidebarContext';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <QueryProvider>
        <ProfileSidebarProvider>
          {children}
          <InstallPrompt />
        </ProfileSidebarProvider>
      </QueryProvider>
    </AuthProvider>
  );
}
