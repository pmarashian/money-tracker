import { redisOps, redisKeys } from './redis';

/**
 * User settings interface
 */
export interface UserSettings {
  balance: number;
  paycheckAmount: number;
  nextBonusDate: string; // ISO date string
  bonusAmount?: number; // Optional bonus amount
  nextPaycheckDate?: string; // Optional ISO date string for next payday (used by health projection)
  timezone?: string; // IANA timezone for "today" in payday and health calculations
}

/**
 * Default user settings
 */
export const DEFAULT_USER_SETTINGS: UserSettings = {
  balance: 0,
  paycheckAmount: 2000, // Default bi-weekly paycheck
  nextBonusDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
};

/**
 * Get user settings from Redis, with defaults for missing values
 */
export async function getUserSettings(userId: string): Promise<UserSettings> {
  const settingsKey = redisKeys.settings(userId);
  const settingsData = await redisOps.get(settingsKey);

  if (!settingsData) {
    return DEFAULT_USER_SETTINGS;
  }

  try {
    const settings = JSON.parse(settingsData);

    // Merge with defaults for any missing properties
    return {
      balance: typeof settings.balance === 'number' ? settings.balance : DEFAULT_USER_SETTINGS.balance,
      paycheckAmount: typeof settings.paycheckAmount === 'number' ? settings.paycheckAmount : DEFAULT_USER_SETTINGS.paycheckAmount,
      nextBonusDate: typeof settings.nextBonusDate === 'string' ? settings.nextBonusDate : DEFAULT_USER_SETTINGS.nextBonusDate,
      ...(typeof settings.bonusAmount === 'number' ? { bonusAmount: settings.bonusAmount } : {}),
      nextPaycheckDate: typeof settings.nextPaycheckDate === 'string' ? settings.nextPaycheckDate : undefined,
      ...(typeof settings.timezone === 'string' && settings.timezone.length > 0 ? { timezone: settings.timezone } : {}),
    };
  } catch (error) {
    console.error('Error parsing user settings:', error);
    return DEFAULT_USER_SETTINGS;
  }
}

/** Start-of-day (local) for date-only comparison */
function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

/**
 * Return "today" as YYYY-MM-DD in the given timezone, or server UTC date if timezone is missing/invalid.
 */
export function getTodayInUserTz(timezone?: string): string {
  if (timezone && timezone.trim()) {
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone.trim(),
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return formatter.format(new Date()); // en-CA gives YYYY-MM-DD
    } catch {
      // Invalid IANA timezone; fall through to server date
    }
  }
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * If nextPaycheckDate is set and <= today (in user timezone), advance it by 14 days and save. Returns settings (possibly updated).
 */
export async function advanceNextPaycheckDateIfNeeded(userId: string): Promise<UserSettings> {
  const settings = await getUserSettings(userId);
  if (!settings.nextPaycheckDate) return settings;

  const todayStr = getTodayInUserTz(settings.timezone);
  if (settings.nextPaycheckDate > todayStr) return settings;

  const payDate = new Date(settings.nextPaycheckDate + 'T00:00:00.000Z');
  const nextDate = new Date(payDate.getTime() + 14 * 24 * 60 * 60 * 1000);
  const newDateStr = nextDate.toISOString().split('T')[0];
  return updateUserSettings(userId, { nextPaycheckDate: newDateStr });
}

/**
 * Update user settings in Redis (partial updates supported)
 */
export async function updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings> {
  // Get current settings
  const currentSettings = await getUserSettings(userId);

  // Apply updates
  const newSettings: UserSettings = {
    ...currentSettings,
    ...updates,
  };
  if (typeof updates.balance === 'number' && !isNaN(updates.balance)) {
    newSettings.balance = updates.balance;
  }
  if ('timezone' in updates) {
    newSettings.timezone = typeof updates.timezone === 'string' && updates.timezone.trim().length > 0
      ? updates.timezone.trim()
      : undefined;
  }

  // Validate the updated settings
  const validationError = validateUserSettings(newSettings);
  if (validationError) {
    throw new Error(validationError);
  }

  // Store in Redis
  const settingsKey = redisKeys.settings(userId);
  await redisOps.set(settingsKey, JSON.stringify(newSettings));

  return newSettings;
}

/**
 * Validate user settings
 */
function validateUserSettings(settings: UserSettings): string | null {
  // Validate balance (must be a number)
  if (typeof settings.balance !== 'number' || isNaN(settings.balance)) {
    return 'Balance must be a valid number';
  }

  // Validate paycheckAmount (must be non-negative; 0 means no regular paycheck)
  if (typeof settings.paycheckAmount !== 'number' || isNaN(settings.paycheckAmount) || settings.paycheckAmount < 0) {
    return 'Paycheck amount must be a non-negative number';
  }

  // Validate nextBonusDate (must be a valid date and not in the past)
  if (typeof settings.nextBonusDate !== 'string') {
    return 'Next bonus date must be a valid date string';
  }

  const bonusDate = new Date(settings.nextBonusDate);
  if (isNaN(bonusDate.getTime())) {
    return 'Next bonus date must be a valid date';
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0); // Reset time to start of day for comparison
  if (bonusDate < now) {
    return 'Next bonus date cannot be in the past';
  }

  // Validate nextPaycheckDate (if provided, must be valid date string)
  if (settings.nextPaycheckDate !== undefined && settings.nextPaycheckDate !== null) {
    if (typeof settings.nextPaycheckDate !== 'string') {
      return 'Next paycheck date must be a valid date string';
    }
    const payDate = new Date(settings.nextPaycheckDate);
    if (isNaN(payDate.getTime())) {
      return 'Next paycheck date must be a valid date';
    }
  }

  return null; // Valid
}