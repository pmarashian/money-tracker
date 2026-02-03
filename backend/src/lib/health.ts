/**
 * Financial health calculation for Money Tracker
 */

import { RecurringPattern, PayrollBonusEvent } from './recurring';
import { UserSettings } from './settings';

export interface HealthSettings {
  notEnoughThreshold: number; // e.g., 0 - below this is "not_enough"
  tooMuchThreshold: number;    // e.g., 500 - above this is "too_much"
}

export interface ProjectedTransaction {
  date: string;        // MM/DD/YYYY format
  amount: number;      // positive for inflow, negative for outflow
  description: string;
  type: 'payroll' | 'bonus' | 'recurring_outflow';
}

export interface HealthBreakdown {
  inflows: ProjectedTransaction[];
  outflows: ProjectedTransaction[];
  projectedBalance: number;
  calculationDate: string;
}

export interface HealthResult {
  status: 'not_enough' | 'enough' | 'too_much';
  projectedBalance: number;
  breakdown: HealthBreakdown;
}

/**
 * Calculate financial health based on payroll, bonus, and recurring patterns
 */
export function calculateFinancialHealth(
  payrollEvents: PayrollBonusEvent[],
  recurringPatterns: RecurringPattern[],
  settings: HealthSettings,
  userSettings: UserSettings,
  startDate: Date = new Date()
): HealthResult {
  // Find the next bonus date (use user setting if available, otherwise from payroll events)
  const nextBonusDate = userSettings.nextBonusDate && userSettings.nextBonusDate.trim() !== ''
    ? new Date(userSettings.nextBonusDate)
    : findNextBonusDate(payrollEvents, startDate);

  // Project inflows (paychecks and bonus)
  const inflows = projectInflows(payrollEvents, userSettings, startDate, nextBonusDate);

  // Project outflows (recurring expenses)
  const outflows = projectOutflows(recurringPatterns, startDate);

  // Calculate projected balance (sum of all projected transactions)
  const projectedBalance = inflows.reduce((sum, tx) => sum + tx.amount, 0) +
                          outflows.reduce((sum, tx) => sum + tx.amount, 0);

  // Determine health status based on thresholds
  let status: HealthResult['status'];
  if (projectedBalance < settings.notEnoughThreshold) {
    status = 'not_enough';
  } else if (projectedBalance > settings.tooMuchThreshold) {
    status = 'too_much';
  } else {
    status = 'enough';
  }

  const breakdown: HealthBreakdown = {
    inflows,
    outflows,
    projectedBalance,
    calculationDate: formatDate(startDate),
  };

  return {
    status,
    projectedBalance,
    breakdown,
  };
}

/**
 * Find the next bonus date from payroll/bonus events
 */
function findNextBonusDate(payrollEvents: PayrollBonusEvent[], fromDate: Date): Date | null {
  // Find all bonus events after the fromDate
  const futureBonuses = payrollEvents
    .filter(event => event.type === 'bonus')
    .map(event => new Date(event.date))
    .filter(date => date >= fromDate)
    .sort((a, b) => a.getTime() - b.getTime());

  return futureBonuses.length > 0 ? futureBonuses[0] : null;
}

/**
 * Project inflows: bi-weekly paychecks from startDate to nextBonusDate, plus the bonus
 */
function projectInflows(
  payrollEvents: PayrollBonusEvent[],
  userSettings: UserSettings,
  startDate: Date,
  nextBonusDate: Date | null
): ProjectedTransaction[] {
  const inflows: ProjectedTransaction[] = [];

  // Use user-specified paycheck amount, or fall back to historical data
  let paycheckAmount = userSettings.paycheckAmount;

  // If user didn't specify paycheck amount, calculate from historical data
  if (paycheckAmount <= 0) {
    const payrollAmounts = payrollEvents
      .filter(event => event.type === 'payroll')
      .map(event => event.amount)
      .sort((a, b) => b - a); // Sort descending to get most recent/typical amounts first

    if (payrollAmounts.length === 0) {
      // No payroll data available and no user setting
      return inflows;
    }

    // Use the median payroll amount as the typical paycheck
    const sortedPayroll = payrollAmounts.sort((a, b) => a - b);
    paycheckAmount = sortedPayroll[Math.floor(sortedPayroll.length / 2)];
  }

  // Determine bi-weekly pay schedule
  // For simplicity, assume paychecks occur every 14 days from the most recent payroll
  const recentPayrolls = payrollEvents
    .filter(event => event.type === 'payroll')
    .map(event => ({
      date: new Date(event.date),
      amount: event.amount
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime()); // Most recent first

  let payCycleStart = new Date(startDate);
  if (recentPayrolls.length > 0) {
    // Find the most recent payroll date and calculate the next pay date
    const lastPayDate = recentPayrolls[0].date;

    // If the last pay date is in the past, calculate when the next pay would be
    if (lastPayDate < startDate) {
      const daysSinceLastPay = Math.floor((startDate.getTime() - lastPayDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysUntilNextPay = 14 - (daysSinceLastPay % 14);
      payCycleStart = new Date(startDate);
      payCycleStart.setDate(payCycleStart.getDate() + daysUntilNextPay);
    } else {
      // If last pay date is in the future, use it
      payCycleStart = new Date(lastPayDate);
    }
  }

  // Project paychecks every 14 days until next bonus date (or 90 days if no bonus)
  const endDate = nextBonusDate || new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);

  for (let currentDate = new Date(payCycleStart);
       currentDate <= endDate;
       currentDate.setDate(currentDate.getDate() + 14)) {

    // Only add if it's in the future
    if (currentDate > startDate) {
      inflows.push({
        date: formatDate(currentDate),
        amount: paycheckAmount,
        description: 'Projected paycheck',
        type: 'payroll',
      });
    }
  }

  // Add the bonus if there's a next bonus date
  if (nextBonusDate && nextBonusDate > startDate) {
    // Use user-specified bonus amount, or fall back to historical data
    let bonusAmount = userSettings.bonusAmount;

    if (bonusAmount === undefined || bonusAmount <= 0) {
      // Find the bonus amount from historical data
      const bonusEvents = payrollEvents.filter(event => event.type === 'bonus');
      if (bonusEvents.length > 0) {
        // Use the most recent bonus amount
        const recentBonus = bonusEvents.sort((a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
        )[0];
        bonusAmount = recentBonus.amount;
      } else {
        // No bonus amount available
        bonusAmount = 0;
      }
    }

    if (bonusAmount > 0) {
      inflows.push({
        date: formatDate(nextBonusDate),
        amount: bonusAmount,
        description: 'Projected bonus',
        type: 'bonus',
      });
    }
  }

  return inflows;
}

/**
 * Project outflows based on recurring patterns
 */
function projectOutflows(recurringPatterns: RecurringPattern[], startDate: Date): ProjectedTransaction[] {
  const outflows: ProjectedTransaction[] = [];
  const endDate = new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days projection

  for (const pattern of recurringPatterns) {
    // Generate projected transactions for this pattern over the next 90 days
    const projectedDates = generateProjectedDates(pattern, startDate, endDate);

    for (const date of projectedDates) {
      outflows.push({
        date: formatDate(date),
        amount: pattern.amount, // This is already negative for debits
        description: pattern.name,
        type: 'recurring_outflow',
      });
    }
  }

  // Sort by date
  return outflows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/**
 * Generate projected dates for a recurring pattern
 */
function generateProjectedDates(
  pattern: RecurringPattern,
  startDate: Date,
  endDate: Date
): Date[] {
  const dates: Date[] = [];
  let currentDate = new Date(startDate);

  // For monthly patterns, use the typical day of month if available
  if (pattern.frequency === 'monthly' && pattern.typicalDayOfMonth) {
    // Start from the beginning of the current month
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

    while (currentDate <= endDate) {
      const projectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), pattern.typicalDayOfMonth);

      // Only add if it's in the future and within range
      if (projectedDate > startDate && projectedDate <= endDate) {
        dates.push(new Date(projectedDate));
      }

      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
  } else {
    // For other frequencies, use simple interval projection
    const intervalDays = getIntervalDays(pattern.frequency);
    currentDate = new Date(startDate);

    // Find the next occurrence after startDate
    if (pattern.predictedNextDate) {
      const nextPredicted = new Date(pattern.predictedNextDate);
      if (nextPredicted > startDate) {
        currentDate = new Date(nextPredicted);
      }
    }

    while (currentDate <= endDate) {
      if (currentDate > startDate) {
        dates.push(new Date(currentDate));
      }

      // Add the interval
      currentDate.setDate(currentDate.getDate() + intervalDays);
    }
  }

  return dates;
}

/**
 * Get interval days for a frequency
 */
function getIntervalDays(frequency: RecurringPattern['frequency']): number {
  switch (frequency) {
    case 'weekly': return 7;
    case 'biweekly': return 14;
    case 'monthly': return 30; // Approximate
    case 'quarterly': return 91; // Approximate
    case 'yearly': return 365; // Approximate
    default: return 30;
  }
}

/**
 * Format date as MM/DD/YYYY
 */
function formatDate(date: Date): string {
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Get default health settings
 */
export function getDefaultHealthSettings(): HealthSettings {
  return {
    notEnoughThreshold: 0,
    tooMuchThreshold: 500,
  };
}