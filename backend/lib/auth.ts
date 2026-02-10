import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient, redisKeys, redisOps } from './redis';

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface UserData extends User {
  password: string;
}

export interface Session {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

/**
 * Get the session from the request by parsing the JWT token from the auth-token cookie
 */
export async function getSession(request: NextRequest): Promise<Session | null> {
  try {
    // Get the auth-token cookie
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) {
      return null;
    }

    // Parse cookies to find auth-token
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, ...valueParts] = cookie.trim().split('=');
      acc[key] = valueParts.join('=');
      return acc;
    }, {} as Record<string, string>);

    const token = cookies['auth-token'];
    if (!token) {
      return null;
    }

    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET environment variable is not set');
      return null;
    }

    const decoded = jwt.verify(token, jwtSecret) as Session;

    // Check if token is expired
    if (decoded.exp * 1000 < Date.now()) {
      return null;
    }

    return decoded;
  } catch (error) {
    console.error('Session verification error:', error);
    return null;
  }
}

/**
 * Get the current user from the session
 */
export async function getCurrentUser(request: NextRequest): Promise<User | null> {
  try {
    const session = await getSession(request);
    if (!session) {
      return null;
    }

    // Get user from Redis using userId
    const redis = getRedisClient();
    const userKey = redisKeys.user.byId(session.userId);
    const userData = await redisOps.get(userKey);

    if (!userData) {
      return null;
    }

    const user = JSON.parse(userData) as UserData;
    // Remove password from user object
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

/**
 * Middleware function to require authentication
 * Returns 401 if not authenticated, otherwise calls next()
 */
export async function requireAuth(request: NextRequest): Promise<NextResponse | null> {
  try {
    const session = await getSession(request);
    if (!session) {
      const response = NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );

      // Set CORS headers for auth error responses
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

    return null; // Authentication successful, continue
  } catch (error) {
    console.error('Require auth error:', error);
    return NextResponse.json(
      { error: 'Authentication error' },
      { status: 500 }
    );
  }
}