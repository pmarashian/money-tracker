import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../../lib/auth';
import { redisHelpers } from '../../../../lib/redis';
import { detectRecurringPatterns, RecurringDetectionResult } from '../../../../lib/recurring';

/**
 * GET /api/transactions/recurring
 * Returns detected recurring expenses and payroll/bonus events for the authenticated user
 */
async function getRecurringHandler(request: NextRequest): Promise<NextResponse> {
  try {
    // Get the user from authentication
    const user = (request as any).user;
    if (!user || !user.id) {
      return NextResponse.json(
        { success: false, error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Try to get cached recurring data first
    const cachedResult = await redisHelpers.getUserRecurringCache(user.id);

    if (cachedResult) {
      // Return cached result
      const transactions = await redisHelpers.getUserTransactions(user.id);
      return NextResponse.json({
        success: true,
        data: {
          ...cachedResult,
          transactionCount: transactions?.length || 0,
        }
      });
    }

    // No cached result, calculate from transactions
    const transactions = await redisHelpers.getUserTransactions(user.id);

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          recurringExpenses: [],
          payrollEvents: [],
          processedAt: new Date().toISOString(),
          transactionCount: 0,
        }
      });
    }

    // Detect recurring patterns
    const result = detectRecurringPatterns(transactions);

    // Cache the result in Redis for faster subsequent requests
    await redisHelpers.setUserRecurringCache(user.id, result);

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        transactionCount: transactions.length,
      }
    });

  } catch (error) {
    console.error('Error getting recurring transactions:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Export protected GET handler
export const GET = withAuth(getRecurringHandler);