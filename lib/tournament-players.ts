import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { CategoryType, Registration } from '@/types';
import { upsertPublicPlayer } from '@/lib/public-players';

export type UniquePlayerRow = {
  name: string;
  phone: string;
  tshirtSize: string;
  tshirtTaken: boolean;
  expertiseLevel: string;
  profilePhotoUrl: string;
  categories: CategoryType[];
  registrationRefs: Array<{ id: string; role: 'primary' | 'partner' }>;
};

export function normalizePlayerName(name: string) {
  return name.trim().toLowerCase();
}

export function formatCategoryLabel(category: string) {
  return category.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function playerInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function buildUniquePlayersFromRegistrations(participants: Registration[]): UniquePlayerRow[] {
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
    upsert(p.name, p.phone, p.tshirtSize, p.tshirtTaken, p.expertiseLevel, p.profilePhotoUrl, p.selectedCategory, {
      id: p.id,
      role: 'primary',
    });
    if (p.partnerName?.trim()) {
      upsert(
        p.partnerName,
        p.partnerPhone,
        p.partnerTshirtSize,
        p.partnerTshirtTaken,
        undefined,
        p.partnerProfilePhotoUrl,
        p.selectedCategory,
        { id: p.id, role: 'partner' },
      );
    }
  });

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function filterPlayersBySearch(players: UniquePlayerRow[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return players;
  return players.filter(
    (p) => p.name.toLowerCase().includes(q) || p.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')),
  );
}

export async function updatePlayerProfilePhoto(
  tournamentId: string,
  player: UniquePlayerRow,
  profilePhotoUrl: string,
) {
  await Promise.all(
    player.registrationRefs.map(({ id, role }) => {
      const fields: Record<string, unknown> = {
        updatedAt: new Date(),
        ...(role === 'primary' ? { profilePhotoUrl } : { partnerProfilePhotoUrl: profilePhotoUrl }),
      };
      return updateDoc(doc(db, 'tournaments', tournamentId, 'registrations', id), fields);
    }),
  );

  const category = player.categories[0];
  if (!category) return;

  await Promise.all(
    player.registrationRefs.map(async ({ id, role }) => {
      const existingSnap = await getDoc(doc(db, 'tournaments', tournamentId, 'publicPlayers', id));
      const existing = existingSnap.data() ?? {};
      if (role === 'primary') {
        await upsertPublicPlayer(db, tournamentId, id, {
          name: (existing.name as string) || player.name,
          partnerName: existing.partnerName as string | undefined,
          profilePhotoUrl,
          partnerProfilePhotoUrl: existing.partnerProfilePhotoUrl as string | undefined,
          selectedCategory: (existing.selectedCategory as CategoryType) || category,
        });
      } else {
        await upsertPublicPlayer(db, tournamentId, id, {
          name: (existing.name as string) || player.name,
          partnerName: player.name,
          profilePhotoUrl: existing.profilePhotoUrl as string | undefined,
          partnerProfilePhotoUrl: profilePhotoUrl,
          selectedCategory: (existing.selectedCategory as CategoryType) || category,
        });
      }
    }),
  );
}

export async function updatePlayerTshirtTaken(
  tournamentId: string,
  player: UniquePlayerRow,
  taken: boolean,
) {
  await Promise.all(
    player.registrationRefs.map(({ id, role }) => {
      const fields: Record<string, unknown> = {
        updatedAt: new Date(),
        ...(role === 'primary' ? { tshirtTaken: taken } : { partnerTshirtTaken: taken }),
      };
      return updateDoc(doc(db, 'tournaments', tournamentId, 'registrations', id), fields);
    }),
  );
}
