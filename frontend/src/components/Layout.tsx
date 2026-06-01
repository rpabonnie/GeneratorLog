import { useState, useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../utils/api';
import logo from '../assets/generatorLogLogo.png';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const isActive = (path: string) => {
    return location.pathname === path ? 'active' : '';
  };

  const handleNavLinkClick = () => {
    setIsMobileMenuOpen(false);
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
          <div className="nav-top">
            <Link to="/" className="nav-logo" onClick={handleNavLinkClick}>
              <img src={logo} alt="Generator Log" className="logo-image" />
            </Link>
            <button
              type="button"
              className="nav-toggle"
              aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen(prev => !prev)}
            >
              ☰
            </button>
          </div>

          <div className={`nav-links ${isMobileMenuOpen ? 'open' : ''}`}>
            <Link to="/" className={`nav-link ${isActive('/')}`} onClick={handleNavLinkClick}>
              Dashboard
            </Link>
            <Link to="/logs" className={`nav-link ${isActive('/logs')}`} onClick={handleNavLinkClick}>
              Run Log
            </Link>
            <Link to="/api-keys" className={`nav-link ${isActive('/api-keys')}`} onClick={handleNavLinkClick}>
              API Keys
            </Link>
            <Link to="/downloads" className={`nav-link ${isActive('/downloads')}`} onClick={handleNavLinkClick}>
              Downloads
            </Link>
            <Link to="/profile" className={`nav-link ${isActive('/profile')}`} onClick={handleNavLinkClick}>
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
