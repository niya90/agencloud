import React, { useState } from 'react';
import { ChatPage } from './pages/ChatPage';
import { ObservabilityPage } from './pages/ObservabilityPage';

type Tab = 'chat' | 'observability';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('chat');

  return (
    <div className="app-wrapper">
      {/* Navigation Header */}
      <header className="app-navbar glass-panel">
        <div className="nav-brand">
          <div className="brand-logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
            </svg>
          </div>
          <div className="brand-meta">
            <h1>Agent Console</h1>
            <span className="brand-tag">ADK Platform</span>
          </div>
        </div>

        <nav className="nav-tabs">
          <button
            onClick={() => setActiveTab('chat')}
            className={`nav-tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
          >
            Agent Workspace
          </button>
          <button
            onClick={() => setActiveTab('observability')}
            className={`nav-tab-btn ${activeTab === 'observability' ? 'active' : ''}`}
          >
            Observability Dashboard
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="app-main-content">
        {activeTab === 'chat' ? <ChatPage /> : <ObservabilityPage />}
      </main>

      <style>{`
        .app-wrapper {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          width: 100%;
          padding: 20px;
          gap: 20px;
          max-width: 1400px;
          margin: 0 auto;
        }

        /* Navbar Layout */
        .app-navbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 24px;
          border-radius: 16px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .nav-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-logo {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: rgba(0, 242, 254, 0.08);
          border: 1px solid rgba(0, 242, 254, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--neon-cyan);
          box-shadow: 0 0 10px rgba(0, 242, 254, 0.1);
        }

        .brand-meta h1 {
          font-family: 'Outfit', sans-serif;
          font-size: 1.1rem;
          font-weight: 800;
          letter-spacing: -0.01em;
          line-height: 1.1;
        }

        .brand-tag {
          font-size: 0.65rem;
          font-weight: 600;
          text-transform: uppercase;
          color: var(--text-muted);
          letter-spacing: 0.05em;
        }

        .nav-tabs {
          display: flex;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--border-glass);
          padding: 4px;
          border-radius: 10px;
        }

        .nav-tab-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-family: var(--font-family-sans);
          font-size: 0.85rem;
          font-weight: 600;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .nav-tab-btn:hover {
          color: var(--text-main);
        }

        .nav-tab-btn.active {
          background: rgba(255, 255, 255, 0.05);
          color: var(--neon-cyan);
          border: 1px solid var(--border-glass);
          box-shadow: var(--shadow-neon);
          text-shadow: 0 0 8px rgba(0, 242, 254, 0.3);
        }

        .app-main-content {
          flex: 1;
          width: 100%;
          min-height: 0; /* Important for scroll elements in child flexbox */
        }

        @media (max-width: 576px) {
          .app-navbar {
            flex-direction: column;
            align-items: flex-start;
          }
          .nav-tabs {
            width: 100%;
            justify-content: space-around;
          }
        }
      `}</style>
    </div>
  );
};

export default App;
