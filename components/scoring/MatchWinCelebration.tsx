'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { playMatchWinSound } from '@/lib/celebration-sound';

const CELEBRATION_DURATION_MS = 7500;
const CONFETTI_COLORS = ['#fbbf24', '#fde047', '#f472b6', '#60a5fa', '#34d399', '#fb923c', '#ffffff', '#f87171'];

export type WinnerDisplaySide = 'left' | 'right';

interface MatchWinCelebrationProps {
  winner?: string;
  winnerSide?: WinnerDisplaySide | null;
  onCelebratingChange?: (active: boolean) => void;
}

function seededRandom(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function MatchWinCelebration({
  winner,
  winnerSide,
  onCelebratingChange,
}: MatchWinCelebrationProps) {
  const [active, setActive] = useState(false);
  const initialized = useRef(false);
  const prevWinner = useRef<string | undefined>(undefined);

  const confetti = useMemo(
    () =>
      Array.from({ length: 140 }, (_, i) => {
        const bias = winnerSide === 'left' ? 0.28 : winnerSide === 'right' ? 0.72 : 0.5;
        const spread = seededRandom(i + 1) * 0.55;
        const left = Math.max(0, Math.min(100, (bias + (seededRandom(i + 2) - 0.5) * spread) * 100));
        return {
          id: i,
          left,
          delay: seededRandom(i + 3) * 0.55,
          duration: 2 + seededRandom(i + 4) * 2.2,
          rotate: seededRandom(i + 5) * 360,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          size: 5 + seededRandom(i + 6) * 10,
        };
      }),
    [winnerSide]
  );

  const crackLines = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        rotate: -85 + i * (170 / 17),
        delay: (i % 4) * 0.04,
        height: 38 + seededRandom(i + 20) * 42,
      })),
    []
  );

  const fireworks = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => {
        const angle = seededRandom(i + 40) * Math.PI * 2;
        const dist = 60 + seededRandom(i + 41) * 160;
        return {
          id: i,
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist - 40,
          delay: seededRandom(i + 42) * 0.55,
          duration: 1 + seededRandom(i + 43) * 0.9,
          size: 4 + seededRandom(i + 44) * 6,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        };
      }),
    []
  );

  const lightRays = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        id: i,
        rotate: -72 + i * (144 / 11),
        delay: i * 0.03,
      })),
    []
  );

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      prevWinner.current = winner;
      return;
    }

    if (winner && !prevWinner.current) {
      setActive(true);
      onCelebratingChange?.(true);
      playMatchWinSound();
      const timer = window.setTimeout(() => {
        setActive(false);
        onCelebratingChange?.(false);
      }, CELEBRATION_DURATION_MS);
      prevWinner.current = winner;
      return () => window.clearTimeout(timer);
    }

    prevWinner.current = winner;
  }, [winner, onCelebratingChange]);

  if (!active) return null;

  const sideAnchor = winnerSide === 'left' ? 'left-[25%]' : winnerSide === 'right' ? 'left-[75%]' : 'left-1/2';

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      {/* Side flash on winner half */}
      {winnerSide && (
        <div
          className={cn(
            'match-win-side-flash absolute inset-y-0 w-1/2',
            winnerSide === 'left' ? 'left-0 bg-yellow-300/25' : 'right-0 bg-yellow-300/25'
          )}
        />
      )}

      {/* Confetti */}
      {confetti.map((piece) => (
        <span
          key={piece.id}
          className="match-win-confetti absolute top-0 rounded-sm opacity-95"
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.size * 1.35,
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            transform: `rotate(${piece.rotate}deg)`,
          }}
        />
      ))}

      {/* Crack lines + fireworks + light rays from winner score */}
      <div className={cn('absolute top-[42%] -translate-x-1/2 -translate-y-1/2', sideAnchor)}>
        {lightRays.map((ray) => (
          <span
            key={ray.id}
            className="match-win-ray absolute bottom-0 left-1/2 w-2 sm:w-3 -ml-1 sm:-ml-1.5 h-40 sm:h-56 lg:h-72 rounded-full bg-gradient-to-t from-yellow-200/90 via-amber-300/50 to-transparent"
            style={
              {
                '--ray-rotate': `${ray.rotate}deg`,
                animationDelay: `${ray.delay}s`,
              } as CSSProperties
            }
          />
        ))}

        {crackLines.map((line) => (
          <span
            key={line.id}
            className="match-win-crack-line absolute bottom-0 left-1/2 w-0.5 sm:w-1 -ml-px rounded-full bg-gradient-to-t from-white via-yellow-200 to-transparent"
            style={
              {
                height: `${line.height}%`,
                minHeight: '4rem',
                '--crack-rotate': `${line.rotate}deg`,
                animationDelay: `${line.delay}s`,
              } as CSSProperties
            }
          />
        ))}

        {crackLines.map((line) => (
          <span
            key={`echo-${line.id}`}
            className="match-win-crack-line match-win-crack-line-echo absolute bottom-0 left-1/2 w-0.5 sm:w-1 -ml-px rounded-full bg-gradient-to-t from-white/80 via-amber-200/70 to-transparent"
            style={
              {
                height: `${line.height * 0.85}%`,
                minHeight: '3rem',
                '--crack-rotate': `${line.rotate + 4}deg`,
                animationDelay: `${0.42 + line.delay}s`,
              } as CSSProperties
            }
          />
        ))}

        {fireworks.map((fw) => (
          <span
            key={fw.id}
            className="match-win-firework absolute left-1/2 top-1/2 rounded-full"
            style={
              {
                width: fw.size,
                height: fw.size,
                marginLeft: -fw.size / 2,
                marginTop: -fw.size / 2,
                backgroundColor: fw.color,
                boxShadow: `0 0 ${fw.size * 2}px ${fw.color}`,
                '--fw-x': `${fw.x}px`,
                '--fw-y': `${fw.y}px`,
                '--fw-duration': `${fw.duration}s`,
                animationDelay: `${fw.delay}s`,
              } as CSSProperties
            }
          />
        ))}

        <div className="match-win-burst absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-300/40 w-24 h-24 sm:w-36 sm:h-36" />
        <div className="match-win-burst absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30 w-12 h-12 sm:w-16 sm:h-16 [animation-delay:0.08s]" />
        <div className="match-win-burst absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-200/25 w-32 h-32 sm:w-44 sm:h-44 [animation-delay:0.45s]" />
        <div className="match-win-burst absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/20 w-16 h-16 sm:w-20 sm:h-20 [animation-delay:0.85s]" />
      </div>
    </div>
  );
}

export function resolveWinnerDisplaySide(
  winner: string | undefined,
  leftName: string,
  rightName: string,
  player1Sets: number,
  player2Sets: number,
  sidesSwapped: boolean,
): WinnerDisplaySide | null {
  if (!winner?.trim()) return null;

  const w = winner.trim().toLowerCase();
  const left = leftName.trim().toLowerCase();
  const right = rightName.trim().toLowerCase();

  const matches = (label: string) =>
    label === w || label.includes(w) || w.includes(label) || w.split(' & ').some((part) => {
      const p = part.trim();
      return p.length > 1 && label.includes(p);
    });

  if (matches(left) && !matches(right)) return 'left';
  if (matches(right) && !matches(left)) return 'right';

  if (player1Sets !== player2Sets) {
    const player1Won = player1Sets > player2Sets;
    if (player1Won) return sidesSwapped ? 'right' : 'left';
    return sidesSwapped ? 'left' : 'right';
  }

  return null;
}
