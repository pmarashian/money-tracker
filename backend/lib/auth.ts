import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { redisHelpers, User } from './redis';

export interface AuthenticatedRequest extends NextRequest {
  user?: User;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

/**
 * Authenticates a request by checking session cookie or Authorization header
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
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
          return { success: false, error: 'Server configuration error' };
        }

        const decoded = jwt.verify(token, jwtSecret) as { userId: string; email: string };
        userId = decoded.userId;
      } catch (error) {
        // JWT is invalid or expired
        return { success: false, error: 'Invalid or expired token' };
      }
    }

    // If neither session cookie nor valid JWT token, return unauthorized
    if (!sessionId && !userId) {
      return { success: false, error: 'No valid session or token provided' };
    }

    // If we have session ID, validate it and get user ID
    if (sessionId) {
      try {
        const session = await redisHelpers.getSession(sessionId);
        if (!session) {
          return { success: false, error: 'Session not found or expired' };
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

          return { success: false, error: 'Session expired' };
        }

        userId = session.userId;
      } catch (error) {
        console.error('Session validation error:', error);
        return { success: false, error: 'Session validation error' };
      }
    }

    // Get user data
    if (!userId) {
      return { success: false, error: 'Unable to identify user' };
    }

    try {
      const user = await redisHelpers.getUserById(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      return { success: true, user };

    } catch (error) {
      console.error('User lookup error:', error);
      return { success: false, error: 'Database connection error' };
    }

  } catch (error) {
    console.error('Authentication error:', error);
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * Creates a protected API route handler that requires authentication
 */
export function withAuth<T extends any[]>(
  handler: (request: AuthenticatedRequest, ...args: T) => Promise<NextResponse> | NextResponse
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const authResult = await authenticateRequest(request);

    if (!authResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.error || 'Authentication required'
        },
        { status: 401 }
      );
    }

    // Attach user to request object
    (request as AuthenticatedRequest).user = authResult.user!;

    return handler(request as AuthenticatedRequest, ...args);
  };
}

/**
 * Creates a protected API route handler for specific HTTP methods
 */
export function withAuthMethods<T extends any[]>(
  methods: Record<string, (request: AuthenticatedRequest, ...args: T) => Promise<NextResponse> | NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const method = request.method.toUpperCase();

    if (!methods[method]) {
      return NextResponse.json(
        { success: false, error: 'Method not allowed' },
        { status: 405 }
      );
    }

    return withAuth(methods[method])(request, ...args);
  };
}