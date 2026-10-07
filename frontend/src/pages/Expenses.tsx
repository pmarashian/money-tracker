import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonSpinner,
  IonModal,
  IonAlert,
} from '@ionic/react';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiGet, apiPost, apiPatch, apiDelete } from '../lib/api';
import { RrWin } from '../components/rr/RrWin';
import { RrField } from '../components/rr/RrField';
import { RrMenuPicker } from '../components/rr/RrMenuPicker';
import { RrCmdButton } from '../components/rr/RrCmdButton';

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

function expenseNameTag(name: string): string {
  return name.trim().toUpperCase();
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
      return <span className="rr-badge rr-badge--edited">edited</span>;
    }
    if (expense.source === 'auto') {
      return <span className="rr-badge">auto</span>;
    }
    return null;
  };

  if (loading) {
    return (
      <IonPage className="rr-app">
        <IonHeader>
          <IonToolbar>
            <IonTitle>Expenses</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-text-center">
          <div className="ion-padding">
            <IonSpinner name="crescent" />
            <p className="rr-lead">Loading recurring expenses...</p>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (error) {
    return (
      <IonPage className="rr-app">
        <IonHeader>
          <IonToolbar>
            <IonTitle>Expenses</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div className="ion-padding">
            <p className="rr-danger rr-fs-m">{error}</p>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage className="rr-app">
      <IonHeader>
        <IonToolbar>
          <IonTitle>Expenses</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="ion-padding">
          <p className="rr-lead">
            Bills used by your projection. Your edits are never overwritten by sync.
          </p>

          <RrCmdButton className="expenses-page__add-gap" onClick={openAdd}>
            Add recurring expense
          </RrCmdButton>

          {visibleExpenses.length === 0 ? (
            <div className="ion-text-center ion-padding">
              <p className="rr-lead">No active expenses.</p>
              <p className="rr-lead">Add a bill or sync from your assistant.</p>
            </div>
          ) : (
            <div className="expenses-list rr-stack">
              {[...visibleExpenses]
                .sort((a, b) => a.expense.name.localeCompare(b.expense.name, undefined, { sensitivity: 'base' }))
                .map(({ expense, index }) => (
                  <RrWin
                    key={`${expense.externalKey ?? expense.name}-${index}`}
                    tag={expenseNameTag(expense.name)}
                    className={expense.paused ? 'mt-expense--paused' : undefined}
                  >
                    <div className="mt-expense__row">
                      <span className="mt-expense__badges">{itemMarker(expense)}</span>
                      <span className="mt-expense__amount">{formatCurrency(expense.amount)}</span>
                    </div>
                    <p className="mt-expense__schedule">
                      {formatFrequency(expense.frequency)}
                      {expense.typicalDayOfMonth != null && ` · Day ${expense.typicalDayOfMonth}`}
                      {expense.paused && ' · Paused'}
                    </p>
                    <div className="rr-cmd-row rr-cmd-row--horizontal mt-expense__actions" role="group">
                      <RrCmdButton showCursor onClick={() => togglePaused(index)}>
                        {expense.paused ? 'Resume' : 'Pause'}
                      </RrCmdButton>
                      <RrCmdButton showCursor={false} onClick={() => openEdit(index)}>
                        Edit
                      </RrCmdButton>
                      <RrCmdButton
                        variant="danger"
                        showCursor={false}
                        onClick={() => setDeleteIndex(index)}
                      >
                        Delete
                      </RrCmdButton>
                    </div>
                  </RrWin>
                ))}
            </div>
          )}
        </div>

        <IonModal
          isOpen={showModal}
          onDidDismiss={closeModal}
          className="rr-modal expense-form-modal"
          animated={false}
        >
          <IonPage className="rr-app">
            <IonContent>
              <div className="expense-form-modal__body">
                <RrWin tag={editingIndex !== null ? 'EDIT BILL' : 'NEW BILL'}>
                  <form id="expense-form" className="expense-form-modal__form" onSubmit={handleSubmit}>
                    {formError && <p className="rr-danger rr-fs-m">{formError}</p>}
                    <RrField
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
                    <RrField
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
                    <div className="rr-field">
                      <span className="rr-field__label">Frequency</span>
                      <RrMenuPicker
                        ariaLabel="Bill frequency"
                        value={formFrequency}
                        options={FREQUENCY_OPTIONS}
                        onChange={setFormFrequency}
                      />
                    </div>
                    {formFrequency === 'monthly' && (
                      <RrField
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
                  </form>
                </RrWin>
                <RrWin tag="COMMAND" className="expense-form-modal__cmd-win">
                  <div className="rr-cmd-row rr-cmd-row--horizontal expense-form-modal__actions" role="group">
                    <RrCmdButton
                      type="submit"
                      form="expense-form"
                      disabled={submitLoading}
                      showCursor={!submitLoading}
                    >
                      {submitLoading ? 'Saving...' : editingIndex !== null ? 'Save' : 'Add'}
                    </RrCmdButton>
                    <RrCmdButton showCursor={false} onClick={closeModal}>
                      Cancel
                    </RrCmdButton>
                  </div>
                </RrWin>
              </div>
            </IonContent>
          </IonPage>
        </IonModal>

        <IonAlert
          cssClass="rr-alert"
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
