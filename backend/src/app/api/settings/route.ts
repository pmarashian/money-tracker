import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/auth';
import { redisOps, mtKeys } from '../../../lib/redis';
import { getDefaultUserSettings, UserSettings, validateUserSettings, mergeUserSettings } from '../../../lib/settings';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await requireAuth(request);

    // Get user settings from Redis (use defaults if not set)
    const settingsKey = mtKeys.settings(user.id);
    const settingsJson = await redisOps.get(settingsKey);
    const settings: UserSettings = settingsJson ? JSON.parse(settingsJson) : getDefaultUserSettings();

    return NextResponse.json(settings);

  } catch (error) {
    console.error('Get settings error:', error);

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

export async function PATCH(request: NextRequest) {
  try {
    // Authenticate user
    const user = await requireAuth(request);

    // Parse request body
    const updates: Partial<UserSettings> = await request.json();

    // Get existing settings
    const settingsKey = mtKeys.settings(user.id);
    const settingsJson = await redisOps.get(settingsKey);
    const existingSettings: UserSettings = settingsJson ? JSON.parse(settingsJson) : getDefaultUserSettings();

    // Validate the updates
    const validationErrors = validateUserSettings(updates);
    if (validationErrors.length > 0) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validationErrors
      }, { status: 400 });
    }

    // Merge updates with existing settings
    const updatedSettings = mergeUserSettings(existingSettings, updates);

    // Store updated settings in Redis
    await redisOps.set(settingsKey, JSON.stringify(updatedSettings));

    return NextResponse.json(updatedSettings);

  } catch (error) {
    console.error('Patch settings error:', error);

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