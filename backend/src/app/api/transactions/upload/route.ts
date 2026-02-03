import { NextRequest, NextResponse } from 'next/server';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { requireAuth } from '../../../../lib/auth';
import { redisOps, mtKeys } from '../../../../lib/redis';
import { detectRecurringTransactions, Transaction } from '../../../../lib/recurring';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await requireAuth(request);

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Check file type
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      return NextResponse.json({ error: 'Only CSV files are allowed' }, { status: 400 });
    }

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Parse CSV data
    const transactions = await parseCSV(buffer);

    // Validate required columns
    const validation = validateChaseColumns(transactions);
    if (!validation.valid) {
      return NextResponse.json({
        error: 'Invalid CSV format',
        details: validation.errors
      }, { status: 400 });
    }

    // Store transactions in Redis
    const transactionKey = mtKeys.transactions(user.id);
    await redisOps.set(transactionKey, JSON.stringify(transactions));

    // Run recurring detection
    const recurringPatterns = detectRecurringTransactions(transactions);

    // Store recurring patterns in Redis
    const recurringKey = mtKeys.recurring(user.id);
    await redisOps.set(recurringKey, JSON.stringify(recurringPatterns));

    // Return success response
    return NextResponse.json({
      success: true,
      transactionCount: transactions.length,
      recurringPatternsCount: recurringPatterns.length,
    });

  } catch (error) {
    console.error('Transaction upload error:', error);

    // Handle authentication errors
    if (error instanceof Error && (error as any).status === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Parse CSV buffer into transaction objects
 */
async function parseCSV(buffer: Buffer): Promise<Transaction[]> {
  return new Promise((resolve, reject) => {
    const transactions: Transaction[] = [];
    const stream = Readable.from(buffer);

    stream
      .pipe(csv({
        // Handle quoted fields properly
        quote: '"',
        escape: '"',
      }))
      .on('data', (data: any) => {
        // Convert MM/DD/YYYY to standard format and parse amount
        const transaction: Transaction = {
          details: data['Details'] || '',
          postingDate: data['Posting Date'] || '',
          description: data['Description'] || '',
          amount: parseFloat(data['Amount'] || '0'),
          type: data['Type'] || '',
          balance: parseFloat(data['Balance'] || '0'),
          checkOrSlipNumber: data['Check or Slip #'] || undefined,
        };
        transactions.push(transaction);
      })
      .on('end', () => {
        resolve(transactions);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

/**
 * Validate that CSV contains required Chase columns
 */
function validateChaseColumns(transactions: Transaction[]): { valid: boolean; errors: string[] } {
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
    const value = firstRow[column as keyof Transaction];
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