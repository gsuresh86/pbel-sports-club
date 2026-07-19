import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyAuthToken } from '@/lib/api-auth';
import { getAdminFirestore, isAdminConfigured } from '@/lib/firebase-admin';
import { isFullTournamentAdmin } from '@/lib/permissions';
import type { User } from '@/types';

type RouteContext = { params: Promise<{ id: string }> };

function toUser(id: string, data: Record<string, unknown>): User {
  const createdAt = data.createdAt as { toDate?: () => Date } | Date | undefined;
  const updatedAt = data.updatedAt as { toDate?: () => Date } | Date | undefined;

  return {
    id,
    email: (data.email as string) ?? '',
    name: (data.name as string) ?? '',
    role: data.role as User['role'],
    assignedTournaments: data.assignedTournaments as string[] | undefined,
    tournamentRoles: data.tournamentRoles as User['tournamentRoles'],
    tournamentPermissions: data.tournamentPermissions as User['tournamentPermissions'],
    createdAt: createdAt && typeof createdAt === 'object' && 'toDate' in createdAt && createdAt.toDate
      ? createdAt.toDate()
      : createdAt instanceof Date
        ? createdAt
        : new Date(),
    updatedAt: updatedAt && typeof updatedAt === 'object' && 'toDate' in updatedAt && updatedAt.toDate
      ? updatedAt.toDate()
      : updatedAt instanceof Date
        ? updatedAt
        : undefined,
    createdBy: data.createdBy as string | undefined,
    profilePhotoUrl: data.profilePhotoUrl as string | undefined,
  };
}

function sanitizeUpdate(body: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    if (value === null) {
      data[key] = FieldValue.delete();
      continue;
    }
    if (
      key === 'startDate' ||
      key === 'endDate' ||
      key === 'registrationDeadline' ||
      key === 'updatedAt'
    ) {
      data[key] = new Date(value as string | number | Date);
      continue;
    }
    data[key] = value;
  }

  data.updatedAt = FieldValue.serverTimestamp();
  return data;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    if (!isAdminConfigured()) {
      return NextResponse.json(
        { error: 'Server admin is not configured' },
        { status: 503 }
      );
    }

    const decoded = await verifyAuthToken(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: tournamentId } = await context.params;
    if (!tournamentId) {
      return NextResponse.json({ error: 'Tournament id is required' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const userSnap = await db.collection('users').doc(decoded.uid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 403 });
    }

    const user = toUser(userSnap.id, userSnap.data() as Record<string, unknown>);
    if (!isFullTournamentAdmin(user, tournamentId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const tournamentRef = db.collection('tournaments').doc(tournamentId);
    const tournamentSnap = await tournamentRef.get();
    if (!tournamentSnap.exists) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    await tournamentRef.update(sanitizeUpdate(body));
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error updating tournament:', error);
    const message = error instanceof Error ? error.message : 'Failed to update tournament';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
