'use client';

import { useState, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
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
import { CategoryType } from '@/types';
import { Camera, Check, Download, Edit, Loader2, Users, X } from 'lucide-react';
import Image from 'next/image';

const isAdminRole = (role: string) =>
  role === 'admin' || role === 'tournament-admin' || role === 'super-admin';

type UniquePlayerRow = {
  name: string;
  phone: string;
  tshirtSize: string;
  tshirtTaken: boolean;
  expertiseLevel: string;
  profilePhotoUrl: string;
  categories: CategoryType[];
  registrationRefs: Array<{ id: string; role: 'primary' | 'partner' }>;
};

function normalizePlayerName(name: string) {
  return name.trim().toLowerCase();
}

function formatCategoryLabel(category: string) {
  return category.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PlayersPage() {
  const { user } = useAuth();
  const params = useParams();
  const tournamentId = params.id as string;
  const queriesEnabled = !!user && isAdminRole(user.role) && !!tournamentId;

  const { data: tournamentData } = useTournament(tournamentId, { enabled: queriesEnabled });
  const { data: registrationsData = [] } = useTournamentRegistrations(tournamentId, { enabled: queriesEnabled });
  const invalidateTournament = useInvalidateTournament();

  const tournament = tournamentData ?? null;
  const participants = registrationsData;

  const [playerSearch, setPlayerSearch] = useState('');
  const [playerCategoryFilter, setPlayerCategoryFilter] = useState<string>('all');
  const [editingPlayerKey, setEditingPlayerKey] = useState<string | null>(null);
  const [playerEdits, setPlayerEdits] = useState<{ tshirtSize: string; expertiseLevel: string; profilePhotoUrl: string | null }>({ tshirtSize: '', expertiseLevel: '', profilePhotoUrl: null });
  const [savingPlayer, setSavingPlayer] = useState(false);
  const [togglingTshirtKey, setTogglingTshirtKey] = useState<string | null>(null);
  const [uploadingPlayerPhoto, setUploadingPlayerPhoto] = useState(false);
  const playerPhotoInputRef = useRef<HTMLInputElement>(null);

  const uniquePlayers = useMemo(() => {
    const map = new Map<string, UniquePlayerRow>();
    const upsert = (
      rawName: string,
      phone: string | undefined,
      tshirtSize: string | undefined,
      tshirtTaken: boolean | undefined,
      expertiseLevel: string | undefined,
      profilePhotoUrl: string | undefined,
      category: CategoryType,
      registrationRef: { id: string; role: 'primary' | 'partner' },
    ) => {
      const name = rawName.trim();
      if (!name) return;
      const key = normalizePlayerName(name);
      const existing = map.get(key);
      if (existing) {
        if (phone?.trim() && !existing.phone) existing.phone = phone.trim();
        if (tshirtSize?.trim() && !existing.tshirtSize) existing.tshirtSize = tshirtSize.trim();
        if (tshirtTaken) existing.tshirtTaken = true;
        if (expertiseLevel?.trim() && !existing.expertiseLevel) existing.expertiseLevel = expertiseLevel.trim();
        if (profilePhotoUrl?.trim() && !existing.profilePhotoUrl) existing.profilePhotoUrl = profilePhotoUrl.trim();
        if (!existing.categories.includes(category)) existing.categories.push(category);
        existing.registrationRefs.push(registrationRef);
      } else {
        map.set(key, {
          name,
          phone: phone?.trim() ?? '',
          tshirtSize: tshirtSize?.trim() ?? '',
          tshirtTaken: tshirtTaken ?? false,
          expertiseLevel: expertiseLevel?.trim() ?? '',
          profilePhotoUrl: profilePhotoUrl?.trim() ?? '',
          categories: [category],
          registrationRefs: [registrationRef],
        });
      }
    };
    participants.forEach((p) => {
      upsert(p.name, p.phone, p.tshirtSize, p.tshirtTaken, p.expertiseLevel, p.profilePhotoUrl, p.selectedCategory, { id: p.id, role: 'primary' });
      if (p.partnerName?.trim()) {
        upsert(p.partnerName, p.partnerPhone, p.partnerTshirtSize, p.partnerTshirtTaken, undefined, p.partnerProfilePhotoUrl, p.selectedCategory, { id: p.id, role: 'partner' });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [participants]);

  const allPlayerCategories = useMemo(
    () => Array.from(new Set(uniquePlayers.flatMap((p) => p.categories))).sort(),
    [uniquePlayers],
  );

  const filteredPlayers = useMemo(() => {
    return uniquePlayers.filter((p) => {
      const matchesSearch = !playerSearch || p.name.toLowerCase().includes(playerSearch.toLowerCase()) || p.phone.includes(playerSearch);
      const matchesCategory = playerCategoryFilter === 'all' || p.categories.includes(playerCategoryFilter as CategoryType);
      return matchesSearch && matchesCategory;
    });
  }, [uniquePlayers, playerSearch, playerCategoryFilter]);

  const startEditPlayer = (player: UniquePlayerRow) => {
    setEditingPlayerKey(normalizePlayerName(player.name));
    setPlayerEdits({ tshirtSize: player.tshirtSize, expertiseLevel: player.expertiseLevel, profilePhotoUrl: player.profilePhotoUrl || null });
  };

  const cancelEditPlayer = () => {
    setEditingPlayerKey(null);
    setSavingPlayer(false);
  };

  const handlePlayerPhotoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setUploadingPlayerPhoto(true);
    try {
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
      const path = `participant-profiles/${tournamentId}/inline-${timestamp}-${safeName}`;
      const snap = await uploadBytes(storageRef(storage, path), file);
      const url = await getDownloadURL(snap.ref);
      setPlayerEdits((prev) => ({ ...prev, profilePhotoUrl: url }));
    } catch (err) {
      console.error('Photo upload failed:', err);
    } finally {
      setUploadingPlayerPhoto(false);
      if (playerPhotoInputRef.current) playerPhotoInputRef.current.value = '';
    }
  };

  const toggleTshirtTaken = async (player: UniquePlayerRow, taken: boolean) => {
    const key = normalizePlayerName(player.name);
    setTogglingTshirtKey(key);
    try {
      await Promise.all(
        player.registrationRefs.map(({ id, role }) => {
          const fields: Record<string, unknown> = {
            updatedAt: new Date(),
            ...(role === 'primary' ? { tshirtTaken: taken } : { partnerTshirtTaken: taken }),
          };
          return updateDoc(doc(db, 'tournaments', tournamentId, 'registrations', id), fields);
        }),
      );
      invalidateTournament(tournamentId);
    } catch (err) {
      console.error('Error updating t-shirt status:', err);
    } finally {
      setTogglingTshirtKey(null);
    }
  };

  const savePlayerEdits = async (player: UniquePlayerRow) => {
    setSavingPlayer(true);
    try {
      await Promise.all(
        player.registrationRefs.map(({ id, role }) => {
          const fields: Record<string, unknown> = { updatedAt: new Date() };
          if (role === 'primary') {
            fields.expertiseLevel = playerEdits.expertiseLevel;
            if (playerEdits.tshirtSize) fields.tshirtSize = playerEdits.tshirtSize;
            if (playerEdits.profilePhotoUrl !== null) fields.profilePhotoUrl = playerEdits.profilePhotoUrl;
          } else {
            if (playerEdits.tshirtSize) fields.partnerTshirtSize = playerEdits.tshirtSize;
            if (playerEdits.profilePhotoUrl !== null) fields.partnerProfilePhotoUrl = playerEdits.profilePhotoUrl;
          }
          return updateDoc(doc(db, 'tournaments', tournamentId, 'registrations', id), fields);
        }),
      );
      invalidateTournament(tournamentId);
      setEditingPlayerKey(null);
    } catch (err) {
      console.error('Error saving player edits:', err);
    } finally {
      setSavingPlayer(false);
    }
  };

  const exportPlayersCsv = (players: UniquePlayerRow[]) => {
    const rows = [
      ['Name', 'Phone', 'T-Shirt Size', 'T-Shirt Taken', 'Level', 'Categories'],
      ...players.map((p) => [p.name, p.phone, p.tshirtSize, p.tshirtTaken ? 'Yes' : 'No', p.expertiseLevel, p.categories.map(formatCategoryLabel).join('; ')]),
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
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-base font-semibold sm:text-lg">
            Players ({(playerSearch || playerCategoryFilter !== 'all') ? `${filteredPlayers.length} of ${uniquePlayers.length}` : uniquePlayers.length})
          </h3>
          <p className="text-xs text-gray-600 sm:text-sm">
            Unique players — click <Edit className="inline h-3 w-3" /> to edit level, T-shirt size or photo
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={playerCategoryFilter} onValueChange={setPlayerCategoryFilter}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="All categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All categories</SelectItem>
              {allPlayerCategories.map((cat) => (
                <SelectItem key={cat} value={cat} className="text-xs capitalize">{formatCategoryLabel(cat)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative w-44 sm:w-52">
            <Input
              placeholder="Search players…"
              value={playerSearch}
              onChange={(e) => setPlayerSearch(e.target.value)}
              className="h-8 pr-8 text-xs"
            />
            {playerSearch && (
              <button type="button" onClick={() => setPlayerSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button
            variant="outline" size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => exportPlayersCsv(filteredPlayers)}
            disabled={filteredPlayers.length === 0}
          >
            <Download className="h-3.5 w-3.5" />Export CSV
          </Button>
        </div>
      </div>

      <input
        ref={playerPhotoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePlayerPhotoUpload(f); }}
      />

      <Card className="rounded-none flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          {uniquePlayers.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <div>
                <Users className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                <h3 className="mb-2 text-lg font-medium text-gray-900">No players yet</h3>
                <p className="text-gray-600">Players will appear here once registrations are submitted.</p>
              </div>
            </div>
          ) : (
            <div className="registrations-table-scroll min-h-0 flex-1 overflow-auto sm:mx-0">
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
                    const isEditing = editingPlayerKey === key;
                    const initials = player.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
                    const photoUrl = isEditing ? playerEdits.profilePhotoUrl : player.profilePhotoUrl;
                    return (
                      <TableRow key={key} className={isEditing ? 'bg-blue-50' : undefined}>
                        <TableCell className="py-1.5 pr-0">
                          {isEditing ? (
                            <button
                              type="button"
                              onClick={() => playerPhotoInputRef.current?.click()}
                              disabled={uploadingPlayerPhoto}
                              className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400"
                              title="Upload profile photo"
                            >
                              {photoUrl ? (
                                <Image src={photoUrl} alt={player.name} width={36} height={36} className="h-full w-full object-cover rounded-full" />
                              ) : (
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-800 text-white text-xs font-bold">{initials}</div>
                              )}
                              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                                {uploadingPlayerPhoto ? <Loader2 className="h-3.5 w-3.5 animate-spin text-white" /> : <Camera className="h-3.5 w-3.5 text-white" />}
                              </div>
                            </button>
                          ) : photoUrl ? (
                            <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-full">
                              <Image src={photoUrl} alt={player.name} width={36} height={36} className="h-full w-full object-cover rounded-full" />
                            </div>
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-800 text-white text-xs font-bold flex-shrink-0">{initials}</div>
                          )}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs font-medium sm:text-sm">{player.name}</TableCell>
                        <TableCell className="py-1.5 text-xs sm:text-sm">{player.phone || '—'}</TableCell>
                        <TableCell className="py-1.5">
                          {isEditing ? (
                            <Select value={playerEdits.tshirtSize} onValueChange={(v) => setPlayerEdits((prev) => ({ ...prev, tshirtSize: v }))}>
                              <SelectTrigger className="h-7 w-24 text-xs"><SelectValue placeholder="Size" /></SelectTrigger>
                              <SelectContent>
                                {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'].map((s) => (
                                  <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-xs sm:text-sm">{player.tshirtSize || '—'}</span>
                          )}
                        </TableCell>
                        <TableCell className="py-1.5">
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
                          {isEditing ? (
                            <Select value={playerEdits.expertiseLevel} onValueChange={(v) => setPlayerEdits((prev) => ({ ...prev, expertiseLevel: v }))}>
                              <SelectTrigger className="h-7 w-28 text-xs"><SelectValue placeholder="Level" /></SelectTrigger>
                              <SelectContent>
                                {['beginner', 'intermediate', 'advanced', 'expert'].map((l) => (
                                  <SelectItem key={l} value={l} className="text-xs capitalize">{l}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className="capitalize text-[10px] sm:text-xs">{player.expertiseLevel || '—'}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-1.5">
                          <div className="flex flex-wrap gap-1">
                            {player.categories.map((cat) => (
                              <Badge key={cat} variant="outline" className="text-[10px] capitalize sm:text-xs">{formatCategoryLabel(cat)}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="py-1.5">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Button size="sm" className="h-7 w-7 p-0" onClick={() => savePlayerEdits(player)} disabled={savingPlayer || uploadingPlayerPhoto} title="Save">
                                {savingPlayer ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={cancelEditPlayer} disabled={savingPlayer} title="Cancel">
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => startEditPlayer(player)} className="h-7 w-7 p-0 touch-manipulation" title="Edit">
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
