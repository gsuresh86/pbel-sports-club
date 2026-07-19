import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import {
  canCreateTournamentStaff,
  canManageUsers,
  getCallerUser,
} from '@/lib/api-auth';
import { getAdminAuth, getAdminFirestore, isAdminConfigured } from '@/lib/firebase-admin';
import { buildTournamentAccessUpdate } from '@/lib/permissions';
import { Permission, UserRole } from '@/types';

const PRIVILEGED_ROLES: UserRole[] = ['admin', 'super-admin'];

export async function POST(request: Request) {
  try {
    if (!isAdminConfigured()) {
      return NextResponse.json(
        { error: 'Server admin is not configured' },
        { status: 503 }
      );
    }

    const caller = await getCallerUser(request);
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    if (PRIVILEGED_ROLES.includes(role as UserRole) && caller.role !== 'super-admin') {
      return NextResponse.json(
        { error: 'Only super-admins can create admin accounts' },
        { status: 403 }
      );
    }

    const tournamentIdForStaff =
      Array.isArray(assignedTournaments) && assignedTournaments.length === 1
        ? (assignedTournaments[0] as string)
        : undefined;

    const isGlobalAdminCreate = PRIVILEGED_ROLES.includes(role as UserRole);
    if (!isGlobalAdminCreate) {
      if (!canCreateTournamentStaff(caller, tournamentIdForStaff) && !canManageUsers(caller)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
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
      const access = buildTournamentAccessUpdate(undefined, undefined, undefined, tournamentId, [
        'tournament-admin',
      ]);
      resolvedRoles = access.tournamentRoles;
      resolvedPermissions = access.tournamentPermissions;
    }

    const userData: Record<string, unknown> = {
      name: name.trim(),
      email: email.trim(),
      role: role === 'referee' || role === 'tournament-admin' ? 'staff' : (role as UserRole),
      assignedTournaments: resolvedAssigned,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: caller.id,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (resolvedRoles) userData.tournamentRoles = resolvedRoles;
    if (resolvedPermissions) userData.tournamentPermissions = resolvedPermissions;

    if (role === 'referee' || role === 'staff') {
      userData.role = 'staff';
    }

    const adminAuth = getAdminAuth();
    const userRecord = await adminAuth.createUser({
      email: email.trim(),
      password,
      displayName: name.trim(),
      disabled: isActive === false,
    });

    await getAdminFirestore().collection('users').doc(userRecord.uid).set(userData);

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      userId: userRecord.uid,
      userData: {
        id: userRecord.uid,
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  } catch (error: unknown) {
    console.error('Error creating user:', error);

    let errorMessage = 'Failed to create user';
    let status = 500;

    if (error && typeof error === 'object' && 'code' in error) {
      const firebaseError = error as { code: string; message: string };

      if (firebaseError.code === 'auth/email-already-exists') {
        errorMessage = 'Email is already in use';
        status = 409;
      } else if (firebaseError.code === 'auth/invalid-password') {
        errorMessage = 'Password should be at least 6 characters';
        status = 400;
      } else if (firebaseError.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
        status = 400;
      } else {
        errorMessage = firebaseError.message;
      }
    }

    return NextResponse.json({ error: errorMessage }, { status });
  }
}
