import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '../../../lib/auth';
import { calculateFinancialHealth } from '../../../lib/health';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Calculate financial health
    const health = await calculateFinancialHealth(user.id);

    return NextResponse.json({
      status: health.status,
      projectedBalance: health.projectedBalance,
      breakdown: health.breakdown,
      projectionPeriodDays: health.projectionPeriodDays,
      currentBalance: health.currentBalance,
      nextPaycheckDate: health.nextPaycheckDate,
    });

  } catch (error) {
    console.error('Health endpoint error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}