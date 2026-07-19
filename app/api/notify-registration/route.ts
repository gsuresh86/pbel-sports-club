import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore, getAdminMessaging, isAdminConfigured } from '@/lib/firebase-admin';

/**
 * Notify tournament staff about a new registration and bump participant count once.
 * Requires a real registrationId under the tournament (idempotent via notifiedAt).
 */
export async function POST(request: Request) {
  try {
    if (!isAdminConfigured()) {
      return NextResponse.json(
        {
          error:
            'Notifications are not configured on the server. Add Firebase Admin env vars to .env.local.',
        },
        { status: 503 }
      );
    }

    const db = getAdminFirestore();
    const messaging = getAdminMessaging();

    const body = (await request.json()) as {
      tournamentId: string;
      tournamentName: string;
      playerName: string;
      registrationId: string;
    };
    const { tournamentId, tournamentName, playerName, registrationId } = body;

    if (!tournamentId || !tournamentName || !playerName || !registrationId) {
      return NextResponse.json(
        {
          error: 'tournamentId, tournamentName, playerName, and registrationId are required',
        },
        { status: 400 }
      );
    }

    const tournamentRef = db.collection('tournaments').doc(tournamentId);
    const registrationRef = tournamentRef.collection('registrations').doc(registrationId);

    const alreadyNotified = await db.runTransaction(async (tx) => {
      const [tournamentSnap, registrationSnap] = await Promise.all([
        tx.get(tournamentRef),
        tx.get(registrationRef),
      ]);

      if (!tournamentSnap.exists || !registrationSnap.exists) {
        return 'missing' as const;
      }

      const reg = registrationSnap.data();
      if (reg?.notifiedAt) {
        return 'duplicate' as const;
      }

      tx.update(registrationRef, {
        notifiedAt: FieldValue.serverTimestamp(),
      });
      tx.update(tournamentRef, {
        currentParticipants: FieldValue.increment(1),
      });

      return 'ok' as const;
    });

    if (alreadyNotified === 'missing') {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    if (alreadyNotified === 'duplicate') {
      return NextResponse.json({ success: true, notified: 0, deduped: true });
    }

    const tournamentSnap = await tournamentRef.get();
    const tournamentData = tournamentSnap.data();
    const adminUserIds: string[] = [];

    const createdBy = tournamentData?.createdBy as string | undefined;
    if (createdBy) {
      adminUserIds.push(createdBy);
    }

    const assignedSnap = await db
      .collection('users')
      .where('assignedTournaments', 'array-contains', tournamentId)
      .where('isActive', '==', true)
      .get();

    assignedSnap.docs.forEach((d) => {
      if (!adminUserIds.includes(d.id)) {
        adminUserIds.push(d.id);
      }
    });

    const tokens: string[] = [];
    for (const userId of adminUserIds) {
      const userSnap = await db.collection('users').doc(userId).get();
      if (userSnap.exists) {
        const fcmToken = userSnap.data()?.fcmToken as string | undefined;
        if (fcmToken) {
          tokens.push(fcmToken);
        }
      }
    }

    const title = 'New Player Registration';
    const bodyText = `${playerName} has registered for "${tournamentName}"`;
    const data = {
      type: 'registration',
      tournamentId,
      registrationId,
      action: 'view',
    };

    if (tokens.length > 0) {
      await messaging.sendEachForMulticast({
        notification: { title, body: bodyText },
        data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
        tokens,
      });
    }

    for (const userId of adminUserIds) {
      await db.collection('notifications').add({
        userId,
        title,
        body: bodyText,
        type: 'registration',
        data: { tournamentId, registrationId },
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({
      success: true,
      notified: adminUserIds.length,
    });
  } catch (error: unknown) {
    console.error('Error in notify-registration:', error);
    const message = error instanceof Error ? error.message : 'Failed to send notification';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
