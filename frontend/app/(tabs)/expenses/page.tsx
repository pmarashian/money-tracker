'use client'

import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonSpinner, IonItem, IonLabel, IonBadge } from '@ionic/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { checkAuth, User } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface RecurringExpense {
  name: string
  amount: number
  frequency: 'weekly' | 'bi-weekly' | 'monthly' | 'yearly'
  typicalDayOfMonth?: number
  confidence?: number
}

interface PayrollEvent {
  name: string
  amount: number
  date: string
  type: 'payroll' | 'bonus'
}

export default function ExpensesPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [expenses, setExpenses] = useState<RecurringExpense[]>([])
  const [payrollEvents, setPayrollEvents] = useState<PayrollEvent[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const checkUserAuth = async () => {
      const authenticatedUser = await checkAuth()
      setUser(authenticatedUser)
      setLoading(false)

      if (!authenticatedUser) {
        router.push('/login')
        return
      }

      // Load recurring expenses
      await loadRecurringExpenses()
    }

    checkUserAuth()
  }, [router])

  const loadRecurringExpenses = async () => {
    setDataLoading(true)
    try {
      const response = await fetch('/api/transactions/recurring', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setExpenses(data.expenses || [])
        setPayrollEvents(data.payrollEvents || [])
      }
    } catch (error) {
      console.error('Failed to load recurring expenses:', error)
    } finally {
      setDataLoading(false)
    }
  }

  const getFrequencyText = (frequency: string) => {
    switch (frequency) {
      case 'weekly': return 'Weekly'
      case 'bi-weekly': return 'Bi-weekly'
      case 'monthly': return 'Monthly'
      case 'yearly': return 'Yearly'
      default: return frequency
    }
  }

  if (loading) {
    return (
      <IonPage>
        <IonContent className="ion-padding ion-text-center">
          <IonSpinner name="circular" />
          <p>Loading...</p>
        </IonContent>
      </IonPage>
    )
  }

  if (!user) {
    return null // Will redirect to login
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle className="font-heading">Expenses</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="max-w-md mx-auto space-y-4">
          {dataLoading ? (
            <div className="ion-text-center">
              <IonSpinner name="circular" />
              <p className="font-body text-xs mt-2">Loading expenses...</p>
            </div>
          ) : (
            <>
              {/* Recurring Expenses */}
              <IonCard>
                <IonCardHeader>
                  <IonCardTitle className="font-heading text-sm">Recurring Expenses</IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                  {expenses.length === 0 ? (
                    <p className="font-body text-xs text-gray-400 text-center">
                      No recurring expenses detected yet.
                      <br />
                      Upload a CSV file to get started.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {expenses.map((expense, index) => (
                        <IonItem key={index} lines="none" className="rounded-lg">
                          <IonLabel>
                            <div className="flex justify-between items-center">
                              <div>
                                <h3 className="font-body text-sm font-medium">{expense.name}</h3>
                                <p className="font-body text-xs text-gray-400">
                                  {getFrequencyText(expense.frequency)}
                                  {expense.typicalDayOfMonth && ` • Day ${expense.typicalDayOfMonth}`}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-heading text-sm text-red-400">
                                  -${expense.amount.toFixed(2)}
                                </p>
                                {expense.confidence && (
                                  <IonBadge
                                    color={expense.confidence > 0.8 ? 'success' : expense.confidence > 0.6 ? 'warning' : 'danger'}
                                    className="text-xs"
                                  >
                                    {Math.round(expense.confidence * 100)}%
                                  </IonBadge>
                                )}
                              </div>
                            </div>
                          </IonLabel>
                        </IonItem>
                      ))}
                    </div>
                  )}
                </IonCardContent>
              </IonCard>

              {/* Payroll Events */}
              {payrollEvents.length > 0 && (
                <IonCard>
                  <IonCardHeader>
                    <IonCardTitle className="font-heading text-sm">Payroll & Bonuses</IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    <div className="space-y-2">
                      {payrollEvents.map((event, index) => (
                        <IonItem key={index} lines="none" className="rounded-lg">
                          <IonLabel>
                            <div className="flex justify-between items-center">
                              <div>
                                <h3 className="font-body text-sm font-medium">{event.name}</h3>
                                <p className="font-body text-xs text-gray-400">
                                  {new Date(event.date).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="text-right">
                                <IonBadge
                                  color={event.type === 'bonus' ? 'success' : 'primary'}
                                  className="text-xs mr-2"
                                >
                                  {event.type}
                                </IonBadge>
                                <p className="font-heading text-sm text-green-400">
                                  +${event.amount.toFixed(2)}
                                </p>
                              </div>
                            </div>
                          </IonLabel>
                        </IonItem>
                      ))}
                    </div>
                  </IonCardContent>
                </IonCard>
              )}
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  )
}