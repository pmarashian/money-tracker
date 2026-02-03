/**
 * Recurring transaction detection for Money Tracker
 */

export interface Transaction {
  details: string;
  postingDate: string; // MM/DD/YYYY format
  description: string;
  amount: number;
  type: string;
  balance: number;
  checkOrSlipNumber?: string;
  normalizedMerchant?: string; // Normalized merchant name for consistent recurring detection
}

export interface RecurringPattern {
  description: string;
  amount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  confidence: number; // 0-1, higher is more confident
  averageAmount: number;
  transactionCount: number;
  firstDate: string;
  lastDate: string;
  predictedNextDate: string;
}

/**
 * Detect recurring transactions from a list of transactions
 */
export function detectRecurringTransactions(transactions: Transaction[]): RecurringPattern[] {
  const patterns: RecurringPattern[] = [];

  // Group transactions by normalized merchant name (or description if not normalized) and amount
  // This ensures consistent recurring detection using clean merchant names
  const groups = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    // Use normalized merchant if available, otherwise fall back to description
    const merchantName = tx.normalizedMerchant || tx.description;
    const key = `${merchantName.trim().toLowerCase()}_${Math.round(tx.amount * 100)}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(tx);
  }

  // Analyze each group for recurring patterns
  for (const [key, groupTxns] of groups) {
    if (groupTxns.length < 3) {
      continue; // Need at least 3 transactions to detect a pattern
    }

    // Sort by date
    const sortedTxns = groupTxns.sort((a, b) =>
      new Date(a.postingDate).getTime() - new Date(b.postingDate).getTime()
    );

    // Calculate date differences in days
    const dateDiffs: number[] = [];
    for (let i = 1; i < sortedTxns.length; i++) {
      const diff = Math.round(
        (new Date(sortedTxns[i].postingDate).getTime() -
         new Date(sortedTxns[i-1].postingDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      dateDiffs.push(diff);
    }

    // Analyze frequency patterns
    const frequency = detectFrequency(dateDiffs);
    if (!frequency) {
      continue; // No clear recurring pattern
    }

    // Calculate confidence based on regularity
    const confidence = calculateConfidence(dateDiffs, frequency);

    if (confidence < 0.7) {
      continue; // Not confident enough
    }

    const averageAmount = sortedTxns.reduce((sum, tx) => sum + tx.amount, 0) / sortedTxns.length;

    // Predict next date
    const lastDate = new Date(sortedTxns[sortedTxns.length - 1].postingDate);
    const nextDate = predictNextDate(lastDate, frequency);

    const pattern: RecurringPattern = {
      // Use normalized merchant name for consistent pattern identification
      description: sortedTxns[0].normalizedMerchant || sortedTxns[0].description.trim(),
      amount: sortedTxns[0].amount,
      frequency,
      confidence,
      averageAmount,
      transactionCount: sortedTxns.length,
      firstDate: sortedTxns[0].postingDate,
      lastDate: sortedTxns[sortedTxns.length - 1].postingDate,
      predictedNextDate: formatDate(nextDate),
    };

    patterns.push(pattern);
  }

  // Sort by confidence (highest first)
  return patterns.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Detect the frequency pattern from date differences
 */
function detectFrequency(dateDiffs: number[]): RecurringPattern['frequency'] | null {
  if (dateDiffs.length === 0) return null;

  const avgDiff = dateDiffs.reduce((sum, diff) => sum + diff, 0) / dateDiffs.length;
  const variance = dateDiffs.reduce((sum, diff) => sum + Math.pow(diff - avgDiff, 2), 0) / dateDiffs.length;
  const stdDev = Math.sqrt(variance);

  // If variance is too high, no clear pattern
  if (stdDev > avgDiff * 0.3) {
    return null;
  }

  // Determine frequency based on average difference
  if (avgDiff >= 360 && avgDiff <= 375) return 'yearly';
  if (avgDiff >= 85 && avgDiff <= 100) return 'quarterly';
  if (avgDiff >= 25 && avgDiff <= 35) return 'monthly';
  if (avgDiff >= 12 && avgDiff <= 16) return 'biweekly';
  if (avgDiff >= 6 && avgDiff <= 9) return 'weekly';

  return null;
}

/**
 * Calculate confidence score based on regularity of intervals
 */
function calculateConfidence(dateDiffs: number[], expectedFrequency: RecurringPattern['frequency']): number {
  if (dateDiffs.length === 0) return 0;

  const expectedDiff = getExpectedDays(expectedFrequency);
  const deviations = dateDiffs.map(diff => Math.abs(diff - expectedDiff));
  const avgDeviation = deviations.reduce((sum, dev) => sum + dev, 0) / deviations.length;

  // Confidence decreases with average deviation
  const maxDeviation = expectedDiff * 0.2; // 20% tolerance
  const confidence = Math.max(0, 1 - (avgDeviation / maxDeviation));

  return Math.min(1, confidence);
}

/**
 * Get expected days for a frequency
 */
function getExpectedDays(frequency: RecurringPattern['frequency']): number {
  switch (frequency) {
    case 'weekly': return 7;
    case 'biweekly': return 14;
    case 'monthly': return 30;
    case 'quarterly': return 91;
    case 'yearly': return 365;
    default: return 30;
  }
}

/**
 * Predict the next date based on frequency
 */
function predictNextDate(lastDate: Date, frequency: RecurringPattern['frequency']): Date {
  const nextDate = new Date(lastDate);

  switch (frequency) {
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'biweekly':
      nextDate.setDate(nextDate.getDate() + 14);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + 3);
      break;
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
  }

  return nextDate;
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