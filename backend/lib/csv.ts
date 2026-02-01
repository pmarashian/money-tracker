import { Transaction } from './redis';

// Chase CSV format constants
export const CHASE_HEADERS = [
  'Details',
  'Posting Date',
  'Description',
  'Amount',
  'Type',
  'Balance',
  'Check or Slip #'
] as const;

export interface ChaseCsvRow {
  details: string;
  postingDate: string;
  description: string;
  amount: number;
  type: string;
  balance: number;
  checkOrSlipNumber: string;
}

export interface CsvParseResult {
  success: boolean;
  transactions?: Transaction[];
  errors?: string[];
  rowCount?: number;
}

/**
 * Validates that CSV headers match Chase format
 */
function validateHeaders(headers: string[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (headers.length !== CHASE_HEADERS.length) {
    errors.push(`Expected ${CHASE_HEADERS.length} columns, got ${headers.length}`);
  }

  // Check for missing headers
  const missingHeaders = CHASE_HEADERS.filter(header => !headers.includes(header));
  if (missingHeaders.length > 0) {
    errors.push(`Missing required headers: ${missingHeaders.join(', ')}`);
  }

  // Check for extra headers
  const extraHeaders = headers.filter(header => !CHASE_HEADERS.includes(header as any));
  if (extraHeaders.length > 0) {
    errors.push(`Unexpected headers: ${extraHeaders.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Parses a single CSV row, handling quoted fields
 */
function parseCsvRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // Escaped quote (two quotes in a row)
        current += '"';
        i += 2;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator (only when not inside quotes)
      result.push(current.trim());
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }

  // Add the last field
  result.push(current.trim());

  return result;
}

/**
 * Parses CSV content into structured data
 */
function parseCsvContent(content: string): { headers: string[]; rows: string[][]; errors: string[] } {
  const lines = content.split('\n').filter(line => line.trim());
  const errors: string[] = [];

  if (lines.length === 0) {
    errors.push('CSV file is empty');
    return { headers: [], rows: [], errors };
  }

  // Parse headers
  const headers = parseCsvRow(lines[0]);
  const rows: string[][] = [];

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line) {
      const row = parseCsvRow(line);
      if (row.length !== headers.length) {
        errors.push(`Row ${i + 1}: Expected ${headers.length} columns, got ${row.length}`);
      }
      rows.push(row);
    }
  }

  return { headers, rows, errors };
}

/**
 * Parses date from MM/DD/YYYY format to ISO string
 */
function parseChaseDate(dateStr: string): string {
  const parts = dateStr.split('/');
  if (parts.length !== 3) {
    throw new Error(`Invalid date format: ${dateStr}. Expected MM/DD/YYYY`);
  }

  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  if (month < 1 || month > 12) {
    throw new Error(`Invalid month: ${month}`);
  }
  if (day < 1 || day > 31) {
    throw new Error(`Invalid day: ${day}`);
  }
  if (year < 2000 || year > 2100) {
    throw new Error(`Invalid year: ${year}`);
  }

  // Create date at start of day in local timezone
  const date = new Date(year, month - 1, day);
  return date.toISOString().split('T')[0]; // YYYY-MM-DD format
}

/**
 * Parses amount string to number, handling Chase format
 */
function parseChaseAmount(amountStr: string): number {
  const cleaned = amountStr.replace(/[$,]/g, '');
  const amount = parseFloat(cleaned);

  if (isNaN(amount)) {
    throw new Error(`Invalid amount format: ${amountStr}`);
  }

  return amount;
}

/**
 * Parses balance string to number
 */
function parseChaseBalance(balanceStr: string): number {
  const cleaned = balanceStr.replace(/[$,]/g, '');
  const balance = parseFloat(cleaned);

  if (isNaN(balance)) {
    throw new Error(`Invalid balance format: ${balanceStr}`);
  }

  return balance;
}

/**
 * Converts Chase CSV row to Transaction object
 */
function chaseRowToTransaction(
  row: string[],
  userId: string,
  rowIndex: number
): Transaction {
  const [
    details,
    postingDate,
    description,
    amount,
    type,
    balance,
    checkOrSlipNumber
  ] = row;

  try {
    const parsedAmount = parseChaseAmount(amount);
    const parsedDate = parseChaseDate(postingDate);
    const parsedBalance = parseChaseBalance(balance);

    // Determine transaction type based on amount sign
    const transactionType: 'income' | 'expense' = parsedAmount >= 0 ? 'income' : 'expense';
    const absAmount = Math.abs(parsedAmount);

    return {
      id: `chase-${userId}-${rowIndex}-${Date.now()}`,
      userId,
      amount: absAmount,
      description: description || details, // Use description if available, fallback to details
      category: 'Uncategorized', // Will be categorized later
      date: parsedDate,
      type: transactionType,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    throw new Error(`Row ${rowIndex + 1}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parses Chase CSV content and returns structured transactions
 */
export function parseChaseCsv(content: string, userId: string): CsvParseResult {
  const errors: string[] = [];

  try {
    // Parse CSV content
    const { headers, rows, errors: parseErrors } = parseCsvContent(content);
    errors.push(...parseErrors);

    if (rows.length === 0) {
      return {
        success: false,
        errors: ['No data rows found in CSV']
      };
    }

    // Validate headers
    const headerValidation = validateHeaders(headers);
    if (!headerValidation.valid) {
      errors.push(...headerValidation.errors);
    }

    if (errors.length > 0) {
      return {
        success: false,
        errors,
        rowCount: rows.length
      };
    }

    // Convert rows to transactions
    const transactions: Transaction[] = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const transaction = chaseRowToTransaction(rows[i], userId, i);
        transactions.push(transaction);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `Unknown error: ${error}`);
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        errors,
        rowCount: rows.length
      };
    }

    return {
      success: true,
      transactions,
      rowCount: rows.length
    };

  } catch (error) {
    return {
      success: false,
      errors: [`Parse error: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
}

/**
 * Validates CSV content without parsing (for quick checks)
 */
export function validateChaseCsv(content: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    const { headers, rows, errors: parseErrors } = parseCsvContent(content);
    errors.push(...parseErrors);

    const headerValidation = validateHeaders(headers);
    if (!headerValidation.valid) {
      errors.push(...headerValidation.errors);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  } catch (error) {
    return {
      valid: false,
      errors: [`Validation error: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
}