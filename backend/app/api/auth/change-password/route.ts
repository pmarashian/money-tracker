import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAuth, getCurrentUser } from "@/lib/auth";
import { getRedisClient, redisKeys, redisOps } from "@/lib/redis";
import { setCorsHeaders } from "@/lib/cors";

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authError = await requireAuth(request);
    if (authError) {
      setCorsHeaders(authError, request);
      return authError;
    }

    const { newPassword } = await request.json();

    // Validate input
    if (!newPassword) {
      const res = NextResponse.json(
        { error: "New password is required" },
        { status: 400 }
      );
      setCorsHeaders(res, request);
      return res;
    }

    // Validate password strength (same as registration)
    if (newPassword.length < 6) {
      const res = NextResponse.json(
        { error: "Password must be at least 6 characters long" },
        { status: 400 }
      );
      setCorsHeaders(res, request);
      return res;
    }

    // Get current user from session
    const user = await getCurrentUser(request);
    if (!user) {
      const res = NextResponse.json(
        { error: "User not found" },
        { status: 404 }
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

    // Hash new password (same configuration as registration)
    const saltRounds = 12;
    const hashedPassword = bcrypt.hashSync(newPassword, saltRounds);

    // Get existing user data to preserve all fields
    const userKeyById = redisKeys.user.byId(user.id);
    const userKeyByEmail = redisKeys.user.byEmail(user.email);

    let userDataById;
    let userDataByEmail;
    try {
      userDataById = await redisOps.get(userKeyById);
      userDataByEmail = await redisOps.get(userKeyByEmail);
    } catch (error) {
      console.error("Redis operation error:", error);
      const res = NextResponse.json(
        { error: "Database operation error" },
        { status: 503 }
      );
      setCorsHeaders(res, request);
      return res;
    }

    // Parse user data
    let userData;
    try {
      // Use data from byId key as source of truth
      const userDataString = userDataById || userDataByEmail;
      if (!userDataString) {
        const res = NextResponse.json(
          { error: "User data not found" },
          { status: 404 }
        );
        setCorsHeaders(res, request);
        return res;
      }
      userData = JSON.parse(userDataString);
    } catch (error) {
      console.error("User data parsing error:", error);
      const res = NextResponse.json(
        { error: "Invalid user data" },
        { status: 500 }
      );
      setCorsHeaders(res, request);
      return res;
    }

    // Update password in user data
    const updatedUserData = {
      ...userData,
      password: hashedPassword,
    };

    // Update both Redis keys to keep data consistent
    try {
      await redisOps.set(userKeyById, JSON.stringify(updatedUserData));
      await redisOps.set(userKeyByEmail, JSON.stringify(updatedUserData));
    } catch (error) {
      console.error("Redis storage error:", error);
      const res = NextResponse.json(
        { error: "Failed to update password" },
        { status: 503 }
      );
      setCorsHeaders(res, request);
      return res;
    }

    // Return success response
    const response = NextResponse.json({
      success: true,
      message: "Password changed successfully",
    });
    setCorsHeaders(response, request);
    return response;
  } catch (error: any) {
    console.error("Password change error:", error.message);
    const res = NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
    setCorsHeaders(res, request);
    return res;
  }
}
