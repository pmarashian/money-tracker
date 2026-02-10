import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonCard,
  IonCardContent,
  IonSpinner,
  IonText,
  IonButton,
  IonModal,
  IonInput,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonAlert,
} from '@ionic/react';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiGet, apiPost, apiPatch, apiDelete } from '../lib/api';

interface RecurringPattern {
  name: string;
  amount: number;
  frequency: 'monthly' | 'weekly' | 'biweekly';
  typicalDayOfMonth?: number;
}

const Expenses: React.FC = () => {
  const { user } = useAuth();
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formFrequency, setFormFrequency] = useState<RecurringPattern['frequency']>('monthly');
  const [formDayOfMonth, setFormDayOfMonth] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const fetchRecurringExpenses = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiGet('/api/transactions/recurring');
      if (!response.ok) throw new Error('Failed to fetch recurring expenses');
      const data = await response.json();
      setRecurringExpenses(data.recurring || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRecurringExpenses();
  }, [fetchRecurringExpenses]);

  const openAdd = () => {
    setEditingIndex(null);
    setFormName('');
    setFormAmount('');
    setFormFrequency('monthly');
    setFormDayOfMonth('');
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (index: number) => {
    const expense = recurringExpenses[index];
    setEditingIndex(index);
    setFormName(expense.name);
    setFormAmount(String(expense.amount));
    setFormFrequency(expense.frequency);
    setFormDayOfMonth(expense.typicalDayOfMonth != null ? String(expense.typicalDayOfMonth) : '');
    setFormError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingIndex(null);
    setFormError(null);
  };

  const validateForm = (): boolean => {
    if (!formName.trim()) {
      setFormError('Name is required');
      return false;
    }
    const amount = Number(formAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Amount must be a positive number');
      return false;
    }
    if (formFrequency !== 'monthly' && formFrequency !== 'weekly' && formFrequency !== 'biweekly') {
      setFormError('Please select a frequency');
      return false;
    }
    if (formDayOfMonth.trim()) {
      const d = Number(formDayOfMonth);
      if (!Number.isInteger(d) || d < 1 || d > 31) {
        setFormError('Day of month must be between 1 and 31');
        return false;
      }
    }
    setFormError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setSubmitLoading(true);
    setFormError(null);
    try {
      const amount = Number(formAmount);
      const typicalDayOfMonth =
        formFrequency === 'monthly' && formDayOfMonth.trim() ? Number(formDayOfMonth) : undefined;
      const payload = {
        name: formName.trim(),
        amount,
        frequency: formFrequency,
        ...(typicalDayOfMonth !== undefined && { typicalDayOfMonth }),
      };

      const response =
        editingIndex !== null
          ? await apiPatch('/api/transactions/recurring', { index: editingIndex, ...payload })
          : await apiPost('/api/transactions/recurring', payload);

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setFormError(data.error || (editingIndex !== null ? 'Failed to update' : 'Failed to add'));
        return;
      }
      const data = await response.json();
      setRecurringExpenses(data.recurring || recurringExpenses);
      closeModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (deleteIndex === null) return;
    const index = deleteIndex;
    setDeleteIndex(null);
    try {
      const response = await apiDelete(`/api/transactions/recurring?index=${index}`);
      if (!response.ok) throw new Error('Failed to delete');
      const data = await response.json();
      setRecurringExpenses(data.recurring || recurringExpenses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(amount)); // Use absolute value since amounts are negative
  };

  const formatFrequency = (frequency: string): string => {
    switch (frequency) {
      case 'monthly':
        return 'Monthly';
      case 'weekly':
        return 'Weekly';
      case 'biweekly':
        return 'Bi-weekly';
      default:
        return frequency;
    }
  };

  if (loading) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Expenses</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-text-center">
          <div className="ion-padding">
            <IonSpinner name="crescent" />
            <p className="font-body">Loading recurring expenses...</p>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (error) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Expenses</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div className="ion-padding">
            <IonText color="danger">
              <h2>Error loading expenses</h2>
              <p>{error}</p>
            </IonText>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Expenses</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="ion-padding">
          <p className="font-body">Your automatically detected recurring expenses. Add, edit, or remove items below.</p>

          <IonButton expand="block" className="ion-margin-bottom" onClick={openAdd}>
            Add recurring expense
          </IonButton>

          {recurringExpenses.length === 0 ? (
            <div className="ion-text-center ion-padding">
              <IonText color="medium">
                <h3>No recurring expenses found</h3>
                <p>Upload your CSV transactions to detect recurring patterns, or add one manually above.</p>
              </IonText>
            </div>
          ) : (
            <div>
              {[...recurringExpenses]
                .map((expense, originalIndex) => ({ expense, originalIndex }))
                .sort((a, b) =>
                  a.expense.name.localeCompare(b.expense.name, undefined, { sensitivity: 'base' })
                )
                .map(({ expense, originalIndex }) => (
                  <IonCard key={originalIndex} className="expense-item ion-margin-bottom">
                    <IonCardContent className="expense-item__content">
                      <div className="expense-item__row expense-item__row--main">
                        <span className="font-heading expense-item__name">{expense.name}</span>
                        <span className="font-body expense-item__amount">{formatCurrency(expense.amount)}</span>
                      </div>
                      <div className="expense-item__row expense-item__row--meta">
                        <span className="expense-item__meta">
                          {formatFrequency(expense.frequency)}
                          {expense.typicalDayOfMonth != null && ` · Day ${expense.typicalDayOfMonth}`}
                        </span>
                        <div className="expense-item__actions">
                          <IonButton fill="outline" size="small" onClick={() => openEdit(originalIndex)}>
                            Edit
                          </IonButton>
                          <IonButton fill="outline" color="danger" size="small" className="ion-margin-start" onClick={() => setDeleteIndex(originalIndex)}>
                            Delete
                          </IonButton>
                        </div>
                      </div>
                    </IonCardContent>
                  </IonCard>
                ))}
            </div>
          )}
        </div>

        <IonModal isOpen={showModal} onDidDismiss={closeModal}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>{editingIndex !== null ? 'Edit recurring expense' : 'Add recurring expense'}</IonTitle>
              <IonButton slot="end" fill="clear" onClick={closeModal}>
                Cancel
              </IonButton>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <form onSubmit={handleSubmit}>
              {formError && (
                <IonText color="danger" className="ion-margin-bottom">
                  <p>{formError}</p>
                </IonText>
              )}
              <IonItem>
                <IonLabel position="stacked">Name</IonLabel>
                <IonInput
                  type="text"
                  value={formName}
                  onIonInput={(e) => setFormName(e.detail.value ?? '')}
                  placeholder="e.g. Rent"
                  required
                />
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">Amount ($)</IonLabel>
                <IonInput
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={formAmount}
                  onIonInput={(e) => setFormAmount(e.detail.value ?? '')}
                  placeholder="0.00"
                  required
                />
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">Frequency</IonLabel>
                <IonSelect
                  value={formFrequency}
                  onIonChange={(e) => setFormFrequency(e.detail.value as RecurringPattern['frequency'])}
                  placeholder="Select"
                >
                  <IonSelectOption value="monthly">Monthly</IonSelectOption>
                  <IonSelectOption value="weekly">Weekly</IonSelectOption>
                  <IonSelectOption value="biweekly">Bi-weekly</IonSelectOption>
                </IonSelect>
              </IonItem>
              {formFrequency === 'monthly' && (
                <IonItem>
                  <IonLabel position="stacked">Day of month (optional)</IonLabel>
                  <IonInput
                    type="number"
                    min={1}
                    max={31}
                    value={formDayOfMonth}
                    onIonInput={(e) => setFormDayOfMonth(e.detail.value ?? '')}
                    placeholder="1–31"
                  />
                </IonItem>
              )}
              <IonButton expand="block" type="submit" className="ion-margin-top" disabled={submitLoading}>
                {submitLoading ? 'Saving...' : editingIndex !== null ? 'Save' : 'Add'}
              </IonButton>
            </form>
          </IonContent>
        </IonModal>

        <IonAlert
          isOpen={deleteIndex !== null}
          onDidDismiss={() => setDeleteIndex(null)}
          header="Delete recurring expense?"
          message="This cannot be undone."
          buttons={[
            'Cancel',
            { text: 'Delete', role: 'destructive', handler: handleDeleteConfirm },
          ]}
        />
      </IonContent>
    </IonPage>
  );
};

export default Expenses;