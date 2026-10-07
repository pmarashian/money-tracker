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
  IonButtons,
  IonModal,
  IonInput,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonAlert,
  IonBadge,
} from '@ionic/react';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiGet, apiPost, apiPatch, apiDelete } from '../lib/api';

interface RecurringPattern {
  name: string;
  amount: number;
  frequency: 'monthly' | 'weekly' | 'biweekly';
  typicalDayOfMonth?: number;
  source?: 'auto' | 'manual';
  userEdited?: boolean;
  inactive?: boolean;
  paused?: boolean;
  externalKey?: string;
  nextDate?: string;
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
    const result = await apiGet<{ recurring: RecurringPattern[] }>('/api/transactions/recurring');
    if (result.ok && result.data) {
      setRecurringExpenses(result.data.recurring || []);
    } else {
      setError(result.error || 'An error occurred');
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchRecurringExpenses();
  }, [fetchRecurringExpenses]);

  const visibleExpenses = recurringExpenses
    .map((expense, index) => ({ expense, index }))
    .filter(({ expense }) => !expense.inactive);

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

      const result =
        editingIndex !== null
          ? await apiPatch<{ recurring: RecurringPattern[] }>('/api/transactions/recurring', {
              index: editingIndex,
              ...payload,
            })
          : await apiPost<{ recurring: RecurringPattern[] }>('/api/transactions/recurring', payload);

      if (!result.ok) {
        setFormError(result.error || (editingIndex !== null ? 'Failed to update' : 'Failed to add'));
        return;
      }
      if (result.data?.recurring) {
        setRecurringExpenses(result.data.recurring);
      }
      closeModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitLoading(false);
    }
  };

  const togglePaused = async (index: number) => {
    const item = recurringExpenses[index];
    const result = await apiPatch<{ recurring: RecurringPattern[] }>('/api/transactions/recurring', {
      index,
      paused: !item.paused,
    });
    if (result.ok && result.data?.recurring) {
      setRecurringExpenses(result.data.recurring);
    }
  };

  const handleDeleteConfirm = async () => {
    if (deleteIndex === null) return;
    const index = deleteIndex;
    setDeleteIndex(null);
    const result = await apiDelete<{ recurring: RecurringPattern[] }>(
      `/api/transactions/recurring?index=${index}`
    );
    if (result.ok && result.data?.recurring) {
      setRecurringExpenses(result.data.recurring);
    } else {
      setError(result.error || 'Failed to delete');
    }
  };

  const formatCurrency = (amount: number): string =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(amount));

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

  const itemMarker = (expense: RecurringPattern) => {
    if (expense.userEdited || expense.source === 'manual') {
      return <IonBadge color="tertiary" className="expense-marker">edited</IonBadge>;
    }
    if (expense.source === 'auto') {
      return <IonBadge color="medium" className="expense-marker">auto</IonBadge>;
    }
    return null;
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
          <p className="font-body expenses-intro">
            Bills used by your projection. Your edits are never overwritten by sync.
          </p>

          <IonButton
            expand="block"
            className="btn-retro btn-retro--primary ion-margin-bottom"
            onClick={openAdd}
          >
            Add recurring expense
          </IonButton>

          {visibleExpenses.length === 0 ? (
            <div className="ion-text-center ion-padding">
              <IonText color="medium">
                <h3>No active expenses</h3>
                <p>Add a bill manually or sync from your assistant script.</p>
              </IonText>
            </div>
          ) : (
            <div className="expenses-list">
              {[...visibleExpenses]
                .sort((a, b) => a.expense.name.localeCompare(b.expense.name, undefined, { sensitivity: 'base' }))
                .map(({ expense, index }) => (
                  <IonCard
                    key={`${expense.externalKey ?? expense.name}-${index}`}
                    className={`expense-item${expense.paused ? ' expense-item--paused' : ''}`}
                  >
                    <IonCardContent className="expense-item__content">
                      <div className="expense-item__row expense-item__row--main">
                        <span className="font-heading expense-item__name">
                          {expense.name} {itemMarker(expense)}
                        </span>
                        <span className="font-body expense-item__amount">{formatCurrency(expense.amount)}</span>
                      </div>
                      <p className="expense-item__schedule font-body">
                        {formatFrequency(expense.frequency)}
                        {expense.typicalDayOfMonth != null && ` · Day ${expense.typicalDayOfMonth}`}
                        {expense.paused && ' · Paused'}
                      </p>
                      <div className="expense-item__actions">
                        <IonButton
                          className="btn-retro btn-retro--outline btn-retro--compact expense-item__action-btn"
                          onClick={() => togglePaused(index)}
                        >
                          {expense.paused ? 'Resume' : 'Pause'}
                        </IonButton>
                        <IonButton
                          className="btn-retro btn-retro--outline btn-retro--compact expense-item__action-btn"
                          onClick={() => openEdit(index)}
                        >
                          Edit
                        </IonButton>
                        <IonButton
                          className="btn-retro btn-retro--outline-danger btn-retro--compact expense-item__action-btn"
                          onClick={() => setDeleteIndex(index)}
                        >
                          Delete
                        </IonButton>
                      </div>
                    </IonCardContent>
                  </IonCard>
                ))}
            </div>
          )}
        </div>

        <IonModal isOpen={showModal} onDidDismiss={closeModal} className="expense-form-modal">
          <IonHeader className="expense-form-modal__header">
            <IonToolbar className="expense-form-modal__toolbar">
              <IonButtons slot="start">
                <IonButton className="btn-retro btn-retro--ghost" onClick={closeModal}>
                  Cancel
                </IonButton>
              </IonButtons>
              <IonTitle className="expense-form-modal__title font-heading">
                {editingIndex !== null ? 'Edit bill' : 'Add bill'}
              </IonTitle>
            </IonToolbar>
          </IonHeader>
          <IonContent className="expense-form-modal__content">
            <form className="expense-form-modal__form ion-padding" onSubmit={handleSubmit}>
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
              <IonButton
                expand="block"
                type="submit"
                className="btn-retro btn-retro--primary ion-margin-top"
                disabled={submitLoading}
              >
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
