import { describe, it, expect, vi, beforeEach } from 'vitest';

const redisMocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}));

vi.mock('./redis', () => ({
  redisOps: {
    get: redisMocks.get,
    set: redisMocks.set,
    lpush: vi.fn(),
    ltrim: vi.fn(),
    lrange: vi.fn().mockResolvedValue([]),
    delete: vi.fn(),
    exists: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),
  },
  redisKeys: {
    recurring: (id: string) => `mt:recurring:${id}`,
    settings: (id: string) => `mt:settings:${id}`,
    snapshot: (id: string) => `mt:snapshot:${id}`,
    snapshotAssistant: (id: string) => `mt:snapshot:assistant:${id}`,
    snapshotHistory: (id: string) => `mt:snapshot:history:${id}`,
    user: { byEmail: (e: string) => `mt:user:${e}`, byId: (id: string) => `mt:user:id:${id}` },
  },
}));

import { recomputeSnapshotForUser } from './snapshotRecompute';

const assistantEnvelope = {
  userId: 'user-1',
  email: 'test@example.com',
  receivedAt: '2026-10-09T12:00:00.000Z',
  snapshot: {
    as_of: '2026-10-09T08:00:00.000Z',
    current_available_balance: 3000,
    next_bonus_date: '2026-10-31',
    following_bonus_date: '2027-01-31',
    projected_low_to_bonus: { amount: 0, date: '2026-10-09' },
    topoff_needed_after_bonus: 0,
    low_after_topoff: { amount: 0, date: '2026-10-09' },
    status: 'on_track' as const,
    topoff_needed_now: 0,
    bills: [],
    min_balance: 500,
    topoff_round_up: 100,
    paycheck_anchor_friday: '2026-10-10',
    pending_note: 'carried-over-field',
  },
};

describe('recomputeSnapshotForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMocks.get.mockImplementation(async (key: string) => {
      if (key === 'mt:snapshot:assistant:user-1') {
        return JSON.stringify(assistantEnvelope);
      }
      if (key === 'mt:settings:user-1') {
        return JSON.stringify({
          balance: 0,
          paycheckAmount: 1000,
          nextBonusDate: '2026-10-31',
          nextPaycheckDate: '2026-10-10',
        });
      }
      if (key === 'mt:recurring:user-1') {
        return JSON.stringify([
          {
            name: 'Utilities',
            amount: 200,
            frequency: 'monthly',
            typicalDayOfMonth: 15,
            nextDate: '2026-10-15',
          },
        ]);
      }
      return null;
    });
    redisMocks.set.mockResolvedValue('OK');
  });

  it('writes app-recompute snapshot and carries assistant-only fields', async () => {
    const envelope = await recomputeSnapshotForUser('user-1', 'test@example.com');
    expect(envelope).not.toBeNull();
    expect(envelope!.snapshot.source).toBe('app-recompute');
    expect(envelope!.snapshot.current_available_balance).toBe(3000);
    expect(envelope!.snapshot.as_of).toBe(assistantEnvelope.snapshot.as_of);
    expect(envelope!.snapshot.pending_note).toBe('carried-over-field');
    expect(envelope!.snapshot.balance_before_next_bonus?.amount).toBe(4800);
    expect(redisMocks.set).toHaveBeenCalledWith(
      'mt:snapshot:user-1',
      expect.stringContaining('"source":"app-recompute"')
    );
    expect(redisMocks.set).not.toHaveBeenCalledWith(
      'mt:snapshot:assistant:user-1',
      expect.anything()
    );
  });

  it('returns null when no assistant baseline exists', async () => {
    redisMocks.get.mockResolvedValue(null);
    const envelope = await recomputeSnapshotForUser('user-1', 'test@example.com');
    expect(envelope).toBeNull();
  });
});
