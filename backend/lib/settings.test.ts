import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const redisMocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}));

vi.mock('./redis', () => ({
  redisOps: {
    get: redisMocks.get,
    set: redisMocks.set,
    delete: vi.fn(),
    exists: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),
  },
  redisKeys: {
    user: { byEmail: (e: string) => `mt:user:${e}`, byId: (id: string) => `mt:user:id:${id}` },
    session: (id: string) => `mt:session:${id}`,
    settings: (id: string) => `mt:settings:${id}`,
    transactions: (id: string) => `mt:txns:${id}`,
    recurring: (id: string) => `mt:recurring:${id}`,
    payroll: (id: string) => `mt:payroll:${id}`,
    chat: (id: string) => `mt:chat:${id}`,
  },
}));

import { getTodayInUserTz, advanceNextPaycheckDateIfNeeded } from './settings';

describe('getTodayInUserTz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns Thursday date in America/New_York when UTC is already Friday 03:34', () => {
    // Thursday 10:34 PM New York = Friday 03:34 UTC
    vi.setSystemTime(new Date('2025-02-13T03:34:00.000Z'));
    const result = getTodayInUserTz('America/New_York');
    expect(result).toBe('2025-02-12');
  });

  it('returns YYYY-MM-DD for valid timezone', () => {
    vi.setSystemTime(new Date('2025-02-13T03:34:00.000Z'));
    const result = getTodayInUserTz('America/New_York');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns UTC date when timezone is undefined', () => {
    vi.setSystemTime(new Date('2025-02-13T03:34:00.000Z'));
    const result = getTodayInUserTz(undefined);
    expect(result).toBe('2025-02-13');
  });

  it('returns UTC date when timezone is empty string', () => {
    vi.setSystemTime(new Date('2025-02-13T03:34:00.000Z'));
    const result = getTodayInUserTz('');
    expect(result).toBe('2025-02-13');
  });
});

describe('advanceNextPaycheckDateIfNeeded', () => {
  const mockUserId = 'test-user-id';
  const stubSettings = {
    balance: 0,
    paycheckAmount: 2000,
    nextBonusDate: '2025-03-15',
    nextPaycheckDate: '2025-02-13',
    timezone: 'America/New_York',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-02-13T03:34:00.000Z')); // Thursday night NY, Friday UTC
    redisMocks.get.mockResolvedValue(JSON.stringify(stubSettings));
    redisMocks.set.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not advance nextPaycheckDate when today (user TZ) is Thursday and next payday is Friday', async () => {
    const settings = await advanceNextPaycheckDateIfNeeded(mockUserId);

    // With timezone America/New_York, "today" is 2025-02-12 (Thursday).
    // nextPaycheckDate 2025-02-13 > 2025-02-12, so we must not advance.
    expect(settings.nextPaycheckDate).toBe('2025-02-13');
    expect(redisMocks.set).not.toHaveBeenCalled();
  });
});
