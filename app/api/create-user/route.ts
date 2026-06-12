import { NextResponse } from 'next/server';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { UserRole, Permission } from '@/types';
import { buildTournamentAccessUpdate } from '@/lib/permissions';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      email,
      password,
      name,
      role,
      assignedTournaments,
      tournamentRoles,
      tournamentPermissions,
      roleSlugs,
      isActive,
    } = body;

    if (!email || !password || !name || !role) {
      return NextResponse.json(
        { error: 'Email, password, name, and role are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    let resolvedRoles = tournamentRoles as Record<string, string[]> | undefined;
    let resolvedPermissions = tournamentPermissions as Record<string, Permission[]> | undefined;
    let resolvedAssigned = (assignedTournaments as string[]) || [];

    if (roleSlugs?.length && assignedTournaments?.length === 1) {
      const tournamentId = assignedTournaments[0];
      const access = buildTournamentAccessUpdate(undefined, undefined, undefined, tournamentId, roleSlugs);
      resolvedRoles = access.tournamentRoles;
      resolvedPermissions = access.tournamentPermissions;
      resolvedAssigned = access.assignedTournaments;
    } else if (role === 'referee' && assignedTournaments?.length) {
      const tournamentId = assignedTournaments[0];
      const access = buildTournamentAccessUpdate(undefined, undefined, undefined, tournamentId, ['referee']);
      resolvedRoles = access.tournamentRoles;
      resolvedPermissions = access.tournamentPermissions;
    } else if (role === 'tournament-admin' && assignedTournaments?.length) {
      const tournamentId = assignedTournaments[0];
      const access = buildTournamentAccessUpdate(undefined, undefined, undefined, tournamentId, ['tournament-admin']);
      resolvedRoles = access.tournamentRoles;
      resolvedPermissions = access.tournamentPermissions;
    }

    const userData: Record<string, unknown> = {
      name: name.trim(),
      email: email.trim(),
      role: role === 'referee' || role === 'tournament-admin' ? 'staff' : (role as UserRole),
      assignedTournaments: resolvedAssigned,
      isActive: isActive !== undefined ? isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (resolvedRoles) userData.tournamentRoles = resolvedRoles;
    if (resolvedPermissions) userData.tournamentPermissions = resolvedPermissions;

    if (role === 'referee' || role === 'staff') {
      userData.role = 'staff';
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', userCredential.user.uid), userData);

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      userId: userCredential.user.uid,
      userData: {
        id: userCredential.user.uid,
        ...userData,
      },
    });
  } catch (error: unknown) {
    console.error('Error creating user:', error);

    let errorMessage = 'Failed to create user';
    if (error && typeof error === 'object' && 'code' in error) {
      const firebaseError = error as { code: string; message: string };

      if (firebaseError.code === 'auth/email-already-in-use') {
        errorMessage = 'Email is already in use';
      } else if (firebaseError.code === 'auth/weak-password') {
        errorMessage = 'Password should be at least 6 characters';
      } else if (firebaseError.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else {
        errorMessage = firebaseError.message;
      }
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
