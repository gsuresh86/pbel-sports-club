import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import type { CategoryType, PublicPlayer, Registration } from '@/types';
import { normalizeCategorySlug } from '@/lib/categoryLabels';

const PUBLIC_PLAYER_KEYS = [
  'tournamentId',
  'name',
  'partnerName',
  'profilePhotoUrl',
  'partnerProfilePhotoUrl',
  'selectedCategory',
  'updatedAt',
] as const;

export function publicPlayersRef(db: Firestore, tournamentId: string) {
  return collection(db, 'tournaments', tournamentId, 'publicPlayers');
}

export function publicPlayerRef(db: Firestore, tournamentId: string, registrationId: string) {
  return doc(db, 'tournaments', tournamentId, 'publicPlayers', registrationId);
}

/** Safe public projection from a full registration (or partial update). */
export function toPublicPlayer(
  tournamentId: string,
  registrationId: string,
  source: Partial<Registration> & { name?: string; selectedCategory?: CategoryType }
): PublicPlayer {
  return {
    id: registrationId,
    tournamentId,
    name: (source.name ?? '').trim(),
    partnerName: source.partnerName?.trim() || undefined,
    profilePhotoUrl: source.profilePhotoUrl?.trim() || undefined,
    partnerProfilePhotoUrl: source.partnerProfilePhotoUrl?.trim() || undefined,
    selectedCategory: (normalizeCategorySlug(source.selectedCategory) ?? source.selectedCategory) as CategoryType,
    updatedAt: new Date(),
  };
}

export function publicPlayerWriteData(player: PublicPlayer): Record<string, unknown> {
  const data: Record<string, unknown> = {
    tournamentId: player.tournamentId,
    name: player.name,
    selectedCategory: player.selectedCategory,
    updatedAt: player.updatedAt ?? new Date(),
  };
  if (player.partnerName) data.partnerName = player.partnerName;
  if (player.profilePhotoUrl) data.profilePhotoUrl = player.profilePhotoUrl;
  if (player.partnerProfilePhotoUrl) data.partnerProfilePhotoUrl = player.partnerProfilePhotoUrl;
  return data;
}

export async function upsertPublicPlayer(
  db: Firestore,
  tournamentId: string,
  registrationId: string,
  source: Partial<Registration> & { name?: string; selectedCategory?: CategoryType }
): Promise<void> {
  const player = toPublicPlayer(tournamentId, registrationId, source);
  if (!player.name || !player.selectedCategory) return;
  await setDoc(publicPlayerRef(db, tournamentId, registrationId), publicPlayerWriteData(player), {
    merge: true,
  });
}

export async function deletePublicPlayer(
  db: Firestore,
  tournamentId: string,
  registrationId: string
): Promise<void> {
  await deleteDoc(publicPlayerRef(db, tournamentId, registrationId));
}

export async function listPublicPlayers(
  db: Firestore,
  tournamentId: string
): Promise<PublicPlayer[]> {
  const snap = await getDocs(publicPlayersRef(db, tournamentId));
  return snap.docs.map((d) => {
    const data = d.data();
    const selectedCategory =
      normalizeCategorySlug(data.selectedCategory as string) ?? (data.selectedCategory as CategoryType);
    return {
      id: d.id,
      tournamentId: (data.tournamentId as string) ?? tournamentId,
      name: (data.name as string) ?? '',
      partnerName: data.partnerName as string | undefined,
      profilePhotoUrl: data.profilePhotoUrl as string | undefined,
      partnerProfilePhotoUrl: data.partnerProfilePhotoUrl as string | undefined,
      selectedCategory,
      updatedAt: data.updatedAt?.toDate?.() ?? undefined,
    } satisfies PublicPlayer;
  });
}

export { PUBLIC_PLAYER_KEYS };
