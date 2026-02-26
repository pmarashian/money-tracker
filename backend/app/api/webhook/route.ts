import { NextRequest, NextResponse } from "next/server";
import { getLogtail } from "@/lib/logtail";

export async function GET() {
  await getLogtail().info("Webhook test", { payload: "test" });

  return NextResponse.json({
    success: true,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    await getLogtail().info("Webhook received", {
      service: "[webhook]",
      payload: JSON.stringify(body),
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.log("Error:", error.message);
    await getLogtail().error("Webhook error", {
      error: error.message,
    });
  }

  return NextResponse.json({
    success: true,
  });
}
