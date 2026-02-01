import { NextResponse } from 'next/server';
import { withAuth } from '../../../lib/auth';
import { redisHelpers, UserSettings } from '../../../lib/redis';
import { AuthenticatedRequest } from '../../../lib/auth';

export const PATCH = withAuth(async (request: AuthenticatedRequest): Promise<NextResponse> => {
  try {
    const user = request.user!;
    const userId = user.id;
    const body = await request.json();

    // Validate input fields
    const { balance, paycheckAmount, nextBonusDate, bonusAmount } = body;

    // Type validation
    if (balance !== undefined && typeof balance !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Balance must be a number' },
        { status: 400 }
      );
    }

    if (paycheckAmount !== undefined && typeof paycheckAmount !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Paycheck amount must be a number' },
        { status: 400 }
      );
    }

    if (nextBonusDate !== undefined && typeof nextBonusDate !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Next bonus date must be a string' },
        { status: 400 }
      );
    }

    if (bonusAmount !== undefined && typeof bonusAmount !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Bonus amount must be a number' },
        { status: 400 }
      );
    }

    // Date validation for nextBonusDate if provided
    if (nextBonusDate) {
      const date = new Date(nextBonusDate);
      if (isNaN(date.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Next bonus date must be a valid ISO date string' },
          { status: 400 }
        );
      }
    }

    // Get existing settings or create default
    let existingSettings = await redisHelpers.getUserSettings(userId);

    if (!existingSettings) {
      // Create default settings if none exist
      existingSettings = {
        userId: userId,
        preferences: {},
        notifications: {
          email: true,
          push: true,
        },
        currency: 'USD',
        updatedAt: new Date().toISOString(),
      };
    }

    // Update settings with provided fields
    const updatedSettings: UserSettings = {
      ...existingSettings,
      ...(balance !== undefined && { balance }),
      ...(paycheckAmount !== undefined && { paycheckAmount }),
      ...(nextBonusDate !== undefined && { nextBonusDate }),
      ...(bonusAmount !== undefined && { bonusAmount }),
      updatedAt: new Date().toISOString(),
    };

    // Save to Redis
    await redisHelpers.setUserSettings(updatedSettings);

    return NextResponse.json({
      success: true,
      data: updatedSettings,
    });

  } catch (error) {
    console.error('Error updating user settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update settings' },
      { status: 500 }
    );
  }
});