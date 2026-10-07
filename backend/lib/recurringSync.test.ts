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
});
