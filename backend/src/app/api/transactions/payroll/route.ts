import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/auth';
import { redisOps, mtKeys } from '../../../../lib/redis';
import { PayrollBonusEvent } from '../../../../lib/recurring';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await requireAuth(request);

    // Get payroll/bonus events from Redis
    const payrollKey = mtKeys.payroll(user.id);
    const payrollJson = await redisOps.get(payrollKey);

    if (!payrollJson) {
      return NextResponse.json({ payrollBonus: [] });
    }

    const payrollBonus: PayrollBonusEvent[] = JSON.parse(payrollJson);

    return NextResponse.json({ payrollBonus });

  } catch (error) {
    console.error('Get payroll/bonus transactions error:', error);

    // Handle authentication errors
    if (error instanceof Error && (error as any).status === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}