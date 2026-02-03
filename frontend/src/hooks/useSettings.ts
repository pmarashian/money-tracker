import { useState, useEffect } from 'react';

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

      const response = await fetch('http://localhost:3000/api/settings', {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please log in to view settings');
        }
        throw new Error(`Failed to fetch settings: ${response.statusText}`);
      }

      const data: UserSettings = await response.json();
      setSettings(data);
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

      const response = await fetch('http://localhost:3000/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please log in to update settings');
        }
        if (response.status === 400) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Invalid settings data');
        }
        throw new Error(`Failed to update settings: ${response.statusText}`);
      }

      const updatedSettings: UserSettings = await response.json();
      setSettings(updatedSettings);
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