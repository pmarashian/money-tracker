import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { setCorsHeaders } from '@/lib/cors';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    if (user) {
      const res = NextResponse.json({ success: true, user });
      setCorsHeaders(res, request);
      return res;
    }
    const res = NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    setCorsHeaders(res, request);
    return res;
  } catch (error) {
    console.error('Session check error:', error);
    const res = NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
    setCorsHeaders(res, request);
    return res;
  }
}