import { useState, useEffect, type FormEvent } from 'react';
import { api } from '../utils/api';
import type { Generator, UsageLog } from '../types';
import './GeneratorLogsPage.css';

function toDateTimeLocal(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 16);
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function formatDuration(hours: number | null): string {
  if (hours === null) return '—';
  return hours.toFixed(2) + ' h';
}

export function GeneratorLogsPage() {
  const [generator, setGenerator] = useState<Generator | null>(null);
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingLog, setEditingLog] = useState<UsageLog | null>(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const generators = await api.getGenerators();
      if (generators.length === 0) {
        setLoading(false);
        return;
      }
      const gen = generators[0];
      setGenerator(gen);
      const logList = await api.getUsageLogs(gen.id);
      setLogs(logList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingLog(null);
    setStartTime('');
    setEndTime('');
    setError('');
  };

  const handleEditClick = (log: UsageLog) => {
    setEditingLog(log);
    setStartTime(toDateTimeLocal(log.startTime));
    setEndTime(toDateTimeLocal(log.endTime));
    setError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!startTime) {
      setError('Start time is required');
      return;
    }

    if (endTime && endTime <= startTime) {
      setError('End time must be after start time');
      return;
    }

    if (!generator) {
      setError('No generator found. Please create a generator first.');
      return;
    }

    try {
      const payload = {
        startTime: new Date(startTime).toISOString(),
        ...(endTime ? { endTime: new Date(endTime).toISOString() } : {}),
      };

      if (editingLog) {
        await api.updateUsageLog(generator.id, editingLog.id, payload);
      } else {
        await api.createUsageLog(generator.id, payload);
      }

      resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save log entry');
    }
  };

  const handleDelete = async (log: UsageLog) => {
    if (!confirm('Are you sure you want to delete this log entry?')) return;
    if (!generator) return;

    try {
      await api.deleteUsageLog(generator.id, log.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete log entry');
    }
  };

  if (loading) {
    return <div className="logs-page"><div className="loading">Loading...</div></div>;
  }

  return (
    <div className="logs-page">
      <div className="logs-container">
        <h1>Generator Run Log</h1>
        {generator && (
          <p className="subtitle">{generator.name} — {generator.totalHours.toFixed(2)} total hours</p>
        )}

        {error && <div className="error-message">{error}</div>}

        {!generator ? (
          <div className="empty-state">
            <p>No generator found. Please create a generator on the Profile page first.</p>
          </div>
        ) : (
          <>
            <section className="log-form-section">
              <h2>{editingLog ? 'Edit Entry' : 'Add Entry'}</h2>
              <form onSubmit={handleSubmit} className="log-form">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="startTime">Start Time</label>
                    <input
                      type="datetime-local"
                      id="startTime"
                      value={startTime}
                      onChange={e => setStartTime(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="endTime">End Time (optional)</label>
                    <input
                      type="datetime-local"
                      id="endTime"
                      value={endTime}
                      onChange={e => setEndTime(e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-actions">
                  <button type="submit" className="submit-button">
                    {editingLog ? 'Save Changes' : 'Add Entry'}
                  </button>
                  {editingLog && (
                    <button type="button" onClick={resetForm} className="cancel-button">
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </section>

            {logs.length === 0 ? (
              <div className="empty-state">
                <p>No run history yet. Add your first entry above.</p>
              </div>
            ) : (
              <div className="logs-table-wrapper">
                <table className="logs-table">
                  <thead>
                    <tr>
                      <th>Start</th>
                      <th>End</th>
                      <th>Duration</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id} className="log-row">
                        <td>{formatDateTime(log.startTime)}</td>
                        <td>{formatDateTime(log.endTime)}</td>
                        <td>{formatDuration(log.durationHours)}</td>
                        <td className="log-row-actions">
                          <button
                            onClick={() => handleEditClick(log)}
                            className="edit-log-button"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(log)}
                            className="delete-log-button"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
