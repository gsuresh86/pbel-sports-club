'use client';

import { Navbar } from '@/components/Navbar';

interface PublicLayoutProps {
  children: React.ReactNode;
  hideAuth?: boolean;
  className?: string;
}

export function PublicLayout({ children, hideAuth = false, className = "" }: PublicLayoutProps) {
  return (
    <>
      <Navbar hideAuth={hideAuth} />
      <main className={`min-h-screen relative ${className}`}>
        <div className="absolute inset-0 bg-[#020617]" />

        <div className="relative z-10">
          {children}
        </div>
      </main>
    </>
  );
}
