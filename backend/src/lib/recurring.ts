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
  name: string;
  amount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  typicalDayOfMonth?: number; // For monthly patterns
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

  // Group transactions by normalized merchant name only
  // For each merchant, collect all {date, amount} pairs
  const merchantGroups = new Map<string, Array<{date: Date, amount: number, originalTx: Transaction}>>();

  for (const tx of transactions) {
    // Only process debits (negative amounts)
    if (tx.amount >= 0) continue;

    // Use normalized merchant if available, otherwise fall back to description
    const merchantName = tx.normalizedMerchant || tx.description;
    const key = merchantName.trim().toLowerCase();

    if (!merchantGroups.has(key)) {
      merchantGroups.set(key, []);
    }

    merchantGroups.get(key)!.push({
      date: new Date(tx.postingDate),
      amount: tx.amount,
      originalTx: tx
    });
  }

  // Analyze each merchant group for recurring patterns
  for (const [merchantName, dateAmountPairs] of merchantGroups) {
    if (dateAmountPairs.length < 2) {
      continue; // Need at least 2 transactions to detect a pattern
    }

    // Sort by date
    const sortedPairs = dateAmountPairs.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate date differences in days
    const dateDiffs: number[] = [];
    for (let i = 1; i < sortedPairs.length; i++) {
      const diff = Math.round(
        (sortedPairs[i].date.getTime() - sortedPairs[i-1].date.getTime()) / (1000 * 60 * 60 * 24)
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

    // Calculate typical amount (average)
    const amounts = sortedPairs.map(p => p.amount);
    const averageAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;

    // Use median amount as the representative amount
    const sortedAmounts = [...amounts].sort((a, b) => a - b);
    const medianAmount = sortedAmounts[Math.floor(sortedAmounts.length / 2)];

    // Calculate typical day of month for monthly patterns
    const typicalDayOfMonth = frequency === 'monthly' ? calculateTypicalDayOfMonth(sortedPairs) : undefined;

    // Predict next date
    const lastDate = sortedPairs[sortedPairs.length - 1].date;
    const nextDate = predictNextDate(lastDate, frequency);

    const pattern: RecurringPattern = {
      name: merchantName,
      amount: medianAmount,
      frequency,
      typicalDayOfMonth,
      confidence,
      averageAmount,
      transactionCount: sortedPairs.length,
      firstDate: formatDate(sortedPairs[0].date),
      lastDate: formatDate(sortedPairs[sortedPairs.length - 1].date),
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
 * Calculate the typical day of month for recurring transactions
 */
function calculateTypicalDayOfMonth(dateAmountPairs: Array<{date: Date, amount: number, originalTx: Transaction}>): number {
  const days = dateAmountPairs.map(p => p.date.getDate());

  // Find the most common day
  const dayCounts = new Map<number, number>();
  for (const day of days) {
    dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
  }

  let mostCommonDay = days[0];
  let maxCount = 0;
  for (const [day, count] of dayCounts) {
    if (count > maxCount) {
      maxCount = count;
      mostCommonDay = day;
    }
  }

  return mostCommonDay;
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