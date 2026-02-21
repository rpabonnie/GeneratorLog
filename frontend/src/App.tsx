import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { DashboardPage } from './components/DashboardPage';
import { EnrollmentPage } from './components/EnrollmentPage';
import { LoginPage } from './components/LoginPage';
import { ProfilePage } from './components/ProfilePage';
import { ApiKeysPage } from './components/ApiKeysPage';
import { GeneratorLogsPage } from './components/GeneratorLogsPage';
import { DownloadsPage } from './components/DownloadsPage';
import { ShortcutSetupPage } from './components/ShortcutSetupPage';
import { Layout } from './components/Layout';
import { api } from './utils/api';
import './App.css';

function ProtectedRoute({ isAuthenticated, children }: {
  isAuthenticated: boolean;
  children: React.ReactNode;
}) {
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function App() {
  // null = still checking, true = authenticated, false = not authenticated
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    api.getCurrentUser()
      .then(() => setIsAuthenticated(true))
      .catch(() => setIsAuthenticated(false));
  }, []);

  if (isAuthenticated === null) return null;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/enroll" element={<EnrollmentPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/logs"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <GeneratorLogsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/api-keys"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <ApiKeysPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/downloads"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <DownloadsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shortcut-setup/:keyId"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <ShortcutSetupPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
