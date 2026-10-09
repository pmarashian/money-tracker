import { redisKeys, redisOps } from './redis';
import type { RecurringPattern } from './recurring';
import { getUserSettings, getTodayInUserTz, advanceNextPaycheckDateIfNeeded } from './settings';
import {
  DEFAULT_MIN_BALANCE,
  DEFAULT_TOPOFF_ROUND_UP,
  computeFollowingBonusDate,
  paycheckAnchorFromNextActual,
  recurringToProjectionBill,
  nextBillDate,
  runProjection,
  type ProjectionBill,
} from './projectionCore';
import {
  getAssistantSnapshotForUser,
  type MoneySnapshot,
  type StoredSnapshotEnvelope,
  saveRecomputedSnapshotForUser,
} from './snapshot';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function projectionTodayFromAssistant(assistant: MoneySnapshot, settingsTz?: string): string {
  const fromAsOf = assistant.as_of?.slice(0, 10);
  if (fromAsOf && /^\d{4}-\d{2}-\d{2}$/.test(fromAsOf)) {
    return fromAsOf;
  }
  return getTodayInUserTz(settingsTz);
}

function readPaycheckAnchor(
  assistant: MoneySnapshot,
  settingsNextPaycheck: string | undefined,
  today: string
): string {
  const extra = assistant as MoneySnapshot & { paycheck_anchor_friday?: string };
  if (typeof extra.paycheck_anchor_friday === 'string' && extra.paycheck_anchor_friday.trim()) {
    return extra.paycheck_anchor_friday.trim();
  }
  if (settingsNextPaycheck) {
    return paycheckAnchorFromNextActual(settingsNextPaycheck);
  }
  return paycheckAnchorFromNextActual(today);
}

function activeRecurringBills(recurring: RecurringPattern[], today: string): ProjectionBill[] {
  return recurring
    .filter((p) => !p.inactive && !p.paused)
    .map((p) => recurringToProjectionBill(p, today));
}

/**
 * Rebuild the displayed snapshot from the last assistant bank baseline + app inputs.
 * Returns null when there is no assistant baseline to recompute from.
 */
export async function recomputeSnapshotForUser(
  userId: string,
  email: string
): Promise<StoredSnapshotEnvelope | null> {
  const assistantEnvelope = await getAssistantSnapshotForUser(userId);
  if (!assistantEnvelope) {
    return null;
  }

  const assistant = assistantEnvelope.snapshot;
  const settings = await advanceNextPaycheckDateIfNeeded(userId);
  const recurringRaw = await redisOps.get(redisKeys.recurring(userId));
  let recurring: RecurringPattern[] = [];
  if (recurringRaw) {
    try {
      recurring = JSON.parse(recurringRaw) as RecurringPattern[];
    } catch {
      recurring = [];
    }
  }

  const today = projectionTodayFromAssistant(assistant, settings.timezone);
  const nextBonusDate = settings.nextBonusDate;
  const paycheckAnchor = readPaycheckAnchor(assistant, settings.nextPaycheckDate, today);
  const followingBonusDate = computeFollowingBonusDate(nextBonusDate, paycheckAnchor);

  const bills = activeRecurringBills(recurring, today);
  const minBalance =
    typeof assistant.min_balance === 'number' && Number.isFinite(assistant.min_balance)
      ? assistant.min_balance
      : DEFAULT_MIN_BALANCE;
  const topoffRoundUp =
    typeof assistant.topoff_round_up === 'number' && Number.isFinite(assistant.topoff_round_up)
      ? assistant.topoff_round_up
      : DEFAULT_TOPOFF_ROUND_UP;

  const scenario = runProjection({
    today,
    startBalance: assistant.current_available_balance,
    nextBonusDate,
    followingBonusDate,
    paycheckAmount: settings.paycheckAmount,
    paycheckAnchorFriday: paycheckAnchor,
    bills,
    minBalance,
    topoffRoundUp,
  });

  const low1 = scenario.low1Raw.balance;
  const status: MoneySnapshot['status'] =
    low1 >= minBalance && assistant.current_available_balance >= minBalance
      ? 'on_track'
      : 'needs_topoff';
  const topoffNow = scenario.nowTop;

  const carried: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(assistant)) {
    if (
      key === 'as_of' ||
      key === 'current_available_balance' ||
      key === 'next_bonus_date' ||
      key === 'following_bonus_date' ||
      key === 'projected_low_to_bonus' ||
      key === 'topoff_needed_after_bonus' ||
      key === 'low_after_topoff' ||
      key === 'status' ||
      key === 'topoff_needed_now' ||
      key === 'bills' ||
      key === 'balance_before_next_bonus' ||
      key === 'source'
    ) {
      continue;
    }
    carried[key] = value;
  }

  const snapshot: MoneySnapshot = {
    ...carried,
    as_of: assistant.as_of,
    current_available_balance: assistant.current_available_balance,
    next_bonus_date: nextBonusDate,
    following_bonus_date: followingBonusDate,
    projected_low_to_bonus: {
      amount: scenario.low1Raw.balance,
      date: scenario.low1Raw.date,
    },
    topoff_needed_after_bonus: scenario.topOff,
    topoff_needed_after_bonus_exact: scenario.topOffExact,
    low_after_topoff: {
      amount: scenario.low2.balance,
      date: scenario.low2.date,
    },
    status,
    topoff_needed_now: topoffNow,
    topoff_needed_now_exact: scenario.nowTopExact,
    topoff_needed_now_by: scenario.nowBy,
    topoff_round_up: topoffRoundUp,
    min_balance: minBalance,
    balance_before_next_bonus: {
      amount: scenario.beforeBonus.balance,
      date: scenario.beforeBonus.date,
    },
    bills: bills.map((b) => ({
      name: b.name,
      amount: b.amount,
      frequency: b.frequency,
      next_date: nextBillDate(b, today) ?? today,
    })),
    source: 'app-recompute',
  };

  if (isRecord(assistant.scenarios)) {
    snapshot.scenarios = assistant.scenarios;
  }

  return saveRecomputedSnapshotForUser(userId, email, snapshot);
}
