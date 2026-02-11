import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireAuth } from '../../../lib/auth';
import { advanceNextPaycheckDateIfNeeded, updateUserSettings, UserSettings } from '../../../lib/settings';

/**
 * GET /api/settings
 * Returns current user settings for form pre-fill
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Check authentication
    const authResult = await requireAuth(request);
    if (authResult) {
      return authResult; // Returns 401 if not authenticated
    }

    // Get current user
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get user settings (auto-advance next paycheck date if in the past or today)
    const settings = await advanceNextPaycheckDateIfNeeded(user.id);

    return NextResponse.json(settings);
  } catch (error) {
    console.error('GET /api/settings error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/settings
 * Updates user settings with partial updates
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    // Check authentication
    const authResult = await requireAuth(request);
    if (authResult) {
      return authResult; // Returns 401 if not authenticated
    }

    // Get current user
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Parse request body
    let updates: Partial<UserSettings>;
    try {
      updates = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Update settings (validation happens in updateUserSettings)
    const updatedSettings = await updateUserSettings(user.id, updates);

    return NextResponse.json(updatedSettings);
  } catch (error) {
    console.error('PATCH /api/settings error:', error);

    // Handle validation errors (thrown by updateUserSettings)
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
