import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireAuth } from '../../../../lib/auth';
import { refreshBalanceForUser, TellerApiError } from '../../../../lib/teller';

/**
 * POST /api/teller/refresh-balance
 * Fetches current balance from Teller, updates user settings.balance, returns new balance and account list.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await requireAuth(request);
    if (authResult) return authResult;

    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const result = await refreshBalanceForUser(user.id);

    console.log('[teller] refresh-balance success:', {
      balance: result.balance,
      accountsCount: result.accounts.length,
    });

    return NextResponse.json({
      balance: result.balance,
      accounts: result.accounts,
    });
  } catch (error) {
    if (error instanceof TellerApiError) {
      const user = await getCurrentUser(request);
      console.error('POST /api/teller/refresh-balance', {
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
        { error: 'Unable to refresh balance. Please try again later.' },
        { status: 502 }
      );
    }
    if (error instanceof Error && error.message === 'No bank account linked') {
      return NextResponse.json(
        { error: 'No bank account linked' },
        { status: 400 }
      );
    }
    console.error('POST /api/teller/refresh-balance error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh balance' },
      { status: 500 }
    );
  }
}
