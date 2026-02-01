import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../../lib/auth';
import { parseChaseCsv } from '../../../../lib/csv';
import { redisHelpers } from '../../../../lib/redis';
import { detectRecurringPatterns } from '../../../../lib/recurring';

/**
 * Handles CSV file uploads for transaction import
 */
async function uploadHandler(request: NextRequest): Promise<NextResponse> {
  try {
    // Get the user from authentication
    const user = (request as any).user;
    if (!user || !user.id) {
      return NextResponse.json(
        { success: false, error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json(
        { success: false, error: 'Only CSV files are supported' },
        { status: 400 }
      );
    }

    // Read file content
    const content = await file.text();

    if (!content.trim()) {
      return NextResponse.json(
        { success: false, error: 'File is empty' },
        { status: 400 }
      );
    }

    // Parse CSV content
    const parseResult = parseChaseCsv(content, user.id);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'CSV parsing failed',
          details: parseResult.errors
        },
        { status: 400 }
      );
    }

    if (!parseResult.transactions || parseResult.transactions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid transactions found in CSV' },
        { status: 400 }
      );
    }

    // Store transactions in Redis
    for (const transaction of parseResult.transactions) {
      await redisHelpers.addUserTransaction(user.id, transaction);
    }

    // Detect recurring patterns and cache them
    const recurringResult = detectRecurringPatterns(parseResult.transactions);
    await redisHelpers.setUserRecurringCache(user.id, recurringResult);

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${parseResult.transactions.length} transactions`,
      data: {
        transactionCount: parseResult.transactions.length,
        userId: user.id
      }
    });

  } catch (error) {
    console.error('Error uploading transactions:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Export protected POST handler
export const POST = withAuth(uploadHandler);