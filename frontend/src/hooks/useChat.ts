import { useState, useEffect, useCallback } from 'react';
import client from '../api/client';

export interface Message {
  id: string;
  sender: 'user' | 'agent' | 'system';
  text: string;
  timestamp: Date;
}

export const useChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Initialize session ID and load past messages from localStorage if available
  useEffect(() => {
    const savedSession = localStorage.getItem('agent_session_id');
    const savedMessages = localStorage.getItem('agent_chat_messages');
    
    if (savedSession) {
      setSessionId(savedSession);
    }
    
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        setMessages(
          parsed.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          }))
        );
      } catch (e) {
        console.error('Failed to parse cached chat messages:', e);
      }
    } else {
      // Set initial greeting
      setMessages([
        {
          id: 'greeting',
          sender: 'agent',
          text: "Hello! I am your GCP Principal Architect AI. How can I help you analyze configurations, check service health, or estimate resource pricing today?",
          timestamp: new Date(),
        },
      ]);
    }
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('agent_chat_messages', JSON.stringify(messages));
    }
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);

      try {
        const response = await client.post('/api/chat', {
          message: text,
          session_id: sessionId || undefined,
          user_id: 'user-default',
        });

        const { response: agentText, session_id: returnedSessionId } = response.data;

        // Save session ID if not already set
        if (!sessionId && returnedSessionId) {
          setSessionId(returnedSessionId);
          localStorage.setItem('agent_session_id', returnedSessionId);
        }

        const agentMessage: Message = {
          id: `agent-${Date.now()}`,
          sender: 'agent',
          text: agentText,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, agentMessage]);
      } catch (err: any) {
        let msg = 'Failed to communicate with the agent.';
        if (err.error?.message) {
          msg = err.error.message;
        } else if (err.detail) {
          msg = err.detail;
        }
        setError(msg);

        const systemErrorMessage: Message = {
          id: `error-${Date.now()}`,
          sender: 'system',
          text: `Error: ${msg}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, systemErrorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId]
  );

  const clearChat = useCallback(() => {
    localStorage.removeItem('agent_session_id');
    localStorage.removeItem('agent_chat_messages');
    setSessionId(null);
    setMessages([
      {
        id: 'greeting',
        sender: 'agent',
        text: "Hello! I am your GCP Principal Architect AI. How can I help you analyze configurations, check service health, or estimate resource pricing today?",
        timestamp: new Date(),
      },
    ]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sessionId,
    sendMessage,
    clearChat,
  };
};
