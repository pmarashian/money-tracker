import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { getSession, getUserById } from '@/lib/redis'

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'

export async function GET(request: NextRequest) {
  try {
    let user = null

    // Try session cookie first (web clients)
    const sessionId = request.cookies.get('sessionId')?.value
    if (sessionId) {
      const session = await getSession(sessionId)
      if (session && session.expiresAt > Date.now()) {
        user = await getUserById(session.userId)
      } else if (session) {
        // Session expired, clean it up (optional)
        // await deleteSession(sessionId)
      }
    }

    // If no session cookie, try JWT token (mobile/SPA clients)
    if (!user) {
      const authHeader = request.headers.get('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7)
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string }
          user = await getUserById(decoded.userId)
        } catch (error) {
          // Token invalid or expired
          console.error('JWT verification failed:', error)
        }
      }
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      },
    })

  } catch (error) {
    console.error('Session check error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}