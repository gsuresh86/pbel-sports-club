import { NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/api-auth';
import { getAdminAuth } from '@/lib/firebase-admin';

/** Require a recent sign-in (after client-side reauthentication). */
const RECENT_AUTH_MAX_AGE_SECONDS = 5 * 60;

export async function POST(request: Request) {
  try {
    const decoded = await verifyAuthToken(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = Math.floor(Date.now() / 1000);
    if (now - decoded.auth_time > RECENT_AUTH_MAX_AGE_SECONDS) {
      return NextResponse.json(
        { error: 'Session expired. Please enter your current password and try again.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const newPassword = body?.newPassword;

    if (!newPassword || typeof newPassword !== 'string') {
      return NextResponse.json({ error: 'New password is required' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    await getAdminAuth().updateUser(decoded.uid, { password: newPassword });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error changing password:', error);
    const message = error instanceof Error ? error.message : 'Failed to change password';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
