'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { ProfileSidebar } from '@/components/ProfileSidebar';

interface ProfileSidebarContextType {
  openProfile: () => void;
  closeProfile: () => void;
}

const ProfileSidebarContext = createContext<ProfileSidebarContextType>({
  openProfile: () => {},
  closeProfile: () => {},
});

export function useProfileSidebar() {
  return useContext(ProfileSidebarContext);
}

export function ProfileSidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const openProfile = useCallback(() => setOpen(true), []);
  const closeProfile = useCallback(() => setOpen(false), []);

  return (
    <ProfileSidebarContext.Provider value={{ openProfile, closeProfile }}>
      {children}
      <ProfileSidebar open={open} onOpenChange={setOpen} />
    </ProfileSidebarContext.Provider>
  );
}
