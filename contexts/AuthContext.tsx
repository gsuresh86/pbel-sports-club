'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { User, UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string, name: string, role?: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

function googleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

async function ensureUserProfile(
  firebaseUser: FirebaseUser,
  provider: 'password' | 'google',
  name?: string,
) {
  const userRef = doc(db, 'users', firebaseUser.uid);
  const existing = await getDoc(userRef);
  const displayName =
    name?.trim() ||
    firebaseUser.displayName ||
    firebaseUser.email?.split('@')[0] ||
    'Organizer';

  if (!existing.exists()) {
    await setDoc(userRef, {
      email: firebaseUser.email || '',
      name: displayName,
      role: 'public' as UserRole,
      isActive: true,
      authProvider: provider,
      ...(firebaseUser.photoURL ? { profilePhotoUrl: firebaseUser.photoURL } : {}),
      createdAt: new Date(),
      lastLoginAt: new Date(),
    });
    return;
  }

  const profile = existing.data();
  const patch: Record<string, unknown> = {
    lastLoginAt: new Date(),
    updatedAt: new Date(),
  };
  if (!profile.name && displayName) patch.name = displayName;
  if (!profile.profilePhotoUrl && firebaseUser.photoURL) patch.profilePhotoUrl = firebaseUser.photoURL;
  if (!profile.authProvider) patch.authProvider = provider;
  if (!profile.email && firebaseUser.email) patch.email = firebaseUser.email;
  await updateDoc(userRef, patch);
}

async function recordLogin(firebaseUser: FirebaseUser, fallbackEmail = '') {
  try {
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    const profile = userDoc.exists() ? userDoc.data() : {};
    const { logUserActivity } = await import('@/lib/user-activity');
    await logUserActivity({
      userId: firebaseUser.uid,
      userName: (profile.name as string) || firebaseUser.displayName || '',
      userEmail: (profile.email as string) || firebaseUser.email || fallbackEmail,
      type: 'login',
      title: 'Logged in',
    });
  } catch (error) {
    console.warn('Failed to record login activity:', error);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrateUser = async (firebaseUser: FirebaseUser) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (userDoc.exists()) {
        const userDataWithId = {
          id: firebaseUser.uid,
          ...userDoc.data(),
        } as User;
        setUser(userDataWithId);

        if (
          userDataWithId.role === 'admin' ||
          userDataWithId.role === 'super-admin' ||
          userDataWithId.role === 'tournament-admin' ||
          userDataWithId.role === 'staff'
        ) {
          try {
            const { initializeNotifications } = await import('@/lib/notifications');
            await initializeNotifications(userDataWithId);
          } catch (error) {
            console.error('Error initializing notifications:', error);
          }
        }
        return;
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }

    setUser({
      id: firebaseUser.uid,
      email: firebaseUser.email || '',
      name: firebaseUser.displayName || '',
      role: 'public' as UserRole,
      createdAt: new Date(),
    } as User);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        await hydrateUser(firebaseUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    getRedirectResult(auth)
      .then(async (result) => {
        if (!result?.user) return;
        await ensureUserProfile(result.user, 'google');
        await recordLogin(result.user);
        await hydrateUser(result.user);
      })
      .catch((error) => {
        console.error('Google redirect sign-in failed:', error);
      });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    try {
      await updateDoc(doc(db, 'users', credential.user.uid), {
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (error) {
      console.warn('Failed to record last login:', error);
    }
    await recordLogin(credential.user, email);
  };

  const signInWithGoogle = async () => {
    const provider = googleProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await ensureUserProfile(result.user, 'google');
      await recordLogin(result.user);
      await hydrateUser(result.user);
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, provider);
        return;
      }
      throw error;
    }
  };

  const signUp = async (email: string, password: string, name: string, _role?: UserRole) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await ensureUserProfile(userCredential.user, 'password', name);
    await hydrateUser(userCredential.user);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const refreshUser = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    await hydrateUser(firebaseUser);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signInWithGoogle, signUp, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
