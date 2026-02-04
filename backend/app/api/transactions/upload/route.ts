import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import { getCurrentUser, requireAuth } from '../../../../lib/auth';
import { redisOps } from '../../../../lib/redis';
import { detectRecurringTransactions, storeRecurringPatterns, Transaction } from '../../../../lib/recurring';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get form data with file
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Check file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json({ error: 'Only CSV files are allowed' }, { status: 400 });
    }

    // Read file content
    const fileContent = await file.text();

    if (!fileContent.trim()) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }

    // Parse CSV
    let records: any[];
    try {
      const result = Papa.parse(fileContent, {
        skipEmptyLines: true,
        header: false,
      });

      if (result.errors.length > 0) {
        console.error('CSV parsing errors:', result.errors);
        return NextResponse.json({ error: 'Invalid CSV format' }, { status: 400 });
      }

      records = result.data;
    } catch (error) {
      console.error('CSV parsing error:', error);
      return NextResponse.json({ error: 'Invalid CSV format' }, { status: 400 });
    }

    if (records.length < 2) {
      return NextResponse.json({ error: 'CSV file must contain at least a header row and one data row' }, { status: 400 });
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
      return NextResponse.json({
        error: `Missing required columns: ${missingColumns.join(', ')}`,
        requiredColumns
      }, { status: 400 });
    }

    // Parse transactions
    const transactions: Transaction[] = [];
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
          return NextResponse.json({
            error: `Invalid date format on row ${i + 1}. Expected MM/DD/YYYY, got: ${postingDate}`
          }, { status: 400 });
        }

        // Validate date is parseable
        const date = new Date(postingDate);
        if (isNaN(date.getTime())) {
          return NextResponse.json({
            error: `Invalid date on row ${i + 1}: ${postingDate}`
          }, { status: 400 });
        }

        if (isNaN(amount) || isNaN(balance)) {
          return NextResponse.json({
            error: `Invalid numeric value on row ${i + 1}. Amount: ${amountStr}, Balance: ${balanceStr}`
          }, { status: 400 });
        }

        const transaction: Transaction = {
          details: row[headerMap.get('details')!]?.toString() || '',
          postingDate,
          description: row[headerMap.get('description')!]?.toString() || '',
          amount,
          type: row[headerMap.get('type')!]?.toString() || '',
          balance,
          checkOrSlipNumber: row[headerMap.get('check or slip #')!]?.toString() || undefined,
        };

        transactions.push(transaction);
      } catch (error) {
        console.error(`Error parsing row ${i + 1}:`, error);
        return NextResponse.json({
          error: `Error parsing row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`
        }, { status: 400 });
      }
    }

    // Store transactions in Redis
    const transactionsKey = `mt:txns:${user.id}`;
    await redisOps.set(transactionsKey, JSON.stringify(transactions));

    // Run recurring detection
    const recurringPatterns = await detectRecurringTransactions(user.id);
    await storeRecurringPatterns(user.id, recurringPatterns);

    return NextResponse.json({
      success: true,
      message: 'Transactions uploaded successfully',
      rowCount: transactions.length,
      recurringPatternsDetected: recurringPatterns.length
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}