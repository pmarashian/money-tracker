import { NextRequest, NextResponse } from 'next/server';
import { requirePushIngestUser } from '@/lib/pushIngest';
import { SyncBillInput, syncRecurringForUser } from '@/lib/recurringSync';

const FREQUENCIES = ['monthly', 'weekly', 'biweekly'] as const;

function parseSyncBody(body: unknown): { bills: SyncBillInput[] } | { error: string } {
  const list = Array.isArray(body) ? body : null;
  if (!list) {
    return { error: 'Request body must be a JSON array of bills' };
  }

  const bills: SyncBillInput[] = [];
  for (let i = 0; i < list.length; i++) {
    const row = list[i];
    if (!row || typeof row !== 'object') {
      return { error: `bills[${i}] must be an object` };
    }
    const r = row as Record<string, unknown>;
    const externalKey = typeof r.externalKey === 'string' ? r.externalKey.trim() : '';
    if (!externalKey) {
      return { error: `bills[${i}].externalKey is required` };
    }
    const name = typeof r.name === 'string' ? r.name.trim() : '';
    if (!name) {
      return { error: `bills[${i}].name is required` };
    }
    const amount = typeof r.amount === 'number' ? r.amount : Number(r.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { error: `bills[${i}].amount must be a positive number` };
    }
    const frequency = r.frequency;
    if (typeof frequency !== 'string' || !FREQUENCIES.includes(frequency as (typeof FREQUENCIES)[number])) {
      return { error: `bills[${i}].frequency must be monthly, weekly, or biweekly` };
    }
    let typicalDayOfMonth: number | undefined;
    if (r.typicalDayOfMonth !== undefined && r.typicalDayOfMonth !== null) {
      const d =
        typeof r.typicalDayOfMonth === 'number' ? r.typicalDayOfMonth : Number(r.typicalDayOfMonth);
      if (!Number.isInteger(d) || d < 1 || d > 31) {
        return { error: `bills[${i}].typicalDayOfMonth must be between 1 and 31` };
      }
      typicalDayOfMonth = d;
    }
    let nextDate: string | undefined;
    if (r.nextDate !== undefined && r.nextDate !== null) {
      if (typeof r.nextDate !== 'string' || !r.nextDate.trim()) {
        return { error: `bills[${i}].nextDate must be a string` };
      }
      nextDate = r.nextDate.trim();
    }
    bills.push({
      externalKey,
      name,
      amount,
      frequency: frequency as SyncBillInput['frequency'],
      ...(typicalDayOfMonth !== undefined ? { typicalDayOfMonth } : {}),
      ...(nextDate !== undefined ? { nextDate } : {}),
    });
  }

  return { bills };
}

/**
 * POST /api/recurring/sync — merge Chase-detected bills (Bearer MT_PUSH_TOKEN).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requirePushIngestUser(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  const parsed = parseSyncBody(body);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await syncRecurringForUser(auth.userId, parsed.bills);
  return NextResponse.json({
    ok: true,
    diff: result.diff,
    recurring: result.recurring,
  });
}
