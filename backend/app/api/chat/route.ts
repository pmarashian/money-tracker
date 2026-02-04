import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '../../../lib/auth';
import { processChatRequest } from '../../../lib/chat';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required and must be a non-empty string' }, { status: 400 });
    }

    // Process chat request
    const result = await processChatRequest(user.id, message.trim());

    return NextResponse.json({
      response: result.response,
      contextUsed: result.contextUsed,
    });

  } catch (error) {
    console.error('Chat endpoint error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}