'use client';

import { Suspense } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProfileSidebarProvider } from '@/contexts/ProfileSidebarContext';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { SiteAnalytics } from '@/components/analytics/SiteAnalytics';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="system">
      <AuthProvider>
        <QueryProvider>
          <ProfileSidebarProvider>
            {children}
            <InstallPrompt />
            <Suspense fallback={null}>
              <SiteAnalytics />
            </Suspense>
          </ProfileSidebarProvider>
        </QueryProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
