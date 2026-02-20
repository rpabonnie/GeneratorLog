import { useState } from 'react';
import { api } from '../utils/api';
import type { UsageLog } from '../types';
import './DownloadsPage.css';

function logsToCSV(logs: UsageLog[]): string {
  const header = ['ID', 'Start Time', 'End Time', 'Duration (hours)', 'Created At'];
  const rows = logs.map(l => [
    l.id,
    new Date(l.startTime).toISOString(),
    l.endTime ? new Date(l.endTime).toISOString() : '',
    l.durationHours !== null ? l.durationHours.toFixed(4) : '',
    new Date(l.createdAt).toISOString(),
  ]);
  return [header, ...rows].map(row => row.join(',')).join('\n');
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DownloadsPage() {
  const [downloadingLogs, setDownloadingLogs] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleDownloadLogs = async () => {
    setError('');
    setMessage('');
    setDownloadingLogs(true);
    try {
      const generators = await api.getGenerators();
      if (generators.length === 0) {
        setError('No generator found. Create one on the Profile page first.');
        return;
      }
      const gen = generators[0];
      const logs = await api.getUsageLogs(gen.id);
      if (logs.length === 0) {
        setMessage('No run log entries to download.');
        return;
      }
      const csv = logsToCSV(logs);
      const date = new Date().toISOString().slice(0, 10);
      downloadCSV(csv, `${gen.name.replace(/\s+/g, '-')}-run-log-${date}.csv`);
      setMessage(`Downloaded ${logs.length} run log entries.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloadingLogs(false);
    }
  };

  return (
    <div className="downloads-page">
      <div className="downloads-container">
        <h1>Downloads</h1>
        <p className="subtitle">Export your generator data</p>

        {error && <div className="error-message" role="alert">{error}</div>}
        {message && <div className="success-message">{message}</div>}

        <div className="download-card">
          <div className="download-card-icon">📋</div>
          <div className="download-card-info">
            <h2>Run Log (CSV)</h2>
            <p>Export your full generator run history with start/end times and duration.</p>
          </div>
          <button
            className="download-button"
            onClick={handleDownloadLogs}
            disabled={downloadingLogs}
          >
            {downloadingLogs ? 'Preparing…' : 'Download CSV'}
          </button>
        </div>
      </div>
    </div>
  );
}
