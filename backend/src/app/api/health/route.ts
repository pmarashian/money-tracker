import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/auth';
import { redisOps, mtKeys } from '../../../lib/redis';
import { calculateFinancialHealth, getDefaultHealthSettings, HealthResult } from '../../../lib/health';
import { getDefaultUserSettings, UserSettings } from '../../../lib/settings';
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

    // Get settings from Redis (use defaults if not set)
    const settingsKey = mtKeys.settings(user.id);
    const settingsJson = await redisOps.get(settingsKey);

    // Parse as both health settings and user settings (they're stored together)
    const healthSettings = settingsJson ? JSON.parse(settingsJson) : getDefaultHealthSettings();
    const userSettings = settingsJson ? JSON.parse(settingsJson) : getDefaultUserSettings();

    // Calculate financial health
    const healthResult: HealthResult = calculateFinancialHealth(
      payrollBonusEvents,
      recurring,
      healthSettings,
      userSettings
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