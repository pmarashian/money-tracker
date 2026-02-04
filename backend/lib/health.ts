import { redisOps, redisKeys } from './redis';
import { RecurringPattern } from './recurring';
import { IncomeEvent } from './payroll';
import { UserSettings, getUserSettings } from './settings';

export interface HealthBreakdown {
  inflows: {
    payroll: number;
    bonus: number;
    total: number;
  };
  outflows: {
    recurring: number;
    total: number;
  };
  netFlow: number;
}

export interface HealthProjection {
  status: 'not_enough' | 'enough' | 'too_much';
  projectedBalance: number;
  breakdown: HealthBreakdown;
  projectionPeriodDays: number;
}

/**
 * Get user settings for health calculation
 */
async function getUserSettingsForHealth(userId: string): Promise<UserSettings> {
  return await getUserSettings(userId);
}

/**
 * Calculate projected inflows from user settings
 * Includes bi-weekly paychecks and one bonus on next bonus date
 */
function calculateInflows(userSettings: UserSettings, projectionDays: number = 90): { paycheck: number; bonus: number } {
  const now = new Date();
  const endDate = new Date(now.getTime() + projectionDays * 24 * 60 * 60 * 1000);
  const nextBonusDate = new Date(userSettings.nextBonusDate);

  // Assume bi-weekly paychecks (14 days) - could be made configurable later
  const paycheckIntervalDays = 14;
  const paycheckAmount = userSettings.paycheckAmount;

  // Project paycheck payments from now until end date
  let projectedPaychecks = 0;
  let currentDate = new Date(now);

  // Calculate next paycheck date (assume bi-weekly from now)
  let nextPaycheckDate = new Date(now);
  // For simplicity, assume next paycheck is 14 days from now
  nextPaycheckDate = new Date(now.getTime() + paycheckIntervalDays * 24 * 60 * 60 * 1000);

  // Project paychecks
  currentDate = new Date(nextPaycheckDate);
  while (currentDate <= endDate) {
    projectedPaychecks += paycheckAmount;
    currentDate = new Date(currentDate.getTime() + paycheckIntervalDays * 24 * 60 * 60 * 1000);
  }

  // Add bonus if next bonus date is within projection period
  const projectedBonus = (nextBonusDate <= endDate && nextBonusDate >= now)
    ? (userSettings.bonusAmount || 0)
    : 0;

  return {
    paycheck: projectedPaychecks,
    bonus: projectedBonus
  };
}

/**
 * Calculate projected outflows from recurring expenses
 */
function calculateOutflows(recurringPatterns: RecurringPattern[], projectionDays: number = 90): number {
  const now = new Date();
  const endDate = new Date(now.getTime() + projectionDays * 24 * 60 * 60 * 1000);

  let totalOutflows = 0;

  for (const pattern of recurringPatterns) {
    const { amount, frequency, typicalDayOfMonth } = pattern;

    switch (frequency) {
      case 'weekly':
        // Count weeks in projection period
        const weeksInPeriod = Math.floor(projectionDays / 7);
        totalOutflows += amount * weeksInPeriod;
        break;

      case 'biweekly':
        // Count bi-weeks in projection period
        const biweeksInPeriod = Math.floor(projectionDays / 14);
        totalOutflows += amount * biweeksInPeriod;
        break;

      case 'monthly':
        // Count months in projection period
        const monthsInPeriod = Math.floor(projectionDays / 30);
        totalOutflows += amount * monthsInPeriod;
        break;
    }
  }

  return totalOutflows;
}

/**
 * Calculate financial health projection
 */
export async function calculateFinancialHealth(userId: string): Promise<HealthProjection> {
  const projectionDays = 90; // 3 months projection

  // Get user settings
  const userSettings = await getUserSettingsForHealth(userId);

  // Get recurring patterns
  const recurringKey = redisKeys.recurring(userId);
  const recurringData = await redisOps.get(recurringKey);
  let recurringPatterns: RecurringPattern[] = [];
  if (recurringData) {
    try {
      recurringPatterns = JSON.parse(recurringData);
    } catch (error) {
      console.error('Error parsing recurring patterns:', error);
    }
  }

  // Calculate inflows from user settings
  const inflows = calculateInflows(userSettings, projectionDays);

  // Calculate outflows
  const outflows = calculateOutflows(recurringPatterns, projectionDays);

  // Calculate net flow and projected balance
  const totalInflows = inflows.paycheck + inflows.bonus;
  const netFlow = totalInflows - outflows;
  const projectedBalance = netFlow;

  // Determine health status based on net flow
  // If net flow is positive, user has enough; if negative, not enough
  let status: 'not_enough' | 'enough' | 'too_much';
  if (netFlow < 0) {
    status = 'not_enough';
  } else if (netFlow > userSettings.paycheckAmount * 0.5) { // More than half paycheck surplus
    status = 'too_much';
  } else {
    status = 'enough';
  }

  return {
    status,
    projectedBalance,
    breakdown: {
      inflows: {
        payroll: inflows.paycheck,
        bonus: inflows.bonus,
        total: totalInflows,
      },
      outflows: {
        recurring: outflows,
        total: outflows,
      },
      netFlow,
    },
    projectionPeriodDays: projectionDays,
  };
}