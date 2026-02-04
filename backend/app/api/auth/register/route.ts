import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getRedisClient, redisKeys, redisOps } from '@/lib/redis';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    let redis;
    try {
      redis = getRedisClient();
    } catch (error) {
      console.error('Redis connection error:', error);
      return NextResponse.json(
        { error: 'Database connection error' },
        { status: 503 }
      );
    }

    // Check if user already exists
    const existingUserKey = redisKeys.user.byEmail(email);
    let existingUser;
    try {
      existingUser = await redisOps.get(existingUserKey);
    } catch (error) {
      console.error('Redis operation error:', error);
      return NextResponse.json(
        { error: 'Database operation error' },
        { status: 503 }
      );
    }

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Generate user ID
    const userId = crypto.randomUUID();

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user object
    const user = {
      id: userId,
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
    };

    // Store user in Redis
    const userKey = redisKeys.user.byEmail(email);
    try {
      await redisOps.set(userKey, JSON.stringify(user));

      // Also store by ID for faster lookups
      const userByIdKey = redisKeys.user.byId(userId);
      await redisOps.set(userByIdKey, JSON.stringify(user));
    } catch (error) {
      console.error('Redis storage error:', error);
      return NextResponse.json(
        { error: 'Failed to create user account' },
        { status: 503 }
      );
    }

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET environment variable is not set');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const token = jwt.sign(
      { userId, email },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // Create HTTP-only cookie
    const response = NextResponse.json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: userId,
        email,
        createdAt: user.createdAt,
      },
    });

    // Set CORS headers directly in the response (middleware may not apply to API routes)
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

    // Set HTTP-only cookie using Set-Cookie header
    const cookieValue = `auth-token=${token}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
    response.headers.set('Set-Cookie', cookieValue);

    return response;

  } catch (error) {
    console.error('Registration error:', error);
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