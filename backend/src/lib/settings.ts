/**
 * User settings for Money Tracker
 */

export interface UserSettings {
  balance: number;              // Current account balance
  paycheckAmount: number;       // Amount per paycheck
  nextBonusDate: string;        // Next bonus date in MM/DD/YYYY format
  bonusAmount?: number;         // Optional bonus amount
}

/**
 * Default user settings
 */
export function getDefaultUserSettings(): UserSettings {
  return {
    balance: 0,
    paycheckAmount: 2000, // Default paycheck amount
    nextBonusDate: '', // No default bonus date
    // bonusAmount is optional, so not included in defaults
  };
}

/**
 * Validate user settings
 */
export function validateUserSettings(settings: Partial<UserSettings>): string[] {
  const errors: string[] = [];

  // Validate balance
  if (settings.balance !== undefined && (typeof settings.balance !== 'number' || isNaN(settings.balance))) {
    errors.push('balance must be a valid number');
  }

  // Validate paycheckAmount
  if (settings.paycheckAmount !== undefined && (typeof settings.paycheckAmount !== 'number' || isNaN(settings.paycheckAmount) || settings.paycheckAmount <= 0)) {
    errors.push('paycheckAmount must be a positive number');
  }

  // Validate nextBonusDate
  if (settings.nextBonusDate !== undefined) {
    if (typeof settings.nextBonusDate !== 'string') {
      errors.push('nextBonusDate must be a string');
    } else if (settings.nextBonusDate.trim() !== '') {
      // If not empty, validate date format
      const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
      if (!dateRegex.test(settings.nextBonusDate)) {
        errors.push('nextBonusDate must be in MM/DD/YYYY format');
      } else {
        // Validate it's a valid date
        const dateParts = settings.nextBonusDate.split('/');
        const month = parseInt(dateParts[0]) - 1; // JS months are 0-based
        const day = parseInt(dateParts[1]);
        const year = parseInt(dateParts[2]);
        const date = new Date(year, month, day);

        if (date.getMonth() !== month || date.getDate() !== day || date.getFullYear() !== year) {
          errors.push('nextBonusDate must be a valid date');
        }
      }
    }
  }

  // Validate bonusAmount
  if (settings.bonusAmount !== undefined && (typeof settings.bonusAmount !== 'number' || isNaN(settings.bonusAmount) || settings.bonusAmount < 0)) {
    errors.push('bonusAmount must be a non-negative number');
  }

  return errors;
}

/**
 * Merge partial settings with existing settings
 */
export function mergeUserSettings(existing: UserSettings, updates: Partial<UserSettings>): UserSettings {
  return {
    ...existing,
    ...updates,
  };
}