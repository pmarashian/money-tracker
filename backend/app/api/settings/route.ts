import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireAuth } from '../../../lib/auth';
import { getUserSettings, updateUserSettings, UserSettings } from '../../../lib/settings';

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

    // Get user settings
    const settings = await getUserSettings(user.id);

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

/**
 * OPTIONS handler for CORS preflight requests
 */
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  const response = new NextResponse(null, { status: 200 });

  // Set CORS headers
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:3001', 'https://your-production-domain.com'];

  const origin = request.headers.get('origin');
  const isAllowedOrigin = origin && allowedOrigins.includes(origin);

  if (isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  return response;
}