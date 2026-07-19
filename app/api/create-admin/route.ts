import { NextResponse } from 'next/server';

/**
 * Bootstrap admin creation is intentionally disabled.
 * Use signup + super-admin role grant, or authenticated /api/create-user.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'This endpoint is disabled. Use /signup then grant admin via Firebase Console, or /api/create-user as a super-admin.',
    },
    { status: 403 }
  );
}
