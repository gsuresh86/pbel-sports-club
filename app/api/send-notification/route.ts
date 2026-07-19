import { NextResponse } from 'next/server';
import { canManageUsers, getCallerUser } from '@/lib/api-auth';
import { getAdminMessaging, isAdminConfigured } from '@/lib/firebase-admin';

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Send notification to specific user tokens (staff/admin only).
 */
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

    const isStaff =
      canManageUsers(caller) ||
      caller.role === 'staff' ||
      caller.role === 'referee' ||
      (caller.assignedTournaments?.length ?? 0) > 0;

    if (!isStaff) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { tokens, notification, data } = (await request.json()) as {
      tokens: string[];
      notification: NotificationPayload;
      data?: Record<string, string>;
    };

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({ error: 'No tokens provided' }, { status: 400 });
    }

    if (!notification?.title || !notification?.body) {
      return NextResponse.json(
        { error: 'Notification title and body are required' },
        { status: 400 }
      );
    }

    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      tokens,
    };

    const messaging = getAdminMessaging();
    const response = await messaging.sendEachForMulticast(message);

    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`Failed token ${tokens[idx]}:`, resp.error);
        }
      });
    }

    return NextResponse.json({
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
    });
  } catch (error: unknown) {
    console.error('Error sending notification:', error);
    const message = error instanceof Error ? error.message : 'Failed to send notification';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
