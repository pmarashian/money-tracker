import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { mtKeys, redisOps } from '@/lib/redis';

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
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Get user from Redis
    const userJson = await redisOps.get(mtKeys.user.byEmail(email));
    if (!userJson) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Parse user record
    const userRecord: UserRecord = JSON.parse(userJson);

    // Verify password
    const isValidPassword = await bcrypt.compare(password, userRecord.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}