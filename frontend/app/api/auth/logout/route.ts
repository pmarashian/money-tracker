import { NextRequest, NextResponse } from 'next/server'
import { deleteSession } from '@/lib/redis'

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('sessionId')?.value

    if (sessionId) {
      // Delete session from Redis
      await deleteSession(sessionId)
    }

    // Clear HTTP-only cookie
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    })

    response.cookies.set('sessionId', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // Expire immediately
    })

    return response

  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}