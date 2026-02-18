import { type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    return location.pathname === path ? 'active' : '';
  };

  const handleLogout = () => {
    api.logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <nav className="navbar">
        <div className="nav-container">
          <Link to="/" className="nav-logo">
            GeneratorLog
          </Link>
          <div className="nav-links">
            <Link to="/profile" className={`nav-link ${isActive('/profile')}`}>
              Profile
            </Link>
            <Link to="/api-keys" className={`nav-link ${isActive('/api-keys')}`}>
              API Keys
            </Link>
            <button onClick={handleLogout} className="nav-logout">
              Sign Out
            </button>
          </div>
        </div>
      </nav>
      <main className="main-content">{children}</main>
    </div>
  );
}
