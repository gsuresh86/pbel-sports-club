import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { tournamentMatchesOrderedQuery, tournamentMatchesRef } from '@/lib/firestore-paths';
import type { Tournament, Registration, Match, Team, Pool } from '@/types';

export function toTournament(data: Record<string, unknown>, id: string): Tournament {
  const toDate = (v: unknown) =>
    v != null && typeof (v as { toDate?: () => Date }).toDate === 'function'
      ? (v as { toDate: () => Date }).toDate()
      : undefined;
  return {
    id,
    ...data,
    startDate: toDate(data.startDate),
    endDate: toDate(data.endDate),
    registrationDeadline: toDate(data.registrationDeadline),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  } as Tournament;
}

function toRegistration(docSnap: { id: string; data: () => Record<string, unknown> }): Registration {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    ...d,
    registeredAt: (d.registeredAt as { toDate?: () => Date })?.toDate?.(),
    approvedAt: (d.approvedAt as { toDate?: () => Date })?.toDate?.(),
    paymentVerifiedAt: (d.paymentVerifiedAt as { toDate?: () => Date })?.toDate?.(),
  } as Registration;
}

function toMatch(docSnap: { id: string; data: () => Record<string, unknown> }): Match {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    ...d,
    scheduledTime: (d.scheduledTime as { toDate?: () => Date })?.toDate?.(),
    actualStartTime: (d.actualStartTime as { toDate?: () => Date })?.toDate?.(),
    actualEndTime: (d.actualEndTime as { toDate?: () => Date })?.toDate?.(),
    updatedAt: (d.updatedAt as { toDate?: () => Date })?.toDate?.(),
  } as Match;
}

function toTeam(docSnap: { id: string; data: () => Record<string, unknown> }): Team {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    ...d,
    createdAt: (d.createdAt as { toDate?: () => Date })?.toDate?.(),
    updatedAt: (d.updatedAt as { toDate?: () => Date })?.toDate?.(),
  } as Team;
}

function toPool(docSnap: { id: string; data: () => Record<string, unknown> }): Pool {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    ...d,
    createdAt: (d.createdAt as { toDate?: () => Date })?.toDate?.(),
    updatedAt: (d.updatedAt as { toDate?: () => Date })?.toDate?.(),
  } as Pool;
}

export async function fetchTournament(tournamentId: string): Promise<Tournament | null> {
  const snap = await getDoc(doc(db, 'tournaments', tournamentId));
  if (!snap.exists()) return null;
  return toTournament(snap.data(), snap.id);
}

export async function fetchTournaments(assignedIds?: string[]): Promise<Tournament[]> {
  const snap = await getDocs(query(collection(db, 'tournaments'), orderBy('createdAt', 'desc')));
  const all = snap.docs.map(d => toTournament(d.data() as Record<string, unknown>, d.id));
  if (assignedIds) return all.filter(t => assignedIds.includes(t.id));
  return all;
}

export async function fetchTournamentRegistrations(
  tournamentId: string
): Promise<Registration[]> {
  const snap = await getDocs(
    collection(db, 'tournaments', tournamentId, 'registrations')
  );
  return snap.docs.map((d) =>
    toRegistration({ id: d.id, data: () => d.data() })
  );
}

export async function fetchTournamentMatches(tournamentId: string): Promise<Match[]> {
  const mapDocs = (docs: { id: string; data: () => Record<string, unknown> }[]) =>
    docs.map((d) => {
      const match = toMatch({ id: d.id, data: () => d.data() });
      if (!match.tournamentId) match.tournamentId = tournamentId;
      return match;
    });

  try {
    const snap = await getDocs(tournamentMatchesOrderedQuery(tournamentId));
    if (snap.docs.length > 0) return mapDocs(snap.docs);
  } catch (error) {
    console.warn('Ordered tournament matches query failed, retrying without orderBy:', error);
  }

  try {
    const snap = await getDocs(tournamentMatchesRef(tournamentId));
    if (snap.docs.length > 0) {
      return mapDocs(snap.docs).sort(
        (a, b) => (a.scheduledTime?.getTime() ?? 0) - (b.scheduledTime?.getTime() ?? 0)
      );
    }
  } catch (error) {
    console.warn('Tournament matches subcollection read failed, trying legacy collection:', error);
  }

  // Legacy fallback while old top-level docs still exist
  const legacySnap = await getDocs(
    query(collection(db, 'matches'), where('tournamentId', '==', tournamentId))
  );
  return mapDocs(legacySnap.docs).sort(
    (a, b) => (a.scheduledTime?.getTime() ?? 0) - (b.scheduledTime?.getTime() ?? 0)
  );
}

export async function fetchTournamentTeams(tournamentId: string): Promise<Team[]> {
  const snap = await getDocs(
    query(
      collection(db, 'tournaments', tournamentId, 'teams'),
      orderBy('createdAt', 'desc')
    )
  );
  return snap.docs.map((d) => toTeam({ id: d.id, data: () => d.data() }));
}

export async function fetchTournamentPools(tournamentId: string): Promise<Pool[]> {
  const snap = await getDocs(
    query(
      collection(db, 'tournaments', tournamentId, 'pools'),
      orderBy('createdAt', 'desc')
    )
  );
  return snap.docs.map((d) => toPool({ id: d.id, data: () => d.data() }));
}

export type TournamentUpdatePayload = Partial<
  Pick<
    Tournament,
    | 'name'
    | 'sport'
    | 'tournamentType'
    | 'categories'
    | 'startDate'
    | 'endDate'
    | 'venue'
    | 'description'
    | 'registrationDeadline'
    | 'maxParticipants'
    | 'entryFee'
    | 'prizePool'
    | 'rules'
    | 'status'
    | 'registrationOpen'
    | 'banner'
    | 'isPublic'
    | 'matchFormat'
    | 'showTowerAndFlat'
    | 'showEmergencyContact'
    | 'showIsResident'
    | 'contacts'
    | 'paymentQrCode'
    | 'whatsappGroupLink'
    | 'doublesFee'
    | 'repeatFee'
    | 'paymentAccounts'
    | 'showTshirtSize'
    | 'showVolunteerNomination'
  >
> & { updatedAt: Date };

export async function updateTournament(
  tournamentId: string,
  data: TournamentUpdatePayload
): Promise<void> {
  const payload = data as Record<string, unknown>;
  const user = auth.currentUser;

  // Prefer admin API so staff tournament-admins (role: staff + tournamentRoles)
  // can update even when client Firestore rules only recognize legacy roles.
  if (user) {
    const token = await user.getIdToken();
    const res = await fetch(`/api/tournaments/${tournamentId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) return;

    // Fall through to client write when admin SDK is not configured.
    if (res.status !== 503) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        typeof err?.error === 'string' ? err.error : 'Failed to update tournament'
      );
    }
  }

  await updateDoc(doc(db, 'tournaments', tournamentId), payload);
}

export { cloneTournament, deleteTournament } from '@/lib/tournament-operations';
