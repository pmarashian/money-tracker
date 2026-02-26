import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireAuth } from '../../../../lib/auth';
import { getApplicationId } from '../../../../lib/teller';

/**
 * GET /api/teller/connect-url
 * Returns the Teller Application ID for the frontend.
 * The frontend uses the Teller Connect script (cdn.teller.io/connect/connect.js)
 * and TellerConnect.setup({ applicationId, products: ["balance"], onSuccess, onExit }),
 * then tellerConnect.open() to open Connect in-page (no redirect).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await requireAuth(request);
    if (authResult) return authResult;

    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const applicationId = getApplicationId();
    return NextResponse.json({ applicationId });
  } catch (error) {
    if (error instanceof Error && error.message.includes('TELLER_APPLICATION_ID')) {
      return NextResponse.json(
        { error: 'Bank connection is not configured' },
        { status: 503 }
      );
    }
    console.error('GET /api/teller/connect-url error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
