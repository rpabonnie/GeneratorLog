import { useState, useEffect, type FormEvent } from 'react';
import { api } from '../utils/api';
import type { User, Generator } from '../types';
import './ProfilePage.css';

export function ProfilePage() {
  const [, setUser] = useState<User | null>(null);
  const [generator, setGenerator] = useState<Generator | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [generatorName, setGeneratorName] = useState('');
  const [oilChangeMonths, setOilChangeMonths] = useState('6');
  const [oilChangeHours, setOilChangeHours] = useState('100');
  const [installedAt, setInstalledAt] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const loadProfile = async () => {
    try {
      setLoading(true);
      const [userProfile, generators] = await Promise.all([
        api.getProfile(),
        api.getGenerators(),
      ]);
      setUser(userProfile);
      setName(userProfile.name || '');
      setEmail(userProfile.email);

      if (generators.length > 0) {
        const gen = generators[0];
        setGenerator(gen);
        setGeneratorName(gen.name);
        setOilChangeMonths(gen.oilChangeMonths.toString());
        setOilChangeHours(gen.oilChangeHours.toString());
        setInstalledAt(gen.installedAt ? gen.installedAt.split('T')[0] : '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch; setState only after awaits
  useEffect(() => { loadProfile(); }, []);

  const handleProfileUpdate = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    try {
      const updated = await api.updateProfile({ name, email });
      setUser(updated);
      setSuccessMessage('Profile updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    }
  };

  const handleGeneratorUpdate = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    try {
      if (generator) {
        const updated = await api.updateGenerator(generator.id, {
          name: generatorName,
          oilChangeMonths: parseInt(oilChangeMonths, 10),
          oilChangeHours: parseFloat(oilChangeHours),
          installedAt: installedAt || null,
        });
        setGenerator(updated);
        setSuccessMessage('Generator settings updated!');
      } else {
        const created = await api.createGenerator({
          name: generatorName,
          oilChangeMonths: parseInt(oilChangeMonths, 10),
          oilChangeHours: parseFloat(oilChangeHours),
          installedAt: installedAt || null,
        });
        setGenerator(created);
        setSuccessMessage('Generator created!');
      }
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update generator');
    }
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    try {
      await api.changePassword(currentPassword, newPassword);
      setPasswordSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(''), 3000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to update password');
    }
  };

  if (loading) {
    return <div className="profile-page"><div className="loading">Loading...</div></div>;
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        <h1>Profile Settings</h1>

        {successMessage && <div className="success-message">{successMessage}</div>}
        {error && <div className="error-message">{error}</div>}

        <section className="profile-section">
          <h2>Personal Information</h2>
          <form onSubmit={handleProfileUpdate} className="profile-form">
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your Name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="your.email@example.com"
              />
            </div>

            <button type="submit" className="submit-button">
              Update Profile
            </button>
          </form>
        </section>

        <section className="profile-section">
          <h2>Security</h2>
          <form onSubmit={handlePasswordChange} className="profile-form">
            <div className="form-group">
              <label htmlFor="currentPassword">Current Password</label>
              <input
                type="password"
                id="currentPassword"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {passwordSuccess && <div className="success-message">{passwordSuccess}</div>}
            {passwordError && <div className="error-message">{passwordError}</div>}

            <button type="submit" className="submit-button">
              Update Password
            </button>
          </form>
        </section>

        <section className="profile-section">
          <h2>Generator Configuration</h2>
          <form onSubmit={handleGeneratorUpdate} className="profile-form">
            <div className="form-group">
              <label htmlFor="generatorName">Generator Name</label>
              <input
                type="text"
                id="generatorName"
                value={generatorName}
                onChange={(e) => setGeneratorName(e.target.value)}
                required
                placeholder="Honda EU2200i"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="oilChangeMonths">Oil Change (months)</label>
                <input
                  type="number"
                  id="oilChangeMonths"
                  value={oilChangeMonths}
                  onChange={(e) => setOilChangeMonths(e.target.value)}
                  min="1"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="oilChangeHours">Oil Change (hours)</label>
                <input
                  type="number"
                  id="oilChangeHours"
                  value={oilChangeHours}
                  onChange={(e) => setOilChangeHours(e.target.value)}
                  min="1"
                  step="0.1"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="installedAt">Installation Date</label>
              <input
                type="date"
                id="installedAt"
                value={installedAt}
                onChange={(e) => setInstalledAt(e.target.value)}
              />
              <small className="field-hint">Used to calculate time-based oil change reminders from the start.</small>
            </div>

            {generator && (
              <div className="generator-stats">
                <p>Total Hours: <strong>{generator.totalHours.toFixed(1)}</strong></p>
                <p>Status: <strong className={generator.isRunning ? 'status-running' : 'status-stopped'}>
                  {generator.isRunning ? 'Running' : 'Stopped'}
                </strong></p>
              </div>
            )}

            <button type="submit" className="submit-button">
              {generator ? 'Update Generator' : 'Create Generator'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
