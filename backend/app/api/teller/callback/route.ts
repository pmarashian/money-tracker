import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireAuth } from '../../../../lib/auth';
import { saveEnrollment } from '../../../../lib/teller';

/**
 * POST /api/teller/callback
 * Frontend sends enrollment_id and access_token after user completes Teller Connect.
 * We store the enrollment for the current user.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await requireAuth(request);
    if (authResult) return authResult;

    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let body: { enrollment_id?: string; enrollmentId?: string; access_token?: string; accessToken?: string; institution_name?: string; institutionName?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const enrollmentId = body.enrollment_id ?? body.enrollmentId;
    const accessToken = body.access_token ?? body.accessToken;
    const institutionName = body.institution_name ?? body.institutionName;

    if (!enrollmentId || !accessToken) {
      return NextResponse.json(
        { error: 'enrollment_id and access_token are required' },
        { status: 400 }
      );
    }

    await saveEnrollment(user.id, {
      enrollmentId,
      accessToken,
      institutionName: typeof institutionName === 'string' ? institutionName : undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/teller/callback error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
