import { NextRequest, NextResponse } from 'next/server';
import {
  resolveUserIdByEmail,
  saveSnapshotForUser,
  validateSnapshotPayload,
  verifyPushToken,
} from '@/lib/snapshot';

/**
 * POST /api/snapshot/push
 * Assistant ingest: bearer MT_PUSH_TOKEN + target user email in body.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!process.env.MT_PUSH_TOKEN) {
    return NextResponse.json(
      { error: 'Push ingest is not configured' },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization');
  if (!verifyPushToken(authHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const emailRaw = record.email;
  const defaultEmail = process.env.MT_PUSH_DEFAULT_USER_EMAIL;
  const email =
    typeof emailRaw === 'string' && emailRaw.trim()
      ? emailRaw.trim()
      : defaultEmail?.trim() ?? '';

  if (!email) {
    return NextResponse.json(
      { error: 'email is required (or set MT_PUSH_DEFAULT_USER_EMAIL on the server)' },
      { status: 400 }
    );
  }

  const { email: _ignored, ...snapshotBody } = record;
  const validation = validateSnapshotPayload(snapshotBody);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const userId = await resolveUserIdByEmail(email);
  if (!userId) {
    return NextResponse.json({ error: 'User not found for email' }, { status: 404 });
  }

  const envelope = await saveSnapshotForUser(userId, email, validation.snapshot);

  return NextResponse.json({
    ok: true,
    userId,
    as_of: envelope.snapshot.as_of,
    received_at: envelope.receivedAt,
  });
}
