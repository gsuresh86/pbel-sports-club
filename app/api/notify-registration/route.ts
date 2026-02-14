import { NextResponse } from 'next/server';
import { getAdminFirestore, getAdminMessaging } from '@/lib/firebase-admin';

/**
 * Notify tournament admin(s) about a new registration.
 * Runs on the server with Admin SDK so it works for public (unauthenticated) registrations.
 */
export async function POST(request: Request) {
  try {
    let db;
    let messaging;
    try {
      db = getAdminFirestore();
      messaging = getAdminMessaging();
    } catch (initError) {
      const msg = initError instanceof Error ? initError.message : 'Firebase Admin not configured';
      console.error('Firebase Admin init:', msg);
      return NextResponse.json(
        { error: 'Notifications are not configured on the server. Add Firebase Admin env vars to .env.local.' },
        { status: 503 }
      );
    }

    const body = await request.json() as {
      tournamentId: string;
      tournamentName: string;
      playerName: string;
    };
    const { tournamentId, tournamentName, playerName } = body;

    if (!tournamentId || !tournamentName || !playerName) {
      return NextResponse.json(
        { error: 'tournamentId, tournamentName, and playerName are required' },
        { status: 400 }
      );
    }
    const adminUserIds: string[] = [];

    const tournamentRef = db.collection('tournaments').doc(tournamentId);
    const tournamentSnap = await tournamentRef.get();
    if (!tournamentSnap.exists) {
      return NextResponse.json({ success: true, notified: 0 }); // no-op
    }

    const tournamentData = tournamentSnap.data();
    // Increment participant count server-side (client cannot update tournaments without auth)
    const currentParticipants = (tournamentData?.currentParticipants ?? 0) + 1;
    await tournamentRef.update({ currentParticipants });
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
      action: 'view',
    };

    if (tokens.length > 0) {
      const message = {
        notification: { title, body: bodyText },
        data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
        tokens,
      };
      await messaging.sendEachForMulticast(message);
    }

    for (const userId of adminUserIds) {
      await db.collection('notifications').add({
        userId,
        title,
        body: bodyText,
        type: 'registration',
        data: { tournamentId },
        read: false,
        createdAt: new Date(),
      });
    }

    return NextResponse.json({
      success: true,
      notified: adminUserIds.length,
    });
  } catch (error: unknown) {
    console.error('Error in notify-registration:', error);
    const message = error instanceof Error ? error.message : 'Failed to send notification';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
