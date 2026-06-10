import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { addDoc, collection, doc, setDoc, Firestore, getDocs, query, where } from 'firebase/firestore';
import type { TournamentContact } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate a public registration link for a tournament
 * Uses environment variable for base URL, falls back to current origin
 */
export function generateRegistrationLink(tournamentId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                 (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  return `${baseUrl}/tournament/${tournamentId}/register`;
}

/**
 * Generate a public tournament view link
 */
export function generateTournamentLink(tournamentId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                 (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  return `${baseUrl}/tournament/${tournamentId}`;
}

/** Parse "name||number" from registration Pay To selection */
export function parsePaymentRecipient(selectedPaymentAccount?: string | null): { name: string; number: string } | null {
  if (!selectedPaymentAccount?.trim()) return null;
  const [namePart, numberPart] = selectedPaymentAccount.split('||');
  const name = namePart?.trim() ?? '';
  const number = numberPart?.trim() ?? '';
  if (!name && !number) return null;
  return { name, number };
}

const MAX_TOURNAMENT_CONTACTS = 2;

/** Read POC list from tournament (supports legacy single contact fields). */
export function getTournamentContacts(tournament: {
  contacts?: TournamentContact[];
  contactName?: string;
  contactPhone?: string;
}): TournamentContact[] {
  if (tournament.contacts?.length) {
    return tournament.contacts
      .slice(0, MAX_TOURNAMENT_CONTACTS)
      .map((c) => ({ name: c.name?.trim() ?? '', phone: c.phone?.trim() ?? '' }))
      .filter((c) => c.name || c.phone);
  }
  if (tournament.contactName?.trim() || tournament.contactPhone?.trim()) {
    return [
      {
        name: tournament.contactName?.trim() ?? '',
        phone: tournament.contactPhone?.trim() ?? '',
      },
    ];
  }
  return [];
}

export function normalizeTournamentContactsForForm(
  contacts: TournamentContact[] | undefined
): TournamentContact[] {
  const filled = contacts ?? [];
  return [
    filled[0] ?? { name: '', phone: '' },
    filled[1] ?? { name: '', phone: '' },
  ];
}

export function buildTournamentContactsPayload(
  contacts: TournamentContact[]
): TournamentContact[] | null {
  const saved = contacts
    .slice(0, MAX_TOURNAMENT_CONTACTS)
    .map((c) => ({ name: c.name.trim(), phone: c.phone.trim() }))
    .filter((c) => c.name || c.phone);
  return saved.length > 0 ? saved : null;
}

export function contactPhoneTelHref(phone: string): string {
  return `tel:${phone.trim().replace(/[^\d+]/g, '')}`;
}

/** Format "name||number" from registration Pay To selection */
export function formatPaymentRecipient(selectedPaymentAccount?: string | null): string | null {
  const parsed = parsePaymentRecipient(selectedPaymentAccount);
  if (!parsed) return null;
  if (parsed.name && parsed.number) return `${parsed.name} — ${parsed.number}`;
  return parsed.name || parsed.number || null;
}

/** Two-letter initials from a name (first + last word, or first two letters). */
export function getInitials(name?: string | null): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** First word of a full name. */
export function firstName(full?: string | null): string {
  return (full ?? '').trim().split(/\s+/)[0] ?? '';
}

export interface MatchSideDisplay {
  /** Combined label — "Asha & Ravi" for doubles, full name for singles/teams. */
  label: string;
  /** Individual full names (1 for singles/teams, 2 for doubles). */
  names: string[];
  /** Avatar URLs aligned with `names` (entries may be undefined). */
  avatars: (string | undefined)[];
}

type RegistrationLike = {
  name?: string;
  partnerName?: string | null;
  profilePhotoUrl?: string | null;
  partnerProfilePhotoUrl?: string | null;
};

/**
 * Display info for one side of a match. When the referenced registration is a
 * doubles entry (has a partner), shows both players' first names and exposes
 * both avatars. Falls back to the name stored on the match (e.g. team matches
 * or registrations that are no longer loaded).
 */
export function getMatchSideDisplay(
  playerId: string,
  fallbackName: string,
  regById: Map<string, RegistrationLike>,
  teamsById?: Map<string, { logoUrl?: string; name?: string }>,
): MatchSideDisplay {
  const reg = regById.get(playerId);
  if (!reg) {
    const team = teamsById?.get(playerId);
    return {
      label: team?.name ?? fallbackName,
      names: [team?.name ?? fallbackName],
      avatars: [team?.logoUrl ?? undefined],
    };
  }

  const hasPartner = !!reg.partnerName && reg.partnerName.trim() !== '';
  if (hasPartner) {
    return {
      label: `${firstName(reg.name)} & ${firstName(reg.partnerName)}`,
      names: [reg.name ?? fallbackName, reg.partnerName ?? ''],
      avatars: [reg.profilePhotoUrl ?? undefined, reg.partnerProfilePhotoUrl ?? undefined],
    };
  }
  return {
    label: reg.name ?? fallbackName,
    names: [reg.name ?? fallbackName],
    avatars: [reg.profilePhotoUrl ?? undefined],
  };
}

/** Fields needed to render one side of a match (singles, doubles pair, or team rubber). */
export type MatchSideNameContext = {
  player1Id: string;
  player1Name: string;
  player1PartnerName?: string | null;
  player2Id: string;
  player2Name: string;
  player2PartnerName?: string | null;
};

/** Combined display label for one side — uses explicit partner fields or registration lookup. */
export function formatMatchSideLabel(
  ctx: MatchSideNameContext,
  side: 1 | 2,
  regById?: Map<string, RegistrationLike>,
): string {
  const name = side === 1 ? ctx.player1Name : ctx.player2Name;
  const partnerName = side === 1 ? ctx.player1PartnerName : ctx.player2PartnerName;
  if (partnerName?.trim()) {
    return `${firstName(name)} & ${firstName(partnerName)}`;
  }
  if (regById) {
    const id = side === 1 ? ctx.player1Id : ctx.player2Id;
    return getMatchSideDisplay(id, name, regById).label;
  }
  return name;
}

/** Labels for live scoreboard / liveScores documents (includes doubles partners). */
export function getMatchLiveDisplayNames(
  ctx: MatchSideNameContext,
  regById?: Map<string, RegistrationLike>,
): { player1Name: string; player2Name: string } {
  return {
    player1Name: formatMatchSideLabel(ctx, 1, regById),
    player2Name: formatMatchSideLabel(ctx, 2, regById),
  };
}

/** Normalize name for participant identity (name + phone). */
export function normalizeParticipantName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Normalize phone for participant identity (ignores spaces and dashes). */
export function normalizeParticipantPhone(phone: string): string {
  return phone.replace(/[\s\-]/g, '').trim();
}

/** Keep the first entry for each unique (normalized name + phone), preserving order. */
export function dedupeByNamePhone<T extends { name: string; phone: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = `${normalizeParticipantName(item.name)}|${normalizeParticipantPhone(item.phone)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

export type RegistrationParticipantFields = {
  name?: string;
  phone?: string;
  partnerName?: string | null;
  partnerPhone?: string | null;
  profilePhotoUrl?: string | null;
  partnerProfilePhotoUrl?: string | null;
  registrationStatus?: 'pending' | 'approved' | 'rejected';
};

/** Rejected registrations do not count toward category limits or repeat fees. */
export function registrationCountsTowardLimit(
  data: RegistrationParticipantFields
): boolean {
  return data.registrationStatus !== 'rejected';
}

/** True when the person appears as primary or partner on a registration. */
export function registrationIncludesParticipant(
  data: RegistrationParticipantFields,
  name: string,
  phone: string
): boolean {
  const normalizedName = normalizeParticipantName(name);
  const normalizedPhone = normalizeParticipantPhone(phone);
  if (!normalizedName || !normalizedPhone) return false;

  const asPrimary =
    normalizeParticipantName(data.name || '') === normalizedName &&
    normalizeParticipantPhone(data.phone || '') === normalizedPhone;
  const asPartner =
    normalizeParticipantName(data.partnerName || '') === normalizedName &&
    normalizeParticipantPhone(data.partnerPhone || '') === normalizedPhone;
  return asPrimary || asPartner;
}

/**
 * Count prior registrations for a participant (name + phone) in a tournament.
 * Includes categories where they registered as primary or as a doubles partner.
 * Rejected registrations are excluded so the person can register again.
 */
export async function getParticipantRegistrationStats(
  db: Firestore,
  tournamentId: string,
  name: string,
  phone: string
): Promise<{ count: number; profilePhotoUrl: string | null }> {
  if (!tournamentId || !name.trim() || !phone.trim()) {
    return { count: 0, profilePhotoUrl: null };
  }

  const phoneTrim = phone.trim();
  const regRef = collection(db, 'tournaments', tournamentId, 'registrations');
  const docMap = new Map<string, RegistrationParticipantFields>();

  const [primarySnap, partnerSnap] = await Promise.all([
    getDocs(query(regRef, where('phone', '==', phoneTrim))),
    getDocs(query(regRef, where('partnerPhone', '==', phoneTrim))),
  ]);

  primarySnap.docs.forEach((d) => docMap.set(d.id, d.data() as RegistrationParticipantFields));
  partnerSnap.docs.forEach((d) => docMap.set(d.id, d.data() as RegistrationParticipantFields));

  const allMatching = Array.from(docMap.values()).filter((data) =>
    registrationIncludesParticipant(data, name, phone)
  );
  const matchingForLimit = allMatching.filter(registrationCountsTowardLimit);

  let profilePhotoUrl: string | null = null;
  for (const data of allMatching) {
    const normalizedName = normalizeParticipantName(name);
    const normalizedPhone = normalizeParticipantPhone(phone);
    const isPrimary =
      normalizeParticipantName(data.name || '') === normalizedName &&
      normalizeParticipantPhone(data.phone || '') === normalizedPhone;
    const url = isPrimary ? data.profilePhotoUrl : data.partnerProfilePhotoUrl;
    if (url) {
      profilePhotoUrl = url;
      break;
    }
  }

  return { count: matchingForLimit.length, profilePhotoUrl };
}

const DOUBLES_CATEGORIES_FOR_FEE = [
  'mens-doubles',
  'womens-doubles',
  'mixed-doubles',
  'family-doubles',
] as const;

export function isDoublesCategoryForFee(category: string): boolean {
  return (DOUBLES_CATEGORIES_FOR_FEE as readonly string[]).includes(category);
}

/** Compute payment amount from prior registration counts and tournament fees. */
export function calculateRegistrationPaymentAmount(
  tournament: {
    entryFee?: number;
    doublesFee?: number;
    repeatFee?: number;
  },
  category: string,
  primaryRegistrationCount: number,
  partnerRegistrationCount: number
): number {
  const doublesFee = tournament.doublesFee ?? 700;
  const repeatFee = tournament.repeatFee ?? 300;

  if (isDoublesCategoryForFee(category)) {
    const primaryFee = primaryRegistrationCount > 0 ? repeatFee : doublesFee;
    const partnerFee = partnerRegistrationCount > 0 ? repeatFee : doublesFee;
    return primaryFee + partnerFee;
  }

  if (primaryRegistrationCount > 0) return repeatFee;
  return tournament.entryFee || 0;
}

/**
 * Clean data for Firebase by removing undefined values and converting empty strings to null
 */
function cleanFirebaseData(data: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      // Convert empty strings to null for optional fields
      if (typeof value === 'string' && value.trim() === '') {
        cleaned[key] = null;
      } else {
        cleaned[key] = value;
      }
    }
  }
  return cleaned;
}

/**
 * Create players from a registration
 * Handles both single and doubles registrations
 */
export async function createPlayersFromRegistration(
  registration: Record<string, unknown>,
  tournamentId: string,
  registrationId: string,
  db: Firestore
): Promise<string[]> {
  console.log('createPlayersFromRegistration called with:', { tournamentId, registrationId, registration });
  const playerIds: string[] = [];
  
  // Create primary player - filter out undefined values
  const primaryPlayerData = cleanFirebaseData({
    tournamentId,
    registrationId,
    name: registration.name,
    email: registration.email,
    phone: registration.phone,
    age: registration.age,
    gender: registration.gender,
    tower: registration.tower,
    flatNumber: registration.flatNumber,
    emergencyContact: registration.emergencyContact,
    expertiseLevel: registration.expertiseLevel,
    previousExperience: registration.previousExperience,
    isResident: registration.isResident,
    selectedCategory: registration.selectedCategory,
    profilePhotoUrl: registration.profilePhotoUrl,
    status: 'active' as const,
    paymentStatus: registration.paymentStatus,
    paymentReference: registration.paymentReference,
    paymentAmount: registration.paymentAmount,
    paymentMethod: registration.paymentMethod,
    paymentVerifiedAt: registration.paymentVerifiedAt,
    paymentVerifiedBy: registration.paymentVerifiedBy,
    createdAt: new Date(),
  });

  console.log('Creating primary player with data:', primaryPlayerData);

  // Use client-side Firebase SDK
  const { addDoc, collection, updateDoc, doc } = await import('firebase/firestore');
  const primaryPlayerRef = await addDoc(collection(db, 'tournaments', tournamentId, 'players'), primaryPlayerData);
  console.log('Primary player created with ID:', primaryPlayerRef.id);
  playerIds.push(primaryPlayerRef.id);

  // Create partner player if it's a doubles registration
  if (registration.partnerName && typeof registration.partnerName === 'string' && registration.partnerName.trim() !== '') {
    console.log('Creating partner player for doubles registration');
    const partnerPlayerData = cleanFirebaseData({
      tournamentId,
      registrationId,
      name: registration.partnerName,
      email: registration.partnerEmail,
      phone: registration.partnerPhone,
      age: registration.age, // Assuming same age for partner, could be updated
      gender: registration.gender, // Assuming same gender for partner, could be updated
      tower: registration.partnerTower,
      flatNumber: registration.partnerFlatNumber,
      emergencyContact: registration.emergencyContact,
      expertiseLevel: registration.expertiseLevel,
      previousExperience: registration.previousExperience,
      isResident: registration.isResident,
      selectedCategory: registration.selectedCategory,
      profilePhotoUrl: registration.partnerProfilePhotoUrl,
      status: 'active' as const,
      partnerId: primaryPlayerRef.id,
      partnerName: registration.name,
      paymentStatus: registration.paymentStatus,
      paymentReference: registration.paymentReference,
      paymentAmount: registration.paymentAmount,
      paymentMethod: registration.paymentMethod,
      paymentVerifiedAt: registration.paymentVerifiedAt,
      paymentVerifiedBy: registration.paymentVerifiedBy,
      createdAt: new Date(),
    });

    console.log('Creating partner player with data:', partnerPlayerData);
    const partnerPlayerRef = await addDoc(collection(db, 'tournaments', tournamentId, 'players'), partnerPlayerData);
    console.log('Partner player created with ID:', partnerPlayerRef.id);
    playerIds.push(partnerPlayerRef.id);

    // Update primary player with partner reference
    console.log('Updating primary player with partner reference');
    await updateDoc(doc(db, 'tournaments', tournamentId, 'players', primaryPlayerRef.id), {
      partnerId: partnerPlayerRef.id,
      partnerName: registration.partnerName,
    });
  }

  console.log('Player creation completed. Player IDs:', playerIds);
  return playerIds;
}

// Settings interfaces
export interface Sport {
  value: string;
  label: string;
  icon: string;
  isActive: boolean;
  order: number;
}

export interface Category {
  value: string;
  label: string;
  description?: string;
  sportValue?: string;
  isActive: boolean;
  order: number;
}

export interface AppSettings {
  sports: Sport[];
  categories: Category[];
  defaultVenue?: string;
  defaultRegistrationDaysBefore?: number;
  updatedAt: Date;
  updatedBy: string;
}

// Load settings from Firestore
export async function loadAppSettings(db: Firestore): Promise<AppSettings | null> {
  try {
    const { getDocs, collection } = await import('firebase/firestore');
    const settingsSnapshot = await getDocs(collection(db, 'appSettings'));
    if (!settingsSnapshot.empty) {
      const data = settingsSnapshot.docs[0].data();
      return {
        ...data,
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as AppSettings;
    }
    return null;
  } catch (error) {
    console.error('Error loading app settings:', error);
    return null;
  }
}

// Get active sports
export function getActiveSports(settings: AppSettings | null): Sport[] {
  if (!settings) return [];
  return settings.sports.filter(s => s.isActive).sort((a, b) => a.order - b.order);
}

// Get active categories (optionally filtered by sport)
export function getActiveCategories(settings: AppSettings | null, sportValue?: string): Category[] {
  if (!settings) return [];
  return settings.categories
    .filter(c => c.isActive && (!c.sportValue || c.sportValue === sportValue || !sportValue))
    .sort((a, b) => a.order - b.order);
}
