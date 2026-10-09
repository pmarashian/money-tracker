import { describe, it, expect } from 'vitest';
import {
  computeFollowingBonusDate,
  runProjection,
  type ProjectionBill,
} from './projectionCore';

/**
 * Expected values derived from the same algorithm as chase_projection.py
 * (synthetic fixture — no real account data).
 */
const FIXTURE = {
  today: '2026-10-09',
  startBalance: 3000,
  nextBonusDate: '2026-10-31',
  followingBonusDate: '2027-01-29',
  paycheckAmount: 1000,
  paycheckAnchorFriday: '2026-10-10',
  minBalance: 500,
  topoffRoundUp: 100,
  bills: [
    {
      name: 'Utilities',
      amount: 200,
      frequency: 'monthly' as const,
      typicalDom: 15,
      lastDate: '2026-09-15',
      isRent: false,
    },
  ] satisfies ProjectionBill[],
  expected: {
    low1Raw: { amount: 3800, date: '2026-10-15' },
    topoffNow: 0,
    beforeBonus: { amount: 4800, date: '2026-10-30' },
    topOffAfterBonus: 0,
    balanceOnBonus: 4800,
    low2: { amount: 4800, date: '2026-11-01' },
    status: 'on_track' as const,
  },
};

describe('projectionCore (Python parity fixture)', () => {
  it('computes following bonus from anchor + next bonus', () => {
    const following = computeFollowingBonusDate(
      FIXTURE.nextBonusDate,
      FIXTURE.paycheckAnchorFriday
    );
    expect(following).toBe(FIXTURE.followingBonusDate);
  });

  it('matches synthetic chase_projection scenario outputs', () => {
    const result = runProjection({
      today: FIXTURE.today,
      startBalance: FIXTURE.startBalance,
      nextBonusDate: FIXTURE.nextBonusDate,
      followingBonusDate: FIXTURE.followingBonusDate,
      paycheckAmount: FIXTURE.paycheckAmount,
      paycheckAnchorFriday: FIXTURE.paycheckAnchorFriday,
      bills: FIXTURE.bills,
      minBalance: FIXTURE.minBalance,
      topoffRoundUp: FIXTURE.topoffRoundUp,
    });

    expect({ amount: result.low1Raw.balance, date: result.low1Raw.date }).toEqual(
      FIXTURE.expected.low1Raw
    );
    expect(result.nowTop).toBe(FIXTURE.expected.topoffNow);
    expect({
      amount: result.beforeBonus.balance,
      date: result.beforeBonus.date,
    }).toEqual(FIXTURE.expected.beforeBonus);
    expect(result.topOff).toBe(FIXTURE.expected.topOffAfterBonus);
    expect(result.balanceOnBonus).toBe(FIXTURE.expected.balanceOnBonus);
    expect({ amount: result.low2.balance, date: result.low2.date }).toEqual(FIXTURE.expected.low2);

    const status =
      result.low1Raw.balance >= FIXTURE.minBalance &&
      FIXTURE.startBalance >= FIXTURE.minBalance
        ? 'on_track'
        : 'needs_topoff';
    expect(status).toBe(FIXTURE.expected.status);
  });
});
