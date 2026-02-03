import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/auth';
import { redisOps, mtKeys } from '../../../../lib/redis';
import { detectRecurringTransactions, detectPayrollBonusTransactions } from '../../../../lib/recurring';
import { parseChaseCSV, validateChaseColumns, ParsedTransaction } from '../../../../lib/csv';

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

    // Parse CSV data with merchant normalization
    const transactions = await parseChaseCSV(buffer);

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

    // Run payroll/bonus detection
    const payrollBonusEvents = detectPayrollBonusTransactions(transactions);

    // Store payroll/bonus events in Redis
    const payrollKey = mtKeys.payroll(user.id);
    await redisOps.set(payrollKey, JSON.stringify(payrollBonusEvents));

    // Return success response
    return NextResponse.json({
      success: true,
      transactionCount: transactions.length,
      recurringPatternsCount: recurringPatterns.length,
      payrollBonusEventsCount: payrollBonusEvents.length,
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
