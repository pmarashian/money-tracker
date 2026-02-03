import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { mtKeys, redisOps } from '@/lib/redis';

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set('Access-Control-Allow-Origin', 'http://localhost:3001');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  return response;
}

export async function POST(request: NextRequest) {
  try {
    // Get the JWT token from the cookie
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      const response = NextResponse.json(
        { error: 'No authentication token found' },
        { status: 401 }
      );
      response.headers.set('Access-Control-Allow-Origin', 'http://localhost:3001');
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      return response;
    }

    // Verify and decode the JWT token
    const jwtSecret = process.env.JWT_SECRET || 'development-jwt-secret-key-for-testing-only';

    let decodedToken: any;
    try {
      decodedToken = jwt.verify(token, jwtSecret);
    } catch (error) {
      const response = NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
      response.headers.set('Access-Control-Allow-Origin', 'http://localhost:3001');
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      return response;
    }

    const { sessionId } = decodedToken;

    if (!sessionId) {
      const response = NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
      response.headers.set('Access-Control-Allow-Origin', 'http://localhost:3001');
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      return response;
    }

    // Delete the session from Redis
    const sessionKey = mtKeys.session(sessionId);
    await redisOps.delete(sessionKey);

    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Logout successful',
    });

    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', 'http://localhost:3001');
    response.headers.set('Access-Control-Allow-Credentials', 'true');

    // Clear the authentication cookie by setting it to expire immediately
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0, // Expire immediately
      path: '/',
    });

    return response;

  } catch (error) {
    console.error('Logout error:', error);
    const response = NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
    response.headers.set('Access-Control-Allow-Origin', 'http://localhost:3001');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    return response;
  }
}