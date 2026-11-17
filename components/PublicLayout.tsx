'use client';

import { Navbar } from '@/components/Navbar';

interface PublicLayoutProps {
  children: React.ReactNode;
  hideAuth?: boolean;
  className?: string;
}

export function PublicLayout({ children, hideAuth = false, className = '' }: PublicLayoutProps) {
  return (
    <>
      <Navbar hideAuth={hideAuth} />
      <main className={`min-h-screen relative bg-background text-foreground ${className}`}>
        <div className="relative z-10">{children}</div>
      </main>
    </>
  );
}
