import { redisOps } from './redis';
import { RecurringPattern } from './recurring';
import { IncomeEvent } from './payroll';

export interface HealthSettings {
  lowThreshold: number; // not_enough if balance below this
  highThreshold: number; // too_much if balance above this
}

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

const DEFAULT_SETTINGS: HealthSettings = {
  lowThreshold: 0,
  highThreshold: 500,
};

/**
 * Get user health settings from Redis, with defaults
 */
async function getHealthSettings(userId: string): Promise<HealthSettings> {
  const settingsKey = `mt:settings:${userId}`;
  const settingsData = await redisOps.get(settingsKey);

  if (!settingsData) {
    return DEFAULT_SETTINGS;
  }

  try {
    const settings = JSON.parse(settingsData);
    return {
      lowThreshold: settings.lowThreshold ?? DEFAULT_SETTINGS.lowThreshold,
      highThreshold: settings.highThreshold ?? DEFAULT_SETTINGS.highThreshold,
    };
  } catch (error) {
    console.error('Error parsing health settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Calculate projected inflows from today until next bonus date
 * Includes bi-weekly paychecks and one bonus on bonus date
 */
function calculateInflows(payrollEvents: IncomeEvent[], projectionDays: number = 90): { payroll: number; bonus: number } {
  const now = new Date();
  const endDate = new Date(now.getTime() + projectionDays * 24 * 60 * 60 * 1000);

  // Find the most recent bonus and its amount
  const bonuses = payrollEvents.filter(event => !event.isPayroll);
  const lastBonus = bonuses.length > 0
    ? bonuses.reduce((latest, current) =>
        new Date(current.date) > new Date(latest.date) ? current : latest
      )
    : null;

  // Find regular payroll events to determine frequency and amount
  const payrolls = payrollEvents.filter(event => event.isPayroll);
  if (payrolls.length === 0) {
    return { payroll: 0, bonus: lastBonus ? lastBonus.amount : 0 };
  }

  // Calculate average payroll amount
  const totalPayroll = payrolls.reduce((sum, p) => sum + p.amount, 0);
  const avgPayroll = totalPayroll / payrolls.length;

  // Determine payroll frequency from dates
  // Sort payroll dates
  const payrollDates = payrolls
    .map(p => new Date(p.date))
    .sort((a, b) => a.getTime() - b.getTime());

  // Calculate average interval between paychecks
  let avgIntervalDays = 14; // Default to bi-weekly
  if (payrollDates.length >= 2) {
    const intervals: number[] = [];
    for (let i = 1; i < payrollDates.length; i++) {
      const days = Math.round((payrollDates[i].getTime() - payrollDates[i-1].getTime()) / (24 * 60 * 60 * 1000));
      intervals.push(days);
    }
    avgIntervalDays = intervals.reduce((sum, days) => sum + days, 0) / intervals.length;
    // Clamp to reasonable range (weekly to monthly)
    avgIntervalDays = Math.max(7, Math.min(31, avgIntervalDays));
  }

  // Project payroll payments from now until end date
  let projectedPayroll = 0;
  let currentDate = new Date(now);

  // Find the most recent payroll date to determine next paycheck
  const lastPayrollDate = payrollDates.length > 0 ? payrollDates[payrollDates.length - 1] : now;

  // Calculate next paycheck date
  let nextPaycheckDate = new Date(lastPayrollDate);
  if (nextPaycheckDate <= now) {
    // Next paycheck is after the last one by avg interval
    nextPaycheckDate = new Date(lastPayrollDate.getTime() + avgIntervalDays * 24 * 60 * 60 * 1000);
  }

  // Project paychecks
  currentDate = new Date(nextPaycheckDate);
  while (currentDate <= endDate) {
    projectedPayroll += avgPayroll;
    currentDate = new Date(currentDate.getTime() + avgIntervalDays * 24 * 60 * 60 * 1000);
  }

  // Add one bonus if we have bonus data
  const projectedBonus = lastBonus ? lastBonus.amount : 0;

  return {
    payroll: projectedPayroll,
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

  // Get settings
  const settings = await getHealthSettings(userId);

  // Get recurring patterns
  const recurringKey = `mt:recurring:${userId}`;
  const recurringData = await redisOps.get(recurringKey);
  let recurringPatterns: RecurringPattern[] = [];
  if (recurringData) {
    try {
      recurringPatterns = JSON.parse(recurringData);
    } catch (error) {
      console.error('Error parsing recurring patterns:', error);
    }
  }

  // Get payroll/bonus events
  const payrollKey = `mt:payroll:${userId}`;
  const payrollData = await redisOps.get(payrollKey);
  let payrollEvents: IncomeEvent[] = [];
  if (payrollData) {
    try {
      payrollEvents = JSON.parse(payrollData);
    } catch (error) {
      console.error('Error parsing payroll data:', error);
    }
  }

  // Calculate inflows
  const inflows = calculateInflows(payrollEvents, projectionDays);

  // Calculate outflows
  const outflows = calculateOutflows(recurringPatterns, projectionDays);

  // Calculate net flow and projected balance
  const totalInflows = inflows.payroll + inflows.bonus;
  const netFlow = totalInflows - outflows;
  const projectedBalance = netFlow;

  // Determine health status
  let status: 'not_enough' | 'enough' | 'too_much';
  if (projectedBalance < settings.lowThreshold) {
    status = 'not_enough';
  } else if (projectedBalance > settings.highThreshold) {
    status = 'too_much';
  } else {
    status = 'enough';
  }

  return {
    status,
    projectedBalance,
    breakdown: {
      inflows: {
        payroll: inflows.payroll,
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