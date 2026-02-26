import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    console.log("Webhook received:", body);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {}

  return NextResponse.json({
    success: true,
  });
}
