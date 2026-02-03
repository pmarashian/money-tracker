import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/auth';
import { redisOps, mtKeys } from '../../../../lib/redis';
import { RecurringPattern } from '../../../../lib/recurring';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await requireAuth(request);

    // Get recurring patterns from Redis
    const recurringKey = mtKeys.recurring(user.id);
    const recurringJson = await redisOps.get(recurringKey);

    if (!recurringJson) {
      return NextResponse.json({ recurring: [] });
    }

    const recurring: RecurringPattern[] = JSON.parse(recurringJson);

    return NextResponse.json({ recurring });

  } catch (error) {
    console.error('Get recurring transactions error:', error);

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