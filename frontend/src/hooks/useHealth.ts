import { useState, useEffect } from 'react';
import { apiClient } from '../utils/api';


interface ProjectedTransaction {
  date: string;
  amount: number;
  description: string;
  type: 'payroll' | 'bonus' | 'recurring_outflow';
}

interface HealthBreakdown {
  inflows: ProjectedTransaction[];
  outflows: ProjectedTransaction[];
  projectedBalance: number;
  calculationDate: string;
}

interface HealthResult {
  status: 'not_enough' | 'enough' | 'too_much';
  projectedBalance: number;
  breakdown: HealthBreakdown;
}

interface UseHealthReturn {
  healthData: HealthResult | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useHealth(): UseHealthReturn {
  const [healthData, setHealthData] = useState<HealthResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get<HealthResult>('/api/health');

      if (response.error) {
        if (response.status === 401) {
          throw new Error('Please log in to view your financial health');
        }
        throw new Error(response.error);
      }

      setHealthData(response.data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setHealthData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return {
    healthData,
    loading,
    error,
    refetch: fetchHealth,
  };
}