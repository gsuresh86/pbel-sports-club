import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { canCreateTournamentStaff, getCallerUser } from '@/lib/api-auth';
import { getAdminFirestore, isAdminConfigured } from '@/lib/firebase-admin';
import { isSystemAdmin } from '@/lib/permissions';
import { normalizeCategorySlug } from '@/lib/categoryLabels';

type RouteContext = { params: Promise<{ id: string }> };

function isRejected(status: unknown): boolean {
  return status === 'rejected';
}

/**
 * Backfill tournaments/{id}/publicPlayers from registrations (staff only).
 * Writes non-rejected registrations and deletes stale/rejected projections.
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
    const publicSnap = await db.collection('tournaments').doc(tournamentId).collection('publicPlayers').get();

    const keepIds = new Set<string>();
    const writes: { id: string; payload: Record<string, unknown> }[] = [];

    for (const regDoc of regsSnap.docs) {
      const data = regDoc.data();
      if (isRejected(data.registrationStatus)) continue;

      const name = typeof data.name === 'string' ? data.name.trim() : '';
      const rawCategory =
        typeof data.selectedCategory === 'string'
          ? data.selectedCategory
          : data.selectedCategory != null
            ? String(data.selectedCategory)
            : undefined;
      const selectedCategory = normalizeCategorySlug(rawCategory);
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

      keepIds.add(regDoc.id);
      writes.push({ id: regDoc.id, payload });
    }

    const deletes = publicSnap.docs.filter((d) => !keepIds.has(d.id));

    const batchSize = 400;
    let written = 0;
    let removed = 0;
    let batch = db.batch();
    let ops = 0;

    const commitIfNeeded = async (force = false) => {
      if (ops === 0) return;
      if (!force && ops < batchSize) return;
      await batch.commit();
      batch = db.batch();
      ops = 0;
    };

    for (const write of writes) {
      const ref = db.collection('tournaments').doc(tournamentId).collection('publicPlayers').doc(write.id);
      batch.set(ref, write.payload, { merge: true });
      written += 1;
      ops += 1;
      await commitIfNeeded();
    }

    for (const pubDoc of deletes) {
      batch.delete(pubDoc.ref);
      removed += 1;
      ops += 1;
      await commitIfNeeded();
    }

    await commitIfNeeded(true);

    return NextResponse.json({
      success: true,
      tournamentId,
      registrations: regsSnap.size,
      written,
      removed,
    });
  } catch (error: unknown) {
    console.error('Error syncing public players:', error);
    const message = error instanceof Error ? error.message : 'Failed to sync public players';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
