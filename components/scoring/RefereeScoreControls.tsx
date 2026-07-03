'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { displayPlayerToStored } from '@/lib/match-scoring';
import { ArrowLeftRight } from 'lucide-react';

export interface RefereeScoreControlsProps {
  player1Name: string;
  player2Name: string;
  player1Score: number;
  player2Score: number;
  maxPoints: number;
  canIncrementP1?: boolean;
  canIncrementP2?: boolean;
  sidesSwapped?: boolean;
  updating?: boolean;
  onIncrement: (player: 'player1' | 'player2') => void;
  onDecrement: (player: 'player1' | 'player2') => void;
  onSetScore?: (player: 'player1' | 'player2', value: number) => void;
  onSwapSides?: () => void;
  className?: string;
}

export function RefereeScoreControls({
  player1Name,
  player2Name,
  player1Score,
  player2Score,
  maxPoints,
  canIncrementP1 = true,
  canIncrementP2 = true,
  sidesSwapped = false,
  updating = false,
  onIncrement,
  onDecrement,
  onSetScore,
  onSwapSides,
  className,
}: RefereeScoreControlsProps) {
  const leftName = sidesSwapped ? player2Name : player1Name;
  const rightName = sidesSwapped ? player1Name : player2Name;
  const leftScore = sidesSwapped ? player2Score : player1Score;
  const rightScore = sidesSwapped ? player1Score : player2Score;
  const leftCanInc = sidesSwapped ? canIncrementP2 : canIncrementP1;
  const rightCanInc = sidesSwapped ? canIncrementP1 : canIncrementP2;
  const leftIsBlue = !sidesSwapped;
  const rightIsBlue = sidesSwapped;

  const handleInc = (displaySide: 'left' | 'right') => {
    const displayPlayer = displaySide === 'left' ? 'player1' : 'player2';
    onIncrement(displayPlayerToStored(displayPlayer, sidesSwapped));
  };

  const handleDec = (displaySide: 'left' | 'right') => {
    const displayPlayer = displaySide === 'left' ? 'player1' : 'player2';
    onDecrement(displayPlayerToStored(displayPlayer, sidesSwapped));
  };

  const handleSet = (displaySide: 'left' | 'right', value: number) => {
    if (!onSetScore) return;
    const displayPlayer = displaySide === 'left' ? 'player1' : 'player2';
    onSetScore(displayPlayerToStored(displayPlayer, sidesSwapped), value);
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
      <div className="flex flex-col gap-2">
        <p className={`text-center text-sm font-semibold truncate px-1 ${leftIsBlue ? 'text-blue-600' : 'text-red-600'}`}>
          {leftName}
        </p>
        <Button
          onClick={() => handleDec('left')}
          disabled={updating || leftScore === 0}
          variant="outline"
          className="min-h-12 touch-manipulation active:scale-95 text-lg"
        >
          −1
        </Button>
        <Button
          onClick={() => handleInc('left')}
          disabled={updating || !leftCanInc}
          className={`min-h-20 sm:min-h-24 touch-manipulation active:scale-95 text-2xl sm:text-3xl font-bold ${leftIsBlue ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}
        >
          +1
        </Button>
        {onSetScore && (
          <div className="pt-1">
            <input
              type="range"
              min={0}
              max={maxPoints}
              value={leftScore}
              onChange={(e) => handleSet('left', parseInt(e.target.value, 10))}
              disabled={updating}
              className={cn(
                'score-range w-full cursor-pointer touch-manipulation disabled:opacity-50',
                'h-10 sm:h-3 sm:rounded-lg sm:appearance-none',
                leftIsBlue ? 'accent-blue-600 sm:bg-blue-100' : 'accent-red-600 sm:bg-red-100',
              )}
            />
            <div className="text-xs text-center text-gray-500 mt-1.5">
              <span className="sm:hidden">Slide: </span>
              <span className="hidden sm:inline">Drag: </span>
              0–{maxPoints}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className={`text-center text-sm font-semibold truncate px-1 ${rightIsBlue ? 'text-blue-600' : 'text-red-600'}`}>
          {rightName}
        </p>
        <Button
          onClick={() => handleDec('right')}
          disabled={updating || rightScore === 0}
          variant="outline"
          className="min-h-12 touch-manipulation active:scale-95 text-lg"
        >
          −1
        </Button>
        <Button
          onClick={() => handleInc('right')}
          disabled={updating || !rightCanInc}
          className={`min-h-20 sm:min-h-24 touch-manipulation active:scale-95 text-2xl sm:text-3xl font-bold ${rightIsBlue ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}
        >
          +1
        </Button>
        {onSetScore && (
          <div className="pt-1">
            <input
              type="range"
              min={0}
              max={maxPoints}
              value={rightScore}
              onChange={(e) => handleSet('right', parseInt(e.target.value, 10))}
              disabled={updating}
              className={cn(
                'score-range w-full cursor-pointer touch-manipulation disabled:opacity-50',
                'h-10 sm:h-3 sm:rounded-lg sm:appearance-none',
                rightIsBlue ? 'accent-blue-600 sm:bg-blue-100' : 'accent-red-600 sm:bg-red-100',
              )}
            />
            <div className="text-xs text-center text-gray-500 mt-1.5">
              <span className="sm:hidden">Slide: </span>
              <span className="hidden sm:inline">Drag: </span>
              0–{maxPoints}
            </div>
          </div>
        )}
      </div>
      </div>

      {onSwapSides && (
        <Button
          type="button"
          onClick={onSwapSides}
          disabled={updating}
          variant="outline"
          className="sm:hidden w-full min-h-12 touch-manipulation gap-2"
        >
          <ArrowLeftRight className="h-4 w-4" />
          {sidesSwapped ? 'Restore sides' : 'Swap sides'}
        </Button>
      )}
    </div>
  );
}
