import { describe, it, expect } from 'vitest';
import { mergeRecurringFromSync, type SyncBillInput } from './recurringSync';
import type { RecurringPattern } from './recurring';

const bill = (overrides: Partial<SyncBillInput> & { externalKey: string }): SyncBillInput => ({
  name: 'Rent',
  amount: 2100,
  frequency: 'monthly',
  typicalDayOfMonth: 1,
  ...overrides,
});

describe('mergeRecurringFromSync', () => {
  it('adds new auto bills', () => {
    const { recurring, diff } = mergeRecurringFromSync([], [bill({ externalKey: 'chase:rent' })]);
    expect(recurring).toHaveLength(1);
    expect(recurring[0].source).toBe('auto');
    expect(diff.added).toEqual(['chase:rent']);
  });

  it('updates auto bill when not userEdited', () => {
    const existing: RecurringPattern[] = [
      {
        name: 'Rent',
        amount: 2000,
        frequency: 'monthly',
        externalKey: 'chase:rent',
        source: 'auto',
      },
    ];
    const { recurring, diff } = mergeRecurringFromSync(existing, [
      bill({ externalKey: 'chase:rent', amount: 2100 }),
    ]);
    expect(recurring[0].amount).toBe(2100);
    expect(diff.updated).toEqual(['chase:rent']);
  });

  it('does not update manual or userEdited items', () => {
    const existing: RecurringPattern[] = [
      {
        name: 'Rent',
        amount: 2000,
        frequency: 'monthly',
        externalKey: 'chase:rent',
        source: 'manual',
      },
      {
        name: 'Power',
        amount: 90,
        frequency: 'monthly',
        externalKey: 'chase:power',
        source: 'auto',
        userEdited: true,
      },
    ];
    const { recurring, diff } = mergeRecurringFromSync(existing, [
      bill({ externalKey: 'chase:rent', amount: 999 }),
      bill({ externalKey: 'chase:power', amount: 999, name: 'Power' }),
    ]);
    expect(recurring[0].amount).toBe(2000);
    expect(recurring[1].amount).toBe(90);
    expect(diff.skippedProtected).toEqual(['chase:rent', 'chase:power']);
  });

  it('deactivates missing auto bills', () => {
    const existing: RecurringPattern[] = [
      {
        name: 'Old',
        amount: 10,
        frequency: 'monthly',
        externalKey: 'chase:old',
        source: 'auto',
      },
    ];
    const { recurring, diff } = mergeRecurringFromSync(existing, []);
    expect(recurring[0].inactive).toBe(true);
    expect(diff.deactivated).toEqual(['chase:old']);
  });

  it('adopts an unkeyed record matched by adoptName', () => {
    const legacy: RecurringPattern = {
      name: '  Rent  ',
      amount: 2000,
      frequency: 'monthly',
      typicalDayOfMonth: 3,
      nextDate: '2026-08-01',
      paused: true,
    };
    const { recurring, diff } = mergeRecurringFromSync([legacy], [
      bill({
        externalKey: 'chase:rent',
        adoptName: ' rENT ',
        name: 'Rent (Zelle to Sacha)',
        amount: 2100,
        nextDate: '2026-11-01',
      }),
    ]);

    expect(recurring).toHaveLength(1);
    expect(recurring[0]).toBe(legacy);
    expect(recurring[0]).toEqual({
      name: 'Rent (Zelle to Sacha)',
      amount: 2100,
      frequency: 'monthly',
      typicalDayOfMonth: 1,
      nextDate: '2026-11-01',
      paused: true,
      externalKey: 'chase:rent',
      inactive: false,
      source: 'auto',
    });
    expect(diff.adopted).toEqual(['chase:rent']);
    expect(diff.added).toEqual([]);
    expect(diff.updated).toEqual([]);
    expect(diff.skippedProtected).toEqual([]);

    const later = mergeRecurringFromSync(recurring, [
      bill({
        externalKey: 'chase:rent',
        adoptName: 'Rent',
        name: 'Rent (Zelle to Sacha)',
        amount: 2200,
      }),
    ]);
    expect(later.diff.adopted).toEqual([]);
    expect(later.diff.updated).toEqual(['chase:rent']);
    expect(later.recurring[0].amount).toBe(2200);
  });

  it('adopts the legacy record and hard-deletes the keyed duplicate', () => {
    const legacy: RecurringPattern = {
      name: 'Rent',
      amount: 2000,
      frequency: 'monthly',
    };
    const duplicate: RecurringPattern = {
      name: 'Rent (Zelle to Sacha)',
      amount: 2100,
      frequency: 'monthly',
      externalKey: 'chase:rent',
      source: 'auto',
      inactive: true,
    };
    const { recurring, diff } = mergeRecurringFromSync([duplicate, legacy], [
      bill({
        externalKey: 'chase:rent',
        adoptName: 'Rent',
        name: 'Rent (Zelle to Sacha)',
        amount: 2100,
        nextDate: '2026-11-01',
      }),
    ]);

    expect(recurring).toHaveLength(1);
    expect(recurring[0]).toBe(legacy);
    expect(recurring[0]).toMatchObject({
      name: 'Rent (Zelle to Sacha)',
      amount: 2100,
      externalKey: 'chase:rent',
      inactive: false,
      source: 'auto',
      nextDate: '2026-11-01',
    });
    expect(recurring.some((item) => item === duplicate)).toBe(false);
    expect(diff.adopted).toEqual(['chase:rent']);
    expect(diff.added).toEqual([]);
    expect(diff.updated).toEqual([]);
    expect(diff.deactivated).toEqual([]);
  });

  it('adopts a userEdited record by attaching the key only', () => {
    const legacy: RecurringPattern = {
      name: 'Rent',
      amount: 1800,
      frequency: 'monthly',
      typicalDayOfMonth: 5,
      userEdited: true,
      paused: true,
      inactive: true,
      source: 'manual',
      nextDate: '2026-12-01',
    };
    const duplicate: RecurringPattern = {
      name: 'Rent (Zelle to Sacha)',
      amount: 2100,
      frequency: 'monthly',
      externalKey: 'chase:rent',
      source: 'auto',
      inactive: true,
    };
    const payload = [
      bill({
        externalKey: 'chase:rent',
        adoptName: 'rent',
        name: 'Rent (Zelle to Sacha)',
        amount: 2100,
        typicalDayOfMonth: 1,
        nextDate: '2026-11-01',
      }),
    ];
    const { recurring, diff } = mergeRecurringFromSync([duplicate, legacy], payload);

    expect(recurring).toHaveLength(1);
    expect(recurring[0]).toBe(legacy);
    expect(recurring[0]).toEqual({
      name: 'Rent',
      amount: 1800,
      frequency: 'monthly',
      typicalDayOfMonth: 5,
      userEdited: true,
      paused: true,
      inactive: true,
      source: 'manual',
      nextDate: '2026-12-01',
      externalKey: 'chase:rent',
    });
    expect(diff.adopted).toEqual(['chase:rent']);
    expect(diff.skippedProtected).toEqual(['chase:rent']);
    expect(diff.added).toEqual([]);
    expect(diff.updated).toEqual([]);
    expect(diff.unchanged).toEqual([]);
    expect(diff.deactivated).toEqual([]);

    const snapshot = structuredClone(recurring);
    const again = mergeRecurringFromSync(recurring, payload);
    expect(again.recurring).toEqual(snapshot);
    expect(again.diff.adopted).toEqual([]);
    expect(again.diff.skippedProtected).toEqual(['chase:rent']);
    expect(again.diff.unchanged).toEqual(['chase:rent']);
  });

  it('adds a new bill when adoptName matches no unkeyed record', () => {
    const manual: RecurringPattern = {
      name: 'Mom',
      amount: 50,
      frequency: 'monthly',
      source: 'manual',
      userEdited: true,
    };
    const { recurring, diff } = mergeRecurringFromSync([manual], [
      bill({ externalKey: 'chase:rent', adoptName: 'Rent' }),
    ]);

    expect(diff.adopted).toEqual([]);
    expect(diff.added).toEqual(['chase:rent']);
    expect(recurring).toHaveLength(2);
    expect(recurring[0]).toBe(manual);
    expect(recurring[0]).toEqual(manual);
    expect(recurring[1]).toMatchObject({
      externalKey: 'chase:rent',
      name: 'Rent',
      source: 'auto',
      inactive: false,
    });
  });

  it('is idempotent when the same payload is applied twice', () => {
    const existing: RecurringPattern[] = [
      { name: 'Rent', amount: 2000, frequency: 'monthly', typicalDayOfMonth: 1 },
      {
        name: 'Rent (Zelle to Sacha)',
        amount: 2100,
        frequency: 'monthly',
        externalKey: 'chase:rent',
        source: 'auto',
        inactive: true,
      },
      {
        name: 'Mom',
        amount: 40,
        frequency: 'monthly',
        source: 'manual',
        userEdited: true,
        paused: true,
      },
    ];
    const payload = [
      bill({
        externalKey: 'chase:rent',
        adoptName: 'Rent',
        name: 'Rent (Zelle to Sacha)',
        amount: 2100,
        nextDate: '2026-11-01',
      }),
    ];
    const first = mergeRecurringFromSync(existing, payload);
    expect(first.diff.adopted).toEqual(['chase:rent']);
    expect(first.recurring).toHaveLength(2);

    const afterFirst = structuredClone(first.recurring);
    const second = mergeRecurringFromSync(first.recurring, payload);
    expect(second.recurring).toEqual(afterFirst);
    expect(second.diff.added).toEqual([]);
    expect(second.diff.updated).toEqual([]);
    expect(second.diff.deactivated).toEqual([]);
    expect(second.diff.adopted).toEqual([]);
    expect(second.diff.skippedProtected).toEqual([]);
    expect(second.diff.unchanged).toEqual(['chase:rent']);
    expect(second.recurring.find((item) => item.name === 'Mom')).toEqual(afterFirst.find((item) => item.name === 'Mom'));
  });

  it('does not touch unkeyed bills that are not named by adoptName', () => {
    const mom: RecurringPattern = {
      name: 'Mom',
      amount: 40,
      frequency: 'monthly',
      source: 'manual',
      userEdited: true,
      paused: true,
    };
    const power: RecurringPattern = {
      name: 'Power',
      amount: 90,
      frequency: 'monthly',
    };
    const unkeyedAuto: RecurringPattern = {
      name: 'Orphan Auto',
      amount: 15,
      frequency: 'weekly',
      source: 'auto',
    };
    const gym: RecurringPattern = {
      name: 'Gym',
      amount: 30,
      frequency: 'monthly',
      externalKey: 'chase:gym',
      source: 'auto',
    };
    const { recurring, diff } = mergeRecurringFromSync([mom, power, unkeyedAuto, gym], [
      bill({ externalKey: 'chase:rent', adoptName: 'Rent' }),
    ]);

    expect(diff.adopted).toEqual([]);
    expect(diff.added).toEqual(['chase:rent']);
    expect(diff.deactivated).toEqual(['chase:gym']);
    expect(recurring.find((item) => item.name === 'Mom')).toEqual(mom);
    expect(recurring.find((item) => item.name === 'Power')).toEqual(power);
    expect(recurring.find((item) => item.name === 'Orphan Auto')).toEqual(unkeyedAuto);
    expect(gym.inactive).toBe(true);

    const again = mergeRecurringFromSync(recurring, []);
    expect(again.recurring.find((item) => item.name === 'Mom')).toEqual(mom);
    expect(again.recurring.find((item) => item.name === 'Power')).toEqual(power);
    expect(again.recurring.find((item) => item.name === 'Orphan Auto')).toEqual(unkeyedAuto);
    expect(again.diff.deactivated).toEqual(['chase:rent']);
    expect(again.recurring.filter((item) => !item.externalKey).every((item) => item.inactive !== true)).toBe(true);
  });
});
