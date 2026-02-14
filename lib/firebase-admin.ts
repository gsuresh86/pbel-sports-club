/**
 * Firebase Admin SDK - single place for server-side init.
 * Requires in .env.local (or env):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY  (from service account JSON, newlines as \n)
 */
import admin from 'firebase-admin';

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

function ensureAdminApp(): void {
  if (admin.apps.length > 0) return;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin is not configured. Add FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY to .env.local (from your Firebase service account JSON).'
    );
  }
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

export function getAdminFirestore(): admin.firestore.Firestore {
  ensureAdminApp();
  return admin.firestore();
}

export function getAdminMessaging(): admin.messaging.Messaging {
  ensureAdminApp();
  return admin.messaging();
}

export function isAdminConfigured(): boolean {
  if (admin.apps.length > 0) return true;
  return !!(projectId && clientEmail && privateKey);
}
