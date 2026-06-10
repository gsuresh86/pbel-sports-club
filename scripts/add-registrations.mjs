/**
 * Bulk-add tournament registrations (and player records) via Firebase Admin.
 *
 * Usage:
 *   node --env-file=.env.local scripts/add-registrations.mjs <tournamentId> [players.json]
 *
 * Default players file: scripts/data/yuPajTMyUzDWAN7vkRmP-players.json
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

function cleanFirebaseData(data) {
  const cleaned = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    cleaned[key] = typeof value === 'string' && value.trim() === '' ? null : value;
  }
  return cleaned;
}

function generateRegistrationCode() {
  return (
    'REG' +
    Date.now().toString(36).toUpperCase() +
    Math.random().toString(36).slice(2, 7).toUpperCase()
  );
}

async function createPlayersFromRegistration(db, registration, tournamentId, registrationId) {
  const playerIds = [];
  const playersRef = db.collection('tournaments').doc(tournamentId).collection('players');

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
    status: 'active',
    paymentStatus: registration.paymentStatus,
    paymentReference: registration.paymentReference,
    paymentAmount: registration.paymentAmount,
    paymentMethod: registration.paymentMethod,
    paymentVerifiedAt: registration.paymentVerifiedAt,
    paymentVerifiedBy: registration.paymentVerifiedBy,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const primaryPlayerRef = await playersRef.add(primaryPlayerData);
  playerIds.push(primaryPlayerRef.id);

  if (registration.partnerName && String(registration.partnerName).trim()) {
    const partnerPlayerData = cleanFirebaseData({
      tournamentId,
      registrationId,
      name: registration.partnerName,
      email: registration.partnerEmail,
      phone: registration.partnerPhone,
      age: registration.partnerAge ?? registration.age,
      gender: registration.gender,
      tower: registration.partnerTower,
      flatNumber: registration.partnerFlatNumber,
      emergencyContact: registration.emergencyContact,
      expertiseLevel: registration.expertiseLevel,
      previousExperience: registration.previousExperience,
      isResident: registration.isResident,
      selectedCategory: registration.selectedCategory,
      profilePhotoUrl: registration.partnerProfilePhotoUrl,
      status: 'active',
      partnerId: primaryPlayerRef.id,
      partnerName: registration.name,
      paymentStatus: registration.paymentStatus,
      paymentReference: registration.paymentReference,
      paymentAmount: registration.paymentAmount,
      paymentMethod: registration.paymentMethod,
      paymentVerifiedAt: registration.paymentVerifiedAt,
      paymentVerifiedBy: registration.paymentVerifiedBy,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const partnerPlayerRef = await playersRef.add(partnerPlayerData);
    playerIds.push(partnerPlayerRef.id);

    await primaryPlayerRef.update({
      partnerId: partnerPlayerRef.id,
      partnerName: registration.partnerName,
    });
  }

  return playerIds;
}

async function main() {
  const tournamentId = process.argv[2];
  const playersFile =
    process.argv[3] || join(__dirname, 'data', `${tournamentId}-players.json`);

  if (!tournamentId) {
    console.error('Usage: node --env-file=.env.local scripts/add-registrations.mjs <tournamentId> [players.json]');
    process.exit(1);
  }

  ensureAdmin();
  const db = admin.firestore();

  const tournamentRef = db.collection('tournaments').doc(tournamentId);
  const tournamentSnap = await tournamentRef.get();
  if (!tournamentSnap.exists) {
    throw new Error(`Tournament not found: ${tournamentId}`);
  }

  const tournament = tournamentSnap.data();
  const players = JSON.parse(readFileSync(playersFile, 'utf8'));
  if (!Array.isArray(players) || players.length === 0) {
    throw new Error(`No players found in ${playersFile}`);
  }

  console.log(`Tournament: ${tournament.name} (${tournamentId})`);
  console.log(`Adding ${players.length} registration(s) from ${playersFile}\n`);

  const registrationsRef = tournamentRef.collection('registrations');
  let added = 0;

  for (const player of players) {
    const now = admin.firestore.FieldValue.serverTimestamp();
    const registrationData = cleanFirebaseData({
      tournamentId,
      name: player.name,
      email: player.email,
      phone: player.phone,
      age: player.age,
      gender: player.gender,
      tower: player.tower,
      flatNumber: player.flatNumber,
      emergencyContact: player.emergencyContact ?? player.phone,
      expertiseLevel: player.expertiseLevel ?? 'intermediate',
      isResident: player.isResident ?? true,
      selectedCategory: player.selectedCategory,
      partnerName: player.partnerName ?? null,
      partnerPhone: player.partnerPhone ?? null,
      partnerEmail: player.partnerEmail ?? null,
      partnerAge: player.partnerAge ?? null,
      partnerTower: player.partnerTower ?? null,
      partnerFlatNumber: player.partnerFlatNumber ?? null,
      paymentReference: player.paymentReference ?? null,
      paymentAmount: player.paymentAmount ?? tournament.entryFee ?? 0,
      paymentMethod: player.paymentMethod ?? 'qr_code',
      registrationStatus: player.registrationStatus ?? 'approved',
      paymentStatus: player.paymentStatus ?? 'paid',
      registrationCode: generateRegistrationCode(),
      registeredAt: now,
      approvedAt: player.registrationStatus === 'pending' ? null : now,
      paymentVerifiedAt: player.paymentStatus === 'pending' ? null : now,
    });

    const registrationRef = await registrationsRef.add(registrationData);
    const playerIds = await createPlayersFromRegistration(
      db,
      registrationData,
      tournamentId,
      registrationRef.id
    );

    added += 1;
    console.log(`✓ ${player.name} (${player.selectedCategory}) -> registration ${registrationRef.id}, players: ${playerIds.join(', ')}`);
  }

  const approvedSnap = await registrationsRef.where('registrationStatus', '==', 'approved').get();
  await tournamentRef.update({ currentParticipants: approvedSnap.size });

  console.log(`\nDone. Added ${added} registration(s). Tournament currentParticipants: ${approvedSnap.size}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
