import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  type DocumentReference,
  type Query,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function tournamentMatchesRef(tournamentId: string) {
  return collection(db, 'tournaments', tournamentId, 'matches');
}

export function tournamentMatchRef(tournamentId: string, matchId: string) {
  return doc(db, 'tournaments', tournamentId, 'matches', matchId);
}

export function tournamentLiveScoresRef(tournamentId: string) {
  return collection(db, 'tournaments', tournamentId, 'liveScores');
}

export function tournamentLiveScoreRef(tournamentId: string, matchId: string) {
  return doc(db, 'tournaments', tournamentId, 'liveScores', matchId);
}

/** All matches across tournaments, ordered by scheduled time (collection group). */
export function allMatchesOrderedQuery(): Query {
  return query(collectionGroup(db, 'matches'), orderBy('scheduledTime', 'asc'));
}

/** Matches for one tournament, ordered by scheduled time. */
export function tournamentMatchesOrderedQuery(tournamentId: string): Query {
  return query(tournamentMatchesRef(tournamentId), orderBy('scheduledTime', 'asc'));
}

export type ResolvedMatchDoc = {
  ref: DocumentReference;
  tournamentId: string;
  data: Record<string, unknown>;
};

export function adminMatchScorePath(matchId: string, _tournamentId?: string | null) {
  return `/admin/matches/${matchId}/score`;
}

/** Admin match detail page (team tie or individual match). */
export function adminTournamentMatchPath(tournamentId: string, matchId: string) {
  return `/admin/tournaments/${tournamentId}/matches/${matchId}`;
}

/**
 * Resolve a match document. Uses a direct path when tournamentId is known;
 * otherwise scans the matches collection group (for legacy URLs with match id only).
 */
export async function findMatchById(
  matchId: string,
  tournamentId?: string | null
): Promise<ResolvedMatchDoc | null> {
  if (tournamentId) {
    const ref = tournamentMatchRef(tournamentId, matchId);
    const snap = await getDoc(ref);
    if (snap.exists()) return { ref, tournamentId, data: snap.data() };
  } else {
    const groupSnap = await getDocs(query(collectionGroup(db, 'matches')));
    const found = groupSnap.docs.find((d) => d.id === matchId);
    if (found) {
      const tid = found.ref.parent.parent?.id;
      if (tid) return { ref: found.ref, tournamentId: tid, data: found.data() };
    }
  }

  // Legacy top-level fallback
  const legacyRef = doc(db, 'matches', matchId);
  const legacySnap = await getDoc(legacyRef);
  if (!legacySnap.exists()) return null;

  const legacyTournamentId = legacySnap.data().tournamentId as string | undefined;
  if (!legacyTournamentId) return null;

  return {
    ref: legacyRef,
    tournamentId: legacyTournamentId,
    data: legacySnap.data(),
  };
}
