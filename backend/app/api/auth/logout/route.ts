import { NextRequest, NextResponse } from 'next/server';
import { setCorsHeaders } from '@/lib/cors';

export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });

    const expiredCookieValue = `auth-token=; HttpOnly; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
    response.headers.set('Set-Cookie', expiredCookieValue);
    setCorsHeaders(response, request);

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    const res = NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
    setCorsHeaders(res, request);
    return res;
  }
}