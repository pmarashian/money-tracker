import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Money Tracker API is running',
    timestamp: new Date().toISOString()
  });
}