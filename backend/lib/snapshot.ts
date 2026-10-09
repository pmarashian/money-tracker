import { timingSafeEqual } from 'crypto';
import { redisKeys, redisOps } from './redis';

export const SNAPSHOT_HISTORY_MAX = 90;

export type SnapshotStatus = 'on_track' | 'needs_topoff';

export interface SnapshotBill {
  name: string;
  amount: number;
  frequency: string;
  next_date: string;
}

export interface SnapshotAmountDate {
  amount: number;
  date: string;
}

/** Core fields from assistant `latest_summary.json`; extra keys are preserved. */
export interface MoneySnapshot {
  as_of: string;
  current_available_balance: number;
  next_bonus_date: string;
  projected_low_to_bonus: SnapshotAmountDate;
  topoff_needed_after_bonus: number;
  following_bonus_date: string;
  low_after_topoff: SnapshotAmountDate;
  status: SnapshotStatus;
  topoff_needed_now: number;
  bills: SnapshotBill[];
  /** Set when the app recomputes locally; assistant push omits or overwrites. */
  source?: 'app-recompute' | 'assistant-push';
  balance_before_next_bonus?: SnapshotAmountDate;
  min_balance?: number;
  topoff_round_up?: number;
  topoff_needed_after_bonus_exact?: number;
  topoff_needed_now_exact?: number;
  topoff_needed_now_by?: string | null;
  scenarios?: Record<string, unknown>;
  paycheck_anchor_friday?: string;
}

export interface StoredSnapshotEnvelope {
  userId: string;
  email: string;
  receivedAt: string;
  snapshot: MoneySnapshot;
}

export type SnapshotValidationResult =
  | { ok: true; snapshot: MoneySnapshot }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isIsoDateTime(value: unknown): boolean {
  if (typeof value !== 'string' || !value.trim()) return false;
  const ms = Date.parse(value);
  return !Number.isNaN(ms);
}

function validateAmountDate(value: unknown, field: string): SnapshotAmountDate | string {
  if (!isRecord(value)) return `${field} must be an object`;
  if (!isFiniteNumber(value.amount)) return `${field}.amount must be a number`;
  if (typeof value.date !== 'string' || !value.date.trim()) return `${field}.date must be a string`;
  return { amount: value.amount, date: value.date };
}

function validateBill(value: unknown, index: number): SnapshotBill | string {
  if (!isRecord(value)) return `bills[${index}] must be an object`;
  if (typeof value.name !== 'string' || !value.name.trim()) {
    return `bills[${index}].name must be a non-empty string`;
  }
  if (!isFiniteNumber(value.amount)) return `bills[${index}].amount must be a number`;
  if (typeof value.frequency !== 'string' || !value.frequency.trim()) {
    return `bills[${index}].frequency must be a string`;
  }
  if (typeof value.next_date !== 'string' || !value.next_date.trim()) {
    return `bills[${index}].next_date must be a string`;
  }
  return {
    name: value.name,
    amount: value.amount,
    frequency: value.frequency,
    next_date: value.next_date,
  };
}

/**
 * Validate assistant snapshot payload. Unknown top-level fields are kept on the snapshot object.
 */
export function validateSnapshotPayload(body: unknown): SnapshotValidationResult {
  if (!isRecord(body)) {
    return { ok: false, error: 'Request body must be a JSON object' };
  }

  const requiredChecks: Array<[string, (v: unknown) => boolean, string]> = [
    ['as_of', isIsoDateTime, 'as_of must be an ISO datetime string'],
    ['current_available_balance', isFiniteNumber, 'current_available_balance must be a number'],
    ['next_bonus_date', (v) => typeof v === 'string' && v.trim().length > 0, 'next_bonus_date must be a string'],
    ['topoff_needed_after_bonus', isFiniteNumber, 'topoff_needed_after_bonus must be a number'],
    ['following_bonus_date', (v) => typeof v === 'string' && v.trim().length > 0, 'following_bonus_date must be a string'],
    ['topoff_needed_now', isFiniteNumber, 'topoff_needed_now must be a number'],
  ];

  for (const [key, check, message] of requiredChecks) {
    if (!check(body[key])) {
      return { ok: false, error: message };
    }
  }

  if (body.status !== 'on_track' && body.status !== 'needs_topoff') {
    return { ok: false, error: 'status must be "on_track" or "needs_topoff"' };
  }

  const projectedLow = validateAmountDate(body.projected_low_to_bonus, 'projected_low_to_bonus');
  if (typeof projectedLow === 'string') {
    return { ok: false, error: projectedLow };
  }

  const lowAfterTopoff = validateAmountDate(body.low_after_topoff, 'low_after_topoff');
  if (typeof lowAfterTopoff === 'string') {
    return { ok: false, error: lowAfterTopoff };
  }

  if (!Array.isArray(body.bills)) {
    return { ok: false, error: 'bills must be an array' };
  }

  const bills: SnapshotBill[] = [];
  for (let i = 0; i < body.bills.length; i++) {
    const bill = validateBill(body.bills[i], i);
    if (typeof bill === 'string') {
      return { ok: false, error: bill };
    }
    bills.push(bill);
  }

  const snapshot = { ...body } as unknown as MoneySnapshot;
  snapshot.as_of = body.as_of as string;
  snapshot.current_available_balance = body.current_available_balance as number;
  snapshot.next_bonus_date = body.next_bonus_date as string;
  snapshot.projected_low_to_bonus = projectedLow;
  snapshot.topoff_needed_after_bonus = body.topoff_needed_after_bonus as number;
  snapshot.following_bonus_date = body.following_bonus_date as string;
  snapshot.low_after_topoff = lowAfterTopoff;
  snapshot.status = body.status as SnapshotStatus;
  snapshot.topoff_needed_now = body.topoff_needed_now as number;
  snapshot.bills = bills;

  if (snapshot.status === 'on_track' && snapshot.topoff_needed_now !== 0) {
    return { ok: false, error: 'topoff_needed_now must be 0 when status is on_track' };
  }

  return { ok: true, snapshot };
}

function safeEqualToken(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }
  return timingSafeEqual(providedBuf, expectedBuf);
}

/**
 * Verify bearer token for assistant push. Returns false if MT_PUSH_TOKEN is unset.
 */
export function verifyPushToken(authorizationHeader: string | null): boolean {
  const expected = process.env.MT_PUSH_TOKEN;
  if (!expected) {
    return false;
  }
  if (!authorizationHeader?.startsWith('Bearer ')) {
    return false;
  }
  const token = authorizationHeader.slice('Bearer '.length).trim();
  if (!token) {
    return false;
  }
  return safeEqualToken(token, expected);
}

export async function resolveUserIdByEmail(email: string): Promise<string | null> {
  const trimmed = email.trim();
  if (!trimmed) return null;
  const userData = await redisOps.get(redisKeys.user.byEmail(trimmed));
  if (!userData) return null;
  try {
    const parsed = JSON.parse(userData) as { id?: string };
    return parsed.id ?? null;
  } catch {
    return null;
  }
}

async function writeLatestSnapshotEnvelope(
  userId: string,
  envelope: StoredSnapshotEnvelope
): Promise<void> {
  await redisOps.set(redisKeys.snapshot(userId), JSON.stringify(envelope));
}

/**
 * Assistant push: updates latest display snapshot, stores assistant baseline, appends history.
 */
export async function saveAssistantPushSnapshot(
  userId: string,
  email: string,
  snapshot: MoneySnapshot
): Promise<StoredSnapshotEnvelope> {
  const stamped: MoneySnapshot = {
    ...snapshot,
    source: 'assistant-push',
  };
  const envelope: StoredSnapshotEnvelope = {
    userId,
    email,
    receivedAt: new Date().toISOString(),
    snapshot: stamped,
  };
  const serialized = JSON.stringify(envelope);
  await writeLatestSnapshotEnvelope(userId, envelope);
  await redisOps.set(redisKeys.snapshotAssistant(userId), serialized);
  await redisOps.lpush(redisKeys.snapshotHistory(userId), serialized);
  await redisOps.ltrim(redisKeys.snapshotHistory(userId), 0, SNAPSHOT_HISTORY_MAX - 1);
  return envelope;
}

/** App-side recompute: refresh latest snapshot only (assistant baseline unchanged). */
export async function saveRecomputedSnapshotForUser(
  userId: string,
  email: string,
  snapshot: MoneySnapshot
): Promise<StoredSnapshotEnvelope> {
  const envelope: StoredSnapshotEnvelope = {
    userId,
    email,
    receivedAt: new Date().toISOString(),
    snapshot: { ...snapshot, source: 'app-recompute' },
  };
  await writeLatestSnapshotEnvelope(userId, envelope);
  return envelope;
}

/** @deprecated Use saveAssistantPushSnapshot or saveRecomputedSnapshotForUser */
export async function saveSnapshotForUser(
  userId: string,
  email: string,
  snapshot: MoneySnapshot
): Promise<StoredSnapshotEnvelope> {
  return saveAssistantPushSnapshot(userId, email, snapshot);
}

export async function getAssistantSnapshotForUser(
  userId: string
): Promise<StoredSnapshotEnvelope | null> {
  const raw = await redisOps.get(redisKeys.snapshotAssistant(userId));
  if (raw) {
    try {
      return JSON.parse(raw) as StoredSnapshotEnvelope;
    } catch {
      return null;
    }
  }
  // Migration: pushes made before the assistant key existed only wrote the latest key
  // and the history list. Fall back to the latest pushed (non-recompute) snapshot.
  const latest = await getLatestSnapshotForUser(userId);
  if (latest && latest.snapshot.source !== 'app-recompute') {
    return latest;
  }
  const history = await redisOps.lrange(redisKeys.snapshotHistory(userId), 0, 0);
  if (history.length > 0) {
    try {
      return JSON.parse(history[0]) as StoredSnapshotEnvelope;
    } catch {
      return null;
    }
  }
  return null;
}

export async function getLatestSnapshotForUser(
  userId: string
): Promise<StoredSnapshotEnvelope | null> {
  const raw = await redisOps.get(redisKeys.snapshot(userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSnapshotEnvelope;
  } catch {
    return null;
  }
}

export const SNAPSHOT_STALE_MS = 3 * 24 * 60 * 60 * 1000;

export function isSnapshotStale(asOfIso: string, nowMs = Date.now()): boolean {
  const asOfMs = Date.parse(asOfIso);
  if (Number.isNaN(asOfMs)) return true;
  return nowMs - asOfMs > SNAPSHOT_STALE_MS;
}
