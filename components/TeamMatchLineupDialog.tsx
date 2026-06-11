'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, addDoc, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  tournamentLiveScoreRef,
  tournamentMatchRef,
  tournamentMatchesRef,
} from '@/lib/firestore-paths';
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
  lineupFromRubbers,
  playerName,
  type RubberLineupSlot,
} from '@/lib/teamMatchRubbers';
import { getMatchLiveDisplayNames } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: Match;
  team1: Team;
  team2: Team;
  registrations: Registration[];
  userId: string;
  existingRubbers?: Match[];
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

function buildRubberPayload(
  slot: RubberLineupSlot,
  registrations: Registration[],
  base: Record<string, unknown>,
): Record<string, unknown> {
  const t1Ids = slot.team1PlayerIds;
  const t2Ids = slot.team2PlayerIds;
  const p1 = t1Ids[0];
  const p2 = t2Ids[0];
  const rubberData: Record<string, unknown> = {
    ...base,
    matchNumber: (base.matchNumber as number) * 10 + slot.rubberNumber,
    rubberNumber: slot.rubberNumber,
    rubberType: slot.rubberType,
    player1Id: p1,
    player1Name: playerName(registrations, p1),
    player2Id: p2,
    player2Name: playerName(registrations, p2),
    player1PartnerId: null,
    player1PartnerName: null,
    player2PartnerId: null,
    player2PartnerName: null,
  };
  if (slot.rubberType === 'doubles') {
    const p1b = t1Ids[1];
    const p2b = t2Ids[1];
    rubberData.player1PartnerId = p1b;
    rubberData.player1PartnerName = playerName(registrations, p1b);
    rubberData.player2PartnerId = p2b;
    rubberData.player2PartnerName = playerName(registrations, p2b);
  }
  return rubberData;
}

export default function TeamMatchLineupDialog({
  open,
  onOpenChange,
  match,
  team1,
  team2,
  registrations,
  userId,
  existingRubbers = [],
  onSaved,
}: Props) {
  const isEditMode = existingRubbers.length > 0;
  const [lineup, setLineup] = useState<RubberLineupSlot[]>(emptyLineup);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rubberByNumber = useMemo(
    () => new Map(existingRubbers.map(r => [r.rubberNumber!, r])),
    [existingRubbers],
  );

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
      setLineup(
        existingRubbers.length > 0 ? lineupFromRubbers(existingRubbers) : emptyLineup(),
      );
      setError(null);
    }
  }, [open, match.id, existingRubbers]);

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

  const syncLiveScoreNames = async (rubberId: string, rubberData: Record<string, unknown>) => {
    const liveSnap = await getDoc(tournamentLiveScoreRef(match.tournamentId, rubberId));
    if (!liveSnap.exists()) return;
    const names = getMatchLiveDisplayNames({
      player1Id: rubberData.player1Id as string,
      player1Name: rubberData.player1Name as string,
      player1PartnerName: rubberData.player1PartnerName as string | null,
      player2Id: rubberData.player2Id as string,
      player2Name: rubberData.player2Name as string,
      player2PartnerName: rubberData.player2PartnerName as string | null,
    });
    await updateDoc(tournamentLiveScoreRef(match.tournamentId, rubberId), {
      ...names,
      lastUpdated: new Date(),
    });
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
        scheduledTime: match.scheduledTime,
        matchFormat: match.matchFormat ?? 'best-of-3',
        updatedAt: now,
        createdBy: userId,
        matchNumber: match.matchNumber,
      };

      for (const slot of lineup) {
        const rubberData = buildRubberPayload(slot, registrations, base);
        const existing = rubberByNumber.get(slot.rubberNumber);

        if (isEditMode && existing) {
          await updateDoc(tournamentMatchRef(match.tournamentId, existing.id), {
            ...rubberData,
            status: existing.status,
            sets: existing.sets ?? [],
          });
          await syncLiveScoreNames(existing.id, rubberData);
        } else {
          await addDoc(tournamentMatchesRef(match.tournamentId), {
            ...rubberData,
            status: 'scheduled' as const,
            sets: [],
          });
        }
      }

      if (!isEditMode) {
        await updateDoc(tournamentMatchRef(match.tournamentId, match.id), {
          matchKind: 'team-tie',
          team1Id: team1.id,
          team2Id: team2.id,
          rubbersGenerated: true,
          status: 'live',
          actualStartTime: now,
          updatedAt: now,
        });
      } else {
        await updateDoc(tournamentMatchRef(match.tournamentId, match.id), {
          updatedAt: now,
        });
      }

      onSaved();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      setError(isEditMode ? 'Failed to update lineup' : 'Failed to save lineup and generate rubbers');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit team lineup' : 'Set team lineup'}</DialogTitle>
          <DialogDescription>
            {team1.name} vs {team2.name} — assign players for all 5 rubbers
            (doubles, singles, doubles, singles, doubles).
            {isEditMode ? ' Changes apply to all rubbers in this tie.' : ' Save before the tie begins.'}
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
            {saving ? 'Saving…' : isEditMode ? 'Save lineup changes' : 'Save lineup & start tie'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
