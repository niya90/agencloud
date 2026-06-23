import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../hooks/useChat';

export const ChatPage: React.FC = () => {
  const { messages, isLoading, error, sessionId, sendMessage, clearChat } = useChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when messages load
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput('');
  };

  const copySessionId = () => {
    if (sessionId) {
      navigator.clipboard.writeText(sessionId);
    }
  };

  return (
    <div className="chat-container page-enter">
      <div className="chat-layout">
        {/* Main Chat Window */}
        <div className="chat-main glass-panel">
          <div className="chat-header">
            <div className="header-info">
              <span className="pulse-indicator"></span>
              <div>
                <h2>GCP AI Architect Assistant</h2>
                <p className="status-text">{isLoading ? 'Agent is thinking...' : 'Agent is online'}</p>
              </div>
            </div>
            {sessionId && (
              <button 
                onClick={clearChat}
                className="btn-secondary btn-small"
                title="Reset Conversation"
              >
                Reset Chat
              </button>
            )}
          </div>

          {error && (
            <div style={{ padding: '10px 20px', background: 'rgba(255, 0, 127, 0.08)', color: 'var(--neon-pink)', borderBottom: '1px solid rgba(255, 0, 127, 0.2)', fontSize: '0.85rem', fontWeight: 500 }}>
              Error: {error}
            </div>
          )}

          <div className="chat-messages-area">
            {messages.map((msg) => (
              <div key={msg.id} className={`message-bubble-wrapper ${msg.sender}`}>
                <div className="message-meta">
                  <span className="sender-name">
                    {msg.sender === 'user' ? 'You' : msg.sender === 'agent' ? 'Architect Agent' : 'System'}
                  </span>
                  <span className="message-time">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="message-text">
                  {msg.text.split('\n').map((line, i) => (
                    <React.Fragment key={i}>
                      {line}
                      <br />
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message-bubble-wrapper agent loading">
                <div className="message-meta">
                  <span className="sender-name">Architect Agent</span>
                </div>
                <div className="message-text loading-dots">
                  <span>.</span><span>.</span><span>.</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSend} className="chat-input-form">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about GCP services status, pricing calculations..."
              disabled={isLoading}
              className="chat-input"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="btn-primary send-btn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </form>
        </div>

        {/* Side Panel */}
        <div className="chat-side-panel glass-panel">
          <h3>Session Scope</h3>
          <div className="session-card">
            <p className="card-label">Active Session ID</p>
            <div className="session-id-display">
              <code>{sessionId || 'Not initialized'}</code>
              {sessionId && (
                <button 
                  onClick={copySessionId} 
                  className="copy-icon-btn" 
                  title="Copy Session ID"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
              )}
            </div>
            <p className="card-desc">
              All agent thoughts, tool logs, and execution traces are streamed live to BigQuery under this Session ID.
            </p>
          </div>

          <div className="suggested-prompts">
            <h4>Quick Templates</h4>
            <button 
              onClick={() => setInput("What is the current health status of our GCP services?")}
              disabled={isLoading}
              className="prompt-chip"
            >
              "Check GCP services health"
            </button>
            <button 
              onClick={() => setInput("Estimate the monthly cost for storing 500 GB in BigQuery storage.")}
              disabled={isLoading}
              className="prompt-chip"
            >
              "Calculate 500 GB BQ storage cost"
            </button>
            <button 
              onClick={() => setInput("How much would it cost to process 12 TB of queries in BigQuery?")}
              disabled={isLoading}
              className="prompt-chip"
            >
              "Calculate 12 TB BQ query cost"
            </button>
            <button 
              onClick={() => setInput("Tell me the price for running 5 million requests on Cloud Run and 10 million tokens on Vertex AI.")}
              disabled={isLoading}
              className="prompt-chip"
            >
              "Estimate Cloud Run & Vertex AI costs"
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .chat-container {
          height: calc(100vh - 120px);
          max-height: 850px;
        }
        .chat-layout {
          display: grid;
          grid-template-columns: 1fr 280px;
          gap: 20px;
          height: 100%;
        }
        .chat-main {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }
        .chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-glass);
        }
        .header-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .pulse-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: var(--neon-cyan);
          box-shadow: 0 0 10px var(--neon-cyan);
          animation: pulseGlow 2s infinite;
        }
        .chat-header h2 {
          font-family: 'Outfit', sans-serif;
          font-size: 1.1rem;
          font-weight: 600;
          letter-spacing: -0.01em;
        }
        .status-text {
          font-size: 0.75rem;
          color: var(--text-muted);
        }
        .chat-messages-area {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .message-bubble-wrapper {
          max-width: 80%;
          animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .message-bubble-wrapper.user {
          align-self: flex-end;
        }
        .message-bubble-wrapper.agent {
          align-self: flex-start;
        }
        .message-bubble-wrapper.system {
          align-self: center;
          max-width: 90%;
        }
        .message-meta {
          font-size: 0.7rem;
          color: var(--text-dim);
          margin-bottom: 4px;
          display: flex;
          gap: 8px;
        }
        .user .message-meta {
          justify-content: flex-end;
        }
        .sender-name {
          font-weight: 600;
        }
        .user .sender-name {
          color: var(--neon-cyan);
        }
        .agent .sender-name {
          color: #a855f7;
        }
        .message-text {
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 0.9rem;
          line-height: 1.5;
          word-break: break-word;
        }
        .user .message-text {
          background: rgba(0, 242, 254, 0.08);
          color: var(--text-main);
          border: 1px solid rgba(0, 242, 254, 0.2);
          border-top-right-radius: 2px;
        }
        .agent .message-text {
          background: rgba(127, 0, 255, 0.08);
          color: var(--text-main);
          border: 1px solid rgba(127, 0, 255, 0.2);
          border-top-left-radius: 2px;
        }
        .system .message-text {
          background: rgba(255, 0, 127, 0.05);
          color: var(--neon-pink);
          border: 1px solid rgba(255, 0, 127, 0.15);
          font-family: var(--font-family-mono);
          font-size: 0.8rem;
        }
        .loading-dots span {
          animation: pulseGlow 1.4s infinite both;
          font-size: 1.5rem;
          line-height: 0.5;
          display: inline-block;
        }
        .loading-dots span:nth-child(2) {
          animation-delay: .2s;
        }
        .loading-dots span:nth-child(3) {
          animation-delay: .4s;
        }
        .chat-input-form {
          padding: 16px 20px;
          border-top: 1px solid var(--border-glass);
          display: flex;
          gap: 12px;
        }
        .chat-input {
          flex: 1;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-glass);
          border-radius: 8px;
          padding: 10px 16px;
          color: var(--text-main);
          font-family: var(--font-family-sans);
          font-size: 0.9rem;
          transition: all 0.2s ease;
        }
        .chat-input:focus {
          outline: none;
          border-color: var(--neon-cyan);
          box-shadow: 0 0 10px rgba(0, 242, 254, 0.15);
          background: rgba(255, 255, 255, 0.05);
        }
        .send-btn {
          width: 42px;
          height: 42px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          flex-shrink: 0;
        }
        .chat-side-panel {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          height: 100%;
          overflow-y: auto;
        }
        .chat-side-panel h3 {
          font-family: 'Outfit', sans-serif;
          font-size: 1rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-main);
        }
        .session-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-glass);
          border-radius: 10px;
          padding: 12px;
        }
        .card-label {
          font-size: 0.7rem;
          color: var(--text-muted);
          font-weight: 600;
          margin-bottom: 6px;
        }
        .session-id-display {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--border-glass);
          border-radius: 6px;
          padding: 6px 10px;
          margin-bottom: 10px;
        }
        .session-id-display code {
          font-family: var(--font-family-mono);
          font-size: 0.75rem;
          color: var(--neon-cyan);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 170px;
        }
        .copy-icon-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          transition: color 0.2s ease;
        }
        .copy-icon-btn:hover {
          color: var(--neon-cyan);
        }
        .card-desc {
          font-size: 0.75rem;
          color: var(--text-dim);
          line-height: 1.4;
        }
        .suggested-prompts {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .suggested-prompts h4 {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          margin-bottom: 2px;
        }
        .prompt-chip {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-glass);
          color: var(--text-muted);
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 0.75rem;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s ease;
          line-height: 1.3;
        }
        .prompt-chip:hover {
          background: rgba(0, 242, 254, 0.04);
          border-color: rgba(0, 242, 254, 0.3);
          color: var(--text-main);
          transform: translateX(3px);
        }
        .btn-small {
          padding: 6px 12px;
          font-size: 0.75rem;
        }
        @media (max-width: 768px) {
          .chat-layout {
            grid-template-columns: 1fr;
          }
          .chat-side-panel {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};
