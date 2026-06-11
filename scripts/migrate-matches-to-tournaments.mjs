/**
 * Copy global `matches` and `liveScores` into tournament subcollections.
 *
 * Usage:
 *   node --env-file=.env.local scripts/migrate-matches-to-tournaments.mjs [--delete-old]
 *
 * Options:
 *   --delete-old   Remove top-level documents after a successful copy (default: copy only)
 *   --dry-run      Log actions without writing
 */
import admin from 'firebase-admin';

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

const BATCH_LIMIT = 450;

async function migrateCollection(db, sourceCollection, targetSubcollection, dryRun, deleteOld) {
  const sourceSnap = await db.collection(sourceCollection).get();
  console.log(`\n${sourceCollection}: ${sourceSnap.size} document(s) found`);

  let copied = 0;
  let skipped = 0;
  let missingTournament = 0;
  let batch = db.batch();
  let batchOps = 0;

  for (const docSnap of sourceSnap.docs) {
    const data = docSnap.data();
    const tournamentId =
      (typeof data.tournamentId === 'string' && data.tournamentId.trim()) ||
      (typeof data.matchId === 'string' &&
        sourceCollection === 'liveScores' &&
        (await db.collection('matches').doc(data.matchId).get()).data()?.tournamentId);

    if (!tournamentId) {
      missingTournament += 1;
      console.warn(`  ⚠ Skipping ${sourceCollection}/${docSnap.id}: no tournamentId`);
      continue;
    }

    const tournamentRef = db.collection('tournaments').doc(tournamentId);
    const tournamentExists = (await tournamentRef.get()).exists;
    if (!tournamentExists) {
      missingTournament += 1;
      console.warn(`  ⚠ Skipping ${sourceCollection}/${docSnap.id}: tournament ${tournamentId} not found`);
      continue;
    }

    const targetRef = tournamentRef.collection(targetSubcollection).doc(docSnap.id);
    const existing = await targetRef.get();
    if (existing.exists) {
      skipped += 1;
      continue;
    }

    if (dryRun) {
      console.log(`  [dry-run] would copy ${sourceCollection}/${docSnap.id} -> tournaments/${tournamentId}/${targetSubcollection}/${docSnap.id}`);
      copied += 1;
      continue;
    }

    batch.set(targetRef, data);
    batchOps += 1;

    if (deleteOld) {
      batch.delete(docSnap.ref);
      batchOps += 1;
    }

    if (batchOps >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      batchOps = 0;
    }

    copied += 1;
  }

  if (!dryRun && batchOps > 0) {
    await batch.commit();
  }

  return { copied, skipped, missingTournament, total: sourceSnap.size };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const deleteOld = args.includes('--delete-old');

  ensureAdmin();
  const db = admin.firestore();

  console.log('Migrating matches and liveScores to tournament subcollections');
  if (dryRun) console.log('Mode: dry-run (no writes)');
  if (deleteOld) console.log('Will delete top-level docs after copy');

  const matchStats = await migrateCollection(db, 'matches', 'matches', dryRun, deleteOld);
  const liveStats = await migrateCollection(db, 'liveScores', 'liveScores', dryRun, deleteOld);

  console.log('\n--- Summary ---');
  console.log(
    `matches:     copied=${matchStats.copied}, skipped=${matchStats.skipped}, missing tournament=${matchStats.missingTournament}, total=${matchStats.total}`
  );
  console.log(
    `liveScores:  copied=${liveStats.copied}, skipped=${liveStats.skipped}, missing tournament=${liveStats.missingTournament}, total=${liveStats.total}`
  );

  if (!dryRun) {
    console.log('\nDone. Deploy updated firestore.rules and run the app against the new paths.');
    if (!deleteOld) {
      console.log('Top-level collections were kept. Re-run with --delete-old after verifying.');
    }
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
