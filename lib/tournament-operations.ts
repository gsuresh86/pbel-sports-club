import {
  addDoc,
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  tournamentLiveScoreRef,
  tournamentMatchRef,
  tournamentMatchesRef,
} from '@/lib/firestore-paths';
import type { TournamentBracket } from '@/types';

const BATCH_LIMIT = 450;

async function commitBatchedDeletes(refs: { path: string }[]): Promise<void> {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    const chunk = refs.slice(i, i + BATCH_LIMIT);
    for (const ref of chunk) {
      batch.delete(doc(db, ref.path));
    }
    await batch.commit();
  }
}

function remapId(
  id: string | undefined,
  maps: {
    reg: Map<string, string>;
    team: Map<string, string>;
    player: Map<string, string>;
  }
): string | undefined {
  if (!id) return id;
  return maps.team.get(id) ?? maps.reg.get(id) ?? maps.player.get(id) ?? id;
}

function stripFirestoreId<T extends Record<string, unknown>>(data: T): Record<string, unknown> {
  const { id: _id, ...rest } = data;
  return rest;
}

export async function cloneTournament(
  sourceTournamentId: string,
  createdBy: string,
  options?: { newName?: string }
): Promise<string> {
  const sourceSnap = await getDoc(doc(db, 'tournaments', sourceTournamentId));
  if (!sourceSnap.exists()) {
    throw new Error('Tournament not found');
  }

  const sourceData = sourceSnap.data();
  const now = new Date();

  const newTournamentRef = await addDoc(collection(db, 'tournaments'), {
    ...stripFirestoreId(sourceData),
    name: options?.newName ?? `${sourceData.name} (Copy)`,
    status: 'upcoming',
    registrationOpen: false,
    createdAt: now,
    updatedAt: now,
    createdBy,
  });
  const newTournamentId = newTournamentRef.id;

  const regIdMap = new Map<string, string>();
  const playerIdMap = new Map<string, string>();
  const teamIdMap = new Map<string, string>();
  const poolIdMap = new Map<string, string>();
  const matchIdMap = new Map<string, string>();

  const idMaps = { reg: regIdMap, team: teamIdMap, player: playerIdMap };

  // 1. Registrations
  const regSnap = await getDocs(
    collection(db, 'tournaments', sourceTournamentId, 'registrations')
  );
  for (const regDoc of regSnap.docs) {
    const newRegRef = await addDoc(
      collection(db, 'tournaments', newTournamentId, 'registrations'),
      {
        ...stripFirestoreId(regDoc.data() as Record<string, unknown>),
        tournamentId: newTournamentId,
      }
    );
    regIdMap.set(regDoc.id, newRegRef.id);
  }

  // 2. Players
  const playerSnap = await getDocs(
    collection(db, 'tournaments', sourceTournamentId, 'players')
  );
  const playersNeedingPartnerUpdate: { newId: string; partnerId: string }[] = [];

  for (const playerDoc of playerSnap.docs) {
    const data = playerDoc.data();
    const newPlayerRef = await addDoc(
      collection(db, 'tournaments', newTournamentId, 'players'),
      {
        ...stripFirestoreId(data as Record<string, unknown>),
        tournamentId: newTournamentId,
        registrationId: regIdMap.get(data.registrationId as string) ?? data.registrationId,
      }
    );
    playerIdMap.set(playerDoc.id, newPlayerRef.id);

    if (data.partnerId) {
      playersNeedingPartnerUpdate.push({
        newId: newPlayerRef.id,
        partnerId: data.partnerId as string,
      });
    }
  }

  for (const { newId, partnerId } of playersNeedingPartnerUpdate) {
    const remappedPartnerId = playerIdMap.get(partnerId);
    if (remappedPartnerId) {
      await updateDoc(doc(db, 'tournaments', newTournamentId, 'players', newId), {
        partnerId: remappedPartnerId,
      });
    }
  }

  // 3. Teams (poolId updated after pools are cloned)
  const teamSnap = await getDocs(collection(db, 'tournaments', sourceTournamentId, 'teams'));
  const teamsNeedingPoolUpdate: { newId: string; poolId: string }[] = [];

  for (const teamDoc of teamSnap.docs) {
    const data = teamDoc.data();
    const remappedPlayers = ((data.players as string[]) ?? []).map(
      (pid) => regIdMap.get(pid) ?? pid
    );
    const newTeamRef = await addDoc(collection(db, 'tournaments', newTournamentId, 'teams'), {
      ...stripFirestoreId(data as Record<string, unknown>),
      tournamentId: newTournamentId,
      players: remappedPlayers,
      captainId: data.captainId
        ? (regIdMap.get(data.captainId as string) ?? data.captainId)
        : data.captainId,
      poolId: null,
    });
    teamIdMap.set(teamDoc.id, newTeamRef.id);

    if (data.poolId) {
      teamsNeedingPoolUpdate.push({
        newId: newTeamRef.id,
        poolId: data.poolId as string,
      });
    }
  }

  // 4. Pools
  const poolSnap = await getDocs(collection(db, 'tournaments', sourceTournamentId, 'pools'));
  for (const poolDoc of poolSnap.docs) {
    const data = poolDoc.data();
    const remappedTeams = ((data.teams as string[]) ?? []).map(
      (tid) => remapId(tid, idMaps) ?? tid
    );
    const newPoolRef = await addDoc(collection(db, 'tournaments', newTournamentId, 'pools'), {
      ...stripFirestoreId(data as Record<string, unknown>),
      tournamentId: newTournamentId,
      teams: remappedTeams,
    });
    poolIdMap.set(poolDoc.id, newPoolRef.id);
  }

  for (const { newId, poolId } of teamsNeedingPoolUpdate) {
    const remappedPoolId = poolIdMap.get(poolId);
    if (remappedPoolId) {
      await updateDoc(doc(db, 'tournaments', newTournamentId, 'teams', newId), {
        poolId: remappedPoolId,
      });
    }
  }

  // 5. Matches (non-rubbers first, then rubbers)
  const matchSnap = await getDocs(collection(db, 'tournaments', sourceTournamentId, 'matches'));
  const allMatches = matchSnap.docs.map((d) => ({ id: d.id, data: d.data() }));
  const nonRubbers = allMatches.filter((m) => !m.data.parentMatchId);
  const rubbers = allMatches.filter((m) => m.data.parentMatchId);

  const cloneMatch = async (match: { id: string; data: Record<string, unknown> }) => {
    const data = match.data;
    const newMatchRef = await addDoc(tournamentMatchesRef(newTournamentId), {
      ...stripFirestoreId(data),
      tournamentId: newTournamentId,
      player1Id: regIdMap.get(data.player1Id as string) ?? data.player1Id,
      player2Id: regIdMap.get(data.player2Id as string) ?? data.player2Id,
      player1PartnerId: data.player1PartnerId
        ? (regIdMap.get(data.player1PartnerId as string) ?? data.player1PartnerId)
        : data.player1PartnerId,
      player2PartnerId: data.player2PartnerId
        ? (regIdMap.get(data.player2PartnerId as string) ?? data.player2PartnerId)
        : data.player2PartnerId,
      team1Id: data.team1Id
        ? (teamIdMap.get(data.team1Id as string) ?? data.team1Id)
        : data.team1Id,
      team2Id: data.team2Id
        ? (teamIdMap.get(data.team2Id as string) ?? data.team2Id)
        : data.team2Id,
      parentMatchId: data.parentMatchId
        ? (matchIdMap.get(data.parentMatchId as string) ?? data.parentMatchId)
        : data.parentMatchId,
    });
    matchIdMap.set(match.id, newMatchRef.id);
  };

  for (const match of nonRubbers) {
    await cloneMatch(match);
  }
  for (const match of rubbers) {
    await cloneMatch(match);
  }

  // 6. Live scores
  for (const [oldMatchId, newMatchId] of matchIdMap) {
    const liveScoreSnap = await getDoc(
      tournamentLiveScoreRef(sourceTournamentId, oldMatchId)
    );
    if (liveScoreSnap.exists()) {
      const liveData = liveScoreSnap.data();
      await setDoc(tournamentLiveScoreRef(newTournamentId, newMatchId), {
        ...stripFirestoreId(liveData as Record<string, unknown>),
        matchId: newMatchId,
        tournamentId: newTournamentId,
      });
    }
  }

  // 7. Brackets
  const bracketSnap = await getDocs(
    query(collection(db, 'brackets'), where('tournamentId', '==', sourceTournamentId))
  );
  for (const bracketDoc of bracketSnap.docs) {
    const data = bracketDoc.data() as TournamentBracket;
    const remappedParticipants = (data.participants ?? []).map((p) => ({
      ...p,
      id: regIdMap.get(p.id) ?? p.id,
    }));
    const remappedRounds = (data.rounds ?? []).map((round) => ({
      ...round,
      matches: (round.matches ?? []).map((m) => ({
        ...m,
        player1Id: m.player1Id ? (regIdMap.get(m.player1Id) ?? m.player1Id) : m.player1Id,
        player2Id: m.player2Id ? (regIdMap.get(m.player2Id) ?? m.player2Id) : m.player2Id,
        winnerId: m.winnerId ? (regIdMap.get(m.winnerId) ?? m.winnerId) : m.winnerId,
      })),
    }));

    await addDoc(collection(db, 'brackets'), {
      ...stripFirestoreId(data as unknown as Record<string, unknown>),
      tournamentId: newTournamentId,
      participants: remappedParticipants,
      rounds: remappedRounds,
    });
  }

  // 8. Winners
  const winnerSnap = await getDocs(
    query(collection(db, 'winners'), where('tournamentId', '==', sourceTournamentId))
  );
  for (const winnerDoc of winnerSnap.docs) {
    const data = winnerDoc.data();
    await addDoc(collection(db, 'winners'), {
      ...stripFirestoreId(data as Record<string, unknown>),
      tournamentId: newTournamentId,
      participantId: regIdMap.get(data.participantId as string) ?? data.participantId,
    });
  }

  // Recalculate currentParticipants from approved registrations
  const approvedCount = regSnap.docs.filter(
    (d) => d.data().registrationStatus === 'approved'
  ).length;
  await updateDoc(doc(db, 'tournaments', newTournamentId), {
    currentParticipants: approvedCount,
  });

  return newTournamentId;
}

export async function deleteTournament(tournamentId: string): Promise<void> {
  const matchSnap = await getDocs(collection(db, 'tournaments', tournamentId, 'matches'));
  const liveScoreSnap = await getDocs(
    collection(db, 'tournaments', tournamentId, 'liveScores')
  );

  const deleteRefs: { path: string }[] = [];

  for (const liveDoc of liveScoreSnap.docs) {
    deleteRefs.push({ path: `tournaments/${tournamentId}/liveScores/${liveDoc.id}` });
  }
  for (const matchDoc of matchSnap.docs) {
    deleteRefs.push({ path: `tournaments/${tournamentId}/matches/${matchDoc.id}` });
  }

  const bracketSnap = await getDocs(
    query(collection(db, 'brackets'), where('tournamentId', '==', tournamentId))
  );
  for (const bracketDoc of bracketSnap.docs) {
    deleteRefs.push({ path: `brackets/${bracketDoc.id}` });
  }

  const winnerSnap = await getDocs(
    query(collection(db, 'winners'), where('tournamentId', '==', tournamentId))
  );
  for (const winnerDoc of winnerSnap.docs) {
    deleteRefs.push({ path: `winners/${winnerDoc.id}` });
  }

  const subcollections = ['players', 'registrations', 'teams', 'pools'] as const;
  for (const sub of subcollections) {
    const snap = await getDocs(collection(db, 'tournaments', tournamentId, sub));
    for (const subDoc of snap.docs) {
      deleteRefs.push({ path: `tournaments/${tournamentId}/${sub}/${subDoc.id}` });
    }
  }

  await commitBatchedDeletes(deleteRefs);

  // Remove tournament from user assignments
  const usersSnap = await getDocs(
    query(collection(db, 'users'), where('assignedTournaments', 'array-contains', tournamentId))
  );
  await Promise.all(
    usersSnap.docs.map((userDoc) =>
      updateDoc(doc(db, 'users', userDoc.id), {
        assignedTournaments: arrayRemove(tournamentId),
        updatedAt: new Date(),
      })
    )
  );

  await deleteDoc(doc(db, 'tournaments', tournamentId));
}
