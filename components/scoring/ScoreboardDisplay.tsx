'use client';

import { useEffect, useRef } from 'react';
import { Play, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getDisplaySides } from '@/lib/match-scoring';

function formatScore(score: number) {
  return score.toString().padStart(2, '0');
}

export interface ScoreboardDisplayProps {
  tournamentName: string;
  round: string;
  matchNumber: number;
  player1Name: string;
  player2Name: string;
  player1Score: number;
  player2Score: number;
  player1Sets: number;
  player2Sets: number;
  currentSet: number;
  isLive: boolean;
  winner?: string;
  court?: string;
  sidesSwapped?: boolean;
  bannerUrl?: string;
  className?: string;
}

export function ScoreboardDisplay({
  tournamentName,
  round,
  matchNumber,
  player1Name,
  player2Name,
  player1Score,
  player2Score,
  player1Sets,
  player2Sets,
  currentSet,
  isLive,
  winner,
  court,
  sidesSwapped = false,
  bannerUrl,
  className,
}: ScoreboardDisplayProps) {
  const sides = getDisplaySides(
    { player1Name, player2Name },
    { p1: player1Score, p2: player2Score, sets1: player1Sets, sets2: player2Sets },
    sidesSwapped
  );

  const prevLeft = useRef(sides.left.score);
  const prevRight = useRef(sides.right.score);
  const leftBump = sides.left.score !== prevLeft.current;
  const rightBump = sides.right.score !== prevRight.current;

  useEffect(() => {
    prevLeft.current = sides.left.score;
    prevRight.current = sides.right.score;
  }, [sides.left.score, sides.right.score]);

  const leftBg = sides.left.color === 'blue' ? 'bg-blue-950/20' : 'bg-red-950/20';
  const rightBg = sides.right.color === 'blue' ? 'bg-blue-950/20' : 'bg-red-950/20';
  const leftText = sides.left.color === 'blue' ? 'text-blue-300' : 'text-red-300';
  const rightText = sides.right.color === 'blue' ? 'text-blue-300' : 'text-red-300';
  const leftScoreText = sides.left.color === 'blue' ? 'text-blue-400' : 'text-red-400';
  const rightScoreText = sides.right.color === 'blue' ? 'text-blue-400' : 'text-red-400';

  return (
    <div
      className={cn(
        'relative h-dvh w-full flex flex-col text-white overflow-hidden select-none',
        !bannerUrl && 'bg-zinc-950',
        className
      )}
    >
      {bannerUrl && (
        <div className="absolute inset-0 z-0" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={bannerUrl}
            src={bannerUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/30 via-zinc-950/40 to-zinc-950/55" />
        </div>
      )}

      <div className="relative z-10 flex flex-col h-full min-h-0">
      <header className="shrink-0 flex items-center justify-between gap-4 px-4 sm:px-8 py-3 sm:py-5 bg-zinc-900/45 backdrop-blur-sm border-b border-zinc-800/60">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-3xl lg:text-4xl font-bold truncate drop-shadow-md">
            {tournamentName}
          </h1>
          <p className="text-base sm:text-xl lg:text-2xl text-zinc-300 truncate drop-shadow-sm">
            {round} · Match #{matchNumber}
            {court ? ` · Court ${court}` : ''}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-3">
          {!winner && (
            <div className="text-right hidden sm:block">
              <div className="text-base sm:text-lg text-zinc-400">Set</div>
              <div className="text-3xl sm:text-4xl font-bold tabular-nums">{currentSet}</div>
            </div>
          )}
          {isLive && !winner ? (
            <div className="flex items-center gap-2 bg-red-600/20 text-red-400 px-3 py-1.5 rounded-full border border-red-500/30">
              <Play className="h-4 w-4 animate-pulse" />
              <span className="font-semibold text-sm sm:text-base">LIVE</span>
            </div>
          ) : winner ? (
            <div className="flex items-center gap-2 bg-yellow-600/20 text-yellow-400 px-3 py-1.5 rounded-full border border-yellow-500/30">
              <Trophy className="h-4 w-4" />
              <span className="font-semibold text-sm sm:text-base">FINAL</span>
            </div>
          ) : null}
        </div>
      </header>

      {winner && (
        <div className="relative shrink-0 py-5 sm:py-8 text-center bg-yellow-950/35 backdrop-blur-sm border-b border-yellow-800/40">
          <p className="text-3xl sm:text-5xl lg:text-6xl font-bold text-yellow-400 flex items-center justify-center gap-4">
            <Trophy className="h-10 w-10 sm:h-14 sm:w-14 lg:h-16 lg:w-16" />
            Congratulations, {winner}!
          </p>
        </div>
      )}

      <div className="relative flex-1 grid grid-cols-2 min-h-0">
        <div className={cn('flex flex-col items-center justify-center border-r border-zinc-800/60 backdrop-blur-[2px] p-4', leftBg)}>
          <h2 className={cn('text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold text-center truncate max-w-full px-2 mb-4 sm:mb-10', leftText)}>
            {sides.left.name}
          </h2>
          <div
            className={cn(
              'text-[clamp(7rem,28vw,28rem)] font-bold tabular-nums leading-none transition-transform duration-200',
              leftScoreText,
              leftBump && 'scale-110'
            )}
          >
            {formatScore(sides.left.score)}
          </div>
          <div className="mt-6 sm:mt-10 text-zinc-400 text-xl sm:text-3xl lg:text-4xl">
            Sets <span className="text-white font-bold tabular-nums">{sides.left.sets}</span>
          </div>
        </div>

        <div className={cn('flex flex-col items-center justify-center backdrop-blur-[2px] p-4', rightBg)}>
          <h2 className={cn('text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold text-center truncate max-w-full px-2 mb-4 sm:mb-10', rightText)}>
            {sides.right.name}
          </h2>
          <div
            className={cn(
              'text-[clamp(7rem,28vw,28rem)] font-bold tabular-nums leading-none transition-transform duration-200',
              rightScoreText,
              rightBump && 'scale-110'
            )}
          >
            {formatScore(sides.right.score)}
          </div>
          <div className="mt-6 sm:mt-10 text-zinc-400 text-xl sm:text-3xl lg:text-4xl">
            Sets <span className="text-white font-bold tabular-nums">{sides.right.sets}</span>
          </div>
        </div>
      </div>

      <footer className="relative shrink-0 py-4 sm:py-6 text-center bg-zinc-900/45 backdrop-blur-sm border-t border-zinc-800/60">
        {winner ? (
          <p className="text-2xl sm:text-4xl lg:text-5xl font-bold text-yellow-400 flex items-center justify-center gap-3">
            <Trophy className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12" />
            Winner: {winner}
          </p>
        ) : isLive ? (
          <p className="text-zinc-400 text-lg sm:text-2xl lg:text-3xl">
            Set {currentSet} · Match in progress
          </p>
        ) : (
          <p className="text-zinc-500 text-lg sm:text-2xl lg:text-3xl">Match not started</p>
        )}
      </footer>
      </div>
    </div>
  );
}
