import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { mtKeys, redisOps } from '@/lib/redis';

interface RegisterRequest {
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
    const body: RegisterRequest = await request.json();

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

    // Password strength validation
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await redisOps.get(mtKeys.user.byEmail(email));
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Generate user ID
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user record
    const userRecord: UserRecord = {
      id: userId,
      email,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    // Store user in Redis
    await redisOps.set(mtKeys.user.byEmail(email), JSON.stringify(userRecord));
    await redisOps.set(mtKeys.user.byId(userId), JSON.stringify(userRecord));

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || 'development-jwt-secret-key-for-testing-only';

    const token = jwt.sign(
      { userId, email },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: userId,
        email,
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
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}