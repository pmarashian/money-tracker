import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireAuth } from '../../../../lib/auth';
import { deleteEnrollment } from '../../../../lib/teller';

/**
 * POST /api/teller/disconnect
 * Removes the Teller enrollment for the current user. Balance can still be edited manually.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await requireAuth(request);
    if (authResult) return authResult;

    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await deleteEnrollment(user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/teller/disconnect error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
