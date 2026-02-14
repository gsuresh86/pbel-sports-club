import { NextResponse } from 'next/server';
import { getAdminMessaging } from '@/lib/firebase-admin';

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Send notification to specific user tokens
 */
export async function POST(request: Request) {
  try {
    const { tokens, notification, data } = await request.json() as {
      tokens: string[];
      notification: NotificationPayload;
      data?: Record<string, string>;
    };

    if (!tokens || tokens.length === 0) {
      return NextResponse.json(
        { error: 'No tokens provided' },
        { status: 400 }
      );
    }

    if (!notification.title || !notification.body) {
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
      tokens: tokens,
    };

    const messaging = getAdminMessaging();
    const response = await messaging.sendEachForMulticast(message);
    
    console.log(`Successfully sent ${response.successCount} notifications`);
    if (response.failureCount > 0) {
      console.error(`Failed to send ${response.failureCount} notifications`);
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
  } catch (error: any) {
    console.error('Error sending notification:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send notification' },
      { status: 500 }
    );
  }
}

