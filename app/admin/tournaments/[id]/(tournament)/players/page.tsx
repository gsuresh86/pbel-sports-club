'use client';

import { useMemo, useState } from 'react';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import {
  useTournament,
  useTournamentRegistrations,
  useInvalidateTournament,
} from '@/hooks/use-tournament-queries';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { categoriesMatch } from '@/lib/categoryLabels';
import {
  buildUniquePlayersFromRegistrations,
  formatCategoryLabel,
  normalizePlayerName,
  playerInitials,
  updatePlayerDetails,
  updatePlayerTshirtTaken,
  type PlayerEditValues,
  type UniquePlayerRow,
} from '@/lib/tournament-players';
import { PlayerEditPane } from '@/components/admin/PlayerEditPane';
import { Download, Edit, Loader2, Users, X } from 'lucide-react';
import Image from 'next/image';
import { useTournamentPageGate } from '@/hooks/use-tournament-page-gate';
import { cn } from '@/lib/utils';

export default function PlayersPage() {
  const { tournamentId, queriesEnabled } = useTournamentPageGate('players');

  const { data: tournamentData } = useTournament(tournamentId, { enabled: queriesEnabled });
  const { data: registrationsData = [] } = useTournamentRegistrations(tournamentId, { enabled: queriesEnabled });
  const invalidateTournament = useInvalidateTournament();

  const tournament = tournamentData ?? null;
  const uniquePlayers = useMemo(
    () => buildUniquePlayersFromRegistrations(registrationsData),
    [registrationsData],
  );

  const [playerSearch, setPlayerSearch] = useState('');
  const [playerCategoryFilter, setPlayerCategoryFilter] = useState<string>('all');
  const [selectedPlayerKey, setSelectedPlayerKey] = useState<string | null>(null);
  const [savingPlayer, setSavingPlayer] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [togglingTshirtKey, setTogglingTshirtKey] = useState<string | null>(null);
  const [uploadingPlayerPhoto, setUploadingPlayerPhoto] = useState(false);

  const allPlayerCategories = useMemo(
    () => Array.from(new Set(uniquePlayers.flatMap((p) => p.categories))).sort(),
    [uniquePlayers],
  );

  const filteredPlayers = useMemo(() => {
    return uniquePlayers.filter((p) => {
      const matchesSearch =
        !playerSearch ||
        p.name.toLowerCase().includes(playerSearch.toLowerCase()) ||
        p.phone.includes(playerSearch);
      const matchesCategory =
        playerCategoryFilter === 'all' ||
        p.categories.some((cat) => categoriesMatch(cat, playerCategoryFilter));
      return matchesSearch && matchesCategory;
    });
  }, [uniquePlayers, playerSearch, playerCategoryFilter]);

  const selectedPlayer =
    selectedPlayerKey != null
      ? uniquePlayers.find((p) => normalizePlayerName(p.name) === selectedPlayerKey) ?? null
      : null;

  const openPlayerPane = (player: UniquePlayerRow) => {
    setSaveError(null);
    setSelectedPlayerKey(normalizePlayerName(player.name));
  };

  const closePlayerPane = () => {
    setSelectedPlayerKey(null);
    setSaveError(null);
    setSavingPlayer(false);
  };

  const handlePlayerPhotoUpload = async (file: File): Promise<string | void> => {
    if (!file.type.startsWith('image/')) return;
    setUploadingPlayerPhoto(true);
    setSaveError(null);
    try {
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
      const path = `participant-profiles/${tournamentId}/inline-${timestamp}-${safeName}`;
      const snap = await uploadBytes(storageRef(storage, path), file);
      return await getDownloadURL(snap.ref);
    } catch (err) {
      console.error('Photo upload failed:', err);
      setSaveError('Photo upload failed. Please try again.');
    } finally {
      setUploadingPlayerPhoto(false);
    }
  };

  const toggleTshirtTaken = async (player: UniquePlayerRow, taken: boolean) => {
    const key = normalizePlayerName(player.name);
    setTogglingTshirtKey(key);
    try {
      await updatePlayerTshirtTaken(tournamentId, player, taken);
      invalidateTournament(tournamentId);
    } catch (err) {
      console.error('Error updating t-shirt status:', err);
    } finally {
      setTogglingTshirtKey(null);
    }
  };

  const savePlayerEdits = async (values: PlayerEditValues) => {
    if (!selectedPlayer) return;
    setSavingPlayer(true);
    setSaveError(null);
    try {
      await updatePlayerDetails(tournamentId, selectedPlayer, values);
      invalidateTournament(tournamentId);
      setSelectedPlayerKey(normalizePlayerName(values.name));
    } catch (err) {
      console.error('Error saving player edits:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save player.');
    } finally {
      setSavingPlayer(false);
    }
  };

  const exportPlayersCsv = (players: UniquePlayerRow[]) => {
    const rows = [
      ['Name', 'Phone', 'Email', 'T-Shirt Size', 'T-Shirt Taken', 'Level', 'Categories'],
      ...players.map((p) => [
        p.name,
        p.phone,
        p.email,
        p.tshirtSize,
        p.tshirtTaken ? 'Yes' : 'No',
        p.expertiseLevel,
        p.categories.map(formatCategoryLabel).join('; '),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = (tournament?.name ?? 'tournament').replace(/\s+/g, '-').toLowerCase().slice(0, 30);
    a.href = url;
    a.download = `players-${slug}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!tournament) return null;

  return (
    <div className="flex h-[calc(100dvh-14rem)] min-h-[280px] flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-base font-semibold sm:text-lg">
            Players (
            {playerSearch || playerCategoryFilter !== 'all'
              ? `${filteredPlayers.length} of ${uniquePlayers.length}`
              : uniquePlayers.length}
            )
          </h3>
          <p className="text-xs text-gray-600 sm:text-sm">
            Unique players — click a row or <Edit className="inline h-3 w-3" /> to edit name and details
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Select value={playerCategoryFilter} onValueChange={setPlayerCategoryFilter}>
            <SelectTrigger className="hidden h-8 w-36 text-xs sm:flex">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                All categories
              </SelectItem>
              {allPlayerCategories.map((cat) => (
                <SelectItem key={cat} value={cat} className="text-xs capitalize">
                  {formatCategoryLabel(cat)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-52">
            <Input
              placeholder="Search players…"
              value={playerSearch}
              onChange={(e) => setPlayerSearch(e.target.value)}
              className="h-8 pr-8 text-xs"
            />
            {playerSearch && (
              <button
                type="button"
                onClick={() => setPlayerSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="hidden h-8 gap-1.5 text-xs sm:flex"
            onClick={() => exportPlayersCsv(filteredPlayers)}
            disabled={filteredPlayers.length === 0}
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none">
        <CardContent className="flex min-h-0 flex-1 overflow-hidden p-0">
          {uniquePlayers.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <div>
                <Users className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                <h3 className="mb-2 text-lg font-medium text-gray-900">No players yet</h3>
                <p className="text-gray-600">Players will appear here once registrations are submitted.</p>
              </div>
            </div>
          ) : (
            <>
              <div
                className={cn(
                  'registrations-table-scroll min-h-0 min-w-0 flex-1 overflow-auto',
                  selectedPlayer && 'hidden sm:block',
                )}
              >
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 text-xs sm:text-sm" />
                      <TableHead className="text-xs sm:text-sm">Name</TableHead>
                      <TableHead className="text-xs sm:text-sm">Phone</TableHead>
                      <TableHead className="text-xs sm:text-sm">T-Shirt Size</TableHead>
                      <TableHead className="text-xs sm:text-sm">T-Shirt Taken</TableHead>
                      <TableHead className="text-xs sm:text-sm">Level</TableHead>
                      <TableHead className="text-xs sm:text-sm">Categories</TableHead>
                      <TableHead className="w-20 text-xs sm:text-sm">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPlayers.map((player) => {
                      const key = normalizePlayerName(player.name);
                      const isSelected = selectedPlayerKey === key;
                      const initials = playerInitials(player.name);
                      return (
                        <TableRow
                          key={key}
                          className={cn('cursor-pointer', isSelected && 'bg-blue-50')}
                          onClick={() => openPlayerPane(player)}
                        >
                          <TableCell className="py-1.5 pr-0">
                            {player.profilePhotoUrl ? (
                              <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-full">
                                <Image
                                  src={player.profilePhotoUrl}
                                  alt={player.name}
                                  width={36}
                                  height={36}
                                  className="h-full w-full rounded-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gray-800 text-xs font-bold text-white">
                                {initials}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="py-1.5 text-xs font-medium sm:text-sm">{player.name}</TableCell>
                          <TableCell className="py-1.5 text-xs sm:text-sm">{player.phone || '—'}</TableCell>
                          <TableCell className="py-1.5 text-xs sm:text-sm">{player.tshirtSize || '—'}</TableCell>
                          <TableCell className="py-1.5" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`tshirt-taken-${key}`}
                                checked={player.tshirtTaken}
                                disabled={togglingTshirtKey === key}
                                onCheckedChange={(checked) => toggleTshirtTaken(player, checked === true)}
                                aria-label={`T-shirt taken for ${player.name}`}
                              />
                              <label
                                htmlFor={`tshirt-taken-${key}`}
                                className={`cursor-pointer text-xs sm:text-sm ${player.tshirtTaken ? 'text-green-700' : 'text-muted-foreground'}`}
                              >
                                {togglingTshirtKey === key ? (
                                  <Loader2 className="inline h-3.5 w-3.5 animate-spin" />
                                ) : player.tshirtTaken ? (
                                  'Yes'
                                ) : (
                                  'No'
                                )}
                              </label>
                            </div>
                          </TableCell>
                          <TableCell className="py-1.5">
                            <Badge variant="outline" className="text-[10px] capitalize sm:text-xs">
                              {player.expertiseLevel || '—'}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-1.5">
                            <div className="flex flex-wrap gap-1">
                              {player.categories.map((cat) => (
                                <Badge key={cat} variant="outline" className="text-[10px] capitalize sm:text-xs">
                                  {formatCategoryLabel(cat)}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="py-1.5" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openPlayerPane(player)}
                              className="h-7 w-7 p-0 touch-manipulation"
                              title="Edit"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {selectedPlayer && (
                <PlayerEditPane
                  player={selectedPlayer}
                  saving={savingPlayer}
                  uploadingPhoto={uploadingPlayerPhoto}
                  error={saveError}
                  onClose={closePlayerPane}
                  onSave={savePlayerEdits}
                  onUploadPhoto={handlePlayerPhotoUpload}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
