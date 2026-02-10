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

    // Get user from Redis
    const userKey = redisKeys.user.byEmail(email);
    let user;
    try {
      user = await redisOps.get(userKey);
    } catch (error) {
      console.error('Redis operation error:', error);
      return NextResponse.json(
        { error: 'Database operation error' },
        { status: 503 }
      );
    }

    // Check if user exists
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Parse user data
    let userData;
    try {
      userData = JSON.parse(user);
    } catch (error) {
      console.error('User data parsing error:', error);
      return NextResponse.json(
        { error: 'Invalid user data' },
        { status: 500 }
      );
    }

    // Verify password
    let isValidPassword;
    try {
      isValidPassword = await bcrypt.compare(password, userData.password);
    } catch (error) {
      console.error('Password verification error:', error);
      return NextResponse.json(
        { error: 'Password verification failed' },
        { status: 500 }
      );
    }

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
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
      { userId: userData.id, email: userData.email },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // Create success response
    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      user: {
        id: userData.id,
        email: userData.email,
        createdAt: userData.createdAt,
      },
    });

    // Set HTTP-only cookie using Set-Cookie header
    const cookieValue = `auth-token=${token}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
    response.headers.set('Set-Cookie', cookieValue);

    return response;

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
