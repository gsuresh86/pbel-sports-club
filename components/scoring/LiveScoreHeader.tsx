'use client';

import { Badge } from '@/components/ui/badge';
import { Play, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getDisplaySides } from '@/lib/match-scoring';

function formatScore(score: number) {
  return score.toString().padStart(2, '0');
}

export interface LiveScoreHeaderProps {
  player1Name: string;
  player2Name: string;
  player1Score: number;
  player2Score: number;
  player1Sets: number;
  player2Sets: number;
  currentSet: number;
  isLive?: boolean;
  winner?: string;
  sidesSwapped?: boolean;
  size?: 'default' | 'large';
  className?: string;
}

export function LiveScoreHeader({
  player1Name,
  player2Name,
  player1Score,
  player2Score,
  player1Sets,
  player2Sets,
  currentSet,
  isLive = false,
  winner,
  sidesSwapped = false,
  size = 'default',
  className,
}: LiveScoreHeaderProps) {
  const scoreClass =
    size === 'large'
      ? 'text-5xl sm:text-6xl font-bold tabular-nums'
      : 'text-4xl sm:text-5xl font-bold tabular-nums';

  const sides = getDisplaySides(
    { player1Name, player2Name },
    { p1: player1Score, p2: player2Score, sets1: player1Sets, sets2: player2Sets },
    sidesSwapped
  );

  const leftColor = sides.left.color === 'blue' ? 'text-blue-600' : 'text-red-600';
  const rightColor = sides.right.color === 'blue' ? 'text-blue-600' : 'text-red-600';

  return (
    <div className={cn('w-full', className)}>
      {isLive && !winner && (
        <div className="flex justify-center mb-3">
          <Badge className="bg-green-100 text-green-800 animate-pulse">
            <Play className="h-3 w-3 mr-1" />
            LIVE
          </Badge>
        </div>
      )}

      <div className="flex items-center justify-center gap-3 sm:gap-6">
        <div className="text-center min-w-0 flex-1">
          <h3 className={cn('text-sm font-medium truncate sm:text-base', leftColor)}>
            {sides.left.name}
          </h3>
          <div className={cn(scoreClass, leftColor, 'mt-1')}>
            {formatScore(sides.left.score)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Sets: {sides.left.sets}</div>
        </div>

        <div className="flex flex-col items-center justify-center shrink-0 px-1">
          <span className="text-2xl font-bold text-gray-400 sm:text-3xl">–</span>
          {!winner && (
            <span className="text-xs text-gray-500 mt-1 whitespace-nowrap">
              Set {currentSet}
            </span>
          )}
        </div>

        <div className="text-center min-w-0 flex-1">
          <h3 className={cn('text-sm font-medium truncate sm:text-base', rightColor)}>
            {sides.right.name}
          </h3>
          <div className={cn(scoreClass, rightColor, 'mt-1')}>
            {formatScore(sides.right.score)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Sets: {sides.right.sets}</div>
        </div>
      </div>

      {winner && (
        <div className="text-center mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <Trophy className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
          <h3 className="text-lg sm:text-xl font-bold text-yellow-800">
            Congratulations, {winner}!
          </h3>
        </div>
      )}
    </div>
  );
}
