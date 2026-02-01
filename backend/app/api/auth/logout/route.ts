import { NextResponse } from 'next/server';
import { redisHelpers } from '../../../../lib/redis';

export async function POST(request: Request) {
  try {
    // Get session ID from HTTP-only cookie
    const cookies = request.headers.get('cookie') || '';
    const sessionIdCookie = cookies.split(';').find(cookie => cookie.trim().startsWith('sessionId='));

    if (!sessionIdCookie) {
      // No session cookie present - user is already logged out
      return NextResponse.json({
        success: true,
        message: 'Already logged out'
      });
    }

    const sessionId = sessionIdCookie.split('=')[1]?.trim();

    if (!sessionId) {
      // Invalid session cookie
      return NextResponse.json({
        success: false,
        error: 'Invalid session'
      }, { status: 400 });
    }

    // Verify session exists before deleting
    try {
      const session = await redisHelpers.getSession(sessionId);
      if (!session) {
        // Session already doesn't exist - clear the cookie anyway
        const response = NextResponse.json({
          success: true,
          message: 'Session already cleared'
        });

        response.cookies.set('sessionId', '', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 0,
          path: '/',
        });

        return response;
      }
    } catch (error) {
      console.error('Session verification error:', error);
      // Continue with logout attempt even if Redis fails
    }

    // Delete session from Redis
    try {
      await redisHelpers.deleteSession(sessionId);
    } catch (error) {
      console.error('Session deletion error:', error);
      return NextResponse.json(
        { success: false, error: 'Database connection error' },
        { status: 503 }
      );
    }

    // Clear the HTTP-only cookie
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    });

    response.cookies.set('sessionId', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    });

    return response;

  } catch (error) {
    console.error('Error logging out user:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}