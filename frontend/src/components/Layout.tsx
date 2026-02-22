import { type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../utils/api';
import logo from '../assets/generatorLogLogo.png';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path ? 'active' : '';
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Session may already be invalid; proceed to login page
    }
    window.location.href = '/login';
  };

  return (
    <div className="layout">
      <nav className="navbar">
        <div className="nav-container">
          <Link to="/" className="nav-logo">
            <img src={logo} alt="Generator Log" className="logo-image" />
          </Link>
          <div className="nav-links">
            <Link to="/" className={`nav-link ${isActive('/')}`}>
              Dashboard
            </Link>
            <Link to="/logs" className={`nav-link ${isActive('/logs')}`}>
              Run Log
            </Link>
            <Link to="/api-keys" className={`nav-link ${isActive('/api-keys')}`}>
              API Keys
            </Link>
            <Link to="/downloads" className={`nav-link ${isActive('/downloads')}`}>
              Downloads
            </Link>
            <Link to="/profile" className={`nav-link ${isActive('/profile')}`}>
              Settings
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
