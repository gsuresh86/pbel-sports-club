'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { Match, Registration, Team } from '@/types';
import {
  TEAM_RUBBER_SEQUENCE,
  rubberTypeLabel,
  validateRubberLineup,
  playerName,
  type RubberLineupSlot,
} from '@/lib/teamMatchRubbers';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: Match;
  team1: Team;
  team2: Team;
  registrations: Registration[];
  userId: string;
  onSaved: () => void;
}

function emptyLineup(): RubberLineupSlot[] {
  return TEAM_RUBBER_SEQUENCE.map(r => ({
    rubberNumber: r.rubberNumber,
    rubberType: r.rubberType,
    team1PlayerIds: [],
    team2PlayerIds: [],
  }));
}

function PlayerSelect({
  label,
  value,
  options,
  onChange,
  disabledIds,
}: {
  label: string;
  value: string;
  options: Registration[];
  onChange: (id: string) => void;
  disabledIds: Set<string>;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-gray-600">{label}</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Select player" />
        </SelectTrigger>
        <SelectContent>
          {options.map(p => (
            <SelectItem
              key={p.id}
              value={p.id}
              disabled={disabledIds.has(p.id) && p.id !== value}
            >
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function TeamMatchLineupDialog({
  open,
  onOpenChange,
  match,
  team1,
  team2,
  registrations,
  userId,
  onSaved,
}: Props) {
  const [lineup, setLineup] = useState<RubberLineupSlot[]>(emptyLineup);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const team1Players = useMemo(
    () => registrations.filter(r => (team1.players || []).includes(r.id)),
    [registrations, team1.players],
  );
  const team2Players = useMemo(
    () => registrations.filter(r => (team2.players || []).includes(r.id)),
    [registrations, team2.players],
  );

  useEffect(() => {
    if (open) {
      setLineup(emptyLineup());
      setError(null);
    }
  }, [open, match.id]);

  const updateSlot = (
    rubberNumber: number,
    side: 'team1' | 'team2',
    index: number,
    playerId: string,
  ) => {
    setLineup(prev => prev.map(slot => {
      if (slot.rubberNumber !== rubberNumber) return slot;
      const ids = side === 'team1' ? [...slot.team1PlayerIds] : [...slot.team2PlayerIds];
      ids[index] = playerId;
      return side === 'team1'
        ? { ...slot, team1PlayerIds: ids }
        : { ...slot, team2PlayerIds: ids };
    }));
  };

  const handleSave = async () => {
    const validationError = validateRubberLineup(lineup);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const now = new Date();
      const base = {
        tournamentId: match.tournamentId,
        round: match.round,
        parentMatchId: match.id,
        matchKind: 'rubber' as const,
        team1Id: team1.id,
        team2Id: team2.id,
        venue: match.venue,
        court: match.court ?? null,
        referee: match.referee ?? null,
        status: 'scheduled' as const,
        sets: [],
        matchFormat: match.matchFormat ?? 'best-of-3',
        scheduledTime: match.scheduledTime,
        updatedAt: now,
        createdBy: userId,
      };

      for (const slot of lineup) {
        const t1Ids = slot.team1PlayerIds;
        const t2Ids = slot.team2PlayerIds;
        const p1 = t1Ids[0];
        const p2 = t2Ids[0];
        const rubberData: Record<string, unknown> = {
          ...base,
          matchNumber: match.matchNumber * 10 + slot.rubberNumber,
          rubberNumber: slot.rubberNumber,
          rubberType: slot.rubberType,
          player1Id: p1,
          player1Name: playerName(registrations, p1),
          player2Id: p2,
          player2Name: playerName(registrations, p2),
        };
        if (slot.rubberType === 'doubles') {
          const p1b = t1Ids[1];
          const p2b = t2Ids[1];
          rubberData.player1PartnerId = p1b;
          rubberData.player1PartnerName = playerName(registrations, p1b);
          rubberData.player2PartnerId = p2b;
          rubberData.player2PartnerName = playerName(registrations, p2b);
        }
        await addDoc(collection(db, 'matches'), rubberData);
      }

      await updateDoc(doc(db, 'matches', match.id), {
        matchKind: 'team-tie',
        team1Id: team1.id,
        team2Id: team2.id,
        rubbersGenerated: true,
        status: 'live',
        actualStartTime: now,
        updatedAt: now,
      });

      onSaved();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      setError('Failed to save lineup and generate rubbers');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Set team lineup</DialogTitle>
          <DialogDescription>
            {team1.name} vs {team2.name} — assign players for all 5 rubbers
            (doubles, singles, doubles, singles, doubles) before the tie begins.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {lineup.map(slot => {
            const t1Disabled = new Set(slot.team1PlayerIds.filter(Boolean));
            const t2Disabled = new Set(slot.team2PlayerIds.filter(Boolean));
            const slotsPerTeam = slot.rubberType === 'doubles' ? 2 : 1;

            return (
              <div key={slot.rubberNumber} className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Rubber {slot.rubberNumber}</span>
                  <Badge variant="outline" className="text-xs">
                    {rubberTypeLabel(slot.rubberType)}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-700">{team1.name}</p>
                    {Array.from({ length: slotsPerTeam }, (_, i) => (
                      <PlayerSelect
                        key={`t1-${i}`}
                        label={slot.rubberType === 'doubles' ? `Player ${i + 1}` : 'Player'}
                        value={slot.team1PlayerIds[i] ?? ''}
                        options={team1Players}
                        onChange={id => updateSlot(slot.rubberNumber, 'team1', i, id)}
                        disabledIds={t1Disabled}
                      />
                    ))}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-700">{team2.name}</p>
                    {Array.from({ length: slotsPerTeam }, (_, i) => (
                      <PlayerSelect
                        key={`t2-${i}`}
                        label={slot.rubberType === 'doubles' ? `Player ${i + 1}` : 'Player'}
                        value={slot.team2PlayerIds[i] ?? ''}
                        options={team2Players}
                        onChange={id => updateSlot(slot.rubberNumber, 'team2', i, id)}
                        disabledIds={t2Disabled}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save lineup & start tie'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
