import { type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path ? 'active' : '';
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
          </div>
        </div>
      </nav>
      <main className="main-content">{children}</main>
    </div>
  );
}
