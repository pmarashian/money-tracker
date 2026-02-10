import React, { useState, useEffect, useRef } from 'react';
import {
  IonContent,
  IonHeader,
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
import { apiPost } from '../lib/api';

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

    const result = await apiPost<ChatResponse>('/api/chat', { message: messageToSend });

    if (result.ok && result.data) {
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: result.data.response,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } else {
      setError(result.error || 'Failed to send message');
      setMessages(prev => prev.slice(0, -1));
    }
    setIsLoading(false);
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
          <IonTitle>Chat</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {/* Welcome message */}
        {messages.length === 0 && (
          <div className="ion-padding">
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