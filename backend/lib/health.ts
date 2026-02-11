import { redisOps, redisKeys } from './redis';
import { RecurringPattern } from './recurring';
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
  /** Current balance from settings (for UI) */
  currentBalance: number;
  /** Next payday from settings, or null if unset (for UI) */
  nextPaycheckDate: string | null;
}

/**
 * Get user settings for health calculation
 */
async function getUserSettingsForHealth(userId: string): Promise<UserSettings> {
  return await getUserSettings(userId);
}

/** Normalize a date to start-of-day (local time) for date-only comparisons */
function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

/**
 * Calculate projected inflows from user settings
 * Includes bi-weekly paychecks and one bonus on next bonus date
 */
function calculateInflows(userSettings: UserSettings, projectionDays: number = 90): { paycheck: number; bonus: number } {
  const now = startOfDay(new Date());
  const endDate = new Date(now.getTime() + projectionDays * 24 * 60 * 60 * 1000);
  const nextBonusDate = startOfDay(new Date(userSettings.nextBonusDate));

  // Assume bi-weekly paychecks (14 days) - could be made configurable later
  const paycheckIntervalDays = 14;
  const paycheckAmount = userSettings.paycheckAmount;

  const firstPaycheckFromNow = new Date(now.getTime() + paycheckIntervalDays * 24 * 60 * 60 * 1000);
  const nextPaycheckDate = userSettings.nextPaycheckDate
    ? startOfDay(new Date(userSettings.nextPaycheckDate))
    : firstPaycheckFromNow;
  const firstPaycheck = nextPaycheckDate.getTime() <= now.getTime() ? firstPaycheckFromNow : nextPaycheckDate;

  let projectedPaychecks = 0;
  let currentDate = new Date(firstPaycheck);
  while (currentDate <= endDate) {
    // Exclude paycheck on nextBonusDate — that payday is the reset for the next cycle
    if (currentDate.getTime() < nextBonusDate.getTime()) {
      projectedPaychecks += paycheckAmount;
    }
    currentDate = new Date(currentDate.getTime() + paycheckIntervalDays * 24 * 60 * 60 * 1000);
  }

  // Add bonus if next bonus date is within projection period (date-only comparison)
  const projectedBonus = (nextBonusDate <= endDate && nextBonusDate >= now)
    ? (userSettings.bonusAmount || 0)
    : 0;

  return {
    paycheck: projectedPaychecks,
    bonus: projectedBonus
  };
}

/** Last day of month (1-indexed month). */
function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Count how many times a monthly expense (on typicalDayOfMonth) falls in [now, endDate].
 */
function countMonthlyOccurrences(now: Date, endDate: Date, typicalDayOfMonth: number): number {
  const day = Math.min(typicalDayOfMonth, 31);
  let count = 0;
  const cursor = new Date(now.getFullYear(), now.getMonth(), 1);
  while (cursor <= endDate) {
    const lastDay = getLastDayOfMonth(cursor.getFullYear(), cursor.getMonth() + 1);
    const occurrenceDay = Math.min(day, lastDay);
    const occurrence = new Date(cursor.getFullYear(), cursor.getMonth(), occurrenceDay);
    if (occurrence >= now && occurrence <= endDate) count += 1;
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return count;
}

/**
 * Calculate projected outflows from recurring expenses
 * Counts only occurrences that fall within [now, endDate] (position-in-month aware).
 */
function calculateOutflows(recurringPatterns: RecurringPattern[], projectionDays: number = 90): number {
  const now = startOfDay(new Date());
  const endDate = new Date(now.getTime() + projectionDays * 24 * 60 * 60 * 1000);

  let totalOutflows = 0;

  for (const pattern of recurringPatterns) {
    const { amount, frequency, typicalDayOfMonth } = pattern;

    switch (frequency) {
      case 'weekly': {
        // First occurrence = 7 days from now (this week's treated as passed); count in [now, endDate]
        const firstOccurrence = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const count = firstOccurrence <= endDate
          ? 1 + Math.floor((endDate.getTime() - firstOccurrence.getTime()) / (7 * 24 * 60 * 60 * 1000))
          : 0;
        totalOutflows += amount * count;
        break;
      }

      case 'biweekly': {
        const firstOccurrence = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        const count = firstOccurrence <= endDate
          ? 1 + Math.floor((endDate.getTime() - firstOccurrence.getTime()) / (14 * 24 * 60 * 60 * 1000))
          : 0;
        totalOutflows += amount * count;
        break;
      }

      case 'monthly': {
        const day = typicalDayOfMonth != null && typicalDayOfMonth >= 1 && typicalDayOfMonth <= 31
          ? typicalDayOfMonth
          : 15;
        totalOutflows += amount * countMonthlyOccurrences(now, endDate, day);
        break;
      }
    }
  }

  return totalOutflows;
}

const FALLBACK_PROJECTION_DAYS = 90;

/**
 * Compute projection period in days: from today to next bonus date (inclusive).
 * If nextBonusDate is missing or in the past, use a fixed fallback period.
 */
function getProjectionPeriodDays(userSettings: UserSettings): number {
  if (!userSettings.nextBonusDate) return FALLBACK_PROJECTION_DAYS;
  const now = startOfDay(new Date());
  const nextBonusDate = startOfDay(new Date(userSettings.nextBonusDate));
  if (nextBonusDate < now) return FALLBACK_PROJECTION_DAYS;
  const ms = nextBonusDate.getTime() - now.getTime();
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return Math.max(1, days);
}

/**
 * Calculate financial health projection
 * Uses present balance and projects to next bonus date.
 * projectedBalance = present balance + net flow over the period.
 */
export async function calculateFinancialHealth(userId: string): Promise<HealthProjection> {
  // Get user settings
  const userSettings = await getUserSettingsForHealth(userId);

  const projectionDays = getProjectionPeriodDays(userSettings);

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

  // Net flow over the period; projected balance = present balance + net flow
  const totalInflows = inflows.paycheck + inflows.bonus;
  const netFlow = totalInflows - outflows;
  const startingBalance = typeof userSettings.balance === 'number' && !isNaN(userSettings.balance)
    ? userSettings.balance
    : 0;
  const projectedBalance = startingBalance + netFlow;

  // Determine health status based on projected balance (at end of period)
  let status: 'not_enough' | 'enough' | 'too_much';
  if (projectedBalance < 0) {
    status = 'not_enough';
  } else if (projectedBalance > userSettings.paycheckAmount * 0.5) {
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
    currentBalance: startingBalance,
    nextPaycheckDate: userSettings.nextPaycheckDate ?? null,
  };
}