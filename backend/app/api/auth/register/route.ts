import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { redisHelpers } from '../../../../lib/redis';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Password validation (minimum 6 characters)
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Check if user already exists
    let existingUser;
    try {
      existingUser = await redisHelpers.getUser(email);
    } catch (error) {
      console.error('Redis connection error:', error);
      return NextResponse.json(
        { success: false, error: 'Database connection error' },
        { status: 503 }
      );
    }

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const now = new Date().toISOString();
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const user = {
      id: userId,
      email,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    };

    // Save user
    try {
      await redisHelpers.setUser(user);
    } catch (error) {
      console.error('Redis save error:', error);
      return NextResponse.json(
        { success: false, error: 'Database save error' },
        { status: 503 }
      );
    }

    // Return success response (without password hash)
    const { passwordHash: _, ...userResponse } = user;
    return NextResponse.json({
      success: true,
      data: userResponse
    }, { status: 201 });

  } catch (error) {
    console.error('Error registering user:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}