import { NextRequest, NextResponse } from "next/server";
import { getLogtail } from "@/lib/logtail";

export async function GET() {
  return NextResponse.json({
    success: true,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("Webhook received:", body);
    await getLogtail().info("Webhook received", { payload: body });

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.log("Error:", error.message);
  }

  return NextResponse.json({
    success: true,
  });
}
