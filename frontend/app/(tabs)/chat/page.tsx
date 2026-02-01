'use client'

import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonCard, IonCardContent, IonButton, IonInput, IonSpinner, IonItem, IonLabel } from '@ionic/react'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { checkAuth, User } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function ChatPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    const checkUserAuth = async () => {
      const authenticatedUser = await checkAuth()
      setUser(authenticatedUser)
      setLoading(false)

      if (!authenticatedUser) {
        router.push('/login')
      }
    }

    checkUserAuth()
  }, [router])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const sendMessage = async () => {
    if (!inputMessage.trim() || sending) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setSending(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ message: userMessage.content })
      })

      if (response.ok) {
        const data = await response.json()
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: data.reply,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, assistantMessage])
      }
    } catch (error) {
      console.error('Chat error:', error)
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error connecting to the server. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMessage])
    } finally {
      setSending(false)
    }
  }

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
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
          <IonTitle className="font-heading">AI Assistant</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="max-w-md mx-auto h-full flex flex-col">
          {/* Messages */}
          <div className="flex-1 space-y-3 mb-4 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <p className="font-body text-xs text-gray-400">
                  Ask me about your finances, recurring expenses, or financial health!
                </p>
                <p className="font-body text-xs text-gray-500 mt-2">
                  Try: "Why is my health status 'not enough'?" or "How can I reduce my monthly expenses?"
                </p>
              </div>
            ) : (
              messages.map((message, index) => (
                <IonCard
                  key={index}
                  className={`${
                    message.role === 'user'
                      ? 'ml-auto bg-blue-900 border-blue-700'
                      : 'mr-auto bg-gray-800 border-gray-700'
                  } max-w-xs`}
                >
                  <IonCardContent className="p-3">
                    <p className="font-body text-xs whitespace-pre-wrap">
                      {message.content}
                    </p>
                    <p className="font-body text-xs text-gray-500 mt-1">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </IonCardContent>
                </IonCard>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex space-x-2">
            <IonInput
              value={inputMessage}
              placeholder="Ask about your finances..."
              onIonChange={(e) => setInputMessage(e.detail.value || '')}
              onKeyPress={handleKeyPress}
              disabled={sending}
              className="flex-1"
            />
            <IonButton
              onClick={sendMessage}
              disabled={!inputMessage.trim() || sending}
              size="default"
            >
              {sending ? (
                <IonSpinner name="circular" />
              ) : (
                'Send'
              )}
            </IonButton>
          </div>
        </div>
      </IonContent>
    </IonPage>
  )
}