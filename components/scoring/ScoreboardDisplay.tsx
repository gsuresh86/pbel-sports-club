'use client';

import { useEffect, useRef } from 'react';
import { Play, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  className,
}: ScoreboardDisplayProps) {
  const prevP1 = useRef(player1Score);
  const prevP2 = useRef(player2Score);
  const p1Bump = player1Score !== prevP1.current;
  const p2Bump = player2Score !== prevP2.current;

  useEffect(() => {
    prevP1.current = player1Score;
    prevP2.current = player2Score;
  }, [player1Score, player2Score]);

  return (
    <div
      className={cn(
        'h-dvh w-full flex flex-col bg-zinc-950 text-white overflow-hidden select-none',
        className
      )}
    >
      {/* Top bar */}
      <header className="shrink-0 flex items-center justify-between gap-4 px-4 sm:px-8 py-3 sm:py-4 bg-zinc-900/80 border-b border-zinc-800">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold truncate">{tournamentName}</h1>
          <p className="text-sm sm:text-base text-zinc-400 truncate">
            {round} · Match #{matchNumber}
            {court ? ` · Court ${court}` : ''}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-3">
          {!winner && (
            <div className="text-right hidden sm:block">
              <div className="text-sm text-zinc-400">Set</div>
              <div className="text-2xl font-bold tabular-nums">{currentSet}</div>
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

      {/* Score panels */}
      <div className="flex-1 grid grid-cols-2 min-h-0">
        {/* Player 1 */}
        <div className="flex flex-col items-center justify-center bg-blue-950/40 border-r border-zinc-800 p-4">
          <h2 className="text-xl sm:text-3xl md:text-4xl font-semibold text-blue-300 text-center truncate max-w-full px-2 mb-4 sm:mb-8">
            {player1Name}
          </h2>
          <div
            className={cn(
              'text-[clamp(5rem,18vw,16rem)] font-bold tabular-nums text-blue-400 leading-none transition-transform duration-200',
              p1Bump && 'scale-110'
            )}
          >
            {formatScore(player1Score)}
          </div>
          <div className="mt-4 sm:mt-8 text-zinc-400 text-lg sm:text-2xl">
            Sets <span className="text-white font-bold tabular-nums">{player1Sets}</span>
          </div>
        </div>

        {/* Player 2 */}
        <div className="flex flex-col items-center justify-center bg-red-950/40 p-4">
          <h2 className="text-xl sm:text-3xl md:text-4xl font-semibold text-red-300 text-center truncate max-w-full px-2 mb-4 sm:mb-8">
            {player2Name}
          </h2>
          <div
            className={cn(
              'text-[clamp(5rem,18vw,16rem)] font-bold tabular-nums text-red-400 leading-none transition-transform duration-200',
              p2Bump && 'scale-110'
            )}
          >
            {formatScore(player2Score)}
          </div>
          <div className="mt-4 sm:mt-8 text-zinc-400 text-lg sm:text-2xl">
            Sets <span className="text-white font-bold tabular-nums">{player2Sets}</span>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <footer className="shrink-0 py-3 sm:py-4 text-center bg-zinc-900/80 border-t border-zinc-800">
        {winner ? (
          <p className="text-xl sm:text-3xl font-bold text-yellow-400 flex items-center justify-center gap-2">
            <Trophy className="h-6 w-6 sm:h-8 sm:w-8" />
            Winner: {winner}
          </p>
        ) : isLive ? (
          <p className="text-zinc-400 text-sm sm:text-lg">
            Set {currentSet} · Match in progress
          </p>
        ) : (
          <p className="text-zinc-500 text-sm sm:text-lg">Match not started</p>
        )}
      </footer>
    </div>
  );
}
