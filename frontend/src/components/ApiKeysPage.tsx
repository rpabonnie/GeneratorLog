import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import type { ApiKey } from '../types';
import './ApiKeysPage.css';

export function ApiKeysPage() {
  const navigate = useNavigate();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [newKey, setNewKey] = useState<ApiKey | null>(null);
  const [qrCode, setQrCode] = useState<string>('');
  const [shortcutFileUrl, setShortcutFileUrl] = useState<string>('');
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedKeyId, setSelectedKeyId] = useState<number | null>(null);

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    try {
      setLoading(true);
      const keys = await api.getApiKeys();
      setApiKeys(keys);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    setError('');
    if (!newKeyName.trim()) {
      setError('Key name is required');
      return;
    }
    try {
      const created = await api.createApiKey(newKeyName.trim());
      setNewKey(created);

      // Fetch QR code for the new key
      const qrData = await api.getApiKeyQRCode(created.id);
      setQrCode(qrData.qrCode);
      setShortcutFileUrl(qrData.shortcutFileUrl);
      setSelectedKeyId(created.id);

      setShowNewKeyModal(true);
      setNewKeyName('');
      await loadApiKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API key');
    }
  };

  const handleShowQR = async (keyId: number) => {
    try {
      const qrData = await api.getApiKeyQRCode(keyId);
      setQrCode(qrData.qrCode);
      setShortcutFileUrl(qrData.shortcutFileUrl);
      setSelectedKeyId(keyId);
      setShowQrModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load QR code');
    }
  };

  const handleViewInstructions = (keyId: number) => {
    navigate(`/shortcut-setup/${keyId}`);
  };

  const handleDeleteKey = async (id: number) => {
    if (!confirm('Are you sure you want to delete this API key?')) return;

    try {
      await api.deleteApiKey(id);
      await loadApiKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete API key');
    }
  };

  const handleResetKey = async (id: number) => {
    if (!confirm('Are you sure you want to reset this API key? The old key will stop working immediately.')) return;

    try {
      const reset = await api.resetApiKey(id);
      setNewKey(reset);
      setShowNewKeyModal(true);
      await loadApiKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset API key');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const closeModal = () => {
    setShowNewKeyModal(false);
    setNewKey(null);
  };

  if (loading) {
    return <div className="apikeys-page"><div className="loading">Loading...</div></div>;
  }

  return (
    <div className="apikeys-page">
      <div className="apikeys-container">
        <h1>API Key Management</h1>
        <p className="subtitle">
          Generate API keys to authenticate your devices (iPhone Shortcuts, Postman, etc.)
        </p>

        {error && <div className="error-message">{error}</div>}

        <div className="create-key-section">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name, e.g. 'iPhone Shortcut'"
            className="key-name-input"
            required
          />
          <button onClick={handleCreateKey} className="create-button">
            Create New API Key
          </button>
        </div>

        {apiKeys.length === 0 ? (
          <div className="empty-state">
            <p>No API keys yet. Create one to get started!</p>
          </div>
        ) : (
          <div className="keys-list">
            {apiKeys.map((key) => (
              <div key={key.id} className="key-card">
                <div className="key-header">
                  <h3>{key.name || 'Unnamed Key'}</h3>
                  <span className="key-id">ID: {key.id}</span>
                </div>
                <div className="key-preview">
                  <code>{key.hint}</code>
                </div>
                <div className="key-meta">
                  <span>Created: {new Date(key.createdAt).toLocaleDateString()}</span>
                  {key.lastUsedAt && (
                    <span>Last used: {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                  )}
                </div>
                <div className="key-actions">
                  <button onClick={() => handleShowQR(key.id)} className="qr-button">
                    View QR Code
                  </button>
                  <button onClick={() => handleViewInstructions(key.id)} className="instructions-button">
                    Setup Instructions
                  </button>
                  <button onClick={() => handleResetKey(key.id)} className="reset-button">
                    Reset Key
                  </button>
                  <button onClick={() => handleDeleteKey(key.id)} className="delete-button">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showNewKeyModal && newKey && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>API Key Created!</h2>
              <p className="modal-warning">
                ⚠️ Save this key now! You won't be able to see it again.
              </p>
              <div className="key-display">
                <code>{newKey.key}</code>
                <button onClick={() => copyToClipboard(newKey.key!)} className="copy-button">
                  Copy
                </button>
              </div>
              {newKey.name && <p className="key-name-display">Name: {newKey.name}</p>}

              {qrCode && (
                <div className="qr-section">
                  <h3>Import iOS Shortcut</h3>
                  <p>Scan with your iPhone to import a pre-configured Shortcut in one tap. You'll be asked for your API key once on import — paste the key copied above.</p>
                  <img src={qrCode} alt="QR Code for Shortcut import" className="qr-code-img" />
                  <button onClick={() => selectedKeyId && handleViewInstructions(selectedKeyId)} className="link-button">
                    Manual Setup Instructions
                  </button>
                </div>
              )}

              <button onClick={closeModal} className="close-button">
                I've Saved the Key
              </button>
            </div>
          </div>
        )}

        {showQrModal && selectedKeyId && (
          <div className="modal-overlay" onClick={() => setShowQrModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>Import iOS Shortcut</h2>
              <p>Scan with your iPhone to import a pre-configured Shortcut directly into the Shortcuts app. You'll be asked for your API key once on import.</p>
              {qrCode && <img src={qrCode} alt="QR Code for Shortcut import" className="qr-code-img" />}
              <div className="qr-actions">
                <a href={shortcutFileUrl} download className="link-button">
                  Download Shortcut File
                </a>
                <button onClick={() => handleViewInstructions(selectedKeyId)} className="link-button">
                  Manual Setup Instructions
                </button>
              </div>
              <button onClick={() => setShowQrModal(false)} className="close-button">
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
