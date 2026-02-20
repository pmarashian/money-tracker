import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getRedisClient, redisKeys, redisOps } from "@/lib/redis";
import { setCorsHeaders } from "@/lib/cors";
import { Resend } from "resend";

const GENERIC_MESSAGE =
  "If an account exists with this email, you'll receive a reset link. Check your inbox.";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      const res = NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
      setCorsHeaders(res, request);
      return res;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const res = NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
      setCorsHeaders(res, request);
      return res;
    }

    try {
      getRedisClient();
    } catch (error) {
      console.error("Redis connection error:", error);
      const res = NextResponse.json(
        { error: "Database connection error" },
        { status: 503 }
      );
      setCorsHeaders(res, request);
      return res;
    }

    const userKey = redisKeys.user.byEmail(email);
    let userDataString: string | null = null;
    try {
      userDataString = await redisOps.get(userKey);
    } catch (error) {
      console.error("Redis operation error:", error);
      const res = NextResponse.json(
        { error: "Database operation error" },
        { status: 503 }
      );
      setCorsHeaders(res, request);
      return res;
    }

    if (userDataString) {
      let userData: { id: string; email: string };
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

      const token = crypto.randomBytes(32).toString("hex");
      const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
      const tokenPayload = JSON.stringify({
        userId: userData.id,
        email: userData.email,
        code,
      });
      const codePayload = JSON.stringify({
        userId: userData.id,
        email: userData.email,
        token,
      });

      try {
        await redisOps.set(redisKeys.resetToken(token), tokenPayload, 3600);
        await redisOps.set(redisKeys.resetCode(code), codePayload, 3600);
      } catch (error) {
        console.error("Redis set reset token/code error:", error);
        const res = NextResponse.json(
          { message: GENERIC_MESSAGE },
          { status: 200 }
        );
        setCorsHeaders(res, request);
        return res;
      }

      const scheme = process.env.APP_DEEP_LINK_SCHEME;
      const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, "") ?? "";
      const resetUrl = scheme
        ? `${scheme}://reset-password?token=${token}`
        : `${frontendUrl}/reset-password?token=${token}`;

      const resendKey = process.env.RESEND_API_KEY;
      const from = process.env.RESEND_FROM ?? "onboarding@resend.dev";

      if (resendKey) {
        try {
          const resend = new Resend(resendKey);
          await resend.emails.send({
            from,
            to: email,
            subject: "Reset your password",
            html: `Click the link below to reset your password.<br><br><a href="${resetUrl}">Reset password</a><br><br>Or go to the reset page and enter this code with your email: <strong>${code}</strong>. Code and link expire in 1 hour.`,
          });
        } catch (err) {
          console.error("Resend send error:", err);
        }
      }
    }

    const response = NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 });
    setCorsHeaders(response, request);
    return response;
  } catch (error) {
    console.error("Forgot password error:", error);
    const res = NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
    setCorsHeaders(res, request);
    return res;
  }
}
