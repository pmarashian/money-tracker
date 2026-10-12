import { RecurringPattern, storeRecurringPatterns } from './recurring';
import { redisOps } from './redis';

export interface SyncBillInput {
  externalKey: string;
  name: string;
  amount: number;
  frequency: RecurringPattern['frequency'];
  typicalDayOfMonth?: number;
  nextDate?: string;
  /** When set, adopt an un-keyed bill whose name matches (case-insensitive, trimmed). */
  adoptName?: string;
}

export interface RecurringSyncDiff {
  added: string[];
  updated: string[];
  deactivated: string[];
  unchanged: string[];
  skippedProtected: string[];
  adopted: string[];
}

export interface RecurringSyncResult {
  recurring: RecurringPattern[];
  diff: RecurringSyncDiff;
}

function getRecurringKey(userId: string): string {
  return `mt:recurring:${userId}`;
}

export async function loadRecurringList(userId: string): Promise<RecurringPattern[]> {
  const raw = await redisOps.get(getRecurringKey(userId));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as RecurringPattern[];
  } catch {
    return [];
  }
}

function isProtected(item: RecurringPattern): boolean {
  return item.source === 'manual' || item.userEdited === true;
}

function canAutoManage(item: RecurringPattern): boolean {
  return item.source === 'auto' && item.userEdited !== true;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/** First un-keyed bill whose name matches adoptName. Keyed bills are never adopted. */
function findUnkeyedByAdoptName(
  existing: RecurringPattern[],
  adoptName: string | undefined,
): RecurringPattern | undefined {
  if (!adoptName?.trim()) return undefined;
  const target = normalizeName(adoptName);
  return existing.find((item) => !item.externalKey && normalizeName(item.name) === target);
}

function hardDeleteOthersWithKey(
  existing: RecurringPattern[],
  byKey: Map<string, RecurringPattern>,
  keep: RecurringPattern,
  externalKey: string,
): void {
  for (let i = existing.length - 1; i >= 0; i--) {
    if (existing[i] !== keep && existing[i].externalKey === externalKey) {
      existing.splice(i, 1);
    }
  }
  byKey.delete(externalKey);
}

function adoptLegacyRecord(
  existing: RecurringPattern[],
  byKey: Map<string, RecurringPattern>,
  legacy: RecurringPattern,
  bill: SyncBillInput,
  diff: RecurringSyncDiff,
): void {
  hardDeleteOthersWithKey(existing, byKey, legacy, bill.externalKey);

  legacy.externalKey = bill.externalKey;
  byKey.set(bill.externalKey, legacy);
  diff.adopted.push(bill.externalKey);

  // User edits win: attach the key only. paused / inactive / source / amounts stay put.
  if (legacy.userEdited === true) {
    diff.skippedProtected.push(bill.externalKey);
    return;
  }

  legacy.inactive = false;
  // Joins the auto-managed set so later syncs update and deactivate this row, not a new duplicate.
  legacy.source = 'auto';
  legacy.name = bill.name;
  legacy.amount = bill.amount;
  legacy.frequency = bill.frequency;
  if (bill.typicalDayOfMonth !== undefined) {
    legacy.typicalDayOfMonth = bill.typicalDayOfMonth;
  }
  if (bill.nextDate !== undefined) {
    legacy.nextDate = bill.nextDate;
  }
}

export function mergeRecurringFromSync(
  existing: RecurringPattern[],
  incoming: SyncBillInput[]
): RecurringSyncResult {
  const diff: RecurringSyncDiff = {
    added: [],
    updated: [],
    deactivated: [],
    unchanged: [],
    skippedProtected: [],
    adopted: [],
  };

  const byKey = new Map<string, RecurringPattern>();
  for (const item of existing) {
    if (item.externalKey) {
      byKey.set(item.externalKey, item);
    }
  }

  const seenKeys = new Set<string>();

  for (const bill of incoming) {
    seenKeys.add(bill.externalKey);

    const legacy = findUnkeyedByAdoptName(existing, bill.adoptName);
    if (legacy) {
      adoptLegacyRecord(existing, byKey, legacy, bill, diff);
      continue;
    }

    const current = byKey.get(bill.externalKey);

    if (!current) {
      const created: RecurringPattern = {
        name: bill.name,
        amount: bill.amount,
        frequency: bill.frequency,
        externalKey: bill.externalKey,
        source: 'auto',
        inactive: false,
        ...(bill.typicalDayOfMonth !== undefined ? { typicalDayOfMonth: bill.typicalDayOfMonth } : {}),
        ...(bill.nextDate !== undefined ? { nextDate: bill.nextDate } : {}),
      };
      existing.push(created);
      byKey.set(bill.externalKey, created);
      diff.added.push(bill.externalKey);
      continue;
    }

    if (isProtected(current)) {
      diff.skippedProtected.push(bill.externalKey);
      diff.unchanged.push(bill.externalKey);
      continue;
    }

    if (!canAutoManage(current)) {
      diff.unchanged.push(bill.externalKey);
      continue;
    }

    let changed = false;
    if (current.name !== bill.name) {
      current.name = bill.name;
      changed = true;
    }
    if (current.amount !== bill.amount) {
      current.amount = bill.amount;
      changed = true;
    }
    if (current.frequency !== bill.frequency) {
      current.frequency = bill.frequency;
      changed = true;
    }
    if (bill.typicalDayOfMonth !== undefined && current.typicalDayOfMonth !== bill.typicalDayOfMonth) {
      current.typicalDayOfMonth = bill.typicalDayOfMonth;
      changed = true;
    }
    if (bill.nextDate !== undefined && current.nextDate !== bill.nextDate) {
      current.nextDate = bill.nextDate;
      changed = true;
    }
    if (current.inactive) {
      current.inactive = false;
      changed = true;
    }

    if (changed) {
      diff.updated.push(bill.externalKey);
    } else {
      diff.unchanged.push(bill.externalKey);
    }
  }

  for (const item of existing) {
    if (!item.externalKey || !canAutoManage(item)) {
      continue;
    }
    if (!seenKeys.has(item.externalKey) && !item.inactive) {
      item.inactive = true;
      diff.deactivated.push(item.externalKey);
    }
  }

  return { recurring: existing, diff };
}

export async function syncRecurringForUser(
  userId: string,
  incoming: SyncBillInput[]
): Promise<RecurringSyncResult> {
  const existing = await loadRecurringList(userId);
  const result = mergeRecurringFromSync(existing, incoming);
  await storeRecurringPatterns(userId, result.recurring);
  return result;
}
