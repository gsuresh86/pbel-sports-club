'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

const SLIDES = [
  {
    src: '/images/sports-background.png',
    alt: 'Community sports action on court',
  },
  {
    src: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1920&h=1080&q=80',
    alt: 'Badminton players mid-rally',
  },
  {
    src: 'https://images.unsplash.com/photo-1534158914592-062992fbe900?auto=format&fit=crop&w=1920&h=1080&q=80',
    alt: 'Table tennis match in progress',
  },
  {
    src: 'https://images.unsplash.com/photo-1612872087720-b8768760e99a?auto=format&fit=crop&w=1920&h=1080&q=80',
    alt: 'Volleyball spike at the net',
  },
  {
    src: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1920&h=1080&q=80',
    alt: 'Athletes training in a sports facility',
  },
] as const;

const INTERVAL_MS = 7000;

export function HeroSportsBackground() {
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [reducedMotion]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {SLIDES.map((slide, i) => {
        const active = reducedMotion ? i === 0 : i === index;
        return (
          <div
            key={slide.src}
            className={cn(
              'absolute inset-0 transition-opacity duration-[1600ms] ease-in-out',
              active ? 'opacity-100' : 'opacity-0',
            )}
          >
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              priority={i === 0}
              sizes="100vw"
              className={cn(
                'object-cover object-center',
                active && !reducedMotion && 'hero-ken-burns',
              )}
            />
          </div>
        );
      })}

      {/* Readability scrim — stronger at bottom/center where copy sits */}
      <div className="absolute inset-0 bg-background/55 dark:bg-background/70" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/55 to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-400/20 via-transparent to-transparent dark:from-amber-400/12" />
    </div>
  );
}
