import { useState, useEffect } from 'react';
import { apiClient } from '../utils/api';

interface UserSettings {
  balance: number;
  paycheckAmount: number;
  nextBonusDate: string;
  bonusAmount?: number;
}

interface UseSettingsReturn {
  settings: UserSettings | null;
  loading: boolean;
  error: string | null;
  updateSettings: (updates: Partial<UserSettings>) => Promise<boolean>;
  refetch: () => void;
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get<UserSettings>('/api/settings');

      if (response.error) {
        if (response.status === 401) {
          throw new Error('Please log in to view settings');
        }
        throw new Error(response.error);
      }

      setSettings(response.data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setSettings(null);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<UserSettings>): Promise<boolean> => {
    try {
      setError(null);

      const response = await apiClient.patch<UserSettings>('/api/settings', updates);

      if (response.error) {
        if (response.status === 401) {
          throw new Error('Please log in to update settings');
        }
        if (response.status === 400) {
          // The API client already handles JSON parsing for error responses
          throw new Error(response.error);
        }
        throw new Error(response.error);
      }

      setSettings(response.data || null);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return false;
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return {
    settings,
    loading,
    error,
    updateSettings,
    refetch: fetchSettings,
  };
}