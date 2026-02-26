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
    await getLogtail().info("Webhook received", { payload: body });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {}

  return NextResponse.json({
    success: true,
  });
}
