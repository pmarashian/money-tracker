import { Transaction } from './redis';

// Interfaces for recurring detection results
export interface RecurringExpense {
  id: string;
  merchantName: string;
  amount: number;
  frequency: 'weekly' | 'bi-weekly' | 'monthly' | 'yearly';
  typicalDayOfMonth?: number;
  isRecurring: boolean;
  confidence: number; // 0-1, how confident we are it's recurring
  transactionCount: number;
  firstSeen: string;
  lastSeen: string;
}

export interface PayrollEvent {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: 'payroll' | 'bonus';
  confidence: number;
}

export interface RecurringDetectionResult {
  recurringExpenses: RecurringExpense[];
  payrollEvents: PayrollEvent[];
  processedAt: string;
}

/**
 * Normalizes transaction descriptions to extract merchant names
 * Handles patterns like PwP, DUKEENERGY, APPLECARD, etc.
 */
export function normalizeDescription(description: string): string {
  if (!description) return '';

  // Convert to lowercase and trim
  let normalized = description.toLowerCase().trim();

  // Handle specific patterns
  if (normalized.includes('pwp')) {
    // PwP MERCHANT NAME Privacycom...
    // Extract merchant name after PwP
    const pwpMatch = normalized.match(/pwp\s+([^]*?)(?:\s+privacycom|$)/);
    if (pwpMatch) {
      normalized = pwpMatch[1].trim();
    }
  } else if (normalized.includes('dukenergy') || normalized.includes('dukeenergy')) {
    // DUKEENERGY BILL PAY...
    normalized = 'duke energy';
  } else if (normalized.includes('applecard')) {
    // APPLECARD GSBANK...
    normalized = 'apple card';
  } else if (normalized.includes('direct dep') || normalized.includes('deposit')) {
    // Direct deposits - keep as is for payroll detection
    return normalized;
  } else if (normalized.includes('payroll')) {
    // Payroll entries - keep as is
    return normalized;
  }

  // Remove common suffixes and prefixes
  const removePatterns = [
    /\s+bill\s+pay.*/,
    /\s+gsbank.*/,
    /\s+privacycom.*/,
    /\s+online\s+payment.*/,
    /\s+automatic\s+payment.*/,
    /\s+transfer.*/,
    /\s+fee.*/,
    /\s+charge.*/,
    /\s+withdrawal.*/,
    /\s+deposit.*/,
    /\s+store\s+#\d+.*/, // Remove "store #1234" patterns
    /\s+#\d+.*/, // Remove standalone "#1234" patterns
  ];

  for (const pattern of removePatterns) {
    normalized = normalized.replace(pattern, '');
  }

  // Clean up extra spaces and special characters
  normalized = normalized
    .replace(/[^\w\s]/g, ' ') // Replace special chars with spaces
    .replace(/\s+/g, ' ') // Normalize multiple spaces
    .trim();

  // Handle common abbreviations
  const abbreviations: Record<string, string> = {
    'amzn': 'amazon',
    'mcdonalds': 'mcdonald\'s',
    'mcd': 'mcdonald\'s',
    'tgt': 'target',
    'walmart': 'walmart',
    'costco': 'costco',
    'cvs': 'cvs pharmacy',
    'walgreens': 'walgreens',
    'starbucks': 'starbucks',
    'subway': 'subway',
    'dominos': 'domino\'s pizza',
    'pizza hut': 'pizza hut',
    'netflix': 'netflix',
    'hulu': 'hulu',
    'disney': 'disney plus',
    'spotify': 'spotify',
    'apple': 'apple',
    'google': 'google',
    'microsoft': 'microsoft',
    'att': 'at&t',
    'verizon': 'verizon',
    'comcast': 'comcast',
    'spectrum': 'spectrum',
    'xfinity': 'xfinity',
  };

  const words = normalized.split(' ');
  const expandedWords = words.map(word => abbreviations[word] || word);
  normalized = expandedWords.join(' ');

  return normalized || 'unknown';
}

/**
 * Groups transactions by normalized merchant name
 */
export function groupTransactionsByMerchant(transactions: Transaction[]): Record<string, Transaction[]> {
  const groups: Record<string, Transaction[]> = {};

  for (const transaction of transactions) {
    // Only process debits (expenses) for recurring detection
    if (transaction.type !== 'expense') continue;

    const merchantName = normalizeDescription(transaction.description);
    if (!groups[merchantName]) {
      groups[merchantName] = [];
    }
    groups[merchantName].push(transaction);
  }

  return groups;
}

/**
 * Calculates statistical measures for a set of numbers
 */
function calculateStats(numbers: number[]): { mean: number; median: number; stdDev: number } {
  if (numbers.length === 0) return { mean: 0, median: 0, stdDev: 0 };

  const sorted = [...numbers].sort((a, b) => a - b);
  const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  const median = sorted[Math.floor(sorted.length / 2)];

  const variance = numbers.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / numbers.length;
  const stdDev = Math.sqrt(variance);

  return { mean, median, stdDev };
}

/**
 * Converts date string to Date object
 */
function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}

/**
 * Calculates days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  return Math.abs((date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Infers frequency from date intervals
 */
function inferFrequency(dateDeltas: number[]): { frequency: 'weekly' | 'bi-weekly' | 'monthly' | 'yearly'; regularity: number } {
  if (dateDeltas.length < 2) return { frequency: 'monthly', regularity: 0 };

  const { mean: avgDelta, stdDev } = calculateStats(dateDeltas);
  const regularity = stdDev / avgDelta; // Lower is more regular

  // Determine frequency based on average interval
  let frequency: 'weekly' | 'bi-weekly' | 'monthly' | 'yearly';

  if (avgDelta <= 8) {
    frequency = 'weekly';
  } else if (avgDelta <= 16) {
    frequency = 'bi-weekly';
  } else if (avgDelta <= 35) {
    frequency = 'monthly';
  } else {
    frequency = 'yearly';
  }

  return { frequency, regularity };
}

/**
 * Determines if a transaction pattern is recurring based on regularity threshold
 */
function isRecurring(dateDeltas: number[], threshold: number = 0.2): boolean {
  if (dateDeltas.length < 3) return false; // Need at least 3 points for meaningful analysis

  const { regularity } = inferFrequency(dateDeltas);
  return regularity < threshold; // Lower regularity score = more regular
}

/**
 * Calculates typical day of month for recurring transactions
 */
function calculateTypicalDayOfMonth(dates: Date[]): number | undefined {
  const days = dates.map(d => d.getDate());
  const { median } = calculateStats(days);
  return Math.round(median);
}

/**
 * Detects recurring expenses from a list of transactions
 */
export function detectRecurringExpenses(transactions: Transaction[]): RecurringExpense[] {
  const merchantGroups = groupTransactionsByMerchant(transactions);
  const recurringExpenses: RecurringExpense[] = [];

  for (const [merchantName, merchantTransactions] of Object.entries(merchantGroups)) {
    // Need at least 2 transactions to detect patterns
    if (merchantTransactions.length < 2) continue;

    // Sort by date
    const sortedTransactions = merchantTransactions.sort((a, b) =>
      parseDate(a.date).getTime() - parseDate(b.date).getTime()
    );

    // Extract amounts and dates
    const amounts = sortedTransactions.map(t => Math.abs(t.amount));
    const dates = sortedTransactions.map(t => parseDate(t.date));

    // Calculate date deltas (days between consecutive transactions)
    const dateDeltas: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      dateDeltas.push(daysBetween(dates[i], dates[i - 1]));
    }

    // Check if this is recurring
    const recurring = isRecurring(dateDeltas);
    const { frequency, regularity } = inferFrequency(dateDeltas);
    const { median: typicalAmount } = calculateStats(amounts);
    const typicalDayOfMonth = calculateTypicalDayOfMonth(dates);
    const confidence = Math.max(0, 1 - regularity); // Convert regularity to confidence

    // Create recurring expense entry
    const recurringExpense: RecurringExpense = {
      id: `recurring-${merchantName}-${Date.now()}`,
      merchantName,
      amount: typicalAmount,
      frequency,
      typicalDayOfMonth,
      isRecurring: recurring,
      confidence,
      transactionCount: merchantTransactions.length,
      firstSeen: sortedTransactions[0].date,
      lastSeen: sortedTransactions[sortedTransactions.length - 1].date,
    };

    recurringExpenses.push(recurringExpense);
  }

  // Sort by confidence (highest first) and only return recurring ones
  return recurringExpenses
    .filter(r => r.isRecurring)
    .sort((a, b) => b.confidence - a.confidence);
}

/**
 * Detects payroll and bonus events from credit transactions
 */
export function detectPayrollAndBonuses(transactions: Transaction[]): PayrollEvent[] {
  // Filter to credit transactions (income)
  const creditTransactions = transactions.filter(t => t.type === 'income');

  if (creditTransactions.length === 0) return [];

  // Look for payroll-like descriptions
  const payrollKeywords = ['payroll', 'direct dep', 'deposit', 'salary', 'wage'];
  const payrollTransactions = creditTransactions.filter(t =>
    payrollKeywords.some(keyword => t.description.toLowerCase().includes(keyword))
  );

  if (payrollTransactions.length === 0) return [];

  // Calculate median payroll amount
  const payrollAmounts = payrollTransactions.map(t => t.amount);
  const { median: medianPayroll } = calculateStats(payrollAmounts);

  const payrollEvents: PayrollEvent[] = [];

  for (const transaction of creditTransactions) {
    const amount = transaction.amount;
    const description = transaction.description;
    const date = transaction.date;

    // Determine if it's payroll or bonus
    let type: 'payroll' | 'bonus';
    let confidence: number;

    if (payrollKeywords.some(keyword => description.toLowerCase().includes(keyword))) {
      // Direct payroll indicator
      type = 'payroll';
      confidence = 0.9;
    } else if (amount > medianPayroll * 2) {
      // Much larger than typical payroll - likely bonus
      type = 'bonus';
      confidence = 0.8;
    } else {
      // Close to median payroll amount - likely payroll
      type = 'payroll';
      confidence = 0.6;
    }

    payrollEvents.push({
      id: `payroll-${Date.now()}-${Math.random()}`,
      description,
      amount,
      date,
      type,
      confidence,
    });
  }

  // Sort by date (most recent first)
  return payrollEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Main function to detect all recurring patterns from transactions
 */
export function detectRecurringPatterns(transactions: Transaction[]): RecurringDetectionResult {
  const recurringExpenses = detectRecurringExpenses(transactions);
  const payrollEvents = detectPayrollAndBonuses(transactions);

  return {
    recurringExpenses,
    payrollEvents,
    processedAt: new Date().toISOString(),
  };
}