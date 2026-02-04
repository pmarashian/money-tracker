import Papa from 'papaparse';

export interface Transaction {
  details: string;
  postingDate: string; // MM/DD/YYYY format
  description: string;
  amount: number;
  type: string;
  balance: number;
  checkOrSlipNumber?: string;
}

export interface NormalizedTransaction extends Transaction {
  normalizedMerchant: string;
}

/**
 * Parse Chase CSV content and return normalized transactions
 */
export function parseChaseCSV(csvContent: string): NormalizedTransaction[] {
  if (!csvContent.trim()) {
    throw new Error('CSV content is empty');
  }

  // Parse CSV with Papa Parse
  let records: any[];
  try {
    const result = Papa.parse(csvContent, {
      skipEmptyLines: true,
      header: false,
    });

    if (result.errors.length > 0) {
      console.error('CSV parsing errors:', result.errors);
      throw new Error('Invalid CSV format');
    }

    records = result.data;
  } catch (error) {
    console.error('CSV parsing error:', error);
    throw new Error('Invalid CSV format');
  }

  if (records.length < 2) {
    throw new Error('CSV file must contain at least a header row and one data row');
  }

  // Extract headers and validate required columns
  const headers = records[0];
  const requiredColumns = ['Details', 'Posting Date', 'Description', 'Amount', 'Type', 'Balance', 'Check or Slip #'];

  // Check for required columns (case-insensitive)
  const headerMap = new Map<string, number>();
  for (let i = 0; i < headers.length; i++) {
    headerMap.set(headers[i].toLowerCase().trim(), i);
  }

  const missingColumns: string[] = [];
  for (const required of requiredColumns) {
    if (!headerMap.has(required.toLowerCase())) {
      missingColumns.push(required);
    }
  }

  if (missingColumns.length > 0) {
    throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
  }

  // Parse transactions
  const transactions: NormalizedTransaction[] = [];
  for (let i = 1; i < records.length; i++) {
    const row = records[i];

    try {
      // Parse amount (handle currency symbols and commas)
      const amountStr = row[headerMap.get('amount')!].toString().replace(/[$,]/g, '');
      const amount = parseFloat(amountStr);

      // Parse balance (handle currency symbols and commas)
      const balanceStr = row[headerMap.get('balance')!].toString().replace(/[$,]/g, '');
      const balance = parseFloat(balanceStr);

      // Validate date format (MM/DD/YYYY)
      const postingDate = row[headerMap.get('posting date')!].toString().trim();
      const dateRegex = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
      if (!dateRegex.test(postingDate)) {
        throw new Error(`Invalid date format on row ${i + 1}. Expected MM/DD/YYYY, got: ${postingDate}`);
      }

      // Validate date is parseable
      const date = new Date(postingDate);
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid date on row ${i + 1}: ${postingDate}`);
      }

      if (isNaN(amount) || isNaN(balance)) {
        throw new Error(`Invalid numeric value on row ${i + 1}. Amount: ${amountStr}, Balance: ${balanceStr}`);
      }

      const description = row[headerMap.get('description')!]?.toString() || '';
      const normalizedMerchant = normalizeMerchantName(description);

      const transaction: NormalizedTransaction = {
        details: row[headerMap.get('details')!]?.toString() || '',
        postingDate,
        description,
        amount,
        type: row[headerMap.get('type')!]?.toString() || '',
        balance,
        checkOrSlipNumber: row[headerMap.get('check or slip #')!]?.toString() || undefined,
        normalizedMerchant,
      };

      transactions.push(transaction);
    } catch (error) {
      console.error(`Error parsing row ${i + 1}:`, error);
      throw new Error(`Error parsing row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return transactions;
}

/**
 * Normalize merchant name from transaction description
 * Extracts clean merchant names from Chase patterns like:
 * - "PwP MERCHANT..." -> "pwp merchant"
 * - "DUKEENERGY..." -> "duke energy"
 * - "APPLECARD..." -> "apple card"
 */
export function normalizeMerchantName(description: string): string {
  if (!description) return '';

  let normalized = description.toLowerCase().trim();

  // Remove extra spaces
  normalized = normalized.replace(/\s+/g, ' ');

  // Extract merchant from common Chase patterns
  const patterns = [
    // PwP patterns: "PwP MERCHANT NAME PAYMENT" -> extract merchant name
    /^pwp\s+merchant\s+(.+?)(?:\s+payment)?$/i,
    // Direct merchant names in all caps camel case: "DUKEENERGY" -> "DUKE ENERGY"
    /^([A-Z]{3,})([A-Z]{3,})$/i,
    // Remove payment/refund suffixes first
    /\s+(?:payment|refund|charge|debit|credit|transfer)$/i,
    // Common prefixes to remove
    /^(?:online|mobile|contactless|recurring)\s+/i,
  ];

  let processed = false;
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match && !processed) {
      if (pattern.source.includes('pwp')) {
        // For PwP patterns, extract the merchant name after "merchant"
        normalized = match[1];
        processed = true;
      } else if (pattern.source.includes('([A-Z]{3,})([A-Z]{3,})$')) {
        // For camel case patterns, split them
        normalized = normalized.replace(/([A-Z]{3,})([A-Z]{3,})/g, '$1 $2');
        processed = true;
      } else {
        // For other patterns, apply the replacement
        normalized = normalized.replace(pattern, '');
        // Don't mark as processed for suffixes/prefixes - allow chaining
      }
    }
  }

  // Final cleanup: remove extra spaces and trim
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // Known abbreviation mappings
  const abbreviationMap: Record<string, string> = {
    'city of cle': 'rent',
    // Add more mappings as needed
  };

  return abbreviationMap[normalized] || normalized;
}

/**
 * Validate that parsed transactions have the required fields for recurring detection
 */
export function validateTransactionsForRecurring(transactions: NormalizedTransaction[]): void {
  const requiredFields = ['description', 'postingDate', 'amount', 'normalizedMerchant'];

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    for (const field of requiredFields) {
      if (!tx[field as keyof NormalizedTransaction]) {
        throw new Error(`Transaction ${i + 1} missing required field: ${field}`);
      }
    }
  }
}