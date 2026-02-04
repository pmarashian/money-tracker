import React, { useState, useEffect, useRef } from 'react';
import {
  IonContent,
  IonHeader,
  IonMenuButton,
  IonPage,
  IonTitle,
  IonToolbar,
  IonItem,
  IonInput,
  IonButton,
  IonIcon,
  IonCard,
  IonCardContent,
  IonSpinner,
  IonAlert,
  IonText,
  IonFooter,
} from '@ionic/react';
import { send } from 'ionicons/icons';
import { useAuth } from '../hooks/useAuth';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatResponse {
  response: string;
  contextUsed: {
    recurringExpensesCount: number;
    healthStatus: string;
    netFlow: number;
  };
}

const Chat: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages are added
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || isLoading) return;

    const messageToSend = newMessage.trim();
    setNewMessage('');
    setIsLoading(true);
    setError(null);

    // Add user message to chat
    const userMessage: ChatMessage = {
      role: 'user',
      content: messageToSend,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ message: messageToSend }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: ChatResponse = await response.json();

      // Add assistant message to chat
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setError(error instanceof Error ? error.message : 'Failed to send message');

      // Remove the user message if sending failed
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  if (authLoading) {
    return (
      <IonPage>
        <IonContent className="ion-padding ion-text-center">
          <IonSpinner name="crescent" />
          <p>Loading...</p>
        </IonContent>
      </IonPage>
    );
  }

  if (!user) {
    return (
      <IonPage>
        <IonContent className="ion-padding ion-text-center">
          <h2>Please log in to use the chat feature</h2>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonMenuButton slot="start" />
          <IonTitle>Chat</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonMenuButton slot="start" />
            <IonTitle size="large">Chat</IonTitle>
          </IonToolbar>
        </IonHeader>

        {/* Welcome message */}
        {messages.length === 0 && (
          <div className="ion-padding">
            <h1 className="font-heading">Chat</h1>
            <p className="font-body">Chat with AI about your financial health and get personalized advice.</p>
          </div>
        )}

        {/* Messages */}
        <div className="ion-padding">
          {messages.map((message, index) => (
            <IonCard key={index} className={message.role === 'user' ? 'user-message' : 'assistant-message'}>
              <IonCardContent>
                <div style={{ display: 'flex', justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: '4px' }}>
                  <IonText color={message.role === 'user' ? 'primary' : 'secondary'}>
                    <small>{message.role === 'user' ? 'You' : 'AI Advisor'}</small>
                  </IonText>
                </div>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{message.content}</p>
                <div style={{ display: 'flex', justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start', marginTop: '4px' }}>
                  <IonText color="medium">
                    <small>{new Date(message.timestamp).toLocaleTimeString()}</small>
                  </IonText>
                </div>
              </IonCardContent>
            </IonCard>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <IonCard>
              <IonCardContent className="ion-text-center">
                <IonSpinner name="crescent" />
                <p>AI is thinking...</p>
              </IonCardContent>
            </IonCard>
          )}

          <div ref={messagesEndRef} />
        </div>
      </IonContent>

      {/* Message input */}
      <IonFooter>
        <IonToolbar>
          <IonItem lines="none" className="message-input">
            <IonInput
              value={newMessage}
              placeholder="Ask about your financial health..."
              onIonInput={(e) => setNewMessage(e.detail.value!)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              clearInput
            />
            <IonButton
              fill="clear"
              slot="end"
              onClick={sendMessage}
              disabled={!newMessage.trim() || isLoading}
            >
              <IonIcon icon={send} />
            </IonButton>
          </IonItem>
        </IonToolbar>
      </IonFooter>

      {/* Error alert */}
      <IonAlert
        isOpen={!!error}
        onDidDismiss={() => setError(null)}
        header="Chat Error"
        message={error || ''}
        buttons={['OK']}
      />
    </IonPage>
  );
};

export default Chat;