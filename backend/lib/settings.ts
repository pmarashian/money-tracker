import { redisOps, redisKeys } from './redis';

/**
 * User settings interface
 */
export interface UserSettings {
  balance: number;
  paycheckAmount: number;
  nextBonusDate: string; // ISO date string
  bonusAmount?: number; // Optional bonus amount
}

/**
 * Default user settings
 */
export const DEFAULT_USER_SETTINGS: UserSettings = {
  balance: 0,
  paycheckAmount: 2000, // Default bi-weekly paycheck
  nextBonusDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
  bonusAmount: 0,
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
      bonusAmount: typeof settings.bonusAmount === 'number' ? settings.bonusAmount : DEFAULT_USER_SETTINGS.bonusAmount,
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

  // Validate paycheckAmount (must be positive)
  if (typeof settings.paycheckAmount !== 'number' || isNaN(settings.paycheckAmount) || settings.paycheckAmount <= 0) {
    return 'Paycheck amount must be a positive number';
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

  // Validate bonusAmount (if provided, must be non-negative)
  if (settings.bonusAmount !== undefined && (typeof settings.bonusAmount !== 'number' || isNaN(settings.bonusAmount) || settings.bonusAmount < 0)) {
    return 'Bonus amount must be a non-negative number';
  }

  return null; // Valid
}