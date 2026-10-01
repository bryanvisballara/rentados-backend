import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import Logo from './Logo';
import './PortalShell.css';

function MenuIcon({ open }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      {open ? (
        <>
          <path
            d="M6 6l12 12M18 6L6 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export default function PortalShell({
  variant = 'admin',
  brandSubtitle,
  navItems,
  user,
  onLogout,
  children,
}) {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (!navOpen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  useEffect(() => {
    if (!navOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [navOpen]);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  function closeNav() {
    setNavOpen(false);
  }

  return (
    <div className={`portal-shell portal-shell--${variant}${navOpen ? ' portal-shell--nav-open' : ''}`}>
      <header className="portal-shell__topbar">
        <button
          type="button"
          className="portal-shell__menu-btn"
          aria-expanded={navOpen}
          aria-controls="portal-shell-nav"
          onClick={() => setNavOpen((open) => !open)}
        >
          <MenuIcon open={navOpen} />
          <span className="portal-shell__menu-label">{navOpen ? 'Cerrar' : 'Menú'}</span>
        </button>
        <div className="portal-shell__topbar-brand">
          <Logo size="sm" />
          <div>
            <p className="portal-shell__topbar-title">Rentados</p>
            <p className="portal-shell__topbar-sub">{brandSubtitle}</p>
          </div>
        </div>
      </header>

      <button
        type="button"
        className="portal-shell__backdrop"
        aria-label="Cerrar menú"
        tabIndex={navOpen ? 0 : -1}
        onClick={closeNav}
      />

      <aside id="portal-shell-nav" className="portal-shell__sidebar">
        <div className="portal-shell__sidebar-brand">
          <Logo size="sm" />
          <div>
            <p className="portal-shell__sidebar-title">Rentados</p>
            <p className="portal-shell__sidebar-sub">{brandSubtitle}</p>
          </div>
        </div>

        <nav className="portal-shell__nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `portal-shell__link${isActive ? ' portal-shell__link--active' : ''}`
              }
              onClick={closeNav}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="portal-shell__footer">
          <p className="portal-shell__user">
            {user?.firstName} {user?.lastName}
          </p>
          <button type="button" className="portal-shell__logout" onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="portal-shell__main">{children}</div>
    </div>
  );
}
