import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const redisMocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  lpush: vi.fn(),
  ltrim: vi.fn(),
  lrange: vi.fn(),
}));

vi.mock('./redis', () => ({
  redisOps: {
    get: redisMocks.get,
    set: redisMocks.set,
    lpush: redisMocks.lpush,
    ltrim: redisMocks.ltrim,
    lrange: redisMocks.lrange,
    delete: vi.fn(),
    exists: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),
  },
  redisKeys: {
    user: { byEmail: (e: string) => `mt:user:${e}`, byId: (id: string) => `mt:user:id:${id}` },
    snapshot: (id: string) => `mt:snapshot:${id}`,
    snapshotAssistant: (id: string) => `mt:snapshot:assistant:${id}`,
    snapshotHistory: (id: string) => `mt:snapshot:history:${id}`,
  },
}));

import {
  getAssistantSnapshotForUser,
  validateSnapshotPayload,
  verifyPushToken,
  isSnapshotStale,
  saveAssistantPushSnapshot,
  SNAPSHOT_HISTORY_MAX,
} from './snapshot';

const validSnapshot = {
  as_of: '2026-10-07T12:00:00.000Z',
  current_available_balance: 4200.5,
  next_bonus_date: '2026-10-31',
  projected_low_to_bonus: { amount: 150, date: '2026-10-20' },
  topoff_needed_after_bonus: 800,
  following_bonus_date: '2027-01-31',
  low_after_topoff: { amount: 200, date: '2026-11-15' },
  status: 'on_track' as const,
  topoff_needed_now: 0,
  bills: [
    { name: 'Rent', amount: 2100, frequency: 'monthly', next_date: '2026-11-01' },
  ],
  extra_future_field: { note: 'allowed' },
};

describe('validateSnapshotPayload', () => {
  it('accepts a valid payload and preserves extra fields', () => {
    const result = validateSnapshotPayload(validSnapshot);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.extra_future_field).toEqual({ note: 'allowed' });
      expect(result.snapshot.bills).toHaveLength(1);
    }
  });

  it('rejects missing status', () => {
    const { status: _, ...rest } = validSnapshot;
    const result = validateSnapshotPayload(rest);
    expect(result.ok).toBe(false);
  });

  it('rejects on_track with non-zero topoff_needed_now', () => {
    const result = validateSnapshotPayload({
      ...validSnapshot,
      topoff_needed_now: 50,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('topoff_needed_now');
    }
  });
});

describe('verifyPushToken', () => {
  const original = process.env.MT_PUSH_TOKEN;

  beforeEach(() => {
    process.env.MT_PUSH_TOKEN = 'test-push-secret-token';
  });

  afterEach(() => {
    process.env.MT_PUSH_TOKEN = original;
  });

  it('returns false when env var is unset', () => {
    delete process.env.MT_PUSH_TOKEN;
    expect(verifyPushToken('Bearer anything')).toBe(false);
  });

  it('accepts matching bearer token', () => {
    expect(verifyPushToken('Bearer test-push-secret-token')).toBe(true);
  });

  it('rejects wrong token without throwing', () => {
    expect(verifyPushToken('Bearer wrong')).toBe(false);
  });
});

describe('isSnapshotStale', () => {
  it('marks snapshots older than 3 days as stale', () => {
    const now = Date.parse('2026-10-07T12:00:00.000Z');
    const fresh = '2026-10-06T12:00:00.000Z';
    const old = '2026-10-01T12:00:00.000Z';
    expect(isSnapshotStale(fresh, now)).toBe(false);
    expect(isSnapshotStale(old, now)).toBe(true);
  });
});

describe('saveAssistantPushSnapshot', () => {
  beforeEach(() => {
    redisMocks.set.mockResolvedValue('OK');
    redisMocks.lpush.mockResolvedValue(1);
    redisMocks.ltrim.mockResolvedValue('OK');
  });

  it('writes latest, assistant baseline, and trims history list', async () => {
    await saveAssistantPushSnapshot(
      'user-1',
      'phillip@example.com',
      validSnapshot as import('./snapshot').MoneySnapshot
    );
    expect(redisMocks.set).toHaveBeenCalledWith('mt:snapshot:user-1', expect.any(String));
    expect(redisMocks.set).toHaveBeenCalledWith('mt:snapshot:assistant:user-1', expect.any(String));
    expect(redisMocks.lpush).toHaveBeenCalledWith('mt:snapshot:history:user-1', expect.any(String));
    expect(redisMocks.ltrim).toHaveBeenCalledWith(
      'mt:snapshot:history:user-1',
      0,
      SNAPSHOT_HISTORY_MAX - 1
    );
  });
});

describe('getAssistantSnapshotForUser fallback', () => {
  const env = (source: string) =>
    JSON.stringify({
      userId: 'user-1',
      email: 'p@example.com',
      receivedAt: '2026-10-09T13:29:13.696Z',
      snapshot: { ...validSnapshot, source },
    });

  beforeEach(() => {
    redisMocks.get.mockReset();
    redisMocks.lrange.mockReset();
  });

  it('uses the assistant key when present', async () => {
    redisMocks.get.mockImplementation(async (k: string) =>
      k === 'mt:snapshot:assistant:user-1' ? env('assistant-push') : null
    );
    const got = await getAssistantSnapshotForUser('user-1');
    expect(got?.snapshot.source).toBe('assistant-push');
  });

  it('falls back to latest pushed snapshot when no assistant key (pre-migration push)', async () => {
    redisMocks.get.mockImplementation(async (k: string) =>
      k === 'mt:snapshot:user-1' ? env('assistant-push') : null
    );
    const got = await getAssistantSnapshotForUser('user-1');
    expect(got?.snapshot.source).toBe('assistant-push');
    expect(redisMocks.lrange).not.toHaveBeenCalled();
  });

  it('falls back to history head when latest is an app recompute', async () => {
    redisMocks.get.mockImplementation(async (k: string) =>
      k === 'mt:snapshot:user-1' ? env('app-recompute') : null
    );
    redisMocks.lrange.mockResolvedValue([env('assistant-push')]);
    const got = await getAssistantSnapshotForUser('user-1');
    expect(got?.snapshot.source).toBe('assistant-push');
    expect(redisMocks.lrange).toHaveBeenCalledWith('mt:snapshot:history:user-1', 0, 0);
  });

  it('returns null when nothing was ever pushed', async () => {
    redisMocks.get.mockResolvedValue(null);
    redisMocks.lrange.mockResolvedValue([]);
    expect(await getAssistantSnapshotForUser('user-1')).toBeNull();
  });
});
