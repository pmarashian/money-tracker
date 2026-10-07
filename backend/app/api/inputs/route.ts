import { NextRequest, NextResponse } from 'next/server';
import { requirePushIngestUser } from '@/lib/pushIngest';
import { loadRecurringList } from '@/lib/recurringSync';
import { getUserSettings } from '@/lib/settings';

/**
 * GET /api/inputs — assistant read of projection inputs (Bearer MT_PUSH_TOKEN).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requirePushIngestUser(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const settings = await getUserSettings(auth.userId);
  const recurring = await loadRecurringList(auth.userId);

  return NextResponse.json({
    email: auth.email,
    userId: auth.userId,
    settings,
    recurring,
  });
}
