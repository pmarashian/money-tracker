import type { RecurringPattern } from './recurring';

/** Mirrors chase_projection.py constants used on the Home snapshot. */
export const DEFAULT_MIN_BALANCE = 500;
export const DEFAULT_TOPOFF_ROUND_UP = 100;
const PAYCHECK_INTERVAL_DAYS = 14;

const HOLIDAYS = new Set([
  '2026-10-12',
  '2026-11-11',
  '2026-11-26',
  '2026-12-25',
  '2027-01-01',
  '2027-01-18',
  '2027-02-15',
]);

export interface ProjectionBill {
  name: string;
  amount: number;
  frequency: 'monthly' | 'weekly' | 'biweekly';
  typicalDom: number;
  lastDate: string;
  isRent: boolean;
  pinWeekday?: number;
}

export interface DayProjection {
  date: string;
  balance: number;
  strict: number;
}

export interface ProjectionScenarioResult {
  w1Raw: DayProjection[];
  low1Raw: DayProjection;
  nowTop: number;
  nowTopExact: number;
  nowBy: string | null;
  w1: DayProjection[];
  balanceOnBonus: number;
  topOff: number;
  topOffExact: number;
  w2: DayProjection[];
  low2: DayProjection;
  beforeBonus: DayProjection;
}

export interface ProjectionInput {
  today: string;
  startBalance: number;
  nextBonusDate: string;
  followingBonusDate: string;
  paycheckAmount: number;
  paycheckAnchorFriday: string;
  bills: ProjectionBill[];
  minBalance: number;
  topoffRoundUp: number;
}

export function parseDateOnlyUtc(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

export function formatDateOnlyUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysUtc(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

function addMonths(y: number, m: number, k = 1): [number, number] {
  const m2 = m - 1 + k;
  return [y + Math.floor(m2 / 12), ((m2 % 12) + 12) % 12 + 1];
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isBusinessDay(d: Date): boolean {
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return !HOLIDAYS.has(formatDateOnlyUtc(d));
}

export function rollForward(d: Date): Date {
  let cur = new Date(d.getTime());
  while (!isBusinessDay(cur)) {
    cur = addDaysUtc(cur, 1);
  }
  return cur;
}

export function rollBack(d: Date): Date {
  let cur = new Date(d.getTime());
  while (!isBusinessDay(cur)) {
    cur = addDaysUtc(cur, -1);
  }
  return cur;
}

export function roundUpTopoff(amount: number, increment: number): number {
  if (amount <= 0 || !increment) return Math.round(Math.max(0, amount) * 100) / 100;
  return Math.ceil(Math.round(amount * 100) / 100 / increment) * increment;
}

/** Nominal Friday anchor such that rollBack(anchor) equals the next actual payday. */
export function paycheckAnchorFromNextActual(nextActualIso: string): string {
  const actual = parseDateOnlyUtc(nextActualIso);
  let anchor = new Date(actual.getTime());
  while (anchor.getUTCDay() !== 5) {
    anchor = addDaysUtc(anchor, 1);
  }
  for (let i = 0; i < 8; i += 1) {
    if (formatDateOnlyUtc(rollBack(anchor)) === nextActualIso) {
      return formatDateOnlyUtc(anchor);
    }
    anchor = addDaysUtc(anchor, 7);
  }
  return formatDateOnlyUtc(anchor);
}

export function paydaysBetween(
  anchorFriday: string,
  start: string,
  end: string
): { actual: string; nominal: string }[] {
  const startD = parseDateOnlyUtc(start);
  const endD = parseDateOnlyUtc(end);
  const out: { actual: string; nominal: string }[] = [];
  let nominal = parseDateOnlyUtc(anchorFriday);
  const endPlus = addDaysUtc(endD, PAYCHECK_INTERVAL_DAYS);
  while (nominal <= endPlus) {
    const actual = rollBack(nominal);
    if (actual >= startD && actual <= endD) {
      out.push({ actual: formatDateOnlyUtc(actual), nominal: formatDateOnlyUtc(nominal) });
    }
    nominal = addDaysUtc(nominal, PAYCHECK_INTERVAL_DAYS);
  }
  return out;
}

export function computeFollowingBonusDate(
  nextBonusDate: string,
  paycheckAnchorFriday: string
): string {
  const bonus1 = parseDateOnlyUtc(nextBonusDate);
  let y = bonus1.getUTCFullYear();
  let m = bonus1.getUTCMonth() + 1;
  [y, m] = addMonths(y, m, 3);
  const monthStart = formatDateOnlyUtc(new Date(Date.UTC(y, m - 1, 1)));
  const monthEnd = formatDateOnlyUtc(new Date(Date.UTC(y, m - 1, lastDayOfMonth(y, m))));
  const pays = paydaysBetween(paycheckAnchorFriday, monthStart, monthEnd);
  if (pays.length === 0) {
    return monthEnd;
  }
  return pays.reduce((max, p) => (p.actual > max ? p.actual : max), pays[0].actual);
}

function billDates(bill: ProjectionBill, start: string, end: string): string[] {
  const startD = parseDateOnlyUtc(start);
  const endD = parseDateOnlyUtc(end);
  const lastD = parseDateOnlyUtc(bill.lastDate);
  const out: string[] = [];

  if (bill.frequency === 'weekly' || bill.frequency === 'biweekly') {
    const step = bill.frequency === 'biweekly' ? 14 : 7;
    if (bill.pinWeekday !== undefined) {
      let d = new Date(startD.getTime());
      while (d.getUTCDay() !== bill.pinWeekday) {
        d = addDaysUtc(d, 1);
      }
      if (lastD >= d) {
        d = addDaysUtc(d, 7);
      }
      while (d <= endD) {
        out.push(formatDateOnlyUtc(d));
        d = addDaysUtc(d, 7);
      }
      return out;
    }
    let d = addDaysUtc(lastD, step);
    while (d < startD) {
      d = addDaysUtc(d, step);
    }
    while (d <= endD) {
      out.push(formatDateOnlyUtc(rollForward(d)));
      d = addDaysUtc(d, step);
    }
    return out;
  }

  let y = startD.getUTCFullYear();
  let m = startD.getUTCMonth() + 1;
  [y, m] = addMonths(y, m, -1);
  for (let i = 0; i < 8; i += 1) {
    let occurrence: Date;
    if (bill.isRent) {
      const dom = lastDayOfMonth(y, m);
      occurrence = new Date(Date.UTC(y, m - 1, dom));
    } else {
      const dom = Math.min(bill.typicalDom, lastDayOfMonth(y, m));
      occurrence = rollForward(new Date(Date.UTC(y, m - 1, dom)));
    }
    const minGapDays = (occurrence.getTime() - lastD.getTime()) / (24 * 60 * 60 * 1000);
    if (minGapDays >= 15 && occurrence >= startD && occurrence <= endD) {
      out.push(formatDateOnlyUtc(occurrence));
    }
    [y, m] = addMonths(y, m, 1);
  }
  return out.sort();
}

function simulate(
  startBal: number,
  first: string,
  end: string,
  bills: ProjectionBill[],
  payAmount: number,
  pays: { actual: string }[]
): DayProjection[] {
  const events = new Map<string, Array<{ name: string; amount: number }>>();
  const firstD = parseDateOnlyUtc(first);
  const endD = parseDateOnlyUtc(end);

  for (const p of pays) {
    const actualD = parseDateOnlyUtc(p.actual);
    if (actualD >= firstD && actualD <= endD) {
      const key = p.actual;
      const list = events.get(key) ?? [];
      list.push({ name: 'Paycheck', amount: payAmount });
      events.set(key, list);
    }
  }

  for (const bill of bills) {
    for (const d of billDates(bill, first, end)) {
      const list = events.get(d) ?? [];
      list.push({ name: bill.name, amount: -bill.amount });
      events.set(d, list);
    }
  }

  const days: DayProjection[] = [];
  let bal = startBal;
  let d = new Date(firstD.getTime());
  while (d <= endD) {
    const key = formatDateOnlyUtc(d);
    const flows = events.get(key) ?? [];
    const debits = flows.filter((f) => f.amount < 0).reduce((s, f) => s + f.amount, 0);
    const pre = Math.round((bal + debits) * 100) / 100;
    const delta = flows.reduce((s, f) => s + f.amount, 0);
    bal = Math.round((bal + delta) * 100) / 100;
    days.push({ date: key, balance: bal, strict: Math.min(pre, bal) });
    d = addDaysUtc(d, 1);
  }
  return days;
}

function lowOf(days: DayProjection[]): DayProjection {
  return days.reduce((best, cur) => {
    if (cur.balance < best.balance) return cur;
    if (cur.balance === best.balance && cur.date < best.date) return cur;
    return best;
  });
}

function runScenario(
  startBal: number,
  today: string,
  bonus1: string,
  bonus2: string,
  bills: ProjectionBill[],
  payAmount: number,
  pays: { actual: string }[],
  floor: number,
  topoffRoundUp: number
): ProjectionScenarioResult {
  const w1Raw = simulate(startBal, today, bonus1, bills, payAmount, pays);
  const low1Raw = lowOf(w1Raw);
  const nowExact = Math.round(Math.max(0, floor - Math.min(startBal, low1Raw.balance)) * 100) / 100;
  const nowTop = roundUpTopoff(nowExact, topoffRoundUp);
  const below = w1Raw.filter((x) => x.balance < floor).map((x) => x.date);
  const nowBy =
    nowExact > 0 ? (startBal < floor ? today : below[0] ?? today) : null;

  const w1 = simulate(startBal + nowTop, today, bonus1, bills, payAmount, pays);
  const balanceOnBonus = w1[w1.length - 1]?.balance ?? startBal;
  const first2 = formatDateOnlyUtc(addDaysUtc(parseDateOnlyUtc(bonus1), 1));
  const w2Zero = simulate(0, first2, bonus2, bills, payAmount, pays);
  const need = Math.round(Math.max(0, floor - Math.min(...w2Zero.map((x) => x.balance))) * 100) / 100;
  const topOffExact = Math.round(Math.max(0, need - balanceOnBonus) * 100) / 100;
  const topOff = roundUpTopoff(topOffExact, topoffRoundUp);
  const w2 = simulate(balanceOnBonus + topOff, first2, bonus2, bills, payAmount, pays);
  const low2 = lowOf(w2);

  const beforeCandidates = w1Raw.filter((x) => x.date < bonus1);
  const beforeBonus =
    beforeCandidates.length > 0 ? beforeCandidates[beforeCandidates.length - 1] : w1Raw[0];

  return {
    w1Raw,
    low1Raw,
    nowTop,
    nowTopExact: nowExact,
    nowBy,
    w1,
    balanceOnBonus,
    topOff,
    topOffExact,
    w2,
    low2,
    beforeBonus,
  };
}

export function isRentRecurring(pattern: RecurringPattern): boolean {
  if (pattern.frequency !== 'monthly') return false;
  const name = pattern.name.toLowerCase();
  if (name.includes('rent')) return true;
  return (pattern.externalKey ?? '').toLowerCase().includes('rent');
}

export function recurringToProjectionBill(
  pattern: RecurringPattern,
  today: string
): ProjectionBill {
  const step =
    pattern.frequency === 'weekly' ? 7 : pattern.frequency === 'biweekly' ? 14 : null;
  let lastDate: string;
  if (pattern.nextDate) {
    const nd = parseDateOnlyUtc(pattern.nextDate);
    if (step) {
      lastDate = formatDateOnlyUtc(addDaysUtc(nd, -step));
    } else {
      lastDate = formatDateOnlyUtc(addDaysUtc(nd, -30));
    }
  } else if (step) {
    lastDate = today;
  } else {
    lastDate = formatDateOnlyUtc(addDaysUtc(parseDateOnlyUtc(today), -16));
  }

  let pinWeekday: number | undefined;
  if (pattern.frequency === 'weekly' && pattern.nextDate) {
    pinWeekday = parseDateOnlyUtc(pattern.nextDate).getUTCDay();
  }

  const dom =
    pattern.typicalDayOfMonth != null &&
    pattern.typicalDayOfMonth >= 1 &&
    pattern.typicalDayOfMonth <= 31
      ? pattern.typicalDayOfMonth
      : pattern.nextDate
        ? parseDateOnlyUtc(pattern.nextDate).getUTCDate()
        : 15;

  return {
    name: pattern.name,
    amount: pattern.amount,
    frequency: pattern.frequency,
    typicalDom: dom,
    lastDate,
    isRent: isRentRecurring(pattern),
    pinWeekday,
  };
}

export function nextBillDate(bill: ProjectionBill, today: string): string | null {
  const dates = billDates(bill, today, formatDateOnlyUtc(addDaysUtc(parseDateOnlyUtc(today), 70)));
  return dates[0] ?? null;
}

export function runProjection(input: ProjectionInput): ProjectionScenarioResult {
  const pays = paydaysBetween(
    input.paycheckAnchorFriday,
    input.today,
    formatDateOnlyUtc(addDaysUtc(parseDateOnlyUtc(input.followingBonusDate), 10))
  );
  return runScenario(
    input.startBalance,
    input.today,
    input.nextBonusDate,
    input.followingBonusDate,
    input.bills,
    input.paycheckAmount,
    pays,
    input.minBalance,
    input.topoffRoundUp
  );
}
