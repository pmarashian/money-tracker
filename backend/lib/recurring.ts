import { redisOps } from './redis';

export interface Transaction {
  details: string;
  postingDate: string; // MM/DD/YYYY format
  description: string;
  amount: number;
  type: string;
  balance: number;
  checkOrSlipNumber?: string;
}

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
    // Create a pattern key based on description (simplified) and amount
    // In a real implementation, this would be more sophisticated
    const descriptionKey = tx.description.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
    const patternKey = `${descriptionKey}_${Math.abs(tx.amount)}`;

    if (!patterns.has(patternKey)) {
      patterns.set(patternKey, []);
    }
    patterns.get(patternKey)!.push(tx);
  }

  // Filter for patterns that appear multiple times
  const recurringPatterns: RecurringPattern[] = [];

  for (const [patternKey, txs] of patterns.entries()) {
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