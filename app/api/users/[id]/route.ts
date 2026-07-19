import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { canManageUsers, getCallerUser } from '@/lib/api-auth';
import { getAdminAuth, getAdminFirestore, isAdminConfigured } from '@/lib/firebase-admin';
import { isSystemAdmin } from '@/lib/permissions';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    if (!isAdminConfigured()) {
      return NextResponse.json({ error: 'Server admin is not configured' }, { status: 503 });
    }

    const caller = await getCallerUser(request);
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!canManageUsers(caller)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: userId } = await context.params;
    if (!userId) {
      return NextResponse.json({ error: 'User id is required' }, { status: 400 });
    }

    if (userId === caller.id) {
      return NextResponse.json({ error: 'Cannot modify your own account this way' }, { status: 403 });
    }

    const body = (await request.json()) as {
      isActive?: boolean;
      password?: string;
      name?: string;
      role?: string;
      assignedTournaments?: string[];
      tournamentRoles?: Record<string, string[]>;
      tournamentPermissions?: Record<string, string[]>;
    };

    const db = getAdminFirestore();
    const auth = getAdminAuth();
    const userRef = db.collection('users').doc(userId);
    const snap = await userRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const targetRole = snap.data()?.role as string | undefined;
    if (
      (targetRole === 'admin' || targetRole === 'super-admin') &&
      caller.role !== 'super-admin'
    ) {
      return NextResponse.json({ error: 'Only super-admins can modify admin accounts' }, { status: 403 });
    }

    const firestoreUpdate: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (typeof body.isActive === 'boolean') {
      firestoreUpdate.isActive = body.isActive;
      await auth.updateUser(userId, { disabled: !body.isActive });
    }

    if (typeof body.password === 'string' && body.password.trim()) {
      if (body.password.length < 6) {
        return NextResponse.json(
          { error: 'Password must be at least 6 characters long' },
          { status: 400 }
        );
      }
      await auth.updateUser(userId, { password: body.password.trim() });
    }

    if (typeof body.name === 'string' && body.name.trim()) {
      firestoreUpdate.name = body.name.trim();
      await auth.updateUser(userId, { displayName: body.name.trim() });
    }

    if (body.role && isSystemAdmin(caller.role)) {
      firestoreUpdate.role = body.role;
    }

    if (Array.isArray(body.assignedTournaments)) {
      firestoreUpdate.assignedTournaments = body.assignedTournaments;
    }
    if (body.tournamentRoles) {
      firestoreUpdate.tournamentRoles = body.tournamentRoles;
    }
    if (body.tournamentPermissions) {
      firestoreUpdate.tournamentPermissions = body.tournamentPermissions;
    }

    await userRef.update(firestoreUpdate);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error updating user:', error);
    const message = error instanceof Error ? error.message : 'Failed to update user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    if (!isAdminConfigured()) {
      return NextResponse.json({ error: 'Server admin is not configured' }, { status: 503 });
    }

    const caller = await getCallerUser(request);
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!canManageUsers(caller)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: userId } = await context.params;
    if (!userId) {
      return NextResponse.json({ error: 'User id is required' }, { status: 400 });
    }

    if (userId === caller.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 403 });
    }

    const db = getAdminFirestore();
    const snap = await db.collection('users').doc(userId).get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const targetRole = snap.data()?.role as string | undefined;
    if (
      (targetRole === 'admin' || targetRole === 'super-admin') &&
      caller.role !== 'super-admin'
    ) {
      return NextResponse.json({ error: 'Only super-admins can delete admin accounts' }, { status: 403 });
    }

    await getAdminAuth().deleteUser(userId);
    await db.collection('users').doc(userId).delete();

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting user:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
