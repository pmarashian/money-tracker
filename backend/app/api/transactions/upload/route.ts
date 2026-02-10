import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/auth';
import { redisOps } from '../../../../lib/redis';
import { detectRecurringTransactions, storeRecurringPatterns, RecurringPattern, Transaction } from '../../../../lib/recurring';
import { extractRecurringExpensesWithAIFromNormalizedTable } from '../../../../lib/extractRecurringWithAI';
import { parseChaseCSV, validateTransactionsForRecurring } from '../../../../lib/csv';
import { detectPayrollAndBonus, storePayrollAndBonus } from '../../../../lib/payroll';

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

    console.log('[upload] POST /api/transactions/upload — file:', file.name, 'user:', user.id);

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
    console.log('[upload] Stored', transactions.length, 'transactions in Redis');

    // Run recurring detection: AI on normalized table first when key is set, else algorithm
    let recurringPatterns: RecurringPattern[];
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log('[upload] Running AI recurring extraction (normalized table)...');
        recurringPatterns = await extractRecurringExpensesWithAIFromNormalizedTable(transactions);
        console.log('[upload] AI recurring extraction OK —', recurringPatterns.length, 'patterns');
      } catch (aiError) {
        console.error('AI recurring extraction failed, using algorithm fallback:', aiError);
        recurringPatterns = await detectRecurringTransactions(user.id);
        console.log('[upload] Algorithm fallback —', recurringPatterns.length, 'patterns');
      }
    } else {
      console.log('[upload] No OPENAI_API_KEY — using algorithm for recurring');
      recurringPatterns = await detectRecurringTransactions(user.id);
      console.log('[upload] Algorithm —', recurringPatterns.length, 'patterns');
    }
    await storeRecurringPatterns(user.id, recurringPatterns);

    // Run payroll and bonus detection
    const payrollEvents = await detectPayrollAndBonus(user.id);
    await storePayrollAndBonus(user.id, payrollEvents);
    console.log('[upload] Payroll/bonus —', payrollEvents.length, 'events');

    console.log('[upload] Success — recurring:', recurringPatterns.length, 'payroll:', payrollEvents.length);
    return NextResponse.json({
      success: true,
      message: 'Transactions uploaded successfully',
      rowCount: transactions.length,
      recurringPatternsDetected: recurringPatterns.length,
      payrollEventsDetected: payrollEvents.length
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}