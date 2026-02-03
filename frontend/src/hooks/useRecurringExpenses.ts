import { useState, useEffect } from 'react';

interface RecurringPattern {
  name: string;
  amount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  typicalDayOfMonth?: number;
  confidence: number;
  averageAmount: number;
  transactionCount: number;
  firstDate: string;
  lastDate: string;
  predictedNextDate: string;
}

interface UseRecurringExpensesReturn {
  recurringExpenses: RecurringPattern[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useRecurringExpenses(): UseRecurringExpensesReturn {
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringPattern[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecurringExpenses = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('http://localhost:3000/api/transactions/recurring', {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please log in to view recurring expenses');
        }
        throw new Error(`Failed to fetch recurring expenses: ${response.statusText}`);
      }

      const data = await response.json();
      setRecurringExpenses(data.recurring || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setRecurringExpenses(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecurringExpenses();
  }, []);

  return {
    recurringExpenses,
    loading,
    error,
    refetch: fetchRecurringExpenses,
  };
}