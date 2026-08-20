import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { CategoryType, Registration } from '@/types';
import { normalizeCategorySlug } from '@/lib/categoryLabels';
import { upsertPublicPlayer } from '@/lib/public-players';

export type UniquePlayerRow = {
  name: string;
  phone: string;
  email: string;
  age: string;
  dateOfBirth: string;
  gender: string;
  tower: string;
  flatNumber: string;
  emergencyContact: string;
  tshirtSize: string;
  tshirtTaken: boolean;
  expertiseLevel: string;
  previousExperience: string;
  isResident: boolean;
  profilePhotoUrl: string;
  categories: CategoryType[];
  hasPrimaryRole: boolean;
  registrationRefs: Array<{ id: string; role: 'primary' | 'partner' }>;
};

export type PlayerEditValues = {
  name: string;
  phone: string;
  email: string;
  age: string;
  dateOfBirth: string;
  gender: string;
  tower: string;
  flatNumber: string;
  emergencyContact: string;
  tshirtSize: string;
  tshirtTaken: boolean;
  expertiseLevel: string;
  previousExperience: string;
  isResident: boolean;
  profilePhotoUrl: string;
};

function emptyPlayerRow(name: string): UniquePlayerRow {
  return {
    name,
    phone: '',
    email: '',
    age: '',
    dateOfBirth: '',
    gender: '',
    tower: '',
    flatNumber: '',
    emergencyContact: '',
    tshirtSize: '',
    tshirtTaken: false,
    expertiseLevel: '',
    previousExperience: '',
    isResident: false,
    profilePhotoUrl: '',
    categories: [],
    hasPrimaryRole: false,
    registrationRefs: [],
  };
}

function takeFirst(existing: string, next: string | undefined) {
  if (existing.trim()) return existing;
  return next?.trim() ?? '';
}

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

export function playerEditValuesFromRow(player: UniquePlayerRow): PlayerEditValues {
  return {
    name: player.name,
    phone: player.phone,
    email: player.email,
    age: player.age,
    dateOfBirth: player.dateOfBirth,
    gender: player.gender,
    tower: player.tower,
    flatNumber: player.flatNumber,
    emergencyContact: player.emergencyContact,
    tshirtSize: player.tshirtSize,
    tshirtTaken: player.tshirtTaken,
    expertiseLevel: player.expertiseLevel,
    previousExperience: player.previousExperience,
    isResident: player.isResident,
    profilePhotoUrl: player.profilePhotoUrl,
  };
}

export function registrationFieldsForPlayerEdit(
  role: 'primary' | 'partner',
  values: PlayerEditValues,
): Record<string, unknown> {
  const opt = (value: string) => value.trim();
  const ageNum = values.age.trim() === '' ? undefined : Number(values.age);
  const validAge = ageNum !== undefined && !Number.isNaN(ageNum) ? ageNum : undefined;

  if (role === 'primary') {
    return {
      name: opt(values.name),
      phone: opt(values.phone),
      email: opt(values.email),
      ...(validAge !== undefined ? { age: validAge } : {}),
      dateOfBirth: opt(values.dateOfBirth) || undefined,
      gender: values.gender || undefined,
      tower: opt(values.tower) || undefined,
      flatNumber: opt(values.flatNumber) || undefined,
      emergencyContact: opt(values.emergencyContact) || undefined,
      tshirtSize: opt(values.tshirtSize) || undefined,
      tshirtTaken: values.tshirtTaken,
      expertiseLevel: values.expertiseLevel || undefined,
      previousExperience: opt(values.previousExperience) || undefined,
      isResident: values.isResident,
      profilePhotoUrl: opt(values.profilePhotoUrl) || undefined,
    };
  }

  return {
    partnerName: opt(values.name),
    partnerPhone: opt(values.phone) || undefined,
    partnerEmail: opt(values.email) || undefined,
    ...(validAge !== undefined ? { partnerAge: validAge } : {}),
    partnerDateOfBirth: opt(values.dateOfBirth) || undefined,
    partnerTower: opt(values.tower) || undefined,
    partnerFlatNumber: opt(values.flatNumber) || undefined,
    partnerTshirtSize: opt(values.tshirtSize) || undefined,
    partnerTshirtTaken: values.tshirtTaken,
    partnerProfilePhotoUrl: opt(values.profilePhotoUrl) || undefined,
  };
}

export function buildUniquePlayersFromRegistrations(participants: Registration[]): UniquePlayerRow[] {
  const map = new Map<string, UniquePlayerRow>();
  const upsert = (
    rawName: string,
    extras: {
      phone?: string;
      email?: string;
      age?: number;
      dateOfBirth?: string;
      gender?: string;
      tower?: string;
      flatNumber?: string;
      emergencyContact?: string;
      tshirtSize?: string;
      tshirtTaken?: boolean;
      expertiseLevel?: string;
      previousExperience?: string;
      isResident?: boolean;
      profilePhotoUrl?: string;
      isPrimary: boolean;
    },
    category: CategoryType,
    registrationRef: { id: string; role: 'primary' | 'partner' },
  ) => {
    const name = rawName.trim();
    if (!name) return;
    const key = normalizePlayerName(name);
    const existing = map.get(key) ?? emptyPlayerRow(name);
    existing.phone = takeFirst(existing.phone, extras.phone);
    existing.email = takeFirst(existing.email, extras.email);
    existing.age = takeFirst(existing.age, extras.age != null ? String(extras.age) : undefined);
    existing.dateOfBirth = takeFirst(existing.dateOfBirth, extras.dateOfBirth);
    existing.gender = takeFirst(existing.gender, extras.gender);
    existing.tower = takeFirst(existing.tower, extras.tower);
    existing.flatNumber = takeFirst(existing.flatNumber, extras.flatNumber);
    existing.emergencyContact = takeFirst(existing.emergencyContact, extras.emergencyContact);
    existing.tshirtSize = takeFirst(existing.tshirtSize, extras.tshirtSize);
    if (extras.tshirtTaken) existing.tshirtTaken = true;
    existing.expertiseLevel = takeFirst(existing.expertiseLevel, extras.expertiseLevel);
    existing.previousExperience = takeFirst(existing.previousExperience, extras.previousExperience);
    if (extras.isResident) existing.isResident = true;
    existing.profilePhotoUrl = takeFirst(existing.profilePhotoUrl, extras.profilePhotoUrl);
    if (extras.isPrimary) existing.hasPrimaryRole = true;
    const cat = (normalizeCategorySlug(category) ?? category) as CategoryType;
    if (!existing.categories.includes(cat)) existing.categories.push(cat);
    existing.registrationRefs.push(registrationRef);
    map.set(key, existing);
  };

  participants.forEach((p) => {
    if (p.registrationStatus === 'rejected') return;
    upsert(
      p.name,
      {
        phone: p.phone,
        email: p.email,
        age: p.age,
        dateOfBirth: p.dateOfBirth,
        gender: p.gender,
        tower: p.tower,
        flatNumber: p.flatNumber,
        emergencyContact: p.emergencyContact,
        tshirtSize: p.tshirtSize,
        tshirtTaken: p.tshirtTaken,
        expertiseLevel: p.expertiseLevel,
        previousExperience: p.previousExperience,
        isResident: p.isResident,
        profilePhotoUrl: p.profilePhotoUrl,
        isPrimary: true,
      },
      p.selectedCategory,
      { id: p.id, role: 'primary' },
    );
    if (p.partnerName?.trim()) {
      upsert(
        p.partnerName,
        {
          phone: p.partnerPhone,
          email: p.partnerEmail,
          age: p.partnerAge,
          dateOfBirth: p.partnerDateOfBirth,
          tower: p.partnerTower,
          flatNumber: p.partnerFlatNumber,
          tshirtSize: p.partnerTshirtSize,
          tshirtTaken: p.partnerTshirtTaken,
          profilePhotoUrl: p.partnerProfilePhotoUrl,
          isPrimary: false,
        },
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

function toFirestoreUpdate(source: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, value === undefined ? deleteField() : value]),
  );
}

export async function updatePlayerDetails(
  tournamentId: string,
  player: UniquePlayerRow,
  values: PlayerEditValues,
) {
  const name = values.name.trim();
  if (!name) {
    throw new Error('Name is required');
  }

  await Promise.all(
    player.registrationRefs.map(({ id, role }) => {
      const fields = toFirestoreUpdate({
        ...registrationFieldsForPlayerEdit(role, { ...values, name }),
        updatedAt: new Date(),
      });
      return updateDoc(doc(db, 'tournaments', tournamentId, 'registrations', id), fields);
    }),
  );

  const category = player.categories[0];
  if (category) {
    await Promise.all(
      player.registrationRefs.map(async ({ id, role }) => {
        const existingSnap = await getDoc(doc(db, 'tournaments', tournamentId, 'publicPlayers', id));
        const existing = existingSnap.data() ?? {};
        if (role === 'primary') {
          await upsertPublicPlayer(db, tournamentId, id, {
            name,
            partnerName: existing.partnerName as string | undefined,
            profilePhotoUrl: values.profilePhotoUrl || undefined,
            partnerProfilePhotoUrl: existing.partnerProfilePhotoUrl as string | undefined,
            selectedCategory: (existing.selectedCategory as CategoryType) || category,
          });
        } else {
          await upsertPublicPlayer(db, tournamentId, id, {
            name: (existing.name as string) || name,
            partnerName: name,
            profilePhotoUrl: existing.profilePhotoUrl as string | undefined,
            partnerProfilePhotoUrl: values.profilePhotoUrl || undefined,
            selectedCategory: (existing.selectedCategory as CategoryType) || category,
          });
        }
      }),
    );
  }

  const playerKeys = [
    'name',
    'email',
    'phone',
    'age',
    'gender',
    'tower',
    'flatNumber',
    'emergencyContact',
    'isResident',
    'expertiseLevel',
    'previousExperience',
  ] as const;
  const primaryFields = registrationFieldsForPlayerEdit('primary', { ...values, name });
  const playerUpdate = toFirestoreUpdate(
    Object.fromEntries(playerKeys.map((key) => [key, primaryFields[key]])),
  );
  playerUpdate.updatedAt = new Date();

  const uniqueRegistrationIds = [...new Set(player.registrationRefs.map((ref) => ref.id))];
  await Promise.all(
    uniqueRegistrationIds.map(async (registrationId) => {
      const snapshot = await getDocs(
        query(
          collection(db, 'tournaments', tournamentId, 'players'),
          where('registrationId', '==', registrationId),
        ),
      );
      await Promise.all(snapshot.docs.map((playerDoc) => updateDoc(playerDoc.ref, playerUpdate)));
    }),
  );
}
