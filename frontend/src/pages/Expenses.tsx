import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonSpinner,
  IonButton,
  IonButtons,
  IonModal,
  IonAlert,
} from '@ionic/react';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiGet, apiPost, apiPatch, apiDelete } from '../lib/api';
import { NesField } from '../components/nes/NesField';
import { NesMenuPicker } from '../components/nes/NesMenuPicker';

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

const FREQUENCY_OPTIONS: { value: RecurringPattern['frequency']; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
];

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
      return <span className="nes-badge nes-badge--edited">edited</span>;
    }
    if (expense.source === 'auto') {
      return <span className="nes-badge nes-badge--auto">auto</span>;
    }
    return null;
  };

  if (loading) {
    return (
      <IonPage className="nes-screen">
        <IonHeader className="nes-screen__header">
          <IonToolbar className="nes-toolbar">
            <IonTitle className="nes-toolbar__title">Expenses</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-text-center">
          <div className="ion-padding">
            <IonSpinner name="crescent" />
            <p className="nes-lead">Loading recurring expenses...</p>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (error) {
    return (
      <IonPage className="nes-screen">
        <IonHeader className="nes-screen__header">
          <IonToolbar className="nes-toolbar">
            <IonTitle className="nes-toolbar__title">Expenses</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div className="ion-padding">
            <p className="nes-error">{error}</p>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage className="nes-screen">
      <IonHeader className="nes-screen__header">
        <IonToolbar className="nes-toolbar">
          <IonTitle className="nes-toolbar__title">Expenses</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="ion-padding">
          <p className="nes-lead">
            Bills used by your projection. Your edits are never overwritten by sync.
          </p>

          <IonButton
            expand="block"
            className="btn-retro btn-retro--primary expenses-page__add-btn"
            onClick={openAdd}
          >
            Add recurring expense
          </IonButton>

          {visibleExpenses.length === 0 ? (
            <div className="ion-text-center ion-padding">
              <p className="nes-lead">No active expenses.</p>
              <p className="nes-lead">Add a bill or sync from your assistant.</p>
            </div>
          ) : (
            <div className="expenses-list">
              {[...visibleExpenses]
                .sort((a, b) => a.expense.name.localeCompare(b.expense.name, undefined, { sensitivity: 'base' }))
                .map(({ expense, index }) => (
                  <div
                    key={`${expense.externalKey ?? expense.name}-${index}`}
                    className={`nes-expense-card${expense.paused ? ' nes-expense-card--paused' : ''}`}
                  >
                      <div className="nes-expense-card__row">
                        <span className="nes-expense-card__name">
                          {expense.name} {itemMarker(expense)}
                        </span>
                        <span className="nes-expense-card__amount">{formatCurrency(expense.amount)}</span>
                      </div>
                      <p className="nes-expense-card__schedule">
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
                          className="btn-retro btn-retro--danger btn-retro--compact expense-item__action-btn"
                          onClick={() => setDeleteIndex(index)}
                        >
                          Delete
                        </IonButton>
                      </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        <IonModal
          isOpen={showModal}
          onDidDismiss={closeModal}
          className="expense-form-modal nes-screen"
        >
          <IonHeader className="nes-screen__header expense-form-modal__header">
            <IonToolbar className="nes-toolbar expense-form-modal__toolbar">
              <IonButtons slot="start">
                <IonButton className="btn-retro btn-retro--ghost" onClick={closeModal}>
                  Cancel
                </IonButton>
              </IonButtons>
              <IonTitle className="nes-toolbar__title expense-form-modal__title">
                {editingIndex !== null ? 'Edit bill' : 'Add bill'}
              </IonTitle>
            </IonToolbar>
          </IonHeader>
          <IonContent className="expense-form-modal__content">
            <form className="expense-form-modal__form nes-panel" onSubmit={handleSubmit}>
              {formError && <p className="nes-error">{formError}</p>}
              <NesField
                label="Name"
                inputProps={{
                  id: 'expense-name',
                  type: 'text',
                  value: formName,
                  placeholder: 'e.g. Rent',
                  required: true,
                  onChange: (e) => setFormName(e.target.value),
                }}
              />
              <NesField
                label="Amount ($)"
                inputProps={{
                  id: 'expense-amount',
                  type: 'number',
                  inputMode: 'decimal',
                  min: 0,
                  step: '0.01',
                  value: formAmount,
                  placeholder: '0.00',
                  required: true,
                  onChange: (e) => setFormAmount(e.target.value),
                }}
              />
              <div className="nes-field">
                <span className="nes-field__label">Frequency</span>
                <NesMenuPicker
                  ariaLabel="Bill frequency"
                  value={formFrequency}
                  options={FREQUENCY_OPTIONS}
                  onChange={setFormFrequency}
                />
              </div>
              {formFrequency === 'monthly' && (
                <NesField
                  label="Day of month (optional)"
                  inputProps={{
                    id: 'expense-day',
                    type: 'number',
                    min: 1,
                    max: 31,
                    value: formDayOfMonth,
                    placeholder: '1-31',
                    onChange: (e) => setFormDayOfMonth(e.target.value),
                  }}
                />
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
          cssClass="nes-alert"
          isOpen={deleteIndex !== null}
          onDidDismiss={() => setDeleteIndex(null)}
          header="Delete bill?"
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
