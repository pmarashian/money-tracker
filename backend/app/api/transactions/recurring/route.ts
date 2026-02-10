import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/auth';
import { redisOps } from '../../../../lib/redis';
import { detectRecurringTransactions, storeRecurringPatterns, type RecurringPattern } from '../../../../lib/recurring';

const FREQUENCIES = ['monthly', 'weekly', 'biweekly'] as const;

function getRecurringKey(userId: string): string {
  return `mt:recurring:${userId}`;
}

async function loadRecurringList(userId: string): Promise<RecurringPattern[]> {
  const recurringKey = getRecurringKey(userId);
  const raw = await redisOps.get(recurringKey);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function validatePattern(body: unknown): { error?: string; pattern?: RecurringPattern } {
  if (!body || typeof body !== 'object') return { error: 'Invalid body' };
  const b = body as Record<string, unknown>;
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name) return { error: 'Name is required' };
  const amount = typeof b.amount === 'number' ? b.amount : Number(b.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Amount must be a positive number' };
  const frequency = b.frequency;
  if (typeof frequency !== 'string' || !FREQUENCIES.includes(frequency as typeof FREQUENCIES[number])) {
    return { error: 'Frequency must be monthly, weekly, or biweekly' };
  }
  let typicalDayOfMonth: number | undefined;
  if (b.typicalDayOfMonth !== undefined && b.typicalDayOfMonth !== null) {
    const d = typeof b.typicalDayOfMonth === 'number' ? b.typicalDayOfMonth : Number(b.typicalDayOfMonth);
    if (!Number.isInteger(d) || d < 1 || d > 31) return { error: 'typicalDayOfMonth must be between 1 and 31' };
    typicalDayOfMonth = d;
  }
  return {
    pattern: {
      name,
      amount,
      frequency: frequency as RecurringPattern['frequency'],
      ...(typicalDayOfMonth !== undefined && { typicalDayOfMonth }),
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const recurringKey = getRecurringKey(user.id);
    let recurringPatterns = await redisOps.get(recurringKey);

    if (!recurringPatterns) {
      const patterns = await detectRecurringTransactions(user.id);
      await redisOps.set(recurringKey, JSON.stringify(patterns));
      recurringPatterns = JSON.stringify(patterns);
    }

    let patterns: RecurringPattern[];
    try {
      patterns = JSON.parse(recurringPatterns);
    } catch (error) {
      console.error('Error parsing recurring patterns:', error);
      patterns = [];
    }

    return NextResponse.json({
      recurring: patterns
    });

  } catch (error) {
    console.error('Recurring patterns error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const result = validatePattern(body);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const list = await loadRecurringList(user.id);
    list.push(result.pattern!);
    await storeRecurringPatterns(user.id, list);

    return NextResponse.json({ recurring: list }, { status: 201 });
  } catch (error) {
    console.error('Recurring POST error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const b = body as Record<string, unknown>;
    const index = typeof b.index === 'number' ? b.index : Number(b.index);
    if (!Number.isInteger(index) || index < 0) {
      return NextResponse.json({ error: 'Valid index is required' }, { status: 400 });
    }

    const list = await loadRecurringList(user.id);
    if (index >= list.length) {
      return NextResponse.json({ error: 'Index out of range' }, { status: 400 });
    }

    if (b.name !== undefined) {
      const name = typeof b.name === 'string' ? b.name.trim() : '';
      if (!name) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
      list[index].name = name;
    }
    if (b.amount !== undefined) {
      const amount = typeof b.amount === 'number' ? b.amount : Number(b.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
      }
      list[index].amount = amount;
    }
    if (b.frequency !== undefined) {
      if (typeof b.frequency !== 'string' || !FREQUENCIES.includes(b.frequency as typeof FREQUENCIES[number])) {
        return NextResponse.json({ error: 'Frequency must be monthly, weekly, or biweekly' }, { status: 400 });
      }
      list[index].frequency = b.frequency as RecurringPattern['frequency'];
    }
    if (b.typicalDayOfMonth !== undefined && b.typicalDayOfMonth !== null) {
      const d = typeof b.typicalDayOfMonth === 'number' ? b.typicalDayOfMonth : Number(b.typicalDayOfMonth);
      if (!Number.isInteger(d) || d < 1 || d > 31) {
        return NextResponse.json({ error: 'typicalDayOfMonth must be between 1 and 31' }, { status: 400 });
      }
      list[index].typicalDayOfMonth = d;
    }

    await storeRecurringPatterns(user.id, list);
    return NextResponse.json({ recurring: list });
  } catch (error) {
    console.error('Recurring PATCH error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const indexParam = searchParams.get('index');
    const index = indexParam !== null ? Number(indexParam) : NaN;
    if (!Number.isInteger(index) || index < 0) {
      return NextResponse.json({ error: 'Valid index query (index=0,1,...) is required' }, { status: 400 });
    }

    const list = await loadRecurringList(user.id);
    if (index >= list.length) {
      return NextResponse.json({ error: 'Index out of range' }, { status: 400 });
    }

    list.splice(index, 1);
    await storeRecurringPatterns(user.id, list);
    return NextResponse.json({ recurring: list });
  } catch (error) {
    console.error('Recurring DELETE error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}