import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { mtKeys, redisOps } from './redis';

export interface User {
  id: string;
  email: string;
}

export interface SessionData {
  userId: string;
  email: string;
  createdAt: string;
}

/**
 * Get the current user session from the request
 * Returns the user if a valid session/token is present, null otherwise
 */
export async function getSession(request: NextRequest): Promise<User | null> {
  try {
    // Get the JWT token from the cookie
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return null;
    }

    // Verify and decode the JWT token
    const jwtSecret = process.env.JWT_SECRET || 'development-jwt-secret-key-for-testing-only';

    let decodedToken: any;
    try {
      decodedToken = jwt.verify(token, jwtSecret);
    } catch (error) {
      // Token is invalid or expired
      return null;
    }

    const { userId, email, sessionId } = decodedToken;

    if (!userId || !email || !sessionId) {
      return null;
    }

    // Verify the session exists in Redis
    const sessionJson = await redisOps.get(mtKeys.session(sessionId));
    if (!sessionJson) {
      return null;
    }

    // Parse and validate session data
    const sessionData: SessionData = JSON.parse(sessionJson);
    if (sessionData.userId !== userId || sessionData.email !== email) {
      return null;
    }

    return {
      id: userId,
      email: email,
    };
  } catch (error) {
    console.error('getSession error:', error);
    return null;
  }
}

/**
 * Require authentication for a request
 * Throws an error if no valid session is present
 * Returns the authenticated user
 */
export async function requireAuth(request: NextRequest): Promise<User> {
  const user = await getSession(request);

  if (!user) {
    const error = new Error('Authentication required');
    (error as any).status = 401;
    throw error;
  }

  return user;
}