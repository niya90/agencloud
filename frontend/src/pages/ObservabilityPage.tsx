import React, { useState, useMemo } from 'react';
import { useObservability, ObservabilityRow } from '../hooks/useObservability';

export const ObservabilityPage: React.FC = () => {
  const { logs, isLoading, error, limit, setLimit, autoRefresh, setAutoRefresh, refresh } = useObservability(100);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEventType, setSelectedEventType] = useState('');
  const [selectedLog, setSelectedLog] = useState<ObservabilityRow | null>(null);

  // Event types for the filter dropdown
  const eventTypes = useMemo(() => {
    const types = new Set<string>();
    logs.forEach(log => {
      if (log.event_type) types.add(log.event_type);
    });
    return Array.from(types);
  }, [logs]);

  // Filtering logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = 
        (log.session_id?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        (log.invocation_id?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        (log.trace_id?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        (log.error_message?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
      
      const matchesType = selectedEventType ? log.event_type === selectedEventType : true;

      return matchesSearch && matchesType;
    });
  }, [logs, searchTerm, selectedEventType]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = filteredLogs.length;
    const uniqueSessions = new Set(filteredLogs.map(l => l.session_id).filter(Boolean)).size;
    
    // Success rate calculation
    const successLogs = filteredLogs.filter(l => l.status === 'SUCCESS' || !l.error_message).length;
    const successRate = total > 0 ? Math.round((successLogs / total) * 100) : 100;

    // Latency calculations (parsing latency_ms JSON)
    let totalLatency = 0;
    let latencyCount = 0;
    filteredLogs.forEach(l => {
      if (l.latency_ms) {
        let lat = 0;
        if (typeof l.latency_ms === 'number') {
          lat = l.latency_ms;
        } else if (typeof l.latency_ms === 'object') {
          // If stored as dict (e.g. {'total': 120})
          lat = l.latency_ms.total || l.latency_ms.total_latency || 0;
        }
        if (lat > 0) {
          totalLatency += lat;
          latencyCount++;
        }
      }
    });
    const avgLatency = latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0;

    return {
      total,
      uniqueSessions,
      successRate,
      avgLatency
    };
  }, [filteredLogs]);

  const getEventBadgeClass = (type?: string) => {
    if (!type) return 'badge-secondary';
    const t = type.toUpperCase();
    if (t.includes('START') || t.includes('BEGIN')) return 'badge-info';
    if (t.includes('COMPLETE') || t.includes('END')) return 'badge-success';
    if (t.includes('TOOL') || t.includes('FUNCTION')) return 'badge-warning';
    return 'badge-secondary';
  };

  const getStatusBadgeClass = (status?: string, errMsg?: string) => {
    if (errMsg) return 'badge-error';
    if (!status) return 'badge-secondary';
    const s = status.toUpperCase();
    if (s === 'SUCCESS') return 'badge-success';
    if (s === 'ERROR' || s === 'FAILED') return 'badge-error';
    return 'badge-secondary';
  };

  const formatLatency = (latField: any) => {
    if (!latField) return '-';
    if (typeof latField === 'number') return `${latField}ms`;
    if (typeof latField === 'object') {
      const lat = latField.total || latField.total_latency || latField.duration || null;
      return lat ? `${lat}ms` : JSON.stringify(latField);
    }
    return String(latField);
  };

  return (
    <div className="obs-container page-enter">
      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card glass-panel">
          <div className="stat-info">
            <span className="stat-title">Telemetry Events</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="stat-icon cyan">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
          </div>
        </div>
        
        <div className="stat-card glass-panel">
          <div className="stat-info">
            <span className="stat-title">Active Sessions</span>
            <span className="stat-value">{stats.uniqueSessions}</span>
          </div>
          <div className="stat-icon purple">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-info">
            <span className="stat-title">Success Rate</span>
            <span className="stat-value">{stats.successRate}%</span>
          </div>
          <div className="stat-icon green">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-info">
            <span className="stat-title">Average Latency</span>
            <span className="stat-value">{stats.avgLatency > 0 ? `${stats.avgLatency}ms` : '-'}</span>
          </div>
          <div className="stat-icon gold">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="controls-bar glass-panel">
        <div className="search-group">
          <input
            type="text"
            placeholder="Search by Session, Trace, or Error..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <select
            value={selectedEventType}
            onChange={(e) => setSelectedEventType(e.target.value)}
            className="filter-select"
          >
            <option value="">All Event Types</option>
            {eventTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="action-group">
          <div className="auto-refresh-toggle">
            <label className="switch">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              <span className="slider round"></span>
            </label>
            <span className="toggle-label">Auto-Refresh (5s)</span>
          </div>

          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="limit-select"
          >
            <option value="50">Show 50</option>
            <option value="100">Show 100</option>
            <option value="200">Show 200</option>
          </select>

          <button onClick={refresh} disabled={isLoading} className="btn-primary refresh-btn">
            {isLoading ? (
              <span className="spinner"></span>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
              </svg>
            )}
            Refresh
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="table-wrapper glass-panel">
        {error && <div className="error-banner">Error: {error}</div>}
        
        <table className="logs-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Event Type</th>
              <th>Agent</th>
              <th>Session ID</th>
              <th>Status</th>
              <th>Latency</th>
              <th>Trace ID</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={7} className="no-data">
                  {isLoading ? 'Fetching telemetry from BigQuery...' : 'No telemetry logs found matching filters.'}
                </td>
              </tr>
            ) : (
              filteredLogs.map((log, index) => (
                <tr key={`${log.invocation_id}-${index}`} onClick={() => setSelectedLog(log)} className="log-row">
                  <td className="timestamp-cell">
                    {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                    <span className="date-sub">
                      {new Date(log.timestamp).toLocaleDateString([], {month: 'short', day: 'numeric'})}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${getEventBadgeClass(log.event_type)}`}>
                      {log.event_type || 'UNKNOWN'}
                    </span>
                  </td>
                  <td><code>{log.agent || '-'}</code></td>
                  <td><code className="session-code" title={log.session_id}>{log.session_id?.substring(0, 8)}...</code></td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(log.status, log.error_message)}`}>
                      {log.error_message ? 'ERROR' : log.status || 'SUCCESS'}
                    </span>
                  </td>
                  <td>{formatLatency(log.latency_ms)}</td>
                  <td><code className="trace-code" title={log.trace_id}>{log.trace_id?.substring(0, 8)}...</code></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Telemetry Details</h3>
              <button className="close-btn" onClick={() => setSelectedLog(null)}>&times;</button>
            </div>
            
            <div className="modal-body">
              <div className="details-grid">
                <div className="detail-item">
                  <span className="detail-label">Timestamp</span>
                  <span className="detail-val">{new Date(selectedLog.timestamp).toString()}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Event Type</span>
                  <span className={`badge ${getEventBadgeClass(selectedLog.event_type)}`}>{selectedLog.event_type}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Session ID</span>
                  <code className="detail-val">{selectedLog.session_id}</code>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Invocation ID</span>
                  <code className="detail-val">{selectedLog.invocation_id}</code>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Trace ID</span>
                  <code className="detail-val">{selectedLog.trace_id}</code>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Agent</span>
                  <span className="detail-val">{selectedLog.agent || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Latency</span>
                  <span className="detail-val">{JSON.stringify(selectedLog.latency_ms) || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Status</span>
                  <span className={`badge ${getStatusBadgeClass(selectedLog.status, selectedLog.error_message)}`}>
                    {selectedLog.status || 'SUCCESS'}
                  </span>
                </div>
              </div>

              {selectedLog.error_message && (
                <div className="error-panel">
                  <h4>Error Stack Trace</h4>
                  <pre className="error-message">{selectedLog.error_message}</pre>
                </div>
              )}

              {selectedLog.content && (
                <div className="json-panel">
                  <h4>Event Content Payload</h4>
                  <pre className="code-block">
                    {JSON.stringify(selectedLog.content, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.content_parts && selectedLog.content_parts.length > 0 && (
                <div className="json-panel">
                  <h4>Content Parts</h4>
                  <pre className="code-block">
                    {JSON.stringify(selectedLog.content_parts, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.attributes && (
                <div className="json-panel">
                  <h4>Plugin Attributes</h4>
                  <pre className="code-block">
                    {JSON.stringify(selectedLog.attributes, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .obs-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding-bottom: 30px;
        }
        
        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 20px;
        }
        .stat-card {
          padding: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .stat-info {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .stat-title {
          font-size: 0.8rem;
          color: var(--text-muted);
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .stat-value {
          font-family: 'Outfit', sans-serif;
          font-size: 1.8rem;
          font-weight: 700;
          color: var(--text-main);
        }
        .stat-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border-glass);
        }
        .stat-icon.cyan { color: var(--neon-cyan); border-color: rgba(0, 242, 254, 0.2); }
        .stat-icon.purple { color: #a855f7; border-color: rgba(127, 0, 255, 0.2); }
        .stat-icon.green { color: var(--neon-cyan); border-color: rgba(0, 242, 254, 0.2); }
        .stat-icon.gold { color: #f59e0b; border-color: rgba(245, 158, 11, 0.2); }

        /* Controls Bar */
        .controls-bar {
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }
        .search-group {
          display: flex;
          gap: 12px;
          flex: 1;
          min-width: 300px;
        }
        .search-input {
          flex: 1;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-glass);
          border-radius: 8px;
          padding: 8px 14px;
          color: var(--text-main);
          font-size: 0.85rem;
          outline: none;
        }
        .search-input:focus {
          border-color: var(--neon-cyan);
          box-shadow: 0 0 10px rgba(0, 242, 254, 0.1);
        }
        .filter-select, .limit-select {
          background: var(--bg-space);
          border: 1px solid var(--border-glass);
          color: var(--text-main);
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 0.85rem;
          outline: none;
          cursor: pointer;
        }
        .filter-select:hover, .limit-select:hover {
          border-color: var(--neon-cyan);
        }
        .action-group {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .auto-refresh-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .toggle-label {
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        .refresh-btn {
          font-size: 0.85rem;
          padding: 8px 16px;
        }
        
        /* Table Wrapper */
        .table-wrapper {
          overflow-x: auto;
          min-height: 200px;
        }
        .logs-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.85rem;
        }
        .logs-table th {
          padding: 14px 18px;
          font-weight: 600;
          color: var(--text-muted);
          border-bottom: 1px solid var(--border-glass);
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.05em;
        }
        .logs-table td {
          padding: 12px 18px;
          border-bottom: 1px solid rgba(255,255,255,0.03);
          color: var(--text-main);
        }
        .log-row {
          cursor: pointer;
          transition: background-color 0.2s ease;
        }
        .log-row:hover {
          background-color: rgba(255, 255, 255, 0.02);
        }
        .timestamp-cell {
          font-family: var(--font-family-mono);
          font-size: 0.8rem;
          display: flex;
          flex-direction: column;
        }
        .date-sub {
          font-size: 0.7rem;
          color: var(--text-dim);
          margin-top: 2px;
        }
        .session-code, .trace-code {
          font-family: var(--font-family-mono);
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        .no-data {
          text-align: center;
          padding: 50px !important;
          color: var(--text-dim);
          font-size: 0.9rem;
        }
        .error-banner {
          background: rgba(255, 0, 127, 0.08);
          color: var(--neon-pink);
          border-bottom: 1px solid rgba(255, 0, 127, 0.2);
          padding: 10px 18px;
          font-size: 0.85rem;
          font-weight: 500;
        }

        /* Toggle Switch */
        .switch {
          position: relative;
          display: inline-block;
          width: 34px;
          height: 20px;
        }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: rgba(255,255,255,0.1);
          transition: .4s;
        }
        .slider:before {
          position: absolute;
          content: "";
          height: 14px; width: 14px;
          left: 3px; bottom: 3px;
          background-color: white;
          transition: .4s;
        }
        input:checked + .slider { background-color: var(--neon-cyan); }
        input:checked + .slider:before { transform: translateX(14px); }
        .slider.round { border-radius: 34px; }
        .slider.round:before { border-radius: 50%; }

        /* Spinner */
        .spinner {
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 1s ease-in-out infinite;
          display: inline-block;
          margin-right: 6px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Modal */
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
          animation: fadeIn 0.25s ease forwards;
        }
        .modal-content {
          width: 100%;
          max-width: 800px;
          max-height: 90vh;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          background: var(--bg-panel);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          animation: slideInLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .modal-header {
          padding: 16px 24px;
          border-bottom: 1px solid var(--border-glass);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .modal-header h3 {
          font-family: 'Outfit', sans-serif;
          font-size: 1.1rem;
          color: var(--text-main);
        }
        .close-btn {
          background: transparent;
          border: none;
          font-size: 1.5rem;
          color: var(--text-muted);
          cursor: pointer;
        }
        .close-btn:hover { color: var(--text-main); }
        .modal-body {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .details-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }
        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .detail-label {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-weight: 500;
        }
        .detail-val {
          font-size: 0.85rem;
          color: var(--text-main);
        }
        .error-panel {
          background: rgba(255, 0, 127, 0.05);
          border: 1px solid rgba(255, 0, 127, 0.15);
          border-radius: 8px;
          padding: 16px;
        }
        .error-panel h4, .json-panel h4 {
          font-size: 0.8rem;
          color: var(--text-muted);
          font-weight: 600;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .error-message {
          color: var(--neon-pink);
          font-family: var(--font-family-mono);
          font-size: 0.8rem;
          overflow-x: auto;
          white-space: pre-wrap;
        }
        .json-panel {
          display: flex;
          flex-direction: column;
        }
        .code-block {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid var(--border-glass);
          border-radius: 8px;
          padding: 16px;
          font-family: var(--font-family-mono);
          font-size: 0.8rem;
          color: var(--text-main);
          overflow-x: auto;
          white-space: pre-wrap;
          max-height: 250px;
        }
        
        .badge-warning {
          background: rgba(245, 158, 11, 0.1);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.2);
        }
        .badge-secondary {
          background: rgba(255,255,255,0.05);
          color: var(--text-muted);
          border: 1px solid rgba(255,255,255,0.1);
        }
      `}</style>
    </div>
  );
};
