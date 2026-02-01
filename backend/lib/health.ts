import { UserSettings } from './redis';
import { RecurringExpense, PayrollEvent } from './recurring';

export interface FinancialHealthProjection {
  currentBalance: number;
  projectedBalance: number;
  totalInflows: number;
  totalOutflows: number;
  inflows: InflowProjection[];
  outflows: OutflowProjection[];
  status: FinancialHealthStatus;
  bonusDate: string;
  daysUntilBonus: number;
  thresholdEnough: number;
  thresholdTooMuch: number;
}

export interface InflowProjection {
  type: 'paycheck' | 'bonus';
  amount: number;
  date: string;
  description: string;
}

export interface OutflowProjection {
  merchantName: string;
  amount: number;
  frequency: string;
  date: string;
  description: string;
}

export type FinancialHealthStatus = 'not_enough' | 'enough' | 'too_much';

/**
 * Configuration for financial health thresholds
 */
export interface FinancialHealthConfig {
  thresholdEnough: number; // Minimum balance needed at bonus date
  thresholdTooMuch: number; // Maximum balance considered "too much"
}

/**
 * Default configuration for financial health thresholds
 */
const DEFAULT_CONFIG: FinancialHealthConfig = {
  thresholdEnough: 0,
  thresholdTooMuch: 500,
};

/**
 * Calculates the number of days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  return Math.floor((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Adds days to a date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Gets the next occurrence of a specific day of month
 */
function getNextDayOfMonth(currentDate: Date, targetDay: number): Date {
  const currentDay = currentDate.getDate();

  if (currentDay <= targetDay) {
    // Target day hasn't passed this month, use current month
    return new Date(currentDate.getFullYear(), currentDate.getMonth(), targetDay);
  } else {
    // Target day has passed, use next month
    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, targetDay);
    return nextMonth;
  }
}

/**
 * Projects bi-weekly paychecks until the bonus date
 */
function projectPaychecks(
  currentBalance: number,
  paycheckAmount: number,
  bonusDate: Date,
  today: Date = new Date()
): InflowProjection[] {
  const paychecks: InflowProjection[] = [];

  // Bi-weekly paychecks occur every 14 days
  const PAYCHECK_INTERVAL_DAYS = 14;

  // Find the next paycheck date (assuming paychecks happen on the same day of the week)
  // For simplicity, we'll assume paychecks happen every 14 days from today
  let nextPaycheckDate = new Date(today);

  // Calculate how many paychecks fit before the bonus date
  while (nextPaycheckDate < bonusDate) {
    paychecks.push({
      type: 'paycheck',
      amount: paycheckAmount,
      date: nextPaycheckDate.toISOString().split('T')[0],
      description: `Bi-weekly paycheck - $${paycheckAmount}`,
    });

    // Move to next paycheck date
    nextPaycheckDate = addDays(nextPaycheckDate, PAYCHECK_INTERVAL_DAYS);
  }

  return paychecks;
}

/**
 * Projects recurring expenses until the bonus date
 */
function projectRecurringExpenses(
  recurringExpenses: RecurringExpense[],
  bonusDate: Date,
  today: Date = new Date()
): OutflowProjection[] {
  const outflows: OutflowProjection[] = [];

  for (const expense of recurringExpenses) {
    const projectedExpenses = projectSingleRecurringExpense(expense, bonusDate, today);
    outflows.push(...projectedExpenses);
  }

  return outflows;
}

/**
 * Projects a single recurring expense until the bonus date
 */
function projectSingleRecurringExpense(
  expense: RecurringExpense,
  bonusDate: Date,
  today: Date = new Date()
): OutflowProjection[] {
  const outflows: OutflowProjection[] = [];

  // Determine the interval in days based on frequency
  let intervalDays: number;
  switch (expense.frequency) {
    case 'weekly':
      intervalDays = 7;
      break;
    case 'bi-weekly':
      intervalDays = 14;
      break;
    case 'monthly':
      intervalDays = 30; // Approximation, we'll use day-of-month for better accuracy
      break;
    case 'yearly':
      intervalDays = 365;
      break;
    default:
      intervalDays = 30;
  }

  if (expense.frequency === 'monthly' && expense.typicalDayOfMonth) {
    // For monthly expenses, use the typical day of month for more accurate projection
    let nextExpenseDate = getNextDayOfMonth(today, expense.typicalDayOfMonth);

    while (nextExpenseDate <= bonusDate) {
      outflows.push({
        merchantName: expense.merchantName,
        amount: expense.amount,
        frequency: expense.frequency,
        date: nextExpenseDate.toISOString().split('T')[0],
        description: `${expense.merchantName} - $${expense.amount} (${expense.frequency})`,
      });

      // Move to next month
      nextExpenseDate = getNextDayOfMonth(
        new Date(nextExpenseDate.getFullYear(), nextExpenseDate.getMonth() + 1, 1),
        expense.typicalDayOfMonth
      );
    }
  } else {
    // For other frequencies, use simple interval calculation
    let nextExpenseDate = new Date(today);

    // Start from the next occurrence after today
    nextExpenseDate = addDays(nextExpenseDate, intervalDays);

    while (nextExpenseDate <= bonusDate) {
      outflows.push({
        merchantName: expense.merchantName,
        amount: expense.amount,
        frequency: expense.frequency,
        date: nextExpenseDate.toISOString().split('T')[0],
        description: `${expense.merchantName} - $${expense.amount} (${expense.frequency})`,
      });

      nextExpenseDate = addDays(nextExpenseDate, intervalDays);
    }
  }

  return outflows;
}

/**
 * Calculates the projected financial health
 */
export function calculateFinancialHealth(
  userSettings: UserSettings,
  recurringExpenses: RecurringExpense[],
  config: FinancialHealthConfig = DEFAULT_CONFIG
): FinancialHealthProjection {
  // Extract required settings
  const currentBalance = userSettings.balance || 0;
  const paycheckAmount = userSettings.paycheckAmount || 0;
  const bonusDateStr = userSettings.nextBonusDate;
  const bonusAmount = userSettings.bonusAmount || 0;

  if (!bonusDateStr) {
    throw new Error('Next bonus date is required for financial health calculation');
  }

  const bonusDate = new Date(bonusDateStr);
  const today = new Date();

  // Validate bonus date is in the future
  if (bonusDate <= today) {
    throw new Error('Bonus date must be in the future');
  }

  // Project inflows (paychecks + bonus)
  const paychecks = projectPaychecks(currentBalance, paycheckAmount, bonusDate, today);

  const bonusInflow: InflowProjection = {
    type: 'bonus',
    amount: bonusAmount,
    date: bonusDateStr,
    description: `Bonus - $${bonusAmount}`,
  };

  const allInflows = [...paychecks, bonusInflow];
  const totalInflows = allInflows.reduce((sum, inflow) => sum + inflow.amount, 0);

  // Project outflows (recurring expenses)
  const outflows = projectRecurringExpenses(recurringExpenses, bonusDate, today);
  const totalOutflows = outflows.reduce((sum, outflow) => sum + outflow.amount, 0);

  // Calculate projected balance
  const projectedBalance = currentBalance + totalInflows - totalOutflows;

  // Determine status
  let status: FinancialHealthStatus;
  if (projectedBalance < config.thresholdEnough) {
    status = 'not_enough';
  } else if (projectedBalance > config.thresholdTooMuch) {
    status = 'too_much';
  } else {
    status = 'enough';
  }

  // Calculate days until bonus
  const daysUntilBonus = daysBetween(today, bonusDate);

  return {
    currentBalance,
    projectedBalance,
    totalInflows,
    totalOutflows,
    inflows: allInflows,
    outflows,
    status,
    bonusDate: bonusDateStr,
    daysUntilBonus,
    thresholdEnough: config.thresholdEnough,
    thresholdTooMuch: config.thresholdTooMuch,
  };
}