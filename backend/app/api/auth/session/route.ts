import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';


export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    return user
      ? NextResponse.json({ success: true, user })
      : NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}