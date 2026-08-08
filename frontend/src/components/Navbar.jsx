import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Navbar() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [selectedSem, setSelectedSem] = useState('Sem 5 · 2026');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'A';
  const isDark = theme === 'dark';

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <header className="navbar-header">
      <div className="navbar-container">
        {/* Brand & Term Dropdown */}
        <div className="navbar-brand-group">
          <div className="brand-logo">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <path
                d="M16 2L28 8.9282V23.0718L16 30L4 23.0718V8.9282L16 2Z"
                fill="url(#logo-grad)"
                stroke="#818cf8"
                strokeWidth="1.5"
              />
              <circle cx="16" cy="16" r="5" fill="#ffffff" />
              <defs>
                <linearGradient id="logo-grad" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#4338ca" />
                </linearGradient>
              </defs>
            </svg>
            <span className="brand-title">AttendAI</span>
          </div>

          <div className="sem-selector desktop-only">
            <select
              value={selectedSem}
              onChange={(e) => setSelectedSem(e.target.value)}
              className="sem-select"
            >
              <option value="Sem 5 · 2026">Sem 5 · 2026</option>
              <option value="Sem 4 · 2025">Sem 4 · 2025</option>
              <option value="Sem 3 · 2025">Sem 3 · 2025</option>
            </select>
          </div>
        </div>

        {/* Center Nav Links (Desktop) */}
        <nav className="navbar-links desktop-only">
          <NavLink to="/today" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Today
          </NavLink>
          <NavLink to="/subjects" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Subjects
          </NavLink>
          <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Analytics
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Settings
          </NavLink>
        </nav>

        {/* Right Tools */}
        <div className="navbar-tools">
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          <NavLink to="/settings" className="user-avatar-btn desktop-only" title="Settings">
            <div className="user-avatar">{userInitial}</div>
          </NavLink>

          {/* Mobile Hamburger Menu Button */}
          <button
            className="mobile-menu-btn mobile-only"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div className="mobile-nav-dropdown animate-fadeInDown">
          <nav className="mobile-nav-links">
            <NavLink to="/today" onClick={closeMenu} className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
              📅 Today
            </NavLink>
            <NavLink to="/subjects" onClick={closeMenu} className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
              📚 Subjects
            </NavLink>
            <NavLink to="/dashboard" onClick={closeMenu} className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
              📊 Analytics
            </NavLink>
            <NavLink to="/settings" onClick={closeMenu} className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
              ⚙️ Settings
            </NavLink>
          </nav>
        </div>
      )}
    </header>
  );
}
