import { NextRequest, NextResponse } from 'next/server';
import { resolveUserIdByEmail, verifyPushToken } from './snapshot';

export async function requirePushIngestUser(
  request: NextRequest
): Promise<{ userId: string; email: string } | NextResponse> {
  if (!process.env.MT_PUSH_TOKEN) {
    return NextResponse.json({ error: 'Push ingest is not configured' }, { status: 503 });
  }

  const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization');
  if (!verifyPushToken(authHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const defaultEmail = process.env.MT_PUSH_DEFAULT_USER_EMAIL?.trim() ?? '';
  if (!defaultEmail) {
    return NextResponse.json(
      { error: 'MT_PUSH_DEFAULT_USER_EMAIL must be set on the server' },
      { status: 503 }
    );
  }

  const userId = await resolveUserIdByEmail(defaultEmail);
  if (!userId) {
    return NextResponse.json({ error: 'User not found for MT_PUSH_DEFAULT_USER_EMAIL' }, { status: 404 });
  }

  return { userId, email: defaultEmail };
}
