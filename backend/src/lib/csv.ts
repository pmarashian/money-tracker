/**
 * CSV parsing utilities for Money Tracker
 */

export interface ParsedTransaction {
  details: string;
  postingDate: string; // MM/DD/YYYY format
  description: string;
  amount: number;
  type: string;
  balance: number;
  checkOrSlipNumber?: string;
  normalizedMerchant?: string; // Added normalized merchant field
}

/**
 * Parse Chase CSV buffer into transaction objects with merchant normalization
 */
export async function parseChaseCSV(buffer: Buffer): Promise<ParsedTransaction[]> {
  const csv = require('csv-parser');
  const { Readable } = require('stream');

  return new Promise((resolve, reject) => {
    const transactions: ParsedTransaction[] = [];
    const stream = Readable.from(buffer);

    stream
      .pipe(csv({
        // Handle quoted fields properly for Chase CSV
        quote: '"',
        escape: '"',
      }))
      .on('data', (data: any) => {
        // Parse raw transaction data
        const rawDescription = data['Description'] || '';
        const normalizedMerchant = normalizeMerchantDescription(rawDescription);

        const transaction: ParsedTransaction = {
          details: data['Details'] || '',
          postingDate: data['Posting Date'] || '',
          description: rawDescription,
          amount: parseFloat(data['Amount'] || '0'),
          type: data['Type'] || '',
          balance: parseFloat(data['Balance'] || '0'),
          checkOrSlipNumber: data['Check or Slip #'] || undefined,
          normalizedMerchant,
        };
        transactions.push(transaction);
      })
      .on('end', () => {
        resolve(transactions);
      })
      .on('error', (error: any) => {
        reject(error);
      });
  });
}

/**
 * Normalize merchant description from Chase CSV patterns
 * Extracts clean merchant names from various Chase description formats
 */
export function normalizeMerchantDescription(description: string): string {
  if (!description || typeof description !== 'string') {
    return '';
  }

  let merchant = description.trim();

  // Remove common prefixes that Chase adds
  const prefixPatterns = [
    /^PwP\s+/i,        // "PwP MERCHANT NAME"
    /^DUKEENERGY\s+/i, // "DUKEENERGY PAYMENT"
    /^APPLECARD\s+/i,  // "APPLECARD PAYMENT"
    /^AUTOMATIC\s+/i,  // "AUTOMATIC PAYMENT"
    /^ONLINE\s+/i,     // "ONLINE PAYMENT"
    /^CHECK\s+/i,      // "CHECK PAYMENT"
    /^ACH\s+/i,        // "ACH PAYMENT"
    /^POS\s+/i,        // "POS PURCHASE"
    /^ATM\s+/i,        // "ATM WITHDRAWAL"
    /^DEBIT\s+/i,      // "DEBIT PURCHASE"
    /^CREDIT\s+/i,     // "CREDIT PAYMENT"
  ];

  for (const pattern of prefixPatterns) {
    merchant = merchant.replace(pattern, '');
  }

  // Clean up extra spaces
  merchant = merchant.replace(/\s+/g, ' ').trim();

  // Handle known merchant abbreviations and mappings
  const merchantMappings: { [key: string]: string } = {
    'CITY OF CLE': 'Rent',
    'UTILITIES': 'Utilities',
    'ELECTRIC': 'Electric Bill',
    'GAS': 'Gas Bill',
    'WATER': 'Water Bill',
    'INTERNET': 'Internet',
    'PHONE': 'Phone Bill',
    'INSURANCE': 'Insurance',
    'GROCERY': 'Groceries',
    'SUPERMARKET': 'Groceries',
    'RESTAURANT': 'Restaurant',
    'FAST FOOD': 'Fast Food',
    'COFFEE': 'Coffee Shop',
    'PHARMACY': 'Pharmacy',
    'GAS STATION': 'Gas Station',
    'TRANSPORTATION': 'Transportation',
    'ENTERTAINMENT': 'Entertainment',
    'SHOPPING': 'Shopping',
    'SUBSCRIPTION': 'Subscription',
    'SERVICES': 'Services',
  };

  // Check for exact matches in mappings
  const upperMerchant = merchant.toUpperCase();
  for (const [abbrev, fullName] of Object.entries(merchantMappings)) {
    if (upperMerchant.includes(abbrev)) {
      return fullName;
    }
  }

  // If no mapping found, return cleaned merchant name
  // Capitalize first letter of each word for readability
  return merchant.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Validate that CSV contains required Chase columns
 */
export function validateChaseColumns(transactions: ParsedTransaction[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (transactions.length === 0) {
    errors.push('CSV file is empty');
    return { valid: false, errors };
  }

  const firstRow = transactions[0];

  // Check required columns exist and have values
  const requiredColumns = [
    'details',
    'postingDate',
    'description',
    'amount',
    'type',
    'balance'
  ];

  for (const column of requiredColumns) {
    const value = firstRow[column as keyof ParsedTransaction];
    if (value === undefined || value === '') {
      errors.push(`Missing required column: ${column}`);
    }
  }

  // Validate date format (MM/DD/YYYY)
  if (firstRow.postingDate && !/^\d{2}\/\d{2}\/\d{4}$/.test(firstRow.postingDate)) {
    errors.push('Posting Date must be in MM/DD/YYYY format');
  }

  // Validate amount and balance are numbers
  if (isNaN(firstRow.amount)) {
    errors.push('Amount must be a valid number');
  }

  if (isNaN(firstRow.balance)) {
    errors.push('Balance must be a valid number');
  }

  return { valid: errors.length === 0, errors };
}