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
import { db } from '@/lib/firebase';
import type { Tournament, Registration, Match, Team, Pool } from '@/types';

function toTournament(data: Record<string, unknown>, id: string): Tournament {
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
  const q = query(
    collection(db, 'matches'),
    where('tournamentId', '==', tournamentId),
    orderBy('scheduledTime', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => toMatch({ id: d.id, data: () => d.data() }));
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
  >
> & { updatedAt: Date };

export async function updateTournament(
  tournamentId: string,
  data: TournamentUpdatePayload
): Promise<void> {
  await updateDoc(doc(db, 'tournaments', tournamentId), data as Record<string, unknown>);
}
