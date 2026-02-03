import React, { useEffect, useState } from 'react'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonText,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonIcon,
  IonTextarea
} from '@ionic/react'
import { send } from 'ionicons/icons'
import { useHistory } from 'react-router-dom'

const ChatPage: React.FC = () => {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Array<{role: 'user' | 'assistant', content: string, timestamp: Date}>>([])
  const [sending, setSending] = useState(false)
  const history = useHistory()

  useEffect(() => {
    // Check if user is logged in
    checkSession()
  }, [])

  const checkSession = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/auth/session', {
        credentials: 'include',
      })

      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
      } else {
        // Not logged in, redirect to login
        history.push('/login')
      }
    } catch (err) {
      // Network error, redirect to login
      history.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!message.trim()) return

    const userMessage = { role: 'user' as const, content: message, timestamp: new Date() }
    setMessages(prev => [...prev, userMessage])
    setMessage('')
    setSending(true)

    try {
      const response = await fetch('http://localhost:3002/api/chat', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      })

      if (response.ok) {
        const result = await response.json()
        const assistantMessage = {
          role: 'assistant' as const,
          content: result.reply,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        console.error('Chat failed')
        // Show error message
      }
    } catch (err) {
      console.error('Chat error:', err)
      // Show error message
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <IonPage>
        <IonContent>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <IonText>Loading...</IonText>
          </div>
        </IonContent>
      </IonPage>
    )
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle className="font-heading">AI Assistant</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <IonCard style={{ flex: 1, marginBottom: '20px' }}>
            <IonCardHeader>
              <IonCardTitle>Financial Assistant</IonCardTitle>
            </IonCardHeader>
            <IonCardContent style={{ height: '400px', overflowY: 'auto' }}>
              {messages.length === 0 ? (
                <IonText className="font-body">
                  <p>Ask me anything about your finances! I can help with:</p>
                  <ul>
                    <li>Expense analysis and recommendations</li>
                    <li>Budget planning</li>
                    <li>What-if scenarios</li>
                    <li>Financial goal setting</li>
                  </ul>
                </IonText>
              ) : (
                <IonList>
                  {messages.map((msg, index) => (
                    <IonItem key={index} style={{
                      flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                      '--background': msg.role === 'user' ? '#e3f2fd' : '#f5f5f5'
                    }}>
                      <IonLabel style={{
                        textAlign: msg.role === 'user' ? 'right' : 'left',
                        flex: 1
                      }}>
                        <IonText className="font-body" style={{
                          fontWeight: msg.role === 'assistant' ? 'bold' : 'normal'
                        }}>
                          {msg.role === 'assistant' ? 'AI: ' : 'You: '}
                        </IonText>
                        <p>{msg.content}</p>
                        <IonText color="medium" style={{ fontSize: '12px' }}>
                          {msg.timestamp.toLocaleTimeString()}
                        </IonText>
                      </IonLabel>
                    </IonItem>
                  ))}
                </IonList>
              )}
            </IonCardContent>
          </IonCard>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <IonTextarea
              value={message}
              onIonChange={(e) => setMessage(e.detail.value!)}
              placeholder="Ask about your finances..."
              rows={2}
              style={{ flex: 1 }}
              disabled={sending}
            />
            <IonButton
              onClick={handleSendMessage}
              disabled={sending || !message.trim()}
              fill="solid"
            >
              <IonIcon icon={send} slot="icon-only" />
            </IonButton>
          </div>
        </div>
      </IonContent>
    </IonPage>
  )
}

export default ChatPage