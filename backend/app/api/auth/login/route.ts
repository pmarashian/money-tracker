import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getRedisClient, redisKeys, redisOps } from "@/lib/redis";
import { setCorsHeaders } from "@/lib/cors";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // Validate input
    if (!email || !password) {
      const res = NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
      setCorsHeaders(res, request);
      return res;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const res = NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
      setCorsHeaders(res, request);
      return res;
    }

    let redis;
    try {
      redis = getRedisClient();
    } catch (error) {
      console.error("Redis connection error:", error);
      const res = NextResponse.json(
        { error: "Database connection error" },
        { status: 503 }
      );
      setCorsHeaders(res, request);
      return res;
    }

    // Get user from Redis
    const userKey = redisKeys.user.byEmail(email);
    let user;
    try {
      user = await redisOps.get(userKey);

      console.log("user", user);
      console.log("userKey", userKey);
    } catch (error) {
      console.error("Redis operation error:", error);
      const res = NextResponse.json(
        { error: "Database operation error" },
        { status: 503 }
      );
      setCorsHeaders(res, request);
      return res;
    }

    // Check if user exists
    if (!user) {
      const res = NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
      setCorsHeaders(res, request);
      return res;
    }

    // Parse user data
    let userData;
    try {
      userData = JSON.parse(user);
    } catch (error) {
      console.error("User data parsing error:", error);
      const res = NextResponse.json(
        { error: "Invalid user data" },
        { status: 500 }
      );
      setCorsHeaders(res, request);
      return res;
    }

    // Verify password
    let isValidPassword;
    try {
      isValidPassword = bcrypt.compareSync(password, userData.password);
    } catch (error) {
      console.error("Password verification error:", error);
      const res = NextResponse.json(
        { error: "Password verification failed" },
        { status: 500 }
      );
      setCorsHeaders(res, request);
      return res;
    }

    if (!isValidPassword) {
      const res = NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
      setCorsHeaders(res, request);
      return res;
    }

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error("JWT_SECRET environment variable is not set");
      const res = NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
      setCorsHeaders(res, request);
      return res;
    }

    const token = jwt.sign(
      { userId: userData.id, email: userData.email },
      jwtSecret,
      { expiresIn: "7d" }
    );

    // Create success response (include token for native app Bearer auth)
    const response = NextResponse.json({
      success: true,
      message: "Login successful",
      user: {
        id: userData.id,
        email: userData.email,
        createdAt: userData.createdAt,
      },
      token,
    });

    // Set HTTP-only cookie using Set-Cookie header
    const cookieValue = `auth-token=${token}; HttpOnly; Path=/; Max-Age=${
      60 * 60 * 24 * 7
    }; SameSite=lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
    response.headers.set("Set-Cookie", cookieValue);

    setCorsHeaders(response, request);
    return response;
  } catch (error: any) {
    console.error("Login error:", error.message);
    const res = NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
    setCorsHeaders(res, request);
    return res;
  }
}
