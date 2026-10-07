import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireAuth } from '@/lib/auth';
import {
  getLatestSnapshotForUser,
  isSnapshotStale,
  MoneySnapshot,
} from '@/lib/snapshot';

export interface SnapshotGetResponse {
  snapshot: MoneySnapshot | null;
  as_of: string | null;
  received_at: string | null;
  stale: boolean;
}

/**
 * GET /api/snapshot
 * Latest assistant snapshot for the logged-in user (JWT / session cookie).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult) {
    return authResult;
  }

  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const envelope = await getLatestSnapshotForUser(user.id);
  if (!envelope) {
    const empty: SnapshotGetResponse = {
      snapshot: null,
      as_of: null,
      received_at: null,
      stale: false,
    };
    return NextResponse.json(empty);
  }

  const asOf = envelope.snapshot.as_of;
  const response: SnapshotGetResponse = {
    snapshot: envelope.snapshot,
    as_of: asOf,
    received_at: envelope.receivedAt,
    stale: isSnapshotStale(asOf),
  };

  return NextResponse.json(response);
}
