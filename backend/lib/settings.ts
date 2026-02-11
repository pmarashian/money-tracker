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
    };
  } catch (error) {
    console.error('Error parsing user settings:', error);
    return DEFAULT_USER_SETTINGS;
  }
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