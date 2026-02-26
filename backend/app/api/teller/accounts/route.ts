import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireAuth } from '../../../../lib/auth';
import { getEnrollment, fetchAndAggregateBalance, TellerApiError } from '../../../../lib/teller';

/**
 * GET /api/teller/accounts
 * Returns linked bank status and list of accounts (with balances) for the current user.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await requireAuth(request);
    if (authResult) return authResult;

    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const enrollment = await getEnrollment(user.id);
    if (!enrollment) {
      return NextResponse.json({
        linked: false,
        institutionName: null,
        accounts: [],
        totalBalance: null,
      });
    }

    const { totalBalance, accounts } = await fetchAndAggregateBalance(enrollment.accessToken);

    return NextResponse.json({
      linked: true,
      institutionName: enrollment.institutionName ?? null,
      linkedAt: enrollment.linkedAt,
      accounts,
      totalBalance,
    });
  } catch (error) {
    if (error instanceof TellerApiError) {
      const user = await getCurrentUser(request);
      console.error('GET /api/teller/accounts', {
        userId: user?.id,
        tellerStatus: error.statusCode,
        message: error.message,
      });
      if (error.statusCode === 401 || error.statusCode === 403) {
        console.error('Teller returned 401/403; check TELLER_API_BASE (sandbox vs production), cert, and appId.');
        return NextResponse.json(
          { error: 'Bank connection expired. Please reconnect your account.' },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: 'Unable to fetch accounts. Please try again later.' },
        { status: 502 }
      );
    }
    console.error('GET /api/teller/accounts error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounts' },
      { status: 500 }
    );
  }
}
