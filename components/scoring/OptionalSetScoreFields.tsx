'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { MatchSet } from '@/types';

export type SetScorePair = { p1: string; p2: string };

export function emptySetScoreRows(count = 3): SetScorePair[] {
  return Array.from({ length: count }, () => ({ p1: '', p2: '' }));
}

export function matchSetsToScorePairs(sets: MatchSet[]): SetScorePair[] {
  return [0, 1, 2].map((i) => ({
    p1: sets[i] != null ? String(sets[i].player1Score) : '',
    p2: sets[i] != null ? String(sets[i].player2Score) : '',
  }));
}

export function scorePairsToMatchSets(pairs: SetScorePair[]): MatchSet[] {
  return pairs
    .map((row, i) => {
      if (!row.p1 && !row.p2) return null;
      return {
        setNumber: i + 1,
        player1Score: parseInt(row.p1, 10) || 0,
        player2Score: parseInt(row.p2, 10) || 0,
      };
    })
    .filter((s): s is MatchSet => s !== null);
}

export function OptionalSetScoreFields({
  rows,
  setCount,
  player1Label,
  player2Label,
  onChange,
  labelClassName,
  inputClassName,
}: {
  rows: SetScorePair[];
  setCount: 1 | 3;
  player1Label: string;
  player2Label: string;
  onChange: (index: number, field: 'p1' | 'p2', value: string) => void;
  labelClassName?: string;
  inputClassName?: string;
}) {
  return (
    <div className="space-y-3">
      <Label className={labelClassName ?? 'text-sm text-gray-600'}>Optional set scores</Label>
      {rows.slice(0, setCount).map((row, index) => (
        <div key={index}>
          <p className="text-xs text-gray-500 mb-1.5">Set {index + 1}</p>
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center max-w-md">
            <Input
              type="number"
              min={0}
              placeholder={player1Label}
              value={row.p1}
              onChange={(e) => onChange(index, 'p1', e.target.value)}
              className={inputClassName}
            />
            <span className="text-gray-400 text-sm">–</span>
            <Input
              type="number"
              min={0}
              placeholder={player2Label}
              value={row.p2}
              onChange={(e) => onChange(index, 'p2', e.target.value)}
              className={inputClassName}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
