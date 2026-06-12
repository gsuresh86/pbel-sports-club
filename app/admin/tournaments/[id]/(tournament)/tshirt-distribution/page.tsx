'use client';

import { useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import {
  useTournament,
  useTournamentRegistrations,
  useInvalidateTournament,
} from '@/hooks/use-tournament-queries';
import { useTournamentPageGate } from '@/hooks/use-tournament-page-gate';
import {
  buildUniquePlayersFromRegistrations,
  filterPlayersBySearch,
  formatCategoryLabel,
  normalizePlayerName,
  playerInitials,
  updatePlayerProfilePhoto,
  updatePlayerTshirtTaken,
  type UniquePlayerRow,
} from '@/lib/tournament-players';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Camera, Check, CheckCircle2, Loader2, Search, Shirt, User, X } from 'lucide-react';

type DistributionFilter = 'all' | 'pending' | 'distributed';

export default function TshirtDistributionPage() {
  const { tournamentId, queriesEnabled } = useTournamentPageGate('tshirt-distribution');

  const { data: tournamentData } = useTournament(tournamentId, { enabled: queriesEnabled });
  const { data: registrationsData = [] } = useTournamentRegistrations(tournamentId, { enabled: queriesEnabled });
  const invalidateTournament = useInvalidateTournament();

  const tournament = tournamentData ?? null;

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<DistributionFilter>('pending');
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const [uploadingPhotoKey, setUploadingPhotoKey] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoUploadTargetRef = useRef<UniquePlayerRow | null>(null);

  const uniquePlayers = useMemo(
    () => buildUniquePlayersFromRegistrations(registrationsData),
    [registrationsData],
  );

  const stats = useMemo(() => {
    const distributed = uniquePlayers.filter((p) => p.tshirtTaken).length;
    return { total: uniquePlayers.length, distributed, pending: uniquePlayers.length - distributed };
  }, [uniquePlayers]);

  const filteredPlayers = useMemo(() => {
    let list = filterPlayersBySearch(uniquePlayers, search);
    if (filter === 'pending') list = list.filter((p) => !p.tshirtTaken);
    if (filter === 'distributed') list = list.filter((p) => p.tshirtTaken);
    return list;
  }, [uniquePlayers, search, filter]);

  const toggleTshirtTaken = async (player: UniquePlayerRow, taken: boolean) => {
    const key = normalizePlayerName(player.name);
    setTogglingKey(key);
    try {
      await updatePlayerTshirtTaken(tournamentId, player, taken);
      invalidateTournament(tournamentId);
    } catch (err) {
      console.error('Error updating t-shirt distribution:', err);
    } finally {
      setTogglingKey(null);
    }
  };

  const startPhotoUpload = (player: UniquePlayerRow) => {
    if (uploadingPhotoKey) return;
    photoUploadTargetRef.current = player;
    photoInputRef.current?.click();
  };

  const handlePhotoUpload = async (file: File) => {
    const player = photoUploadTargetRef.current;
    if (!player || !file.type.startsWith('image/')) return;

    const key = normalizePlayerName(player.name);
    setUploadingPhotoKey(key);
    try {
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
      const path = `participant-profiles/${tournamentId}/inline-${timestamp}-${safeName}`;
      const snap = await uploadBytes(storageRef(storage, path), file);
      const url = await getDownloadURL(snap.ref);
      await updatePlayerProfilePhoto(tournamentId, player, url);
      invalidateTournament(tournamentId);
    } catch (err) {
      console.error('Photo upload failed:', err);
    } finally {
      setUploadingPhotoKey(null);
      photoUploadTargetRef.current = null;
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  if (!tournament) return null;

  return (
    <div className="flex flex-col gap-3 sm:h-[calc(100dvh-14rem)] sm:min-h-[320px] sm:overflow-hidden">
      <div className="sticky top-0 z-10 flex shrink-0 flex-col gap-3 bg-background pb-1 sm:static sm:pb-0">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold sm:text-lg">T-Shirt Distribution</h3>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Search players, verify their profile photo, and mark t-shirt as distributed. Tap a photo to update it.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
            <Badge variant="outline" className="gap-1">
              <Shirt className="h-3 w-3" />
              {stats.distributed}/{stats.total} distributed
            </Badge>
            <Badge variant="secondary">{stats.pending} pending</Badge>
          </div>
        </div>

        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search players by name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full pl-9 pr-9 text-sm"
            autoFocus
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {(['pending', 'all', 'distributed'] as const).map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={filter === value ? 'default' : 'outline'}
              className="h-8 text-xs capitalize"
              onClick={() => setFilter(value)}
            >
              {value === 'pending' ? `Pending (${stats.pending})` : value === 'distributed' ? `Distributed (${stats.distributed})` : `All (${stats.total})`}
            </Button>
          ))}
        </div>
      </div>

      <input
        ref={photoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handlePhotoUpload(file);
        }}
      />

      <Card className="flex flex-col rounded-none border-x-0 sm:min-h-0 sm:flex-1 sm:overflow-hidden">
        <CardContent className="flex-1 p-3 sm:min-h-0 sm:overflow-auto sm:p-4">
          {uniquePlayers.length === 0 ? (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center">
              <User className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-medium">No players yet</p>
              <p className="text-sm text-muted-foreground">Players appear here after registrations are submitted.</p>
            </div>
          ) : filteredPlayers.length === 0 ? (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center">
              <Search className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-medium">No players match your search</p>
              <p className="text-sm text-muted-foreground">Try a different name, phone number, or filter.</p>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPlayers.map((player) => {
                const key = normalizePlayerName(player.name);
                const isToggling = togglingKey === key;
                const isUploadingPhoto = uploadingPhotoKey === key;
                const initials = playerInitials(player.name);

                return (
                  <li
                    key={key}
                    className={cn(
                      'flex flex-col overflow-hidden rounded-lg border bg-white shadow-sm transition-colors',
                      player.tshirtTaken ? 'border-green-200 bg-green-50/40' : 'border-gray-200',
                    )}
                  >
                    <div className="flex items-start gap-3 p-3 sm:p-4">
                      <button
                        type="button"
                        onClick={() => startPhotoUpload(player)}
                        disabled={!!uploadingPhotoKey}
                        className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:cursor-not-allowed sm:h-24 sm:w-24"
                        title="Tap to change profile photo"
                        aria-label={`Change profile photo for ${player.name}`}
                      >
                        {player.profilePhotoUrl ? (
                          <Image
                            src={player.profilePhotoUrl}
                            alt={player.name}
                            width={96}
                            height={96}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gray-800 text-lg font-bold text-white">
                            {initials}
                          </div>
                        )}
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 transition-colors sm:bg-black/0 sm:group-hover:bg-black/40 sm:group-focus-visible:bg-black/40">
                          {isUploadingPhoto ? (
                            <Loader2 className="h-6 w-6 animate-spin text-white" />
                          ) : (
                            <>
                              <Camera className="h-5 w-5 text-white sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100 sm:h-6 sm:w-6" />
                              <span className="mt-0.5 text-[10px] font-medium text-white sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100 sm:text-xs">
                                Change
                              </span>
                            </>
                          )}
                        </div>
                        {player.tshirtTaken && !isUploadingPhoto && (
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-green-600/20">
                            <CheckCircle2 className="h-8 w-8 text-green-700" />
                          </div>
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{player.name}</p>
                        <p className="text-sm text-muted-foreground">{player.phone || 'No phone'}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <Badge variant="secondary" className="text-xs">
                            Size: {player.tshirtSize || '—'}
                          </Badge>
                          {player.tshirtTaken ? (
                            <Badge className="bg-green-600 text-xs hover:bg-green-600">Distributed</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              Pending
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {player.categories.map((cat) => (
                            <Badge key={cat} variant="outline" className="text-[10px] capitalize">
                              {formatCategoryLabel(cat)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto border-t bg-gray-50/80 p-3">
                      <label
                        htmlFor={`distribute-${key}`}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors',
                          player.tshirtTaken
                            ? 'border-green-300 bg-green-50'
                            : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50',
                          isToggling && 'pointer-events-none opacity-70',
                        )}
                      >
                        <Checkbox
                          id={`distribute-${key}`}
                          checked={player.tshirtTaken}
                          disabled={isToggling}
                          onCheckedChange={(checked) => toggleTshirtTaken(player, checked === true)}
                          className="h-5 w-5"
                        />
                        <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
                          {isToggling ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                              Updating…
                            </>
                          ) : player.tshirtTaken ? (
                            <>
                              <Check className="h-4 w-4 shrink-0 text-green-700" />
                              T-shirt distributed
                            </>
                          ) : (
                            <>
                              <Shirt className="h-4 w-4 shrink-0 text-muted-foreground" />
                              Mark t-shirt as distributed
                            </>
                          )}
                        </span>
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
