import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, firebaseConfig } from '@/lib/firebase';
import type { Permission, UserRole } from '@/types';

const SECONDARY_APP_NAME = 'staff-creator';

function getSecondaryApp(): FirebaseApp {
  return (
    getApps().find((app) => app.name === SECONDARY_APP_NAME) ??
    initializeApp(firebaseConfig, SECONDARY_APP_NAME)
  );
}

function mapStaffRole(role: UserRole): UserRole {
  return role === 'referee' || role === 'tournament-admin' ? 'staff' : role;
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code: string }).code);
    if (code === 'auth/email-already-in-use') return 'Email is already in use';
    if (code === 'auth/weak-password' || code === 'auth/invalid-password') {
      return 'Password should be at least 6 characters';
    }
    if (code === 'auth/invalid-email') return 'Invalid email address';
    if (code === 'permission-denied' || code === 'firestore/permission-denied') {
      return 'You do not have permission to add staff for this tournament.';
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Failed to create staff user';
}

/** Create a Firebase Auth user without signing out the current admin, then write the staff profile. */
export async function createTournamentStaffUser(params: {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  assignedTournaments: string[];
  tournamentRoles?: Record<string, string[]>;
  tournamentPermissions?: Record<string, Permission[]>;
}): Promise<{ userId: string }> {
  const creator = auth.currentUser;
  if (!creator) {
    throw new Error('You must be signed in to perform this action');
  }

  const secondaryAuth = getAuth(getSecondaryApp());
  let userId = '';

  try {
    const credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      params.email.trim(),
      params.password
    );
    userId = credential.user.uid;
    await updateProfile(credential.user, { displayName: params.name.trim() });
    await signOut(secondaryAuth);
  } catch (error: unknown) {
    if (secondaryAuth.currentUser) {
      await signOut(secondaryAuth).catch(() => undefined);
    }
    throw new Error(errorMessage(error));
  }

  try {
    await setDoc(doc(db, 'users', userId), {
      name: params.name.trim(),
      email: params.email.trim(),
      role: mapStaffRole(params.role),
      assignedTournaments: params.assignedTournaments,
      ...(params.tournamentRoles ? { tournamentRoles: params.tournamentRoles } : {}),
      ...(params.tournamentPermissions
        ? { tournamentPermissions: params.tournamentPermissions }
        : {}),
      isActive: true,
      createdBy: creator.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error: unknown) {
    throw new Error(errorMessage(error));
  }

  return { userId };
}
