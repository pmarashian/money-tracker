import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../../lib/auth';
import { redisHelpers } from '../../../../lib/redis';
import { calculateFinancialHealth, FinancialHealthConfig } from '../../../../lib/health';

/**
 * GET /api/health/financial
 * Returns the user's financial health projection based on current balance,
 * upcoming paychecks, bonus, and recurring expenses
 */
async function getFinancialHealthHandler(request: NextRequest): Promise<NextResponse> {
  try {
    // Get the user from authentication
    const user = (request as any).user;
    if (!user || !user.id) {
      return NextResponse.json(
        { success: false, error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Get user settings
    const userSettings = await redisHelpers.getUserSettings(user.id);
    if (!userSettings) {
      return NextResponse.json(
        { success: false, error: 'User settings not found. Please configure your financial settings first.' },
        { status: 400 }
      );
    }

    // Validate required financial settings
    if (userSettings.balance === undefined || userSettings.paycheckAmount === undefined || !userSettings.nextBonusDate) {
      return NextResponse.json(
        {
          success: false,
          error: 'Incomplete financial settings. Please configure balance, paycheck amount, and next bonus date.',
          requiredFields: ['balance', 'paycheckAmount', 'nextBonusDate']
        },
        { status: 400 }
      );
    }

    // Get recurring expenses
    const recurringData = await redisHelpers.getUserRecurringCache(user.id);
    const recurringExpenses = recurringData?.recurringExpenses || [];

    // Get optional configuration from query parameters
    const { searchParams } = new URL(request.url);
    const thresholdEnough = searchParams.get('thresholdEnough');
    const thresholdTooMuch = searchParams.get('thresholdTooMuch');

    const config: FinancialHealthConfig = {
      thresholdEnough: thresholdEnough ? parseFloat(thresholdEnough) : 0,
      thresholdTooMuch: thresholdTooMuch ? parseFloat(thresholdTooMuch) : 500,
    };

    // Calculate financial health
    const financialHealth = calculateFinancialHealth(userSettings, recurringExpenses, config);

    return NextResponse.json({
      success: true,
      data: financialHealth,
    });

  } catch (error) {
    console.error('Error calculating financial health:', error);

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('Bonus date must be in the future')) {
        return NextResponse.json(
          { success: false, error: 'Next bonus date must be in the future' },
          { status: 400 }
        );
      }
      if (error.message.includes('Next bonus date is required')) {
        return NextResponse.json(
          { success: false, error: 'Next bonus date is required in user settings' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Export protected GET handler
export const GET = withAuth(getFinancialHealthHandler);