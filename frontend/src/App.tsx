import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { EnrollmentPage } from './components/EnrollmentPage';
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
        <Route path="/enroll" element={<EnrollmentPage />} />
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Navigate to="/profile" replace />
            ) : (
              <Navigate to="/enroll" replace />
            )
          }
        />
        <Route
          path="/profile"
          element={
            isAuthenticated ? (
              <Layout>
                <ProfilePage />
              </Layout>
            ) : (
              <Navigate to="/enroll" replace />
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
              <Navigate to="/enroll" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
