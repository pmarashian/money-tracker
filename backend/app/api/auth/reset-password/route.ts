import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getRedisClient, redisKeys, redisOps } from "@/lib/redis";
import { setCorsHeaders } from "@/lib/cors";

const INVALID_MSG = "Invalid or expired reset link.";
const INVALID_CODE_MSG = "Invalid or expired reset code.";
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const { token, email, code, newPassword } = await request.json();

    if (!newPassword || typeof newPassword !== "string") {
      const res = NextResponse.json(
        { error: "New password is required" },
        { status: 400 }
      );
      setCorsHeaders(res, request);
      return res;
    }

    if (newPassword.length < 6) {
      const res = NextResponse.json(
        { error: "Password must be at least 6 characters long" },
        { status: 400 }
      );
      setCorsHeaders(res, request);
      return res;
    }

    const hasToken = token && typeof token === "string";
    const hasCodeEmail =
      code && typeof code === "string" && email && typeof email === "string";

    if (hasToken && hasCodeEmail) {
      const res = NextResponse.json(
        { error: "Provide either the reset link token or email and code, not both." },
        { status: 400 }
      );
      setCorsHeaders(res, request);
      return res;
    }

    if (!hasToken && !hasCodeEmail) {
      const res = NextResponse.json(
        { error: "Token is required, or email and reset code." },
        { status: 400 }
      );
      setCorsHeaders(res, request);
      return res;
    }

    let payload: { userId: string; email: string };
    let keysToDelete: string[] = [];

    if (hasToken) {
      const resetKey = redisKeys.resetToken(token);
      let payloadString: string | null = null;
      try {
        payloadString = await redisOps.get(resetKey);
      } catch (error) {
        console.error("Redis operation error:", error);
        const res = NextResponse.json(
          { error: "Database operation error" },
          { status: 503 }
        );
        setCorsHeaders(res, request);
        return res;
      }

      if (!payloadString) {
        const res = NextResponse.json({ error: INVALID_MSG }, { status: 400 });
        setCorsHeaders(res, request);
        return res;
      }

      let parsed: { userId: string; email: string; code: string };
      try {
        parsed = JSON.parse(payloadString);
      } catch {
        const res = NextResponse.json({ error: INVALID_MSG }, { status: 400 });
        setCorsHeaders(res, request);
        return res;
      }

      payload = { userId: parsed.userId, email: parsed.email };
      keysToDelete = [resetKey, redisKeys.resetCode(parsed.code)];
    } else {
      if (!emailRegex.test(email)) {
        const res = NextResponse.json(
          { error: "Invalid email format" },
          { status: 400 }
        );
        setCorsHeaders(res, request);
        return res;
      }

      const codeKey = redisKeys.resetCode(code);
      let payloadString: string | null = null;
      try {
        payloadString = await redisOps.get(codeKey);
      } catch (error) {
        console.error("Redis operation error:", error);
        const res = NextResponse.json(
          { error: "Database operation error" },
          { status: 503 }
        );
        setCorsHeaders(res, request);
        return res;
      }

      if (!payloadString) {
        const res = NextResponse.json(
          { error: INVALID_CODE_MSG },
          { status: 400 }
        );
        setCorsHeaders(res, request);
        return res;
      }

      let parsed: { userId: string; email: string; token: string };
      try {
        parsed = JSON.parse(payloadString);
      } catch {
        const res = NextResponse.json(
          { error: INVALID_CODE_MSG },
          { status: 400 }
        );
        setCorsHeaders(res, request);
        return res;
      }

      if (parsed.email.toLowerCase() !== email.toLowerCase()) {
        const res = NextResponse.json(
          { error: INVALID_CODE_MSG },
          { status: 400 }
        );
        setCorsHeaders(res, request);
        return res;
      }

      payload = { userId: parsed.userId, email: parsed.email };
      keysToDelete = [codeKey, redisKeys.resetToken(parsed.token)];
    }

    const userKeyById = redisKeys.user.byId(payload.userId);
    let userDataString: string | null = null;
    try {
      userDataString = await redisOps.get(userKeyById);
    } catch (error) {
      console.error("Redis operation error:", error);
      const res = NextResponse.json(
        { error: "Database operation error" },
        { status: 503 }
      );
      setCorsHeaders(res, request);
      return res;
    }

    if (!userDataString) {
      const res = NextResponse.json(
        { error: hasToken ? INVALID_MSG : INVALID_CODE_MSG },
        { status: 400 }
      );
      setCorsHeaders(res, request);
      return res;
    }

    let userData: { id: string; email: string; password: string; createdAt: string };
    try {
      userData = JSON.parse(userDataString);
    } catch {
      const res = NextResponse.json(
        { error: "Invalid user data" },
        { status: 500 }
      );
      setCorsHeaders(res, request);
      return res;
    }

    const saltRounds = 12;
    const hashedPassword = bcrypt.hashSync(newPassword, saltRounds);
    const updatedUserData = {
      ...userData,
      password: hashedPassword,
    };

    const userKeyByEmail = redisKeys.user.byEmail(userData.email);

    try {
      await redisOps.set(userKeyById, JSON.stringify(updatedUserData));
      await redisOps.set(userKeyByEmail, JSON.stringify(updatedUserData));
      await redisOps.delete(...keysToDelete);
    } catch (error) {
      console.error("Redis update/delete error:", error);
      const res = NextResponse.json(
        { error: "Failed to reset password" },
        { status: 503 }
      );
      setCorsHeaders(res, request);
      return res;
    }

    const response = NextResponse.json({
      success: true,
      message: "Password reset successfully",
    });
    setCorsHeaders(response, request);
    return response;
  } catch (error) {
    console.error("Reset password error:", error);
    const res = NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
    setCorsHeaders(res, request);
    return res;
  }
}
