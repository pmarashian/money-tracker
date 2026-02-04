import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireAuth } from '../../../../lib/auth';
import { redisOps } from '../../../../lib/redis';
import { detectRecurringTransactions, storeRecurringPatterns, Transaction } from '../../../../lib/recurring';
import { parseChaseCSV, validateTransactionsForRecurring } from '../../../../lib/csv';

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

    // Parse CSV using the CSV library
    let transactions: Transaction[];
    try {
      transactions = parseChaseCSV(fileContent);
      validateTransactionsForRecurring(transactions);
    } catch (error) {
      console.error('CSV parsing error:', error);
      return NextResponse.json({
        error: error instanceof Error ? error.message : 'Invalid CSV format'
      }, { status: 400 });
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