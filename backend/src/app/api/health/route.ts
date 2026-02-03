import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/auth';
import { redisOps, mtKeys } from '../../../lib/redis';
import { calculateFinancialHealth, getDefaultHealthSettings, HealthResult } from '../../../lib/health';
import { RecurringPattern, PayrollBonusEvent } from '../../../lib/recurring';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await requireAuth(request);

    // Get recurring patterns from Redis
    const recurringKey = mtKeys.recurring(user.id);
    const recurringJson = await redisOps.get(recurringKey);
    const recurring: RecurringPattern[] = recurringJson ? JSON.parse(recurringJson) : [];

    // Get payroll/bonus events from Redis
    const payrollKey = mtKeys.payroll(user.id);
    const payrollJson = await redisOps.get(payrollKey);
    const payrollBonusEvents: PayrollBonusEvent[] = payrollJson ? JSON.parse(payrollJson) : [];

    // Get user settings from Redis (use defaults if not set)
    const settingsKey = mtKeys.settings(user.id);
    const settingsJson = await redisOps.get(settingsKey);
    const settings = settingsJson ? JSON.parse(settingsJson) : getDefaultHealthSettings();

    // Calculate financial health
    const healthResult: HealthResult = calculateFinancialHealth(
      payrollBonusEvents,
      recurring,
      settings
    );

    return NextResponse.json(healthResult);

  } catch (error) {
    console.error('Get health error:', error);

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