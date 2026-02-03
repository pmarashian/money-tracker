import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
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

interface LoginRequest {
  email: string;
  password: string;
}

interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequest = await request.json();

    // Validate input
    const { email, password } = body;
    if (!email || !password) {
      const response = NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
      response.headers.set('Access-Control-Allow-Origin', 'http://localhost:3001');
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      return response;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const response = NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
      response.headers.set('Access-Control-Allow-Origin', 'http://localhost:3001');
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      return response;
    }

    // Get user from Redis
    const userJson = await redisOps.get(mtKeys.user.byEmail(email));
    if (!userJson) {
      const response = NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
      response.headers.set('Access-Control-Allow-Origin', 'http://localhost:3001');
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      return response;
    }

    // Parse user record
    const userRecord: UserRecord = JSON.parse(userJson);

    // Verify password
    const isValidPassword = await bcrypt.compare(password, userRecord.passwordHash);
    if (!isValidPassword) {
      const response = NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
      response.headers.set('Access-Control-Allow-Origin', 'http://localhost:3001');
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      return response;
    }

    // Generate session ID
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || 'development-jwt-secret-key-for-testing-only';

    const token = jwt.sign(
      { userId: userRecord.id, email: userRecord.email, sessionId },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // Store session in Redis with expiry (7 days)
    const sessionData = JSON.stringify({
      userId: userRecord.id,
      email: userRecord.email,
      createdAt: new Date().toISOString(),
    });

    await redisOps.set(mtKeys.session(sessionId), sessionData, 60 * 60 * 24 * 7); // 7 days

    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      user: {
        id: userRecord.id,
        email: userRecord.email,
      },
    });

    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', 'http://localhost:3001');
    response.headers.set('Access-Control-Allow-Credentials', 'true');

    // Set HTTP-only cookie with JWT token
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;

  } catch (error) {
    console.error('Login error:', error);
    const response = NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
    response.headers.set('Access-Control-Allow-Origin', 'http://localhost:3001');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    return response;
  }
}