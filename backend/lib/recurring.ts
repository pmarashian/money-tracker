import { redisOps } from './redis';
import { NormalizedTransaction } from './csv';

export type Transaction = NormalizedTransaction;

export interface RecurringPattern {
  name: string;
  amount: number;
  frequency: 'monthly' | 'weekly' | 'biweekly';
  typicalDayOfMonth?: number;
}

export async function detectRecurringTransactions(userId: string): Promise<RecurringPattern[]> {
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

  // Group debits (negative amounts) by normalized merchant
  const debitGroups = new Map<string, { date: string; amount: number }[]>();

  for (const tx of transactions) {
    // Only consider debits (negative amounts)
    if (tx.amount >= 0) continue;

    const merchant = tx.normalizedMerchant;
    if (!debitGroups.has(merchant)) {
      debitGroups.set(merchant, []);
    }
    debitGroups.get(merchant)!.push({
      date: tx.postingDate,
      amount: tx.amount
    });
  }

  // Process groups with ≥2 points
  const recurringPatterns: RecurringPattern[] = [];

  for (const [merchant, points] of Array.from(debitGroups.entries())) {
    if (points.length >= 2) {
      // Sort by date
      points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Calculate date deltas in days
      const deltas: number[] = [];
      for (let i = 1; i < points.length; i++) {
        const prevDate = new Date(points[i - 1].date);
        const currDate = new Date(points[i].date);
        const deltaDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        deltas.push(deltaDays);
      }

      // Infer frequency from average delta
      const avgDelta = deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
      let frequency: 'weekly' | 'biweekly' | 'monthly';

      if (avgDelta <= 10) {
        frequency = 'weekly';
      } else if (avgDelta <= 18) {
        frequency = 'biweekly';
      } else {
        frequency = 'monthly';
      }

      // Check regularity with standard deviation threshold
      const mean = deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
      const variance = deltas.reduce((sum, delta) => sum + Math.pow(delta - mean, 2), 0) / deltas.length;
      const stdDev = Math.sqrt(variance);

      // Only consider regular if standard deviation is below threshold
      // Threshold: 3 days for weekly/biweekly, 5 days for monthly
      const threshold = frequency === 'monthly' ? 5 : 3;
      if (stdDev <= threshold) {
        // Compute typical amount (median)
        const amounts = points.map(p => p.amount).sort((a, b) => a - b);
        const typicalAmount = amounts.length % 2 === 0
          ? (amounts[amounts.length / 2 - 1] + amounts[amounts.length / 2]) / 2
          : amounts[Math.floor(amounts.length / 2)];

        // Calculate typical day of month (for monthly patterns)
        let typicalDayOfMonth: number | undefined;
        if (frequency === 'monthly') {
          const days = points.map(p => new Date(p.date).getDate());
          const avgDay = days.reduce((sum, day) => sum + day, 0) / days.length;
          typicalDayOfMonth = Math.round(avgDay);
        }

        recurringPatterns.push({
          name: merchant,
          amount: Math.abs(typicalAmount), // Convert back to positive for display
          frequency,
          typicalDayOfMonth
        });
      }
    }
  }

  return recurringPatterns;
}

export async function storeRecurringPatterns(userId: string, patterns: RecurringPattern[]): Promise<void> {
  const recurringKey = `mt:recurring:${userId}`;
  await redisOps.set(recurringKey, JSON.stringify(patterns));
}