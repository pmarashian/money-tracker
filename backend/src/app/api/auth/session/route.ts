import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getSession(request);

    if (!user) {
      return NextResponse.json(
        { error: 'No valid session found' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: user,
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}