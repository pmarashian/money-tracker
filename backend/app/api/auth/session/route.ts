import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { redisHelpers } from '../../../../lib/redis';

// Force dynamic rendering for this route since it uses request headers
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    let sessionId: string | null = null;
    let userId: string | null = null;

    // First, try to get session ID from HTTP-only cookie
    const cookies = request.headers.get('cookie') || '';
    const sessionIdCookie = cookies.split(';').find(cookie => cookie.trim().startsWith('sessionId='));

    if (sessionIdCookie) {
      sessionId = sessionIdCookie.split('=')[1]?.trim() || null;
    }

    // Second, try to get JWT token from Authorization header (for mobile/SPA clients)
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      try {
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
          console.error('JWT_SECRET not configured');
          return NextResponse.json(
            { success: false, error: 'Server configuration error' },
            { status: 500 }
          );
        }

        const decoded = jwt.verify(token, jwtSecret) as { userId: string; email: string };
        userId = decoded.userId;
      } catch (error) {
        // JWT is invalid or expired
        return NextResponse.json(
          { success: false, error: 'Invalid or expired token' },
          { status: 401 }
        );
      }
    }

    // If neither session cookie nor valid JWT token, return unauthorized
    if (!sessionId && !userId) {
      return NextResponse.json(
        { success: false, error: 'No valid session or token provided' },
        { status: 401 }
      );
    }

    // If we have session ID, validate it and get user ID
    if (sessionId) {
      try {
        const session = await redisHelpers.getSession(sessionId);
        if (!session) {
          return NextResponse.json(
            { success: false, error: 'Session not found or expired' },
            { status: 401 }
          );
        }

        // Check if session has expired
        const expiresAt = new Date(session.expiresAt);
        if (expiresAt < new Date()) {
          // Session expired, clean it up
          try {
            await redisHelpers.deleteSession(sessionId);
          } catch (error) {
            console.error('Error cleaning up expired session:', error);
          }

          return NextResponse.json(
            { success: false, error: 'Session expired' },
            { status: 401 }
          );
        }

        userId = session.userId;
      } catch (error) {
        console.error('Session validation error:', error);
        return NextResponse.json(
          { success: false, error: 'Session validation error' },
          { status: 500 }
        );
      }
    }

    // Get user data
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unable to identify user' },
        { status: 401 }
      );
    }

    try {
      const user = await redisHelpers.getUserById(userId);
      if (!user) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        );
      }

      // Return user data (excluding password hash)
      const { passwordHash: _, ...userResponse } = user;

      return NextResponse.json({
        success: true,
        data: {
          user: userResponse,
        }
      });

    } catch (error) {
      console.error('User lookup error:', error);
      return NextResponse.json(
        { success: false, error: 'Database connection error' },
        { status: 503 }
      );
    }

  } catch (error) {
    console.error('Error getting session:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}