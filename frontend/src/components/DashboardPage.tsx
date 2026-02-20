import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { api } from '../utils/api';
import type { Generator, UsageLog, OilChangeEntry } from '../types';
import './DashboardPage.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function monthsSince(iso: string | null): number {
  if (!iso) return 999;
  const d = new Date(iso);
  const now = new Date();
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
}

function gaugeColor(percent: number): string {
  if (percent >= 90) return '#e53e3e';
  if (percent >= 70) return '#d69e2e';
  return '#48bb78';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function formatElapsed(ms: number): string {
  if (ms <= 0) return '0m 0s';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
}

// ── SVG Gauge ─────────────────────────────────────────────────────────────────

function Gauge({ value, max, label, unit }: {
  value: number; max: number; label: string; unit: string;
}) {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color = gaugeColor(percent);
  const arcLen = Math.PI * 80;           // semicircle r=80 ≈ 251.3
  const fillLen = (percent / 100) * arcLen;
  const overdue = value >= max;

  return (
    <div className="gauge-wrap">
      <svg viewBox="0 0 200 114" className="gauge-svg" aria-hidden="true">
        {/* Track */}
        <path d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none" stroke="#e2e8f0" strokeWidth="16" strokeLinecap="round" />
        {/* Fill */}
        <path d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none" stroke={color} strokeWidth="16" strokeLinecap="round"
          strokeDasharray={`${fillLen} ${arcLen}`} />
        <text x="100" y="84" textAnchor="middle" className="gauge-value-text">
          {value.toFixed(1)}
        </text>
        <text x="100" y="100" textAnchor="middle" className="gauge-max-text">
          / {max} {unit}
        </text>
        <text x="100" y="113" textAnchor="middle" className="gauge-status-text"
          style={{ fill: color }}>
          {overdue ? 'OVERDUE' : `${(max - value).toFixed(1)} left`}
        </text>
      </svg>
      <div className="gauge-label">{label}</div>
    </div>
  );
}

// ── Run Bar Chart ─────────────────────────────────────────────────────────────

function RunBarChart({ logs }: { logs: UsageLog[] }) {
  const completed = logs
    .filter(l => l.durationHours !== null && l.durationHours > 0)
    .slice(-12);

  if (completed.length === 0) {
    return <p className="chart-empty">No completed runs to display.</p>;
  }

  const maxH = Math.max(...completed.map(l => l.durationHours!), 0.1);
  const barW = 28;
  const gap = 8;
  const chartH = 100;
  const totalW = completed.length * (barW + gap) + gap;

  return (
    <div className="run-chart-wrap">
      <svg viewBox={`0 0 ${totalW} ${chartH + 28}`} className="run-chart-svg"
        role="img" aria-label="Recent runs bar chart">
        {completed.map((log, i) => {
          const h = (log.durationHours! / maxH) * chartH;
          const x = gap + i * (barW + gap);
          const y = chartH - h;
          const label = new Date(log.startTime).toLocaleDateString(undefined, {
            month: 'short', day: 'numeric',
          });
          const hrs = log.durationHours!.toFixed(1);
          return (
            <g key={log.id}>
              <title>{label} — {hrs}h</title>
              <rect x={x} y={y} width={barW} height={h} rx="3"
                fill={parseFloat(hrs) > 0 ? '#667eea' : '#cbd5e0'} />
              <text x={x + barW / 2} y={chartH + 10} textAnchor="middle"
                className="chart-label">{label}</text>
              <text x={x + barW / 2} y={y - 4} textAnchor="middle"
                className="chart-bar-val">{hrs}h</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Live runtime hook ─────────────────────────────────────────────────────────

function useLiveElapsed(startTime: string | null, isRunning: boolean) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isRunning || !startTime) { setElapsed(0); return; }
    const tick = () => setElapsed(Date.now() - new Date(startTime).getTime());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTime, isRunning]);

  return elapsed;
}

// ── Main Component ────────────────────────────────────────────────────────────

export function DashboardPage() {
  const [generator, setGenerator] = useState<Generator | null>(null);
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [oilHistory, setOilHistory] = useState<OilChangeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showOilForm, setShowOilForm] = useState(false);
  const [oilDate, setOilDate] = useState('');
  const [oilNotes, setOilNotes] = useState('');
  const [oilSubmitting, setOilSubmitting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState('');

  const elapsed = useLiveElapsed(generator?.currentStartTime ?? null, generator?.isRunning ?? false);

  const loadData = useCallback(async () => {
    try {
      const generators = await api.getGenerators();
      if (generators.length === 0) { setLoading(false); return; }
      const gen = generators[0];
      setGenerator(gen);
      const [logList, oilList] = await Promise.all([
        api.getUsageLogs(gen.id),
        api.getOilChangeHistory(gen.id),
      ]);
      setLogs(logList);
      setOilHistory(oilList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleToggle = async () => {
    if (!generator || toggling) return;
    setToggling(true);
    setToggleError('');
    try {
      const result = await api.toggleGenerator(generator.id);
      setGenerator(prev => {
        if (!prev) return prev;
        if (result.status === 'started') {
          return { ...prev, isRunning: true, currentStartTime: result.startTime };
        }
        return { ...prev, isRunning: false, currentStartTime: null, totalHours: result.totalHours };
      });
      if (result.status === 'stopped') {
        const updatedLogs = await api.getUsageLogs(generator.id);
        setLogs(updatedLogs);
      }
    } catch (err) {
      setToggleError(err instanceof Error ? err.message : 'Toggle failed');
    } finally {
      setToggling(false);
    }
  };

  const handleLogOilChange = async (e: FormEvent) => {
    e.preventDefault();
    if (!generator) return;
    setOilSubmitting(true);
    try {
      await api.logOilChange(generator.id, {
        ...(oilDate ? { performedAt: new Date(oilDate).toISOString() } : {}),
        ...(oilNotes.trim() ? { notes: oilNotes.trim() } : {}),
      });
      setShowOilForm(false);
      setOilDate('');
      setOilNotes('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log oil change');
    } finally {
      setOilSubmitting(false);
    }
  };

  const handleDeleteOilChange = async (changeId: number) => {
    if (!generator) return;
    if (!confirm('Remove this oil change entry?')) return;
    try {
      await api.deleteOilChange(generator.id, changeId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete oil change');
    }
  };

  if (loading) {
    return <div className="dashboard-page"><div className="loading">Loading…</div></div>;
  }

  if (!generator) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-container">
          <h1>Dashboard</h1>
          <div className="empty-state">
            <p>No generator configured yet.</p>
            <a href="/profile" className="setup-link">Go to Profile to set up your generator</a>
          </div>
        </div>
      </div>
    );
  }

  const hoursSince = generator.totalHours - (generator.lastOilChangeHours ?? 0);
  const monthsSinceOil = monthsSince(generator.lastOilChangeDate);
  const clampedMonths = Math.min(monthsSinceOil, generator.oilChangeMonths);

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        <h1>Dashboard</h1>
        <p className="subtitle">{generator.name}</p>

        {error && <div className="error-message" role="alert">{error}</div>}

        {/* ── Stat Cards ── */}
        <div className="stat-cards">
          {/* Status */}
          <div className="stat-card">
            <div className="stat-card-header">
              <span className={`status-dot ${generator.isRunning ? 'running' : 'stopped'}`} />
              <h2>Generator Status</h2>
            </div>
            <div className={`status-badge ${generator.isRunning ? 'badge-running' : 'badge-stopped'}`}>
              {generator.isRunning ? 'Running' : 'Stopped'}
            </div>
            {generator.isRunning && elapsed > 0 && (
              <p className="stat-detail">Current session: <strong>{formatElapsed(elapsed)}</strong></p>
            )}
            <p className="stat-detail">Total lifetime: <strong>{generator.totalHours.toFixed(1)} h</strong></p>
            <button
              className={`toggle-button ${generator.isRunning ? 'toggle-stop' : 'toggle-start'}`}
              onClick={handleToggle}
              disabled={toggling}
            >
              {toggling ? 'Please wait…' : generator.isRunning ? 'Stop Generator' : 'Start Generator'}
            </button>
            {toggleError && <p className="toggle-error" role="alert">{toggleError}</p>}
          </div>

          {/* Hours Gauge */}
          <div className="stat-card">
            <h2>Hours to Oil Change</h2>
            <Gauge
              value={hoursSince}
              max={generator.oilChangeHours}
              label="Hours since last change"
              unit="h"
            />
          </div>

          {/* Months Gauge */}
          <div className="stat-card">
            <h2>Months to Oil Change</h2>
            <Gauge
              value={clampedMonths}
              max={generator.oilChangeMonths}
              label="Months since last change"
              unit="mo"
            />
          </div>
        </div>

        {/* ── Recent Runs Chart ── */}
        <section className="dashboard-section">
          <h2>Recent Runs</h2>
          <RunBarChart logs={logs} />
        </section>

        {/* ── Oil Change History ── */}
        <section className="dashboard-section oil-change-section">
          <div className="section-header">
            <h2>Oil Change History</h2>
            {!showOilForm && (
              <button className="primary-button" onClick={() => setShowOilForm(true)}>
                Log Oil Change
              </button>
            )}
          </div>

          {showOilForm && (
            <form onSubmit={handleLogOilChange} className="oil-change-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="oilDate">Date (optional — defaults to now)</label>
                  <input
                    type="datetime-local"
                    id="oilDate"
                    value={oilDate}
                    onChange={e => setOilDate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="oilNotes">Notes (optional)</label>
                  <input
                    type="text"
                    id="oilNotes"
                    value={oilNotes}
                    onChange={e => setOilNotes(e.target.value)}
                    placeholder="Oil type, brand…"
                    maxLength={500}
                  />
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="primary-button" disabled={oilSubmitting}>
                  {oilSubmitting ? 'Saving…' : 'Confirm Oil Change Done'}
                </button>
                <button type="button" className="cancel-button"
                  onClick={() => { setShowOilForm(false); setOilDate(''); setOilNotes(''); }}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {oilHistory.length === 0 ? (
            <p className="empty-list">No oil changes recorded yet.</p>
          ) : (
            <ul className="oil-change-list">
              {oilHistory.map(entry => (
                <li key={entry.id} className="oil-change-entry">
                  <div className="oil-change-info">
                    <strong>{formatDate(entry.performedAt)}</strong>
                    <span className="oil-hours">at {entry.hoursAtChange.toFixed(1)} h</span>
                    {entry.notes && <span className="oil-notes">{entry.notes}</span>}
                  </div>
                  <button
                    className="delete-oil-change-button"
                    onClick={() => handleDeleteOilChange(entry.id)}
                    title="Remove entry"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
