import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../lib/auth';
import { redisHelpers } from '../../../lib/redis';
import { calculateFinancialHealth, FinancialHealthConfig } from '../../../lib/health';

/**
 * GET /api/health
 * Returns the user's financial health status for authenticated users
 */
async function getHealthHandler(request: NextRequest): Promise<NextResponse> {
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

    // Handle missing settings gracefully
    if (!userSettings || userSettings.balance === undefined ||
        userSettings.paycheckAmount === undefined || !userSettings.nextBonusDate) {
      // Return sensible defaults when settings are missing
      return NextResponse.json({
        status: 'not_enough',
        projectedBalance: 0,
        breakdown: {
          error: 'Incomplete financial settings. Please configure balance, paycheck amount, and next bonus date.',
          requiredFields: ['balance', 'paycheckAmount', 'nextBonusDate']
        }
      });
    }

    // Get recurring expenses
    const recurringData = await redisHelpers.getUserRecurringCache(user.id);
    const recurringExpenses = recurringData?.recurringExpenses || [];

    // Use default configuration
    const config: FinancialHealthConfig = {
      thresholdEnough: 0,
      thresholdTooMuch: 500,
    };

    // Calculate financial health
    const financialHealth = calculateFinancialHealth(userSettings, recurringExpenses, config);

    // Return simplified response as specified in task
    return NextResponse.json({
      status: financialHealth.status,
      projectedBalance: financialHealth.projectedBalance,
      breakdown: {
        currentBalance: financialHealth.currentBalance,
        totalInflows: financialHealth.totalInflows,
        totalOutflows: financialHealth.totalOutflows,
        bonusDate: financialHealth.bonusDate,
        daysUntilBonus: financialHealth.daysUntilBonus
      }
    });

  } catch (error) {
    console.error('Error calculating financial health:', error);

    // Handle errors gracefully without crashing
    if (error instanceof Error) {
      if (error.message.includes('Bonus date must be in the future') ||
          error.message.includes('Next bonus date is required')) {
        return NextResponse.json({
          status: 'not_enough',
          projectedBalance: 0,
          breakdown: {
            error: 'Invalid bonus date configuration. Please check your settings.'
          }
        });
      }
    }

    // Return safe defaults for any other errors
    return NextResponse.json({
      status: 'not_enough',
      projectedBalance: 0,
      breakdown: {
        error: 'Unable to calculate financial health. Please try again later.'
      }
    });
  }
}

// Export protected GET handler
export const GET = withAuth(getHealthHandler);