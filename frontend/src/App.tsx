import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { EnrollmentPage } from './components/EnrollmentPage';
import { LoginPage } from './components/LoginPage';
import { ProfilePage } from './components/ProfilePage';
import { ApiKeysPage } from './components/ApiKeysPage';
import { Layout } from './components/Layout';
import { api } from './utils/api';
import './App.css';

function App() {
  const userId = api.getUserId();
  const isAuthenticated = userId !== null;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/enroll" element={<EnrollmentPage />} />
        <Route
          path="/"
          element={<Navigate to={isAuthenticated ? '/profile' : '/login'} replace />}
        />
        <Route
          path="/profile"
          element={
            isAuthenticated ? (
              <Layout>
                <ProfilePage />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/api-keys"
          element={
            isAuthenticated ? (
              <Layout>
                <ApiKeysPage />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
