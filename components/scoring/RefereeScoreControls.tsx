'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface RefereeScoreControlsProps {
  player1Name: string;
  player2Name: string;
  player1Score: number;
  player2Score: number;
  maxPoints: number;
  updating?: boolean;
  onIncrement: (player: 'player1' | 'player2') => void;
  onDecrement: (player: 'player1' | 'player2') => void;
  onSetScore?: (player: 'player1' | 'player2', value: number) => void;
  className?: string;
}

export function RefereeScoreControls({
  player1Name,
  player2Name,
  player1Score,
  player2Score,
  maxPoints,
  updating = false,
  onIncrement,
  onDecrement,
  onSetScore,
  className,
}: RefereeScoreControlsProps) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:gap-4', className)}>
      {/* Player 1 */}
      <div className="flex flex-col gap-2">
        <p className="text-center text-sm font-semibold text-blue-600 truncate px-1">
          {player1Name}
        </p>
        <Button
          onClick={() => onDecrement('player1')}
          disabled={updating || player1Score === 0}
          variant="outline"
          className="min-h-12 touch-manipulation active:scale-95 text-lg"
        >
          −1
        </Button>
        <Button
          onClick={() => onIncrement('player1')}
          disabled={updating}
          className="min-h-20 sm:min-h-24 touch-manipulation active:scale-95 text-2xl sm:text-3xl font-bold bg-blue-600 hover:bg-blue-700"
        >
          +1
        </Button>
        {onSetScore && (
          <div className="hidden sm:block">
            <input
              type="range"
              min={0}
              max={maxPoints}
              value={player1Score}
              onChange={(e) => onSetScore('player1', parseInt(e.target.value, 10))}
              disabled={updating}
              className="w-full h-3 rounded-lg appearance-none cursor-pointer bg-blue-100 accent-blue-600 disabled:opacity-50"
            />
            <div className="text-xs text-center text-gray-500 mt-1">
              Drag: 0–{maxPoints}
            </div>
          </div>
        )}
      </div>

      {/* Player 2 */}
      <div className="flex flex-col gap-2">
        <p className="text-center text-sm font-semibold text-red-600 truncate px-1">
          {player2Name}
        </p>
        <Button
          onClick={() => onDecrement('player2')}
          disabled={updating || player2Score === 0}
          variant="outline"
          className="min-h-12 touch-manipulation active:scale-95 text-lg"
        >
          −1
        </Button>
        <Button
          onClick={() => onIncrement('player2')}
          disabled={updating}
          className="min-h-20 sm:min-h-24 touch-manipulation active:scale-95 text-2xl sm:text-3xl font-bold bg-red-600 hover:bg-red-700"
        >
          +1
        </Button>
        {onSetScore && (
          <div className="hidden sm:block">
            <input
              type="range"
              min={0}
              max={maxPoints}
              value={player2Score}
              onChange={(e) => onSetScore('player2', parseInt(e.target.value, 10))}
              disabled={updating}
              className="w-full h-3 rounded-lg appearance-none cursor-pointer bg-red-100 accent-red-600 disabled:opacity-50"
            />
            <div className="text-xs text-center text-gray-500 mt-1">
              Drag: 0–{maxPoints}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
