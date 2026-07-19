import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { canCreateTournamentStaff, getCallerUser } from '@/lib/api-auth';
import { getAdminFirestore, isAdminConfigured } from '@/lib/firebase-admin';
import { isSystemAdmin } from '@/lib/permissions';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Backfill tournaments/{id}/publicPlayers from registrations (staff only).
 * Safe to re-run; merges display fields only.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    if (!isAdminConfigured()) {
      return NextResponse.json({ error: 'Server admin is not configured' }, { status: 503 });
    }

    const caller = await getCallerUser(request);
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: tournamentId } = await context.params;
    if (!tournamentId) {
      return NextResponse.json({ error: 'Tournament id is required' }, { status: 400 });
    }

    const allowed =
      isSystemAdmin(caller.role) ||
      caller.role === 'tournament-admin' ||
      canCreateTournamentStaff(caller, tournamentId);

    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = getAdminFirestore();
    const regsSnap = await db.collection('tournaments').doc(tournamentId).collection('registrations').get();

    let written = 0;
    const batchSize = 400;
    let batch = db.batch();
    let ops = 0;

    for (const regDoc of regsSnap.docs) {
      const data = regDoc.data();
      const name = typeof data.name === 'string' ? data.name.trim() : '';
      const selectedCategory = data.selectedCategory as string | undefined;
      if (!name || !selectedCategory) continue;

      const payload: Record<string, unknown> = {
        tournamentId,
        name,
        selectedCategory,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (typeof data.partnerName === 'string' && data.partnerName.trim()) {
        payload.partnerName = data.partnerName.trim();
      }
      if (typeof data.profilePhotoUrl === 'string' && data.profilePhotoUrl.trim()) {
        payload.profilePhotoUrl = data.profilePhotoUrl.trim();
      }
      if (typeof data.partnerProfilePhotoUrl === 'string' && data.partnerProfilePhotoUrl.trim()) {
        payload.partnerProfilePhotoUrl = data.partnerProfilePhotoUrl.trim();
      }

      const ref = db.collection('tournaments').doc(tournamentId).collection('publicPlayers').doc(regDoc.id);
      batch.set(ref, payload, { merge: true });
      written += 1;
      ops += 1;

      if (ops >= batchSize) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }

    if (ops > 0) {
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      tournamentId,
      registrations: regsSnap.size,
      written,
    });
  } catch (error: unknown) {
    console.error('Error syncing public players:', error);
    const message = error instanceof Error ? error.message : 'Failed to sync public players';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
