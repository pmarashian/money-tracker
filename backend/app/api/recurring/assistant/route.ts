import { NextRequest, NextResponse } from 'next/server';
import { requirePushIngestUser } from '@/lib/pushIngest';
import {
  applyAssistantRecurringActionsForUser,
  type AssistantRecurringAction,
  type AssistantRecurringActionName,
} from '@/lib/recurringAssistant';
import { triggerSnapshotRecompute } from '@/lib/snapshotRecomputeTrigger';

const ACTIONS = new Set<AssistantRecurringActionName>([
  'create',
  'update',
  'pause',
  'unpause',
  'deactivate',
]);

function parseActions(body: unknown): { actions: AssistantRecurringAction[] } | { error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object' };
  }
  const record = body as Record<string, unknown>;
  let rawActions: unknown[];
  if (Array.isArray(record.actions)) {
    rawActions = record.actions;
  } else if (typeof record.action === 'string') {
    rawActions = [record];
  } else {
    return { error: 'Provide action or actions[]' };
  }

  if (rawActions.length === 0) {
    return { error: 'actions must not be empty' };
  }

  const actions: AssistantRecurringAction[] = [];
  for (let i = 0; i < rawActions.length; i++) {
    const row = rawActions[i];
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      return { error: `actions[${i}] must be an object` };
    }
    const r = row as Record<string, unknown>;
    const actionName = r.action;
    if (typeof actionName !== 'string' || !ACTIONS.has(actionName as AssistantRecurringActionName)) {
      return {
        error: `actions[${i}].action must be create, update, pause, unpause, or deactivate`,
      };
    }
    const action: AssistantRecurringAction = {
      action: actionName as AssistantRecurringActionName,
    };
    if (typeof r.id === 'string') action.id = r.id;
    if (typeof r.externalKey === 'string') action.externalKey = r.externalKey;
    if (typeof r.matchName === 'string') action.matchName = r.matchName;
    if (r.force !== undefined) action.force = Boolean(r.force);
    if (typeof r.name === 'string') action.name = r.name;
    if (r.amount !== undefined) {
      action.amount = typeof r.amount === 'number' ? r.amount : Number(r.amount);
    }
    if (typeof r.frequency === 'string') {
      action.frequency = r.frequency as AssistantRecurringAction['frequency'];
    }
    if (r.day !== undefined) {
      action.day = typeof r.day === 'number' ? r.day : Number(r.day);
    }
    if (r.typicalDayOfMonth !== undefined) {
      action.typicalDayOfMonth =
        typeof r.typicalDayOfMonth === 'number'
          ? r.typicalDayOfMonth
          : Number(r.typicalDayOfMonth);
    }
    if (r.nextDate !== undefined) {
      action.nextDate = r.nextDate as string;
    }
    actions.push(action);
  }

  return { actions };
}

/**
 * POST /api/recurring/assistant — manage recurring bills (Bearer MT_PUSH_TOKEN).
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

  const parsed = parseActions(body);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await applyAssistantRecurringActionsForUser(auth.userId, parsed.actions);
  if (result.changed) {
    await triggerSnapshotRecompute(auth.userId, auth.email);
  }

  return NextResponse.json({
    ok: true,
    results: result.results,
    recurring: result.recurring,
  });
}
