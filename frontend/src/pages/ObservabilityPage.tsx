import React, { useState, useMemo } from 'react';
import { useObservability, InvocationMetrics, ObservabilityRow } from '../hooks/useObservability';

export const ObservabilityPage: React.FC = () => {
  const { 
    invocations, 
    isLoading, 
    error, 
    limit, 
    setLimit, 
    autoRefresh, 
    setAutoRefresh, 
    refresh,
    fetchInvocationEvents,
    runRCA
  } = useObservability(100);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedInvocation, setSelectedInvocation] = useState<InvocationMetrics | null>(null);
  
  // States for detailed raw events and RCA
  const [rawEvents, setRawEvents] = useState<ObservabilityRow[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(false);
  const [rcaExplanation, setRcaExplanation] = useState<string | null>(null);
  const [isLoadingRca, setIsLoadingRca] = useState<boolean>(false);
  const [rcaError, setRcaError] = useState<string | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // Filtering invocations
  const filteredInvocations = useMemo(() => {
    return invocations.filter(inv => {
      const matchesSearch = 
        (inv.session_id?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        (inv.invocation_id?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        (inv.query?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        (inv.response?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        (inv.error_message?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        (inv.tools_called?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
      
      const matchesStatus = selectedStatus 
        ? inv.status === selectedStatus 
        : true;

      return matchesSearch && matchesStatus;
    });
  }, [invocations, searchTerm, selectedStatus]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = filteredInvocations.length;
    const uniqueSessions = new Set(filteredInvocations.map(i => i.session_id).filter(Boolean)).size;
    
    // Success rate calculation
    const successCount = filteredInvocations.filter(i => i.status === 'OK').length;
    const successRate = total > 0 ? Math.round((successCount / total) * 100) : 100;

    // Latency calculation
    let totalLatency = 0;
    let latencyCount = 0;
    filteredInvocations.forEach(i => {
      if (i.total_latency_ms) {
        totalLatency += i.total_latency_ms;
        latencyCount++;
      }
    });
    const avgLatency = latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0;

    // Token totals
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    filteredInvocations.forEach(i => {
      if (i.input_tokens) totalPromptTokens += i.input_tokens;
      if (i.output_tokens) totalCompletionTokens += i.output_tokens;
    });

    return {
      total,
      uniqueSessions,
      successRate,
      avgLatency,
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens: totalPromptTokens + totalCompletionTokens
    };
  }, [filteredInvocations]);

  const handleSelectInvocation = async (invocation: InvocationMetrics) => {
    setSelectedInvocation(invocation);
    setRawEvents([]);
    setRcaExplanation(null);
    setRcaError(null);
    setExpandedEventId(null);
    setIsLoadingEvents(true);
    
    try {
      const events = await fetchInvocationEvents(invocation.invocation_id);
      setRawEvents(events);
    } catch (err) {
      console.error("Failed to load raw events", err);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const handleRunRca = async (invocationId: string) => {
    setIsLoadingRca(true);
    setRcaError(null);
    setRcaExplanation(null);
    try {
      const explanation = await runRCA(invocationId);
      setRcaExplanation(explanation);
    } catch (err: any) {
      setRcaError(err.message || 'Failed to run Root Cause Analysis');
    } finally {
      setIsLoadingRca(false);
    }
  };

  const getStatusBadgeClass = (status?: string) => {
    if (!status) return 'badge-secondary';
    const s = status.toUpperCase();
    if (s === 'OK' || s === 'SUCCESS') return 'badge-success';
    if (s === 'ERROR' || s === 'FAILED') return 'badge-error';
    return 'badge-secondary';
  };

  const getEventBadgeClass = (type?: string) => {
    if (!type) return 'badge-secondary';
    const t = type.toUpperCase();
    if (t.includes('START') || t.includes('BEGIN')) return 'badge-info';
    if (t.includes('COMPLETE') || t.includes('END')) return 'badge-success';
    if (t.includes('TOOL') || t.includes('FUNCTION')) return 'badge-warning';
    if (t.includes('ERROR')) return 'badge-error';
    return 'badge-secondary';
  };

  const formatStageName = (stage: string) => {
    return stage
      .replace('USER_MESSAGE_', '')
      .replace('INVOCATION_', '')
      .replace('AGENT_', '')
      .replace('LLM_', '')
      .replace('TOOL_', '');
  };

  // Helper to render basic markdown from model RCA
  const renderMarkdown = (text: string) => {
    return text.split('\n').map((line, idx) => {
      if (line.startsWith('### ')) {
        return <h5 key={idx} className="rca-h5">{line.substring(4)}</h5>;
      }
      if (line.startsWith('## ')) {
        return <h4 key={idx} className="rca-h4">{line.substring(3)}</h4>;
      }
      if (line.startsWith('# ')) {
        return <h3 key={idx} className="rca-h3">{line.substring(2)}</h3>;
      }
      if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
        return <li key={idx} className="rca-li">{line.replace(/^[\s*-]+/, '')}</li>;
      }
      if (line.startsWith('> ')) {
        return <blockquote key={idx} className="rca-blockquote">{line.substring(2)}</blockquote>;
      }
      if (line.startsWith('```')) {
        return null;
      }
      if (!line.trim()) return <div key={idx} style={{ height: '8px' }} />;
      
      let content: React.ReactNode = line;
      if (line.includes('**')) {
        const parts = line.split('**');
        content = parts.map((part, i) => i % 2 === 1 ? <strong key={i}>{part}</strong> : part);
      }
      
      return <p key={idx} className="rca-p">{content}</p>;
    });
  };

  return (
    <div className="obs-container page-enter">
      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card glass-panel">
          <div className="stat-info">
            <span className="stat-title">Total Queries</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="stat-icon cyan">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
        </div>
        
        <div className="stat-card glass-panel">
          <div className="stat-info">
            <span className="stat-title">Tokens Consumed</span>
            <span className="stat-value" style={{ fontSize: '1.4rem' }}>
              {stats.totalTokens.toLocaleString()}
            </span>
            <span className="stat-sub-label">
              In: {stats.totalPromptTokens.toLocaleString()} | Out: {stats.totalCompletionTokens.toLocaleString()}
            </span>
          </div>
          <div className="stat-icon purple">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-info">
            <span className="stat-title">Success Rate</span>
            <span className="stat-value">{stats.successRate}%</span>
          </div>
          <div className="stat-icon green">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-info">
            <span className="stat-title">Avg Latency</span>
            <span className="stat-value">{stats.avgLatency > 0 ? `${(stats.avgLatency / 1000).toFixed(2)}s` : '-'}</span>
          </div>
          <div className="stat-icon gold">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            placeholder="Search by query, response, session, or tool..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="filter-select"
          >
            <option value="">All Statuses</option>
            <option value="OK">Succeeded (OK)</option>
            <option value="ERROR">Failed (ERROR)</option>
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
            <span className="toggle-label">Auto-Refresh</span>
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
              </svg>
            )}
            Refresh
          </button>
        </div>
      </div>

      {/* Invocations Table */}
      <div className="table-wrapper glass-panel">
        {error && <div className="error-banner">Error: {error}</div>}
        
        <table className="logs-table">
          <thead>
            <tr>
              <th>Start Time</th>
              <th>Session ID</th>
              <th>User Query</th>
              <th>Execution Stages</th>
              <th>Tokens (In/Out)</th>
              <th>Latency</th>
              <th>Tools</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvocations.length === 0 ? (
              <tr>
                <td colSpan={8} className="no-data">
                  {isLoading ? 'Querying trace log metrics from BigQuery...' : 'No telemetry traces found.'}
                </td>
              </tr>
            ) : (
              filteredInvocations.map((inv, index) => (
                <tr key={`${inv.invocation_id}-${index}`} onClick={() => handleSelectInvocation(inv)} className="log-row">
                  <td className="timestamp-cell">
                    {new Date(inv.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                    <span className="date-sub">
                      {new Date(inv.start_time).toLocaleDateString([], {month: 'short', day: 'numeric'})}
                    </span>
                  </td>
                  <td><code className="session-code" title={inv.session_id}>{inv.session_id?.substring(0, 8)}...</code></td>
                  <td className="query-cell" title={inv.query}>
                    {inv.query ? (inv.query.length > 50 ? `${inv.query.substring(0, 50)}...` : inv.query) : <span className="empty-sub">No user query</span>}
                  </td>
                  <td>
                    <div className="stages-badge-container">
                      {inv.stages.slice(0, 5).map((stage, sIdx) => (
                        <span key={sIdx} className={`stage-mini-badge ${getEventBadgeClass(stage)}`}>
                          {formatStageName(stage)}
                        </span>
                      ))}
                      {inv.stages.length > 5 && (
                        <span className="stage-mini-badge badge-secondary">
                          +{inv.stages.length - 5} more
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="token-metric">
                      <strong>{inv.total_tokens || 0}</strong>
                      <span className="token-sub">
                        {inv.input_tokens || 0} / {inv.output_tokens || 0}
                      </span>
                    </span>
                  </td>
                  <td>{inv.total_latency_ms ? `${(inv.total_latency_ms / 1000).toFixed(2)}s` : '-'}</td>
                  <td>
                    {inv.tools_called ? (
                      <div className="tools-badge-container">
                        {Array.from(new Set(inv.tools_called.split(', '))).map((t, tIdx) => (
                          <span key={tIdx} className="tool-chip">
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="empty-sub">None</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(inv.status)}`}>
                      {inv.status || 'OK'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Invocation Details Drawer / Modal */}
      {selectedInvocation && (
        <div className="modal-overlay" onClick={() => setSelectedInvocation(null)}>
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Trace Execution Details</h3>
                <span className="invocation-sub-header">Invocation ID: <code>{selectedInvocation.invocation_id}</code></span>
              </div>
              <button className="close-btn" onClick={() => setSelectedInvocation(null)}>&times;</button>
            </div>
            
            <div className="modal-body">
              {/* Detailed Grid */}
              <div className="details-grid">
                <div className="detail-item">
                  <span className="detail-label">Start Time</span>
                  <span className="detail-val">{new Date(selectedInvocation.start_time).toString()}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Session ID</span>
                  <code className="detail-val">{selectedInvocation.session_id}</code>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Latency</span>
                  <span className="detail-val">{selectedInvocation.total_latency_ms ? `${(selectedInvocation.total_latency_ms / 1000).toFixed(2)}s (${selectedInvocation.total_latency_ms} ms)` : '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Tokens Consumed</span>
                  <span className="detail-val">
                    <strong>{selectedInvocation.total_tokens || 0}</strong> (In: {selectedInvocation.input_tokens || 0} | Out: {selectedInvocation.output_tokens || 0})
                  </span>
                </div>
              </div>

              {/* User Query and Response */}
              <div className="query-response-panel">
                <div className="qr-box user-query">
                  <h5>User Query</h5>
                  <p>{selectedInvocation.query || 'N/A'}</p>
                </div>
                <div className="qr-box agent-response">
                  <h5>Agent Response</h5>
                  <p>{selectedInvocation.response || 'N/A'}</p>
                </div>
              </div>

              {/* Root Cause Analysis (RCA) Section */}
              <div className="rca-container glass-panel">
                <div className="rca-header">
                  <h4>AI-Powered Trace Analysis & RCA</h4>
                  {!rcaExplanation && !isLoadingRca && (
                    <button 
                      onClick={() => handleRunRca(selectedInvocation.invocation_id)} 
                      className={`rca-btn ${selectedInvocation.status === 'ERROR' ? 'error-btn' : ''}`}
                    >
                      {selectedInvocation.status === 'ERROR' ? 'Run Failure RCA' : 'Explain Execution Flow'}
                    </button>
                  )}
                </div>

                {isLoadingRca && (
                  <div className="rca-loading">
                    <span className="spinner rca-spinner"></span>
                    <span>Gemini is fetching trace logs and performing Root Cause Analysis...</span>
                  </div>
                )}

                {rcaError && (
                  <div className="error-banner" style={{ borderRadius: '6px', marginTop: '12px' }}>
                    {rcaError}
                  </div>
                )}

                {rcaExplanation && (
                  <div className="rca-explanation-box markdown-body">
                    {renderMarkdown(rcaExplanation)}
                  </div>
                )}

                {!rcaExplanation && !isLoadingRca && !rcaError && (
                  <p className="rca-placeholder">
                    {selectedInvocation.status === 'ERROR' 
                      ? 'This query execution failed. Click the button above to run Gemini AI Root Cause Analysis to pinpoint what went wrong and how to fix it.'
                      : 'This query completed successfully. You can run the AI trace analysis above to review and optimize the tool execution steps.'}
                  </p>
                )}
              </div>

              {/* Raw Event Timeline */}
              <div className="timeline-container">
                <h4>Execution Timeline ({rawEvents.length} events)</h4>
                {isLoadingEvents ? (
                  <div className="timeline-loading">
                    <span className="spinner"></span> Loading raw event sequence...
                  </div>
                ) : (
                  <div className="timeline">
                    {rawEvents.map((ev, evIdx) => (
                      <div key={evIdx} className="timeline-item">
                        <div className="timeline-dot"></div>
                        <div className="timeline-content-wrapper">
                          <div className="timeline-item-header">
                            <span className={`badge ${getEventBadgeClass(ev.event_type)}`}>
                              {ev.event_type}
                            </span>
                            <span className="timeline-time">
                              {new Date(ev.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                            </span>
                            <span className={`badge ${ev.error_message ? 'badge-error' : 'badge-success'}`}>
                              {ev.error_message ? 'ERROR' : ev.status || 'OK'}
                            </span>
                            <button 
                              onClick={() => setExpandedEventId(expandedEventId === ev.span_id ? null : ev.span_id || String(evIdx))}
                              className="btn-view-raw"
                            >
                              {expandedEventId === (ev.span_id || String(evIdx)) ? 'Hide Payload' : 'View Payload'}
                            </button>
                          </div>
                          
                          {ev.error_message && (
                            <pre className="timeline-error">{ev.error_message}</pre>
                          )}

                          {expandedEventId === (ev.span_id || String(evIdx)) && (
                            <div className="timeline-payload">
                              {ev.content && (
                                <div className="payload-sub-box">
                                  <span>Payload Content</span>
                                  <pre>{JSON.stringify(ev.content, null, 2)}</pre>
                                </div>
                              )}
                              {ev.attributes && (
                                <div className="payload-sub-box">
                                  <span>Attributes</span>
                                  <pre>{JSON.stringify(ev.attributes, null, 2)}</pre>
                                </div>
                              )}
                              {ev.latency_ms && (
                                <div className="payload-sub-box">
                                  <span>Step Latency</span>
                                  <pre>{JSON.stringify(ev.latency_ms, null, 2)}</pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
          min-height: 100px;
        }
        .stat-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
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
          line-height: 1.1;
        }
        .stat-sub-label {
          font-size: 0.7rem;
          color: var(--text-dim);
          margin-top: 4px;
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
          display: flex;
          align-items: center;
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
        .query-cell {
          font-weight: 500;
        }
        .empty-sub {
          color: var(--text-dim);
          font-style: italic;
          font-size: 0.8rem;
        }
        .session-code {
          font-family: var(--font-family-mono);
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        /* Token and Stage containers */
        .token-metric {
          display: flex;
          flex-direction: column;
        }
        .token-sub {
          font-size: 0.7rem;
          color: var(--text-dim);
          margin-top: 1px;
        }
        .stages-badge-container {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          max-width: 250px;
        }
        .stage-mini-badge {
          font-size: 0.65rem;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 500;
          letter-spacing: 0.02em;
        }
        .tools-badge-container {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        .tool-chip {
          background: rgba(168, 85, 247, 0.1);
          color: #c084fc;
          border: 1px solid rgba(168, 85, 247, 0.2);
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 0.7rem;
          font-family: var(--font-family-mono);
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
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Modal / Detail Drawer */
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: flex-end; /* Drawer-style from right */
          z-index: 1000;
          animation: fadeIn 0.2s ease forwards;
        }
        .modal-content {
          width: 100%;
          max-width: 850px;
          height: 100vh;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          background: var(--bg-panel);
          border-left: 1px solid rgba(255,255,255,0.1);
          border-radius: 0;
          animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .modal-header {
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-glass);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .modal-header h3 {
          font-family: 'Outfit', sans-serif;
          font-size: 1.25rem;
          color: var(--text-main);
          font-weight: 600;
        }
        .invocation-sub-header {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: 4px;
          display: block;
        }
        .close-btn {
          background: transparent;
          border: none;
          font-size: 1.8rem;
          color: var(--text-muted);
          cursor: pointer;
          padding: 0 10px;
        }
        .close-btn:hover { color: var(--text-main); }
        
        .modal-body {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        
        .details-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
          background: rgba(255,255,255,0.01);
          border: 1px solid var(--border-glass);
          border-radius: 8px;
          padding: 16px;
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
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        .detail-val {
          font-size: 0.85rem;
          color: var(--text-main);
        }

        /* Query & Response boxes */
        .query-response-panel {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        @media(min-width: 600px) {
          .query-response-panel {
            grid-template-columns: 1fr 1fr;
          }
        }
        .qr-box {
          border: 1px solid var(--border-glass);
          border-radius: 8px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .qr-box h5 {
          font-size: 0.8rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 0;
          font-weight: 600;
        }
        .qr-box p {
          font-size: 0.88rem;
          color: var(--text-main);
          margin: 0;
          line-height: 1.5;
          white-space: pre-wrap;
        }
        .qr-box.user-query {
          background: rgba(0, 242, 254, 0.02);
          border-color: rgba(0, 242, 254, 0.1);
        }
        .qr-box.agent-response {
          background: rgba(255, 255, 255, 0.01);
        }

        /* RCA styles */
        .rca-container {
          padding: 20px;
          background: rgba(168, 85, 247, 0.02);
          border-color: rgba(168, 85, 247, 0.1);
          border-radius: 10px;
        }
        .rca-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }
        .rca-header h4 {
          font-size: 0.95rem;
          color: #c084fc;
          font-weight: 600;
          margin: 0;
        }
        .rca-btn {
          background: rgba(168, 85, 247, 0.15);
          color: #c084fc;
          border: 1px solid rgba(168, 85, 247, 0.3);
          border-radius: 6px;
          padding: 6px 14px;
          font-size: 0.8rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .rca-btn:hover {
          background: rgba(168, 85, 247, 0.25);
          border-color: rgba(168, 85, 247, 0.5);
          box-shadow: 0 0 8px rgba(168, 85, 247, 0.2);
        }
        .rca-btn.error-btn {
          background: rgba(255, 0, 127, 0.15);
          color: var(--neon-pink);
          border-color: rgba(255, 0, 127, 0.3);
        }
        .rca-btn.error-btn:hover {
          background: rgba(255, 0, 127, 0.25);
          border-color: rgba(255, 0, 127, 0.5);
          box-shadow: 0 0 8px rgba(255, 0, 127, 0.2);
        }
        .rca-loading {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 15px 0;
          font-size: 0.85rem;
          color: var(--text-muted);
        }
        .rca-spinner {
          border-top-color: #c084fc;
          width: 16px;
          height: 16px;
        }
        .rca-placeholder {
          font-size: 0.85rem;
          color: var(--text-dim);
          margin-top: 10px;
          line-height: 1.5;
        }
        .rca-explanation-box {
          margin-top: 16px;
          background: rgba(0,0,0,0.25);
          border: 1px solid rgba(168, 85, 247, 0.15);
          border-radius: 8px;
          padding: 18px;
          color: var(--text-main);
          font-size: 0.88rem;
          line-height: 1.6;
        }
        
        /* Custom Markdown styling for RCA */
        .rca-h3 { font-size: 1.15rem; color: #c084fc; font-weight: 600; margin-top: 0; margin-bottom: 12px; border-bottom: 1px solid rgba(168,85,247,0.2); padding-bottom: 4px; }
        .rca-h4 { font-size: 1rem; color: var(--text-main); font-weight: 600; margin-top: 16px; margin-bottom: 8px; }
        .rca-h5 { font-size: 0.9rem; color: var(--text-main); font-weight: 600; margin-top: 14px; margin-bottom: 6px; }
        .rca-p { margin: 0 0 10px 0; }
        .rca-li { margin-left: 18px; margin-bottom: 6px; list-style-type: square; }
        .rca-blockquote { margin: 12px 0; padding: 8px 16px; border-left: 3px solid #c084fc; background: rgba(168,85,247,0.05); color: var(--text-muted); font-style: italic; }

        /* Timeline / Trace progression */
        .timeline-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .timeline-container h4 {
          font-size: 0.9rem;
          color: var(--text-main);
          font-weight: 600;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .timeline-loading {
          font-size: 0.85rem;
          color: var(--text-dim);
          padding: 20px 0;
        }
        .timeline {
          position: relative;
          padding-left: 20px;
          margin-top: 10px;
        }
        .timeline::before {
          content: '';
          position: absolute;
          top: 4px; left: 4px; bottom: 4px;
          width: 2px;
          background: var(--border-glass);
        }
        .timeline-item {
          position: relative;
          margin-bottom: 18px;
        }
        .timeline-dot {
          position: absolute;
          top: 6px; left: -20px;
          width: 10px; height: 10px;
          border-radius: 50%;
          background: var(--neon-cyan);
          box-shadow: 0 0 8px var(--neon-cyan);
          border: 2px solid var(--bg-panel);
          transition: all 0.3s;
        }
        .timeline-item:hover .timeline-dot {
          transform: scale(1.3);
        }
        .timeline-content-wrapper {
          background: rgba(255,255,255,0.01);
          border: 1px solid var(--border-glass);
          border-radius: 6px;
          padding: 10px 14px;
          transition: all 0.2s;
        }
        .timeline-content-wrapper:hover {
          border-color: rgba(255,255,255,0.15);
          background: rgba(255,255,255,0.02);
        }
        .timeline-item-header {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .timeline-time {
          font-size: 0.75rem;
          color: var(--text-dim);
          font-family: var(--font-family-mono);
        }
        .btn-view-raw {
          background: transparent;
          border: none;
          color: var(--neon-cyan);
          font-size: 0.75rem;
          cursor: pointer;
          padding: 2px 6px;
          margin-left: auto;
          text-decoration: underline;
        }
        .btn-view-raw:hover {
          color: #818cf8;
        }
        .timeline-error {
          margin-top: 8px;
          background: rgba(255, 0, 127, 0.05);
          border: 1px solid rgba(255, 0, 127, 0.15);
          color: var(--neon-pink);
          border-radius: 4px;
          padding: 8px 12px;
          font-family: var(--font-family-mono);
          font-size: 0.75rem;
          white-space: pre-wrap;
        }
        .timeline-payload {
          margin-top: 10px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          border-top: 1px dashed var(--border-glass);
          padding-top: 10px;
        }
        .payload-sub-box {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .payload-sub-box span {
          font-size: 0.7rem;
          color: var(--text-muted);
          font-weight: 500;
          text-transform: uppercase;
        }
        .payload-sub-box pre {
          background: rgba(0,0,0,0.4);
          border: 1px solid var(--border-glass);
          border-radius: 4px;
          padding: 10px;
          font-family: var(--font-family-mono);
          font-size: 0.75rem;
          color: var(--text-main);
          overflow-x: auto;
          white-space: pre-wrap;
          max-height: 180px;
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
