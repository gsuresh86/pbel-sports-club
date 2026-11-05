'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { User, UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, role?: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      console.log('Auth state changed:', firebaseUser ? 'User logged in' : 'User logged out');
      if (firebaseUser) {
        try {
          console.log('Fetching user document for UID:', firebaseUser.uid);
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log('User data from Firestore:', userData);
            console.log('User role:', userData.role);
          const userDataWithId = {
            id: firebaseUser.uid,
            ...userData
          } as User;
          
          setUser(userDataWithId);
          
          // Initialize notifications for authenticated users
          if (userDataWithId.role === 'admin' || userDataWithId.role === 'super-admin' || userDataWithId.role === 'tournament-admin' || userDataWithId.role === 'staff') {
            try {
              const { initializeNotifications } = await import('@/lib/notifications');
              await initializeNotifications(userDataWithId);
            } catch (error) {
              console.error('Error initializing notifications:', error);
            }
          }
          } else {
            console.log('User document not found in Firestore');
            // Don't set user to null immediately - keep Firebase user info
            // This prevents redirect loops when Firestore document is missing
            setUser({
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || '',
              role: 'public' as UserRole,
              createdAt: new Date(),
            } as User);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          // Don't set user to null on error - keep Firebase user info
          setUser({
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || '',
            role: 'public' as UserRole,
            createdAt: new Date(),
          } as User);
        }
      } else {
        console.log('No Firebase user - setting user to null');
        setUser(null);
      }
      setLoading(false);
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
      const { logUserActivity } = await import('@/lib/user-activity');
      const userDoc = await getDoc(doc(db, 'users', credential.user.uid));
      const profile = userDoc.exists() ? userDoc.data() : {};
      await logUserActivity({
        userId: credential.user.uid,
        userName: (profile.name as string) || credential.user.displayName || '',
        userEmail: (profile.email as string) || credential.user.email || email,
        type: 'login',
        title: 'Logged in',
      });
    } catch (error) {
      console.warn('Failed to record login activity:', error);
    }
  };

  const signUp = async (email: string, password: string, name: string, _role?: UserRole) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      email,
      name,
      role: 'public' as UserRole,
      isActive: true,
      createdAt: new Date(),
    });
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const refreshUser = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    if (userDoc.exists()) {
      setUser({ id: firebaseUser.uid, ...userDoc.data() } as User);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
