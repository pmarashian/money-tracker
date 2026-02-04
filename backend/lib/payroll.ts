import { redisOps } from './redis';
import { Transaction } from './csv';

export interface PayrollEvent {
  date: string;
  amount: number;
  description: string;
  isPayroll: true;
}

export interface BonusEvent {
  date: string;
  amount: number;
  description: string;
  isPayroll: false;
}

export type IncomeEvent = PayrollEvent | BonusEvent;

/**
 * Detect payroll and bonus events from transactions
 * Logic:
 * - Identify credits (positive amounts) as potential income
 * - Credits with PAYROLL or DIRECT DEP in description are payroll
 * - Other credits that are outliers (>2× median payroll amount) are bonus
 * - All other credits are treated as bonus
 */
export async function detectPayrollAndBonus(userId: string): Promise<IncomeEvent[]> {
  // Get transactions from Redis
  const transactionsKey = `mt:txns:${userId}`;
  const transactionsData = await redisOps.get(transactionsKey);

  if (!transactionsData) {
    return [];
  }

  let transactions: Transaction[];
  try {
    transactions = JSON.parse(transactionsData);
  } catch (error) {
    console.error('Error parsing transactions data:', error);
    return [];
  }

  // Filter credits (positive amounts)
  const credits = transactions.filter(tx => tx.amount > 0);

  if (credits.length === 0) {
    return [];
  }

  // Identify payroll credits based on description patterns
  const payrollCredits: Transaction[] = [];
  const potentialBonusCredits: Transaction[] = [];

  for (const tx of credits) {
    const description = tx.description.toLowerCase();

    // Check for payroll indicators
    if (description.includes('payroll') || description.includes('direct dep')) {
      payrollCredits.push(tx);
    } else {
      potentialBonusCredits.push(tx);
    }
  }

  // Calculate median payroll amount
  const payrollAmounts = payrollCredits.map(tx => tx.amount).sort((a, b) => a - b);
  const medianPayroll = payrollAmounts.length > 0
    ? (payrollAmounts.length % 2 === 0
        ? (payrollAmounts[payrollAmounts.length / 2 - 1] + payrollAmounts[payrollAmounts.length / 2]) / 2
        : payrollAmounts[Math.floor(payrollAmounts.length / 2)])
    : 0;

  // Classify potential bonus credits
  const bonusCredits: Transaction[] = [];
  const additionalPayrollCredits: Transaction[] = [];

  for (const tx of potentialBonusCredits) {
    // If median payroll exists and this amount is ≤2× median, treat as payroll
    // Otherwise treat as bonus
    if (medianPayroll > 0 && tx.amount <= medianPayroll * 2) {
      additionalPayrollCredits.push(tx);
    } else {
      bonusCredits.push(tx);
    }
  }

  // Combine all payroll credits
  const allPayrollCredits = [...payrollCredits, ...additionalPayrollCredits];

  // Create income events
  const incomeEvents: IncomeEvent[] = [];

  // Add payroll events
  for (const tx of allPayrollCredits) {
    incomeEvents.push({
      date: tx.postingDate,
      amount: tx.amount,
      description: tx.description,
      isPayroll: true,
    });
  }

  // Add bonus events
  for (const tx of bonusCredits) {
    incomeEvents.push({
      date: tx.postingDate,
      amount: tx.amount,
      description: tx.description,
      isPayroll: false,
    });
  }

  // Sort by date (newest first)
  incomeEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return incomeEvents;
}

/**
 * Store payroll and bonus events in Redis
 */
export async function storePayrollAndBonus(userId: string, events: IncomeEvent[]): Promise<void> {
  const payrollKey = `mt:payroll:${userId}`;
  await redisOps.set(payrollKey, JSON.stringify(events));
}