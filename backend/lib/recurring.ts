import { redisOps } from './redis';
import { NormalizedTransaction } from './csv';

export type Transaction = NormalizedTransaction;

export interface RecurringPattern {
  id: string;
  description: string;
  amount: number;
  frequency: 'monthly' | 'weekly' | 'biweekly';
  lastSeen: string;
  count: number;
  estimatedNext: string;
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

  // Group transactions by similar characteristics
  const patterns = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    // Use normalized merchant name for consistent pattern matching
    const patternKey = `${tx.normalizedMerchant}_${Math.abs(tx.amount)}`;

    if (!patterns.has(patternKey)) {
      patterns.set(patternKey, []);
    }
    patterns.get(patternKey)!.push(tx);
  }

  // Filter for patterns that appear multiple times
  const recurringPatterns: RecurringPattern[] = [];

  for (const [patternKey, txs] of Array.from(patterns.entries())) {
    if (txs.length >= 3) { // At least 3 occurrences to be considered recurring
      const sortedTxs = txs.sort((a: Transaction, b: Transaction) =>
        new Date(a.postingDate).getTime() - new Date(b.postingDate).getTime()
      );

      // Calculate frequency (simplified - assuming monthly for now)
      const frequency = 'monthly' as const;

      // Estimate next occurrence
      const lastTx = sortedTxs[sortedTxs.length - 1];
      const lastDate = new Date(lastTx.postingDate);
      const estimatedNext = new Date(lastDate);
      estimatedNext.setMonth(estimatedNext.getMonth() + 1);

      recurringPatterns.push({
        id: patternKey,
        description: sortedTxs[0].description,
        amount: sortedTxs[0].amount,
        frequency,
        lastSeen: lastTx.postingDate,
        count: txs.length,
        estimatedNext: estimatedNext.toISOString().split('T')[0].replace(/-/g, '/'), // Convert to MM/DD/YYYY
      });
    }
  }

  return recurringPatterns;
}

export async function storeRecurringPatterns(userId: string, patterns: RecurringPattern[]): Promise<void> {
  const recurringKey = `mt:recurring:${userId}`;
  await redisOps.set(recurringKey, JSON.stringify(patterns));
}