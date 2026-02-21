import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import './ShortcutSetupPage.css';

interface ShortcutInfo {
  id: number;
  name: string | null;
  hint: string;
  apiEndpoint: string;
}

export function ShortcutSetupPage() {
  const { keyId } = useParams<{ keyId: string }>();
  const navigate = useNavigate();
  const [info, setInfo] = useState<ShortcutInfo | null>(null);
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState<string>('');

  useEffect(() => {
    const fetchInfo = async () => {
      if (!keyId) {
        setError('No API key ID provided');
        return;
      }

      try {
        const data = await api.getApiKeyShortcutInfo(parseInt(keyId, 10));
        setInfo(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load shortcut info');
      }
    };

    fetchInfo();
  }, [keyId]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  if (error) {
    return (
      <div className="shortcut-setup-page">
        <div className="shortcut-setup-error">
          <h1>Error</h1>
          <p>{error}</p>
          <button onClick={() => navigate('/api-keys')}>Go to API Keys</button>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="shortcut-setup-page">
        <div className="shortcut-setup-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="shortcut-setup-page">
      <div className="shortcut-setup-content">
        <h1>iOS Shortcut Setup</h1>
        <p className="setup-subtitle">
          Set up your iPhone to toggle your generator with a single tap
        </p>

        <div className="setup-info-box">
          <h2>API Key: {info.name || 'Unnamed'}</h2>
          <p className="hint">Key hint: {info.hint}</p>
        </div>

        <div className="setup-section">
          <h3>Step 1: Create a New Shortcut</h3>
          <ol>
            <li>Open the <strong>Shortcuts</strong> app on your iPhone</li>
            <li>Tap the <strong>+</strong> button to create a new shortcut</li>
            <li>Tap <strong>Add Action</strong></li>
          </ol>
        </div>

        <div className="setup-section">
          <h3>Step 2: Add URL Action</h3>
          <ol>
            <li>Search for <strong>"URL"</strong> and add the URL action</li>
            <li>Copy and paste the following URL:</li>
          </ol>
          <div className="code-block">
            <code>{info.apiEndpoint}</code>
            <button
              className="copy-btn"
              onClick={() => copyToClipboard(info.apiEndpoint, 'url')}
            >
              {copied === 'url' ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="setup-section">
          <h3>Step 3: Add Get Contents of URL Action</h3>
          <ol>
            <li>Search for <strong>"Get Contents of URL"</strong> and add it</li>
            <li>Tap <strong>Show More</strong> to see all options</li>
            <li>Change <strong>Method</strong> to <strong>POST</strong></li>
            <li>Under <strong>Headers</strong>, tap <strong>Add new field</strong></li>
            <li>Set header name to: <code>x-api-key</code></li>
            <li>Set header value to your API key (shown when you created it)</li>
            <li>
              If you don't have your API key anymore, go back to the{' '}
              <a href="/api-keys">API Keys page</a> and reset it
            </li>
          </ol>
          <div className="warning-box">
            <strong>⚠️ Important:</strong> Your API key was shown only once when you
            created it. If you didn't save it, you'll need to reset the key from the
            API Keys page.
          </div>
        </div>

        <div className="setup-section">
          <h3>Step 4: Add Show Result Action</h3>
          <ol>
            <li>Search for <strong>"Show Result"</strong> and add it</li>
            <li>This will display the response from the API</li>
            <li>You'll see either "started" or "stopped" status</li>
          </ol>
        </div>

        <div className="setup-section">
          <h3>Step 5: Name and Save</h3>
          <ol>
            <li>Tap <strong>Done</strong></li>
            <li>Give your shortcut a name like "Toggle Generator"</li>
            <li>Optionally, add it to your home screen or as a widget</li>
          </ol>
        </div>

        <div className="setup-section">
          <h3>Step 6: Test Your Shortcut</h3>
          <ol>
            <li>Run your new shortcut</li>
            <li>You should see a result like:</li>
          </ol>
          <div className="code-block">
            <pre>{`{
  "status": "started",
  "isRunning": true,
  "startTime": "2026-02-21T...",
  "totalHours": 125.5
}`}</pre>
          </div>
          <p>Or when stopping:</p>
          <div className="code-block">
            <pre>{`{
  "status": "stopped",
  "isRunning": false,
  "durationHours": 2.5,
  "totalHours": 128.0
}`}</pre>
          </div>
        </div>

        <div className="setup-actions">
          <button onClick={() => navigate('/api-keys')} className="btn-primary">
            Back to API Keys
          </button>
          <button onClick={() => window.print()} className="btn-secondary">
            Print Instructions
          </button>
        </div>
      </div>
    </div>
  );
}
