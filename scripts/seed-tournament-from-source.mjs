/**
 * Copy tournament subcollections from a source tournament into an existing target
 * tournament (with ID remapping). The source tournament is read-only and never modified.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-tournament-from-source.mjs <sourceId> <targetId> [--dry-run]
 *
 * Example:
 *   node --env-file=.env.local scripts/seed-tournament-from-source.mjs GfjjdBdKKmCkA8IVrdwK yuPajTMyUzDWAN7vkRmP
 */
import admin from 'firebase-admin';

const BATCH_LIMIT = 450;

function ensureAdmin() {
  if (admin.apps.length > 0) return;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin env vars in .env.local');
  }
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

function stripFirestoreId(data) {
  const { id: _id, ...rest } = data;
  return rest;
}

function cleanFirestoreData(data) {
  const cleaned = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    cleaned[key] = value;
  }
  return cleaned;
}

function remapId(id, maps) {
  if (!id) return id;
  return maps.team.get(id) ?? maps.reg.get(id) ?? maps.player.get(id) ?? id;
}

async function commitBatchedDeletes(db, docRefs) {
  for (let i = 0; i < docRefs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const ref of docRefs.slice(i, i + BATCH_LIMIT)) {
      batch.delete(ref);
    }
    await batch.commit();
  }
}

async function countSubcollections(db, tournamentId) {
  const subs = ['registrations', 'players', 'teams', 'pools', 'matches', 'liveScores', 'finances'];
  const counts = {};
  for (const sub of subs) {
    counts[sub] = (await db.collection('tournaments').doc(tournamentId).collection(sub).get()).size;
  }
  counts.brackets = (
    await db.collection('brackets').where('tournamentId', '==', tournamentId).get()
  ).size;
  counts.winners = (
    await db.collection('winners').where('tournamentId', '==', tournamentId).get()
  ).size;
  return counts;
}

async function clearTargetData(db, targetId, dryRun) {
  console.log(`\nClearing existing data on target tournament ${targetId}...`);
  const deleteRefs = [];

  const subs = ['liveScores', 'matches', 'pools', 'teams', 'players', 'registrations', 'finances'];
  for (const sub of subs) {
    const snap = await db.collection('tournaments').doc(targetId).collection(sub).get();
    for (const docSnap of snap.docs) {
      deleteRefs.push(docSnap.ref);
    }
  }

  const bracketSnap = await db.collection('brackets').where('tournamentId', '==', targetId).get();
  for (const docSnap of bracketSnap.docs) {
    deleteRefs.push(docSnap.ref);
  }

  const winnerSnap = await db.collection('winners').where('tournamentId', '==', targetId).get();
  for (const docSnap of winnerSnap.docs) {
    deleteRefs.push(docSnap.ref);
  }

  console.log(`  ${deleteRefs.length} document(s) to delete`);
  if (!dryRun && deleteRefs.length > 0) {
    await commitBatchedDeletes(db, deleteRefs);
  }
}

const TOURNAMENT_CONFIG_KEYS = [
  'sport',
  'tournamentType',
  'categories',
  'startDate',
  'endDate',
  'venue',
  'description',
  'registrationDeadline',
  'maxParticipants',
  'entryFee',
  'prizePool',
  'rules',
  'status',
  'registrationOpen',
  'banner',
  'matchFormat',
  'showTowerAndFlat',
  'showEmergencyContact',
  'showIsResident',
  'showTshirtSize',
  'paymentQrCode',
  'whatsappGroupLink',
  'contacts',
  'contactName',
  'contactPhone',
  'showVolunteerNomination',
  'doublesFee',
  'repeatFee',
  'paymentAccounts',
  'categoryQualifyCounts',
];

async function copyTournamentData(db, sourceId, targetId, dryRun) {
  const sourceRef = db.collection('tournaments').doc(sourceId);
  const targetRef = db.collection('tournaments').doc(targetId);

  const [sourceSnap, targetSnap] = await Promise.all([sourceRef.get(), targetRef.get()]);
  if (!sourceSnap.exists) throw new Error(`Source tournament not found: ${sourceId}`);
  if (!targetSnap.exists) throw new Error(`Target tournament not found: ${targetId}`);

  const sourceData = sourceSnap.data();
  const targetData = targetSnap.data();
  console.log(`\nSource: ${sourceData.name} (${sourceId})`);
  console.log(`Target: ${targetData.name} (${targetId})`);

  await clearTargetData(db, targetId, dryRun);

  const regIdMap = new Map();
  const playerIdMap = new Map();
  const teamIdMap = new Map();
  const poolIdMap = new Map();
  const matchIdMap = new Map();
  const idMaps = { reg: regIdMap, team: teamIdMap, player: playerIdMap };

  // 1. Registrations
  const regSnap = await sourceRef.collection('registrations').get();
  console.log(`\nCopying ${regSnap.size} registration(s)...`);
  for (const regDoc of regSnap.docs) {
    const data = stripFirestoreId(regDoc.data());
    if (dryRun) {
      regIdMap.set(regDoc.id, `dry-reg-${regDoc.id}`);
      continue;
    }
    const newRef = await targetRef.collection('registrations').add(
      cleanFirestoreData({
        ...data,
        tournamentId: targetId,
      })
    );
    regIdMap.set(regDoc.id, newRef.id);
  }

  // 2. Players
  const playerSnap = await sourceRef.collection('players').get();
  console.log(`Copying ${playerSnap.size} player(s)...`);
  const playersNeedingPartnerUpdate = [];

  for (const playerDoc of playerSnap.docs) {
    const data = playerDoc.data();
    if (dryRun) {
      playerIdMap.set(playerDoc.id, `dry-player-${playerDoc.id}`);
      if (data.partnerId) {
        playersNeedingPartnerUpdate.push({
          newId: playerIdMap.get(playerDoc.id),
          partnerId: data.partnerId,
        });
      }
      continue;
    }
    const newRef = await targetRef.collection('players').add(
      cleanFirestoreData({
        ...stripFirestoreId(data),
        tournamentId: targetId,
        registrationId: regIdMap.get(data.registrationId) ?? data.registrationId,
      })
    );
    playerIdMap.set(playerDoc.id, newRef.id);
    if (data.partnerId) {
      playersNeedingPartnerUpdate.push({ newId: newRef.id, partnerId: data.partnerId });
    }
  }

  if (!dryRun) {
    for (const { newId, partnerId } of playersNeedingPartnerUpdate) {
      const remappedPartnerId = playerIdMap.get(partnerId);
      if (remappedPartnerId) {
        await targetRef.collection('players').doc(newId).update({ partnerId: remappedPartnerId });
      }
    }
  }

  // 3. Teams
  const teamSnap = await sourceRef.collection('teams').get();
  console.log(`Copying ${teamSnap.size} team(s)...`);
  const teamsNeedingPoolUpdate = [];

  for (const teamDoc of teamSnap.docs) {
    const data = teamDoc.data();
    const remappedPlayers = (data.players ?? []).map((pid) => regIdMap.get(pid) ?? pid);
    if (dryRun) {
      teamIdMap.set(teamDoc.id, `dry-team-${teamDoc.id}`);
      if (data.poolId) {
        teamsNeedingPoolUpdate.push({ newId: teamIdMap.get(teamDoc.id), poolId: data.poolId });
      }
      continue;
    }
    const newRef = await targetRef.collection('teams').add(
      cleanFirestoreData({
        ...stripFirestoreId(data),
        tournamentId: targetId,
        players: remappedPlayers,
        captainId: data.captainId ? (regIdMap.get(data.captainId) ?? data.captainId) : data.captainId,
        poolId: null,
      })
    );
    teamIdMap.set(teamDoc.id, newRef.id);
    if (data.poolId) {
      teamsNeedingPoolUpdate.push({ newId: newRef.id, poolId: data.poolId });
    }
  }

  // 4. Pools
  const poolSnap = await sourceRef.collection('pools').get();
  console.log(`Copying ${poolSnap.size} pool(s)...`);

  for (const poolDoc of poolSnap.docs) {
    const data = poolDoc.data();
    const remappedTeams = (data.teams ?? []).map((tid) => remapId(tid, idMaps) ?? tid);
    if (dryRun) {
      poolIdMap.set(poolDoc.id, `dry-pool-${poolDoc.id}`);
      continue;
    }
    const newRef = await targetRef.collection('pools').add(
      cleanFirestoreData({
        ...stripFirestoreId(data),
        tournamentId: targetId,
        teams: remappedTeams,
      })
    );
    poolIdMap.set(poolDoc.id, newRef.id);
  }

  if (!dryRun) {
    for (const { newId, poolId } of teamsNeedingPoolUpdate) {
      const remappedPoolId = poolIdMap.get(poolId);
      if (remappedPoolId) {
        await targetRef.collection('teams').doc(newId).update({ poolId: remappedPoolId });
      }
    }
  }

  // 5. Matches (non-rubbers first, then rubbers)
  const matchSnap = await sourceRef.collection('matches').get();
  const allMatches = matchSnap.docs.map((d) => ({ id: d.id, data: d.data() }));
  const nonRubbers = allMatches.filter((m) => !m.data.parentMatchId);
  const rubbers = allMatches.filter((m) => m.data.parentMatchId);
  console.log(`Copying ${allMatches.length} match(es) (${rubbers.length} rubbers)...`);

  const cloneMatch = async (match) => {
    const data = match.data;
    const payload = cleanFirestoreData({
      ...stripFirestoreId(data),
      tournamentId: targetId,
      player1Id: regIdMap.get(data.player1Id) ?? data.player1Id,
      player2Id: regIdMap.get(data.player2Id) ?? data.player2Id,
      player1PartnerId: data.player1PartnerId
        ? (regIdMap.get(data.player1PartnerId) ?? data.player1PartnerId)
        : data.player1PartnerId,
      player2PartnerId: data.player2PartnerId
        ? (regIdMap.get(data.player2PartnerId) ?? data.player2PartnerId)
        : data.player2PartnerId,
      team1Id: data.team1Id ? (teamIdMap.get(data.team1Id) ?? data.team1Id) : data.team1Id,
      team2Id: data.team2Id ? (teamIdMap.get(data.team2Id) ?? data.team2Id) : data.team2Id,
      parentMatchId: data.parentMatchId
        ? (matchIdMap.get(data.parentMatchId) ?? data.parentMatchId)
        : data.parentMatchId,
    });

    if (dryRun) {
      matchIdMap.set(match.id, `dry-match-${match.id}`);
      return;
    }

    const newRef = await targetRef.collection('matches').add(payload);
    matchIdMap.set(match.id, newRef.id);
  };

  for (const match of nonRubbers) {
    await cloneMatch(match);
  }
  for (const match of rubbers) {
    await cloneMatch(match);
  }

  // 6. Live scores
  const liveScoreSnap = await sourceRef.collection('liveScores').get();
  console.log(`Copying ${liveScoreSnap.size} live score(s)...`);

  for (const liveDoc of liveScoreSnap.docs) {
    const data = liveDoc.data();
    const oldMatchId = data.matchId ?? liveDoc.id;
    const newMatchId = matchIdMap.get(oldMatchId);
    if (!newMatchId) {
      console.warn(`  ⚠ Skipping live score ${liveDoc.id}: no remapped match for ${oldMatchId}`);
      continue;
    }
    if (dryRun) continue;

    await targetRef.collection('liveScores').doc(newMatchId).set(
      cleanFirestoreData({
        ...stripFirestoreId(data),
        matchId: newMatchId,
        tournamentId: targetId,
      })
    );
  }

  // 7. Brackets
  const bracketSnap = await db.collection('brackets').where('tournamentId', '==', sourceId).get();
  console.log(`Copying ${bracketSnap.size} bracket(s)...`);

  for (const bracketDoc of bracketSnap.docs) {
    const data = bracketDoc.data();
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

    if (!dryRun) {
      await db.collection('brackets').add(
        cleanFirestoreData({
          ...stripFirestoreId(data),
          tournamentId: targetId,
          participants: remappedParticipants,
          rounds: remappedRounds,
        })
      );
    }
  }

  // 8. Winners
  const winnerSnap = await db.collection('winners').where('tournamentId', '==', sourceId).get();
  console.log(`Copying ${winnerSnap.size} winner(s)...`);

  for (const winnerDoc of winnerSnap.docs) {
    const data = winnerDoc.data();
    if (!dryRun) {
      await db.collection('winners').add(
        cleanFirestoreData({
          ...stripFirestoreId(data),
          tournamentId: targetId,
          participantId: regIdMap.get(data.participantId) ?? data.participantId,
        })
      );
    }
  }

  // 9. Finances
  const financeSnap = await sourceRef.collection('finances').get();
  console.log(`Copying ${financeSnap.size} finance record(s)...`);

  for (const financeDoc of financeSnap.docs) {
    if (!dryRun) {
      await targetRef.collection('finances').add(
        cleanFirestoreData({
          ...stripFirestoreId(financeDoc.data()),
          tournamentId: targetId,
        })
      );
    }
  }

  // 10. Update target tournament config (keep name, createdAt, createdBy)
  const configUpdate = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
  for (const key of TOURNAMENT_CONFIG_KEYS) {
    if (sourceData[key] !== undefined) {
      configUpdate[key] = sourceData[key];
    }
  }
  const approvedCount = regSnap.docs.filter((d) => d.data().registrationStatus === 'approved').length;
  configUpdate.currentParticipants = approvedCount;

  if (!dryRun) {
    await targetRef.update(configUpdate);
  }

  return { approvedCount };
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const dryRun = process.argv.includes('--dry-run');
  const [sourceId, targetId] = args;

  if (!sourceId || !targetId) {
    console.error(
      'Usage: node --env-file=.env.local scripts/seed-tournament-from-source.mjs <sourceId> <targetId> [--dry-run]'
    );
    process.exit(1);
  }

  if (sourceId === targetId) {
    throw new Error('Source and target tournament IDs must be different');
  }

  ensureAdmin();
  const db = admin.firestore();

  const sourceBefore = await countSubcollections(db, sourceId);
  console.log('Source counts before:', sourceBefore);

  if (dryRun) console.log('\n*** DRY RUN — no writes ***');

  const { approvedCount } = await copyTournamentData(db, sourceId, targetId, dryRun);

  if (!dryRun) {
    const targetAfter = await countSubcollections(db, targetId);
    const sourceAfter = await countSubcollections(db, sourceId);

    console.log('\n--- Done ---');
    console.log('Target counts after:', targetAfter);
    console.log('Source counts after (should be unchanged):', sourceAfter);

    const sourceUnchanged = JSON.stringify(sourceBefore) === JSON.stringify(sourceAfter);
    if (!sourceUnchanged) {
      console.error('WARNING: Source tournament counts changed! Investigate immediately.');
      process.exit(1);
    }

    console.log(`\nSeeded ${targetId} with data from ${sourceId}`);
    console.log(`currentParticipants set to ${approvedCount}`);
    console.log('Source tournament was not modified.');
  } else {
    console.log('\nDry run complete. Re-run without --dry-run to apply changes.');
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
