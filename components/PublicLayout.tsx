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
        {/* Sports Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat bg-fixed"
          style={{
            backgroundImage: `
              linear-gradient(135deg, rgba(15, 23, 42, 0.6), rgba(30, 58, 138, 0.5), rgba(15, 23, 42, 0.6)),
              url('/images/sports-background.png')
            `
          }}
        >
          {/* Subtle Sports Pattern Overlay */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 left-10 text-6xl text-white/20">🏸</div>
            <div className="absolute top-20 right-20 text-5xl text-white/20">🏓</div>
            <div className="absolute top-40 left-1/4 text-4xl text-white/20">🏐</div>
            <div className="absolute top-60 right-1/3 text-5xl text-white/20">🏆</div>
            <div className="absolute bottom-40 left-20 text-4xl text-white/20">⚡</div>
            <div className="absolute bottom-20 right-10 text-6xl text-white/20">🏸</div>
            <div className="absolute bottom-60 left-1/2 text-5xl text-white/20">🏓</div>
            <div className="absolute top-1/2 left-10 text-4xl text-white/20">🏐</div>
            <div className="absolute top-1/3 right-1/4 text-5xl text-white/20">🏆</div>
            <div className="absolute top-1/4 right-1/2 text-5xl text-white/20">🏅</div>
            <div className="absolute bottom-1/3 left-1/3 text-4xl text-white/20">🎯</div>
          </div>
          
          {/* Futuristic Animated Elements */}
          <div className="absolute inset-0">
            <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-blue-500/10 rounded-full animate-pulse shadow-lg shadow-blue-500/20"></div>
            <div className="absolute top-1/2 right-1/4 w-24 h-24 bg-green-400/10 rounded-full animate-pulse delay-1000 shadow-lg shadow-green-400/20"></div>
            <div className="absolute bottom-1/4 left-1/3 w-20 h-20 bg-orange-400/10 rounded-full animate-pulse delay-2000 shadow-lg shadow-orange-400/20"></div>
            <div className="absolute top-1/3 right-1/3 w-16 h-16 bg-purple-400/10 rounded-full animate-pulse delay-3000 shadow-lg shadow-purple-400/20"></div>
          </div>
          
          {/* Additional Gradient Overlay for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30"></div>
        </div>
        
        {/* Content with relative positioning */}
        <div className="relative z-10">
          {children}
        </div>
      </main>
    </>
  );
}
