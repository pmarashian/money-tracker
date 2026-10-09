import { randomUUID } from 'crypto';
import { RecurringPattern, storeRecurringPatterns } from './recurring';
import { loadRecurringList } from './recurringSync';

const FREQUENCIES = ['monthly', 'weekly', 'biweekly'] as const;

export type AssistantRecurringActionName =
  | 'create'
  | 'update'
  | 'pause'
  | 'unpause'
  | 'deactivate';

export interface AssistantRecurringAction {
  action: AssistantRecurringActionName;
  id?: string;
  externalKey?: string;
  /**
   * Target a legacy row (no id and no externalKey) by exact name (trimmed, case-insensitive).
   * For pause/unpause/deactivate, `name` is used as the target when matchName is omitted.
   */
  matchName?: string;
  force?: boolean;
  name?: string;
  amount?: number;
  frequency?: RecurringPattern['frequency'];
  /** Alias for typicalDayOfMonth */
  day?: number;
  typicalDayOfMonth?: number;
  nextDate?: string;
}

export type AssistantRecurringActionResult =
  | {
      action: AssistantRecurringActionName;
      status: 'ok';
      id?: string;
      externalKey?: string;
      index: number;
    }
  | {
      action: AssistantRecurringActionName;
      status: 'skipped';
      reason: 'userEdited';
      id?: string;
      externalKey?: string;
      index: number;
    }
  | {
      action: AssistantRecurringActionName;
      status: 'error';
      error: string;
      id?: string;
      externalKey?: string;
    };

export interface AssistantRecurringApplyResult {
  recurring: RecurringPattern[];
  results: AssistantRecurringActionResult[];
  changed: boolean;
}

function isFrequency(value: unknown): value is RecurringPattern['frequency'] {
  return typeof value === 'string' && FREQUENCIES.includes(value as (typeof FREQUENCIES)[number]);
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function targetName(action: AssistantRecurringAction): string {
  if (typeof action.matchName === 'string' && action.matchName.trim()) {
    return action.matchName;
  }
  // For update, `name` is the new value, never a selector.
  if (action.action !== 'update' && typeof action.name === 'string' && action.name.trim()) {
    return action.name;
  }
  return '';
}

function findIndex(
  list: RecurringPattern[],
  action: AssistantRecurringAction
): { index: number } | { error: string } {
  const id = typeof action.id === 'string' ? action.id.trim() : '';
  const externalKey =
    typeof action.externalKey === 'string' ? action.externalKey.trim() : '';
  if (id || externalKey) {
    if (id) {
      const byId = list.findIndex((row) => row.id === id);
      if (byId >= 0) return { index: byId };
    }
    if (externalKey) {
      const byKey = list.findIndex((row) => row.externalKey === externalKey);
      if (byKey >= 0) return { index: byKey };
    }
    return { error: 'Recurring bill not found' };
  }

  const name = targetName(action);
  if (!name) {
    return { error: 'id, externalKey, or matchName is required' };
  }
  const wanted = normalizeName(name);
  const matches: number[] = [];
  list.forEach((row, index) => {
    const hasId = typeof row.id === 'string' && row.id.trim() !== '';
    const hasKey = typeof row.externalKey === 'string' && row.externalKey.trim() !== '';
    if (!hasId && !hasKey && typeof row.name === 'string' && normalizeName(row.name) === wanted) {
      matches.push(index);
    }
  });
  if (matches.length === 0) {
    return { error: 'Recurring bill not found (name match only covers rows without id/externalKey)' };
  }
  if (matches.length > 1) {
    return { error: `Ambiguous name: ${matches.length} rows without id/externalKey match "${name.trim()}"` };
  }
  return { index: matches[0] };
}

function parseDay(action: AssistantRecurringAction): number | undefined | { error: string } {
  const raw = action.day !== undefined ? action.day : action.typicalDayOfMonth;
  if (raw === undefined || raw === null) return undefined;
  const d = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(d) || d < 1 || d > 31) {
    return { error: 'day / typicalDayOfMonth must be between 1 and 31' };
  }
  return d;
}

function applyCreate(
  list: RecurringPattern[],
  action: AssistantRecurringAction
): AssistantRecurringActionResult {
  const name = typeof action.name === 'string' ? action.name.trim() : '';
  if (!name) {
    return { action: 'create', status: 'error', error: 'name is required' };
  }
  const amount =
    typeof action.amount === 'number' ? action.amount : Number(action.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      action: 'create',
      status: 'error',
      error: 'amount must be a positive number',
    };
  }
  if (!isFrequency(action.frequency)) {
    return {
      action: 'create',
      status: 'error',
      error: 'frequency must be monthly, weekly, or biweekly',
    };
  }
  const dayResult = parseDay(action);
  if (dayResult && typeof dayResult === 'object' && 'error' in dayResult) {
    return { action: 'create', status: 'error', error: dayResult.error };
  }
  const externalKey =
    typeof action.externalKey === 'string' && action.externalKey.trim()
      ? action.externalKey.trim()
      : undefined;
  if (externalKey && list.some((row) => row.externalKey === externalKey)) {
    return {
      action: 'create',
      status: 'error',
      error: 'externalKey already exists',
      externalKey,
    };
  }
  const id =
    typeof action.id === 'string' && action.id.trim()
      ? action.id.trim()
      : randomUUID();
  if (list.some((row) => row.id === id)) {
    return { action: 'create', status: 'error', error: 'id already exists', id };
  }
  let nextDate: string | undefined;
  if (action.nextDate !== undefined && action.nextDate !== null) {
    if (typeof action.nextDate !== 'string' || !action.nextDate.trim()) {
      return { action: 'create', status: 'error', error: 'nextDate must be a string' };
    }
    nextDate = action.nextDate.trim();
  }

  const created: RecurringPattern = {
    id,
    name,
    amount,
    frequency: action.frequency,
    source: 'auto',
    inactive: false,
    paused: false,
    ...(externalKey ? { externalKey } : {}),
    ...(typeof dayResult === 'number' ? { typicalDayOfMonth: dayResult } : {}),
    ...(nextDate !== undefined ? { nextDate } : {}),
  };
  // Intentionally omit userEdited — assistant-managed rows stay assistant-editable.
  list.push(created);
  return {
    action: 'create',
    status: 'ok',
    id: created.id,
    externalKey: created.externalKey,
    index: list.length - 1,
  };
}

function applyTargetedMutation(
  list: RecurringPattern[],
  action: AssistantRecurringAction,
  mutate: (row: RecurringPattern) => string | void
): AssistantRecurringActionResult {
  const found = findIndex(list, action);
  if ('error' in found) {
    return {
      action: action.action,
      status: 'error',
      error: found.error,
      id: action.id,
      externalKey: action.externalKey,
    };
  }
  const row = list[found.index];
  if (row.userEdited === true && action.force !== true) {
    return {
      action: action.action,
      status: 'skipped',
      reason: 'userEdited',
      id: row.id,
      externalKey: row.externalKey,
      index: found.index,
    };
  }

  const mutateError = mutate(row);
  if (mutateError) {
    return {
      action: action.action,
      status: 'error',
      error: mutateError,
      id: row.id,
      externalKey: row.externalKey,
    };
  }

  // Never set or clear userEdited from assistant mutations.
  return {
    action: action.action,
    status: 'ok',
    id: row.id,
    externalKey: row.externalKey,
    index: found.index,
  };
}

function applyUpdate(
  list: RecurringPattern[],
  action: AssistantRecurringAction
): AssistantRecurringActionResult {
  return applyTargetedMutation(list, action, (row) => {
    if (action.name !== undefined) {
      const name = typeof action.name === 'string' ? action.name.trim() : '';
      if (!name) return 'name cannot be empty';
      row.name = name;
    }
    if (action.amount !== undefined) {
      const amount =
        typeof action.amount === 'number' ? action.amount : Number(action.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return 'amount must be a positive number';
      }
      row.amount = amount;
    }
    if (action.frequency !== undefined) {
      if (!isFrequency(action.frequency)) {
        return 'frequency must be monthly, weekly, or biweekly';
      }
      row.frequency = action.frequency;
    }
    if (action.day !== undefined || action.typicalDayOfMonth !== undefined) {
      const dayResult = parseDay(action);
      if (dayResult && typeof dayResult === 'object' && 'error' in dayResult) {
        return dayResult.error;
      }
      if (typeof dayResult === 'number') {
        row.typicalDayOfMonth = dayResult;
      }
    }
    if (action.nextDate !== undefined) {
      if (typeof action.nextDate !== 'string' || !action.nextDate.trim()) {
        return 'nextDate must be a string';
      }
      row.nextDate = action.nextDate.trim();
    }
  });
}

export function applyAssistantRecurringActions(
  existing: RecurringPattern[],
  actions: AssistantRecurringAction[]
): AssistantRecurringApplyResult {
  const list = existing.map((row) => ({ ...row }));
  const results: AssistantRecurringActionResult[] = [];
  let changed = false;

  for (const action of actions) {
    let result: AssistantRecurringActionResult;
    switch (action.action) {
      case 'create':
        result = applyCreate(list, action);
        break;
      case 'update':
        result = applyUpdate(list, action);
        break;
      case 'pause':
        result = applyTargetedMutation(list, action, (row) => {
          row.paused = true;
        });
        break;
      case 'unpause':
        result = applyTargetedMutation(list, action, (row) => {
          row.paused = false;
        });
        break;
      case 'deactivate':
        result = applyTargetedMutation(list, action, (row) => {
          row.inactive = true;
        });
        break;
      default:
        result = {
          action: action.action,
          status: 'error',
          error: `Unknown action: ${String((action as { action?: unknown }).action)}`,
        };
    }
    results.push(result);
    if (result.status === 'ok') changed = true;
  }

  return { recurring: list, results, changed };
}

export async function applyAssistantRecurringActionsForUser(
  userId: string,
  actions: AssistantRecurringAction[]
): Promise<AssistantRecurringApplyResult> {
  const existing = await loadRecurringList(userId);
  const result = applyAssistantRecurringActions(existing, actions);
  if (result.changed) {
    await storeRecurringPatterns(userId, result.recurring);
  }
  return result;
}
