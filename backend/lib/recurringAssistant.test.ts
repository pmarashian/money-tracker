import { describe, it, expect, vi, beforeEach } from 'vitest';

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
    recurring: (id: string) => `mt:recurring:${id}`,
  },
}));

import {
  applyAssistantRecurringActions,
  applyAssistantRecurringActionsForUser,
} from './recurringAssistant';
import type { RecurringPattern } from './recurring';

describe('applyAssistantRecurringActions', () => {
  it('creates an auto row with id and never sets userEdited', () => {
    const { recurring, results, changed } = applyAssistantRecurringActions([], [
      {
        action: 'create',
        name: 'Netflix',
        amount: 15.99,
        frequency: 'monthly',
        day: 12,
        externalKey: 'chase:netflix',
      },
    ]);
    expect(changed).toBe(true);
    expect(results[0].status).toBe('ok');
    expect(recurring).toHaveLength(1);
    expect(recurring[0].source).toBe('auto');
    expect(recurring[0].userEdited).toBeUndefined();
    expect(recurring[0].id).toBeTruthy();
    expect(recurring[0].typicalDayOfMonth).toBe(12);
    expect(recurring[0].externalKey).toBe('chase:netflix');
  });

  it('updates by externalKey and by id', () => {
    const existing: RecurringPattern[] = [
      {
        id: 'row-1',
        name: 'Rent',
        amount: 2000,
        frequency: 'monthly',
        externalKey: 'chase:rent',
        source: 'auto',
      },
    ];
    const byKey = applyAssistantRecurringActions(existing, [
      { action: 'update', externalKey: 'chase:rent', amount: 2100, nextDate: '2026-11-01' },
    ]);
    expect(byKey.recurring[0].amount).toBe(2100);
    expect(byKey.recurring[0].nextDate).toBe('2026-11-01');
    expect(byKey.recurring[0].userEdited).toBeUndefined();

    const byId = applyAssistantRecurringActions(byKey.recurring, [
      { action: 'update', id: 'row-1', name: 'Apartment', day: 1 },
    ]);
    expect(byId.recurring[0].name).toBe('Apartment');
    expect(byId.recurring[0].typicalDayOfMonth).toBe(1);
  });

  it('skips userEdited rows unless force:true', () => {
    const existing: RecurringPattern[] = [
      {
        id: 'edited',
        name: 'Power',
        amount: 90,
        frequency: 'monthly',
        externalKey: 'chase:power',
        source: 'auto',
        userEdited: true,
      },
    ];
    const skipped = applyAssistantRecurringActions(existing, [
      { action: 'update', externalKey: 'chase:power', amount: 120 },
    ]);
    expect(skipped.changed).toBe(false);
    expect(skipped.results[0]).toMatchObject({
      status: 'skipped',
      reason: 'userEdited',
      externalKey: 'chase:power',
    });
    expect(skipped.recurring[0].amount).toBe(90);

    const forced = applyAssistantRecurringActions(existing, [
      { action: 'update', externalKey: 'chase:power', amount: 120, force: true },
    ]);
    expect(forced.changed).toBe(true);
    expect(forced.results[0].status).toBe('ok');
    expect(forced.recurring[0].amount).toBe(120);
    expect(forced.recurring[0].userEdited).toBe(true);
  });

  it('pauses, unpauses, and deactivates', () => {
    const existing: RecurringPattern[] = [
      {
        id: 'gym',
        name: 'Gym',
        amount: 40,
        frequency: 'monthly',
        externalKey: 'chase:gym',
        source: 'auto',
        paused: false,
        inactive: false,
      },
    ];
    const paused = applyAssistantRecurringActions(existing, [
      { action: 'pause', id: 'gym' },
    ]);
    expect(paused.recurring[0].paused).toBe(true);

    const unpaused = applyAssistantRecurringActions(paused.recurring, [
      { action: 'unpause', externalKey: 'chase:gym' },
    ]);
    expect(unpaused.recurring[0].paused).toBe(false);

    const deactivated = applyAssistantRecurringActions(unpaused.recurring, [
      { action: 'deactivate', id: 'gym' },
    ]);
    expect(deactivated.recurring[0].inactive).toBe(true);
  });
});

describe('applyAssistantRecurringActionsForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMocks.get.mockResolvedValue(
      JSON.stringify([
        {
          id: 'row-1',
          name: 'Rent',
          amount: 2000,
          frequency: 'monthly',
          externalKey: 'chase:rent',
          source: 'auto',
        },
      ])
    );
    redisMocks.set.mockResolvedValue('OK');
  });

  it('persists when changed', async () => {
    const result = await applyAssistantRecurringActionsForUser('user-1', [
      { action: 'update', externalKey: 'chase:rent', amount: 2200 },
    ]);
    expect(result.changed).toBe(true);
    expect(redisMocks.set).toHaveBeenCalledWith(
      'mt:recurring:user-1',
      expect.stringContaining('"amount":2200')
    );
  });

  it('does not persist when all actions are skipped', async () => {
    redisMocks.get.mockResolvedValue(
      JSON.stringify([
        {
          id: 'row-1',
          name: 'Rent',
          amount: 2000,
          frequency: 'monthly',
          externalKey: 'chase:rent',
          source: 'auto',
          userEdited: true,
        },
      ])
    );
    const result = await applyAssistantRecurringActionsForUser('user-1', [
      { action: 'update', externalKey: 'chase:rent', amount: 2200 },
    ]);
    expect(result.changed).toBe(false);
    expect(redisMocks.set).not.toHaveBeenCalled();
  });
});
