import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import type { ApiKey } from '../types';
import './ApiKeysPage.css';

export function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [newKey, setNewKey] = useState<ApiKey | null>(null);

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
      setShowNewKeyModal(true);
      setNewKeyName('');
      await loadApiKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API key');
    }
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
                  <code>{key.keyPreview}</code>
                </div>
                <div className="key-meta">
                  <span>Created: {new Date(key.createdAt).toLocaleDateString()}</span>
                  {key.lastUsedAt && (
                    <span>Last used: {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                  )}
                </div>
                <div className="key-actions">
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
              <button onClick={closeModal} className="close-button">
                I've Saved the Key
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
